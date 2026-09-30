import { Router } from "express";
import { WorkerController } from "../controllers/worker.controller";
import { LedgerController } from "../controllers/ledger.controller";
import { ExportController } from "../controllers/export.controller";

const router = Router();

// Exports (must precede /:id)
router.get("/export-all.xlsx", ExportController.exportAllWorkers);

// Worker CRUD
router.post("/", WorkerController.createWorker);
router.get("/", WorkerController.getWorkers);
router.get("/:id", WorkerController.getWorkerById);
router.get("/:id/export.xlsx", ExportController.exportWorkerLedger);
router.put("/:id", WorkerController.updateWorker);
router.post("/:id/clear", WorkerController.markCleared);

// Worker Ledger Entries
router.post("/:id/ledger", LedgerController.createEntry);
router.get("/:id/ledger", LedgerController.getEntries);
router.put("/:id/ledger/:entryId", LedgerController.updateEntry);
router.delete("/:id/ledger/:entryId", LedgerController.deleteEntry);

// Worker Aliases
router.get("/:id/aliases", LedgerController.getAliases);
router.post("/:id/aliases", LedgerController.createAlias);
router.delete("/:id/aliases/:aliasId", LedgerController.deleteAlias);

export default router;
