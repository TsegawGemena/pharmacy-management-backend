import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as authService from "./auth.service";

export async function login(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const user = await authService.getMe(req.user.userId);
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function logout(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  // JWT is stateless; client clears localStorage
  res.status(200).json({ message: "Logged out" });
}
