import { Request, Response } from "express";
import {
  parseSmsSchema,
  createLedgerEntrySchema,
  updateLedgerEntrySchema,
  createAliasSchema,
} from "../schemas/ledger.schema";
import { SmsParserService } from "../services/smsParser.service";
import { FuzzyMatchService } from "../services/fuzzyMatch.service";
import {
  LedgerService,
  DuplicateTransactionError,
} from "../services/ledger.service";

export class LedgerController {
  /**
   * Parse SMS endpoint (paste SMS -> extracted fields + suggested worker, no save)
   * POST /ledger/parse-sms
   */
  static async parseSms(req: Request, res: Response) {
    try {
      const parsedBody = parseSmsSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      // 1. Parse text using regex rules
      const extracted = await SmsParserService.parse(parsedBody.data.message);

      // 2. Fuzzy match sender against workers and aliases
      const matchResult = await FuzzyMatchService.matchSender(
        extracted.sender_name,
        extracted.sender_phone
      );

      return res.json({
        parsed: extracted,
        suggested_worker: matchResult.suggested_worker,
        all_workers: matchResult.all_workers,
      });
    } catch (error: any) {
      console.error("Error parsing SMS:", error);
      return res.status(500).json({ error: error.message || "Failed to parse SMS" });
    }
  }

  /**
   * Create ledger entry (manual or confirmed SMS)
   * POST /workers/:id/ledger
   */
  static async createEntry(req: Request, res: Response) {
    try {
      const { id: workerId } = req.params;
      const parsedBody = createLedgerEntrySchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const result = await LedgerService.createEntry(workerId, parsedBody.data);

      if ("notFound" in result) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof DuplicateTransactionError) {
        return res.status(409).json({
          error: "DUPLICATE_TRANSACTION",
          message: error.message,
          existing_entry: error.existingEntry,
        });
      }

      console.error("Error creating ledger entry:", error);
      return res.status(500).json({ error: error.message || "Failed to create ledger entry" });
    }
  }

  /**
   * Get all ledger entries for a worker
   * GET /workers/:id/ledger
   */
  static async getEntries(req: Request, res: Response) {
    try {
      const { id: workerId } = req.params;
      const entries = await LedgerService.getWorkerEntries(workerId);

      if (entries === null) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.json(entries);
    } catch (error: any) {
      console.error("Error fetching entries:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch entries" });
    }
  }

  /**
   * Get all aliases for a worker
   * GET /workers/:id/aliases
   */
  static async getAliases(req: Request, res: Response) {
    try {
      const { id: workerId } = req.params;
      const aliases = await LedgerService.getWorkerAliases(workerId);

      if (aliases === null) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.json(aliases);
    } catch (error: any) {
      console.error("Error fetching aliases:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch aliases" });
    }
  }

  /**
   * Create an alias directly
   * POST /workers/:id/aliases
   */
  static async createAlias(req: Request, res: Response) {
    try {
      const { id: workerId } = req.params;
      const parsedBody = createAliasSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const alias = await LedgerService.createWorkerAlias(
        workerId,
        parsedBody.data.alias_name
      );

      if (!alias) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.status(201).json(alias);
    } catch (error: any) {
      console.error("Error creating alias:", error);
      return res.status(500).json({ error: error.message || "Failed to create alias" });
    }
  }

  /**
   * Delete an alias
   * DELETE /workers/:id/aliases/:aliasId
   */
  static async deleteAlias(req: Request, res: Response) {
    try {
      const { id: workerId, aliasId } = req.params;
      const success = await LedgerService.deleteWorkerAlias(workerId, aliasId);

      if (!success) {
        return res.status(404).json({ error: "Alias not found for this worker" });
      }

      return res.json({ message: "Alias removed successfully" });
    } catch (error: any) {
      console.error("Error deleting alias:", error);
      return res.status(500).json({ error: error.message || "Failed to delete alias" });
    }
  }

  /**
   * Update an existing ledger entry
   * PUT /workers/:id/ledger/:entryId
   */
  static async updateEntry(req: Request, res: Response) {
    try {
      const { id: workerId, entryId } = req.params;
      const parsedBody = updateLedgerEntrySchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const result = await LedgerService.updateEntry(
        workerId,
        entryId,
        parsedBody.data
      );

      if ("notFound" in result) {
        return res.status(404).json({ error: result.message });
      }

      return res.json(result);
    } catch (error: any) {
      if (error instanceof DuplicateTransactionError) {
        return res.status(409).json({
          error: "DUPLICATE_TRANSACTION",
          message: error.message,
          existing_entry: error.existingEntry,
        });
      }

      console.error("Error updating ledger entry:", error);
      return res.status(500).json({ error: error.message || "Failed to update ledger entry" });
    }
  }

  /**
   * Delete a ledger entry
   * DELETE /workers/:id/ledger/:entryId
   */
  static async deleteEntry(req: Request, res: Response) {
    try {
      const { id: workerId, entryId } = req.params;
      const result = await LedgerService.deleteEntry(workerId, entryId);

      if ("notFound" in result) {
        return res.status(404).json({ error: result.message });
      }

      return res.json(result);
    } catch (error: any) {
      console.error("Error deleting ledger entry:", error);
      return res.status(500).json({ error: error.message || "Failed to delete ledger entry" });
    }
  }

  /**
   * Get all payment modes (Momo, Cash, Bank Transfer)
   * GET /payment-modes or GET /ledger/payment-modes
   */
  static async getPaymentModes(_req: Request, res: Response) {
    try {
      const modes = await LedgerService.getPaymentModes();
      return res.json(modes);
    } catch (error: any) {
      console.error("Error fetching payment modes:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch payment modes" });
    }
  }
}
