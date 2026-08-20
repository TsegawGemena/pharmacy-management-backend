import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as attendanceController from "./attendance.controller";

const router = Router();

router.use(requireAuth);

router.get("/", attendanceController.list);
router.post("/clock-in", attendanceController.clockIn);
router.post("/clock-out", attendanceController.clockOut);

export default router;
