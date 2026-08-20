import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as adjustmentsController from "./adjustments.controller";

const router = Router();

router.use(requireAuth);

router.get("/", adjustmentsController.list);
router.post("/", adjustmentsController.create);

export default router;
