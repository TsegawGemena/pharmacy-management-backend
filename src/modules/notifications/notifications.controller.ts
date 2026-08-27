import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as notificationsService from "./notifications.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await notificationsService.listNotifications(req.user!.userId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await notificationsService.getUnreadCount(req.user!.userId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function markRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await notificationsService.markNotificationRead(
      req.params.id,
      req.user!.userId
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await notificationsService.markAllNotificationsRead(
      req.user!.userId
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
