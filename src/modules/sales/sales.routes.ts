import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as salesController from "./sales.controller";

const router = Router();

router.use(requireAuth);

router.get("/pos/products", salesController.posProducts);
router.post("/sales", salesController.checkout);
router.post("/sales/hold", salesController.hold);

export default router;
