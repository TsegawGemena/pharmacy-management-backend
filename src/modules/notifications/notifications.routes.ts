import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as notificationsController from "./notifications.controller";

const router = Router();

router.use(requireAuth);

router.get("/", notificationsController.list);
router.get("/unread-count", notificationsController.unreadCount);
router.post("/read-all", notificationsController.markAllRead);
router.post("/:id/read", notificationsController.markRead);

export default router;
