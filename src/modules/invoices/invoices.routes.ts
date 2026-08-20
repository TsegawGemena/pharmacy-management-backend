import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as invoicesController from "./invoices.controller";

const router = Router();

router.use(requireAuth);

router.get("/export", invoicesController.exportCsv);
router.get("/", invoicesController.list);
router.get("/:id", invoicesController.getById);
router.patch("/:id/status", invoicesController.updateStatus);

export default router;
