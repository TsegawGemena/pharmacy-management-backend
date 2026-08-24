import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  updateProfileSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  updateStatusSchema,
} from "./users.service";
import * as usersController from "./users.controller";

const router = Router();

router.get("/me", requireAuth, usersController.getMe);
router.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  usersController.updateMe
);

// Admin employee management
router.get(
  "/stats",
  requireAuth,
  requireRole("Admin"),
  usersController.stats
);
router.get("/", requireAuth, requireRole("Admin"), usersController.list);
router.get("/:id", requireAuth, requireRole("Admin"), usersController.getById);
router.post(
  "/",
  requireAuth,
  requireRole("Admin"),
  validate(createEmployeeSchema),
  usersController.create
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("Admin"),
  validate(updateEmployeeSchema),
  usersController.update
);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("Admin"),
  validate(updateStatusSchema),
  usersController.updateStatus
);

export default router;
