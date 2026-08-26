import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as inventoryController from "./inventory.controller";

const router = Router();

router.use(requireAuth);

router.get("/alerts", inventoryController.alerts);
router.post("/restock", inventoryController.restock);
router.get("/expiring", inventoryController.expiring);
router.get("/", inventoryController.list);
router.post("/", inventoryController.create);
router.patch("/:id", inventoryController.update);

export default router;
