import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as settingsController from "./settings.controller";

const router = Router();

router.use(requireAuth);

router.get("/stock-alerts", settingsController.getStockAlerts);
router.put("/stock-alerts", settingsController.putStockAlerts);
router.get("/expiry-alerts", settingsController.getExpiryAlerts);
router.put("/expiry-alerts", settingsController.putExpiryAlerts);

export default router;
