import { prisma } from "../prisma";
import { CreateWorkerInput, UpdateWorkerInput } from "../schemas/worker.schema";
import {
  calculateSuggestedEndDate,
  computeWeeklyPaceAndConsistency,
  attachPaymentNumbersAndRunningBalance,
} from "../utils/calculations";
import { WorkerStatus } from "@prisma/client";

export class WorkerService {
  /**
   * Create a new worker.
   * Auto-suggests expected_end_date if not provided.
   */
  static async createWorker(data: CreateWorkerInput) {
    const expectedEndDate =
      data.expected_end_date ??
      calculateSuggestedEndDate(
        data.start_date,
        data.initial_debt,
        data.expected_weekly_payment
      );

    const worker = await prisma.worker.create({
      data: {
        name: data.name,
        phone: data.phone,
        occupation: data.occupation,
        car_type: data.car_type,
        number_plate: data.number_plate,
        initial_debt: data.initial_debt,
        expected_weekly_payment: data.expected_weekly_payment,
        start_date: data.start_date,
        expected_end_date: expectedEndDate,
        status: data.status,
        details: data.details || undefined,
        notes: data.notes,
      },
      include: {
        aliases: true,
      },
    });

    const metrics = computeWeeklyPaceAndConsistency(worker, []);

    return {
      ...worker,
      ...metrics,
    };
  }

  /**
   * Get all workers with computed balances and weekly pace/consistency metrics.
   */
  static async getWorkers(filters?: {
    status?: WorkerStatus;
    occupation?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.occupation) {
      where.occupation = { equals: filters.occupation, mode: "insensitive" };
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
        { number_plate: { contains: filters.search, mode: "insensitive" } },
        { car_type: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const workers = await prisma.worker.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        aliases: true,
        ledger_entries: {
          select: {
            id: true,
            type: true,
            amount: true,
            entry_date: true,
            created_at: true,
          },
        },
      },
    });

    return workers.map((worker) => {
      const metrics = computeWeeklyPaceAndConsistency(worker, worker.ledger_entries);
      const { ledger_entries, ...rest } = worker;
      return {
        ...rest,
        ...metrics,
      };
    });
  }

  /**
   * Get single worker by ID with dynamically numbered ledger entries,
   * running balance, and weekly pace/consistency metrics.
   */
  static async getWorkerById(id: string) {
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        aliases: true,
        ledger_entries: {
          orderBy: [{ entry_date: "asc" }, { created_at: "asc" }],
        },
      },
    });

    if (!worker) {
      return null;
    }

    const metrics = computeWeeklyPaceAndConsistency(worker, worker.ledger_entries);
    const numberedEntries = attachPaymentNumbersAndRunningBalance(
      worker.initial_debt,
      worker.ledger_entries
    );

    return {
      ...worker,
      ...metrics,
      ledger_entries: numberedEntries,
    };
  }

  /**
   * Update worker details.
   */
  static async updateWorker(id: string, data: UpdateWorkerInput) {
    const existing = await prisma.worker.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.occupation !== undefined) updateData.occupation = data.occupation;
    if (data.car_type !== undefined) updateData.car_type = data.car_type;
    if (data.number_plate !== undefined) updateData.number_plate = data.number_plate;
    if (data.initial_debt !== undefined) updateData.initial_debt = data.initial_debt;
    if (data.expected_weekly_payment !== undefined) {
      updateData.expected_weekly_payment = data.expected_weekly_payment;
    }
    if (data.start_date !== undefined) updateData.start_date = data.start_date;
    if (data.expected_end_date !== undefined) updateData.expected_end_date = data.expected_end_date;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.details !== undefined) updateData.details = data.details || undefined;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.worker.update({
      where: { id },
      data: updateData,
      include: {
        aliases: true,
        ledger_entries: {
          select: {
            id: true,
            type: true,
            amount: true,
            entry_date: true,
            created_at: true,
          },
        },
      },
    });

    const metrics = computeWeeklyPaceAndConsistency(updated, updated.ledger_entries);
    const { ledger_entries, ...rest } = updated;

    return {
      ...rest,
      ...metrics,
    };
  }

  /**
   * Update status (e.g. mark CLEARED, INACTIVE, ACTIVE).
   */
  static async setStatus(id: string, status: WorkerStatus) {
    return this.updateWorker(id, { status });
  }
}
