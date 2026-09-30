import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";

const router = Router();

router.get("/leaderboard", AnalyticsController.getLeaderboard);
router.get("/worker/:id", AnalyticsController.getWorkerAnalytics);
router.get("/occupation/:occupation", AnalyticsController.getOccupationAnalytics);
router.get("/overview", AnalyticsController.getOverview);

export default router;
