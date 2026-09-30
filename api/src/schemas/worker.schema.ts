import { z } from "zod";

export const createWorkerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().optional().nullable(),
  occupation: z.string().trim().default("Driver"),
  car_type: z.string().trim().optional().nullable(),
  number_plate: z.string().trim().optional().nullable(),
  initial_debt: z.coerce
    .number()
    .min(0, "Initial debt must be greater than or equal to 0"),
  expected_weekly_payment: z.coerce
    .number()
    .positive("Expected weekly payment must be greater than 0"),
  start_date: z.string().or(z.date()).transform((val) => new Date(val)),
  expected_end_date: z
    .string()
    .or(z.date())
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  status: z.enum(["ACTIVE", "CLEARED", "INACTIVE"]).default("ACTIVE"),
  details: z.record(z.any()).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateWorkerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  occupation: z.string().trim().optional(),
  car_type: z.string().trim().optional().nullable(),
  number_plate: z.string().trim().optional().nullable(),
  initial_debt: z.coerce
    .number()
    .min(0, "Initial debt must be greater than or equal to 0")
    .optional(),
  expected_weekly_payment: z.coerce
    .number()
    .positive("Expected weekly payment must be greater than 0")
    .optional(),
  start_date: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  expected_end_date: z
    .string()
    .or(z.date())
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  status: z.enum(["ACTIVE", "CLEARED", "INACTIVE"]).optional(),
  details: z.record(z.any()).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;
export type UpdateWorkerInput = z.infer<typeof updateWorkerSchema>;
