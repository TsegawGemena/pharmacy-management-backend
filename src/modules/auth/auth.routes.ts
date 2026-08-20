import { Router } from "express";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { loginSchema } from "./auth.service";
import * as authController from "./auth.controller";

const router = Router();

router.post("/login", validate(loginSchema), authController.login);
router.get("/me", requireAuth, authController.me);
router.post("/logout", requireAuth, authController.logout);

export default router;
