import { Router } from "express";
import { LedgerController } from "../controllers/ledger.controller";
import { SmsPatternController } from "../controllers/smsPattern.controller";

const router = Router();

// SMS parsing route
router.post("/parse-sms", LedgerController.parseSms);

// Payment modes route
router.get("/payment-modes", LedgerController.getPaymentModes);

// SMS training pattern routes
router.get("/sms-patterns", SmsPatternController.getPatterns);
router.post("/sms-patterns/generate", SmsPatternController.generatePattern);
router.post("/sms-patterns/test", SmsPatternController.testPattern);
router.post("/sms-patterns", SmsPatternController.createPattern);
router.patch("/sms-patterns/:id/toggle", SmsPatternController.togglePattern);
router.delete("/sms-patterns/:id", SmsPatternController.deletePattern);

export default router;
