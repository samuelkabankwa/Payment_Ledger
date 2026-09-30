import { Request, Response } from "express";
import { WorkerService } from "../services/worker.service";
import { createWorkerSchema, updateWorkerSchema } from "../schemas/worker.schema";
import { WorkerStatus } from "@prisma/client";

export class WorkerController {
  static async createWorker(req: Request, res: Response) {
    try {
      const parsed = createWorkerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const worker = await WorkerService.createWorker(parsed.data);
      return res.status(201).json(worker);
    } catch (error: any) {
      console.error("Error creating worker:", error);
      return res.status(500).json({ error: error.message || "Failed to create worker" });
    }
  }

  static async getWorkers(req: Request, res: Response) {
    try {
      const { status, occupation, search } = req.query;

      let workerStatus: WorkerStatus | undefined;
      if (status && Object.values(WorkerStatus).includes(status as WorkerStatus)) {
        workerStatus = status as WorkerStatus;
      }

      const workers = await WorkerService.getWorkers({
        status: workerStatus,
        occupation: typeof occupation === "string" ? occupation : undefined,
        search: typeof search === "string" ? search : undefined,
      });

      return res.json(workers);
    } catch (error: any) {
      console.error("Error fetching workers:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch workers" });
    }
  }

  static async getWorkerById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const worker = await WorkerService.getWorkerById(id);

      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.json(worker);
    } catch (error: any) {
      console.error("Error fetching worker:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch worker" });
    }
  }

  static async updateWorker(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const parsed = updateWorkerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const worker = await WorkerService.updateWorker(id, parsed.data);
      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.json(worker);
    } catch (error: any) {
      console.error("Error updating worker:", error);
      return res.status(500).json({ error: error.message || "Failed to update worker" });
    }
  }

  static async markCleared(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const worker = await WorkerService.setStatus(id, WorkerStatus.CLEARED);
      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.json(worker);
    } catch (error: any) {
      console.error("Error marking worker cleared:", error);
      return res.status(500).json({ error: error.message || "Failed to mark worker cleared" });
    }
  }
}
