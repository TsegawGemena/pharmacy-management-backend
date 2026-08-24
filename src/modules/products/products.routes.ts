import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createProductSchema, updateProductSchema } from "./products.service";
import * as productsController from "./products.controller";

const router = Router();

router.use(requireAuth);

router.get("/", productsController.list);
router.get("/:id", productsController.getById);
router.post("/", validate(createProductSchema), productsController.create);
router.patch("/:id", validate(updateProductSchema), productsController.update);
router.delete("/:id", productsController.remove);

export default router;
