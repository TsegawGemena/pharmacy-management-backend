import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as reportsService from "./reports.service";

export async function dashboard(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await reportsService.getDashboard();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function sales(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const range = String(req.query.range || "week");
    const data = await reportsService.getSalesReport(range);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function revenueProfit(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await reportsService.getRevenueProfit();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function byCategory(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await reportsService.getByCategory();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function expiry(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await reportsService.getExpiryReport();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
