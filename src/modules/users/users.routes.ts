import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as usersController from "./users.controller";

const router = Router();

router.get("/me", requireAuth, usersController.getMe);
router.patch("/me", requireAuth, usersController.updateMe);

export default router;
