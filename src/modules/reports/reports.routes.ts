import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as reportsController from "./reports.controller";

const router = Router();

router.use(requireAuth);

router.get("/dashboard", reportsController.dashboard);
router.get("/reports/sales", reportsController.sales);
router.get("/reports/revenue-profit", reportsController.revenueProfit);
router.get("/reports/by-category", reportsController.byCategory);
router.get("/reports/expiry", reportsController.expiry);

export default router;
