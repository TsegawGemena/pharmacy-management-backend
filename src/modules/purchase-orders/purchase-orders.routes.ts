import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as poController from "./purchase-orders.controller";

const router = Router();

router.use(requireAuth);

router.get("/", poController.list);
router.get("/:id", poController.getById);
router.post("/", poController.create);
router.patch("/:id", poController.update);
router.post("/:id/submit", poController.submit);
router.post("/:id/receive", poController.receive);
router.post("/:id/cancel", poController.cancel);

export default router;
