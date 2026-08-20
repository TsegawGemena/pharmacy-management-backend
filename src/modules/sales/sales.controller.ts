import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as salesService from "./sales.service";

export async function posProducts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await salesService.listPosProducts(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function checkout(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await salesService.completeSale(req.body, req.user!.userId);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function hold(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await salesService.holdSale(req.body, req.user!.userId);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}
