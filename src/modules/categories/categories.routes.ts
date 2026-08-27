import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./categories.service";
import * as categoriesController from "./categories.controller";

const router = Router();

router.use(requireAuth);

router.get("/", categoriesController.list);
router.post("/", validate(createCategorySchema), categoriesController.create);
router.patch(
  "/:id",
  validate(updateCategorySchema),
  categoriesController.update
);
router.delete("/:id", categoriesController.remove);

export default router;
