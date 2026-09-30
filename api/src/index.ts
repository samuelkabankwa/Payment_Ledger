import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./prisma";
import workerRoutes from "./routes/worker.routes";
import ledgerRoutes from "./routes/ledger.routes";
import analyticsRoutes from "./routes/analytics.routes";
import { ExportController } from "./controllers/export.controller";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/workers", workerRoutes);
app.use("/ledger", ledgerRoutes);
app.use("/analytics", analyticsRoutes);
app.get("/backup.json", ExportController.exportBackup);

app.get("/health", async (_req: Request, res: Response) => {
  try {
    // Check DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Payment Ledger API listening on port ${port}`);
});

export default app;
