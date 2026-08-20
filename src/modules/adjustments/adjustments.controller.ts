import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as adjustmentsService from "./adjustments.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await adjustmentsService.listAdjustments(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await adjustmentsService.createAdjustment(
      req.body,
      req.user!.userId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}
