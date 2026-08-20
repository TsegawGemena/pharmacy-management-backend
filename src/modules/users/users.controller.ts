import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as usersService from "./users.service";

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.getProfile(req.user!.userId);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.updateProfile(req.user!.userId, req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
