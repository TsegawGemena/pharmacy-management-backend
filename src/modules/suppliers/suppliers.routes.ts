import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as suppliersController from "./suppliers.controller";

const router = Router();

router.use(requireAuth);

router.get("/", suppliersController.list);
router.post("/", suppliersController.create);
router.patch("/:id", suppliersController.update);
router.delete("/:id", suppliersController.remove);

export default router;
