import { z } from "zod";

export const parseSmsSchema = z.object({
  message: z.string().trim().min(1, "SMS message text is required"),
});

export const createLedgerEntrySchema = z
  .object({
    type: z.enum(["PAYMENT", "DEBT_ADDED"]).default("PAYMENT"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    entry_date: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    payment_mode_id: z.string().trim().optional().nullable(),
    payment_mode: z.string().trim().optional().nullable(),
    transaction_ref: z.string().trim().min(1, "Transaction reference is required"),
    sender_name: z.string().trim().min(1, "Sender name is required"),
    source: z.enum(["SMS_PARSED", "MANUAL"]).default("MANUAL"),
    provider: z.string().trim().optional().nullable(),
    note: z.string().trim().optional().nullable(),
    remember_alias: z.boolean().optional().default(false),
    save_alias_if_new: z.boolean().optional().default(false),
  })
  .refine(
    (data) =>
      Boolean(
        (data.payment_mode_id && data.payment_mode_id.trim().length > 0) ||
          (data.payment_mode && data.payment_mode.trim().length > 0)
      ),
    {
      message: "Mode of payment is required (Momo, Cash, or Bank Transfer)",
      path: ["payment_mode"],
    }
  );

export const createAliasSchema = z.object({
  alias_name: z.string().trim().min(1, "Alias name is required"),
});

export const updateLedgerEntrySchema = z.object({
  type: z.enum(["PAYMENT", "DEBT_ADDED"]).optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0").optional(),
  entry_date: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  payment_mode_id: z.string().trim().optional().nullable(),
  payment_mode: z.string().trim().optional().nullable(),
  transaction_ref: z.string().trim().min(1, "Transaction reference cannot be empty").optional(),
  sender_name: z.string().trim().min(1, "Sender name cannot be empty").optional(),
  source: z.enum(["SMS_PARSED", "MANUAL"]).optional(),
  provider: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export type ParseSmsInput = z.infer<typeof parseSmsSchema>;
export type CreateLedgerEntryInput = z.infer<typeof createLedgerEntrySchema>;
export type UpdateLedgerEntryInput = z.infer<typeof updateLedgerEntrySchema>;
export type CreateAliasInput = z.infer<typeof createAliasSchema>;
