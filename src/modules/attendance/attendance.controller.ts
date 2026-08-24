import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as attendanceService from "./attendance.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await attendanceService.listAttendance(req.user!.userId);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function clockIn(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await attendanceService.clockIn(req.user!.userId);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function clockOut(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await attendanceService.clockOut(req.user!.userId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function activity(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await attendanceService.listActivity(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
