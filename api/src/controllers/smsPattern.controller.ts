import { Request, Response } from "express";
import { prisma } from "../prisma";
import { SmsParserService } from "../services/smsParser.service";
import { z } from "zod";

const createPatternSchema = z.object({
  name: z.string().trim().min(1, "Pattern name is required"),
  provider: z.string().trim().default("MTN"),
  example_sms: z.string().trim().min(1, "Example SMS is required"),
  pattern_regex: z.string().trim().min(1, "Regex pattern is required"),
  amount_group: z.coerce.number().optional().nullable(),
  ref_group: z.coerce.number().optional().nullable(),
  sender_group: z.coerce.number().optional().nullable(),
  phone_group: z.coerce.number().optional().nullable(),
  date_group: z.coerce.number().optional().nullable(),
  note_group: z.coerce.number().optional().nullable(),
  date_missing: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

const generatePatternSchema = z.object({
  example_sms: z.string().trim().min(1, "Example SMS is required"),
  provider: z.string().trim().default("MTN"),
  amount: z.string().or(z.number()).optional().nullable(),
  transaction_ref: z.string().optional().nullable(),
  sender_name: z.string().optional().nullable(),
  sender_phone: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

const testPatternSchema = z.object({
  test_sms: z.string().trim().min(1, "Test SMS is required"),
  pattern_regex: z.string().trim().min(1, "Regex is required"),
  amount_group: z.coerce.number().optional().nullable(),
  ref_group: z.coerce.number().optional().nullable(),
  sender_group: z.coerce.number().optional().nullable(),
  phone_group: z.coerce.number().optional().nullable(),
  date_group: z.coerce.number().optional().nullable(),
  note_group: z.coerce.number().optional().nullable(),
  date_missing: z.boolean().default(false),
  provider: z.string().optional().nullable(),
});

export class SmsPatternController {
  /**
   * GET /ledger/sms-patterns
   */
  static async getPatterns(_req: Request, res: Response) {
    try {
      const patterns = await prisma.smsPattern.findMany({
        orderBy: { created_at: "desc" },
      });
      return res.json(patterns);
    } catch (error: any) {
      console.error("Error fetching SMS patterns:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch patterns" });
    }
  }

  /**
   * POST /ledger/sms-patterns/generate
   */
  static async generatePattern(req: Request, res: Response) {
    try {
      const parsed = generatePatternSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { example_sms, provider, ...extracted } = parsed.data;
      const result = SmsParserService.generateRegexPattern(example_sms, extracted);

      return res.json({
        ...result,
        provider,
      });
    } catch (error: any) {
      console.error("Error generating pattern:", error);
      return res.status(500).json({ error: error.message || "Failed to generate pattern" });
    }
  }

  /**
   * POST /ledger/sms-patterns/test
   */
  static async testPattern(req: Request, res: Response) {
    try {
      const parsed = testPatternSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { test_sms, pattern_regex, ...groupMap } = parsed.data;
      const result = SmsParserService.testPattern(test_sms, pattern_regex, {
        ...groupMap,
        provider: groupMap.provider || undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error("Error testing pattern:", error);
      return res.status(500).json({ error: error.message || "Failed to test pattern" });
    }
  }

  /**
   * POST /ledger/sms-patterns
   */
  static async createPattern(req: Request, res: Response) {
    try {
      const parsed = createPatternSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // Verify regex compiles
      try {
        new RegExp(parsed.data.pattern_regex, "i");
      } catch (e: any) {
        return res.status(400).json({ error: `Invalid regular expression: ${e.message}` });
      }

      const created = await prisma.smsPattern.create({
        data: parsed.data,
      });

      return res.status(201).json(created);
    } catch (error: any) {
      console.error("Error saving SMS pattern:", error);
      return res.status(500).json({ error: error.message || "Failed to save pattern" });
    }
  }

  /**
   * PATCH /ledger/sms-patterns/:id/toggle
   */
  static async togglePattern(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pattern = await prisma.smsPattern.findUnique({ where: { id } });
      if (!pattern) {
        return res.status(404).json({ error: "Pattern not found" });
      }

      const updated = await prisma.smsPattern.update({
        where: { id },
        data: { is_active: !pattern.is_active },
      });

      return res.json(updated);
    } catch (error: any) {
      console.error("Error toggling SMS pattern:", error);
      return res.status(500).json({ error: error.message || "Failed to toggle pattern" });
    }
  }

  /**
   * DELETE /ledger/sms-patterns/:id
   */
  static async deletePattern(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.smsPattern.delete({
        where: { id },
      });
      return res.json({ success: true, deleted_id: id });
    } catch (error: any) {
      console.error("Error deleting SMS pattern:", error);
      return res.status(500).json({ error: error.message || "Failed to delete pattern" });
    }
  }
}
