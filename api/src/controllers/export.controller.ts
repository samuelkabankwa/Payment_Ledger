import { Request, Response } from "express";
import { ExcelService } from "../services/excel.service";
import { BackupService } from "../services/backup.service";

export class ExportController {
  /**
   * Export individual worker statement as Excel
   * GET /workers/:id/export.xlsx
   */
  static async exportWorkerLedger(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const buffer = await ExcelService.generateWorkerStatement(id);

      if (!buffer) {
        return res.status(404).json({ error: "Worker not found" });
      }

      const filename = `worker_statement_${id.slice(-6)}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error: any) {
      console.error("Error generating worker statement export:", error);
      return res.status(500).json({ error: error.message || "Failed to generate Excel export" });
    }
  }

  /**
   * Export all workers summary as Excel
   * GET /workers/export-all.xlsx
   */
  static async exportAllWorkers(_req: Request, res: Response) {
    try {
      const buffer = await ExcelService.generateAllWorkersSummary();
      const filename = `all_workers_summary_${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error: any) {
      console.error("Error generating all-workers summary export:", error);
      return res.status(500).json({ error: error.message || "Failed to generate summary export" });
    }
  }

  /**
   * One-click full database dump to JSON
   * GET /backup.json
   */
  static async exportBackup(_req: Request, res: Response) {
    try {
      const backup = await BackupService.exportFullBackup();
      const filename = `payment_ledger_backup_${new Date().toISOString().slice(0, 10)}.json`;

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.json(backup);
    } catch (error: any) {
      console.error("Error generating backup:", error);
      return res.status(500).json({ error: error.message || "Failed to export backup" });
    }
  }
}
