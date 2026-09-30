import { prisma } from "../prisma";
import { CreateLedgerEntryInput } from "../schemas/ledger.schema";
import {
  computeWorkerBalance,
  computeWeeklyPaceAndConsistency,
  attachPaymentNumbersAndRunningBalance,
} from "../utils/calculations";

export class DuplicateTransactionError extends Error {
  existingEntry: {
    id: string;
    worker_id: string;
    worker_name: string;
    entry_date: Date;
    amount: any;
    transaction_ref: string;
  };

  constructor(existing: any) {
    super(`Transaction reference ${existing.transaction_ref} already recorded`);
    this.name = "DuplicateTransactionError";
    this.existingEntry = {
      id: existing.id,
      worker_id: existing.worker_id,
      worker_name: existing.worker.name,
      entry_date: existing.entry_date,
      amount: existing.amount,
      transaction_ref: existing.transaction_ref,
    };
  }
}

export class LedgerService {
  /**
   * Create a new ledger entry with duplicate transaction_ref guard
   * and optional alias remembering.
   */
  static async createEntry(workerId: string, data: CreateLedgerEntryInput) {
    // 1. Verify worker exists
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
    });
    if (!worker) {
      return { notFound: true };
    }

    // 2. Duplicate transaction guard
    if (data.transaction_ref && data.transaction_ref.trim().length > 0) {
      const existing = await prisma.ledgerEntry.findUnique({
        where: { transaction_ref: data.transaction_ref.trim() },
        include: { worker: { select: { name: true } } },
      });

      if (existing) {
        throw new DuplicateTransactionError(existing);
      }
    }

    // 3. Remember alias if requested
    if (data.remember_alias && data.sender_name && data.sender_name.trim().length > 0) {
      const cleanSender = data.sender_name.trim();
      const isSameAsWorkerName =
        cleanSender.toLowerCase() === worker.name.toLowerCase();

      if (!isSameAsWorkerName) {
        const existingAlias = await prisma.workerAlias.findFirst({
          where: {
            worker_id: workerId,
            alias_name: { equals: cleanSender, mode: "insensitive" },
          },
        });

        if (!existingAlias) {
          await prisma.workerAlias.create({
            data: {
              worker_id: workerId,
              alias_name: cleanSender,
            },
          });
        }
      }
    }

    // 4. Resolve payment_mode_id
    let paymentModeId: string | null = null;
    if (data.payment_mode_id) {
      paymentModeId = data.payment_mode_id;
    } else if (data.payment_mode) {
      const mode = await prisma.paymentMode.upsert({
        where: { name: data.payment_mode },
        update: {},
        create: { name: data.payment_mode },
      });
      paymentModeId = mode.id;
    } else {
      const defaultMode = await prisma.paymentMode.upsert({
        where: { name: "Momo" },
        update: {},
        create: { name: "Momo" },
      });
      paymentModeId = defaultMode.id;
    }

    // 5. Create LedgerEntry
    const entry = await prisma.ledgerEntry.create({
      data: {
        worker_id: workerId,
        payment_mode_id: paymentModeId,
        type: data.type,
        amount: data.amount,
        entry_date: data.entry_date,
        transaction_ref: data.transaction_ref?.trim() || null,
        sender_name: data.sender_name?.trim() || null,
        source: data.source,
        provider: data.provider || null,
        note: data.note?.trim() || null,
      },
      include: {
        payment_mode: true,
      },
    });

    // 6. Compute updated worker balance & weekly metrics
    const allEntries = await prisma.ledgerEntry.findMany({
      where: { worker_id: workerId },
      select: { id: true, type: true, amount: true, entry_date: true, created_at: true },
    });
    const metrics = computeWeeklyPaceAndConsistency(worker, allEntries);

    return {
      entry,
      worker_balance: metrics,
    };
  }

  /**
   * Get all payment modes (Momo, Cash, Bank Transfer)
   */
  static async getPaymentModes() {
    return prisma.paymentMode.findMany({
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get all ledger entries for a worker with dynamic payment_number and running_balance
   */
  static async getWorkerEntries(workerId: string) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return null;

    const entries = await prisma.ledgerEntry.findMany({
      where: { worker_id: workerId },
      include: {
        payment_mode: true,
      },
      orderBy: [{ entry_date: "asc" }, { created_at: "asc" }],
    });

    return attachPaymentNumbersAndRunningBalance(worker.initial_debt, entries);
  }

  /**
   * Update an existing ledger entry.
   * Checks transaction_ref uniqueness if updated.
   */
  static async updateEntry(
    workerId: string,
    entryId: string,
    data: any
  ) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return { notFound: true, message: "Worker not found" };

    const existingEntry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, worker_id: workerId },
    });
    if (!existingEntry) return { notFound: true, message: "Ledger entry not found" };

    // Duplicate transaction guard if transaction_ref changed
    if (
      data.transaction_ref !== undefined &&
      data.transaction_ref !== null &&
      data.transaction_ref.trim() !== "" &&
      data.transaction_ref.trim() !== existingEntry.transaction_ref
    ) {
      const duplicate = await prisma.ledgerEntry.findUnique({
        where: { transaction_ref: data.transaction_ref.trim() },
        include: { worker: { select: { name: true } } },
      });

      if (duplicate && duplicate.id !== entryId) {
        throw new DuplicateTransactionError(duplicate);
      }
    }

    const updateData: any = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.entry_date !== undefined) updateData.entry_date = data.entry_date;
    if (data.transaction_ref !== undefined) {
      updateData.transaction_ref = data.transaction_ref?.trim() || null;
    }
    if (data.sender_name !== undefined) {
      updateData.sender_name = data.sender_name?.trim() || null;
    }
    if (data.source !== undefined) updateData.source = data.source;
    if (data.provider !== undefined) updateData.provider = data.provider || null;
    if (data.note !== undefined) updateData.note = data.note?.trim() || null;

    if (data.payment_mode_id !== undefined) {
      updateData.payment_mode_id = data.payment_mode_id;
    } else if (data.payment_mode !== undefined) {
      const mode = await prisma.paymentMode.upsert({
        where: { name: data.payment_mode },
        update: {},
        create: { name: data.payment_mode },
      });
      updateData.payment_mode_id = mode.id;
    }

    const updated = await prisma.ledgerEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        payment_mode: true,
      },
    });

    const allEntries = await prisma.ledgerEntry.findMany({
      where: { worker_id: workerId },
      select: { id: true, type: true, amount: true, entry_date: true, created_at: true },
    });
    const metrics = computeWeeklyPaceAndConsistency(worker, allEntries);

    return {
      entry: updated,
      worker_balance: metrics,
    };
  }

  /**
   * Delete a ledger entry and recompute balance.
   */
  static async deleteEntry(workerId: string, entryId: string) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return { notFound: true, message: "Worker not found" };

    const existingEntry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, worker_id: workerId },
    });
    if (!existingEntry) return { notFound: true, message: "Ledger entry not found" };

    await prisma.ledgerEntry.delete({
      where: { id: entryId },
    });

    const allEntries = await prisma.ledgerEntry.findMany({
      where: { worker_id: workerId },
      select: { id: true, type: true, amount: true, entry_date: true, created_at: true },
    });
    const metrics = computeWeeklyPaceAndConsistency(worker, allEntries);

    return {
      success: true,
      deleted_id: entryId,
      worker_balance: metrics,
    };
  }

  /**
   * Get aliases for a worker
   */
  static async getWorkerAliases(workerId: string) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return null;

    return prisma.workerAlias.findMany({
      where: { worker_id: workerId },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Add alias for a worker
   */
  static async createWorkerAlias(workerId: string, aliasName: string) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return null;

    const cleanAlias = aliasName.trim();
    const existing = await prisma.workerAlias.findFirst({
      where: {
        worker_id: workerId,
        alias_name: { equals: cleanAlias, mode: "insensitive" },
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.workerAlias.create({
      data: {
        worker_id: workerId,
        alias_name: cleanAlias,
      },
    });
  }

  /**
   * Delete an alias
   */
  static async deleteWorkerAlias(workerId: string, aliasId: string) {
    const alias = await prisma.workerAlias.findFirst({
      where: { id: aliasId, worker_id: workerId },
    });
    if (!alias) return false;

    await prisma.workerAlias.delete({
      where: { id: aliasId },
    });
    return true;
  }
}
