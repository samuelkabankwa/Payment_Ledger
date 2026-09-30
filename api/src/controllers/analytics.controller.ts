import { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { WorkerStatus } from "@prisma/client";

export class AnalyticsController {
  /**
   * GET /analytics/leaderboard
   */
  static async getLeaderboard(req: Request, res: Response) {
    try {
      const { sortBy, occupation, status } = req.query;

      let workerStatus: WorkerStatus | undefined;
      if (status && Object.values(WorkerStatus).includes(status as WorkerStatus)) {
        workerStatus = status as WorkerStatus;
      }

      const leaderboard = await AnalyticsService.getLeaderboard({
        sortBy: sortBy === "consistency" ? "consistency" : "pace",
        occupation: typeof occupation === "string" ? occupation : undefined,
        status: workerStatus,
      });

      return res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching leaderboard:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch leaderboard" });
    }
  }

  /**
   * GET /analytics/worker/:id
   */
  static async getWorkerAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const analytics = await AnalyticsService.getWorkerAnalytics(id);

      if (!analytics) {
        return res.status(404).json({ error: "Worker not found" });
      }

      return res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching worker analytics:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch worker analytics" });
    }
  }

  /**
   * GET /analytics/occupation/:occupation
   */
  static async getOccupationAnalytics(req: Request, res: Response) {
    try {
      const { occupation } = req.params;
      const analytics = await AnalyticsService.getOccupationAnalytics(occupation);
      return res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching occupation analytics:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch occupation analytics" });
    }
  }

  /**
   * GET /analytics/overview
   */
  static async getOverview(req: Request, res: Response) {
    try {
      const overview = await AnalyticsService.getOverviewAnalytics();
      return res.json(overview);
    } catch (error: any) {
      console.error("Error fetching overview analytics:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch overview analytics" });
    }
  }
}
