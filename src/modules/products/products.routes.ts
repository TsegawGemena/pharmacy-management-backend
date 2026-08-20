import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as productsController from "./products.controller";

const router = Router();

router.use(requireAuth);

router.get("/", productsController.list);
router.get("/:id", productsController.getById);
router.post("/", productsController.create);
router.patch("/:id", productsController.update);
router.delete("/:id", productsController.remove);

export default router;
