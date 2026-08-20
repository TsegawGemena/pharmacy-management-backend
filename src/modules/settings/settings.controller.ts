import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as settingsService from "./settings.service";

export async function getStockAlerts(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await settingsService.getStockAlertSettings();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function putStockAlerts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await settingsService.updateStockAlertSettings(req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getExpiryAlerts(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await settingsService.getExpiryAlertSettings();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function putExpiryAlerts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await settingsService.updateExpiryAlertSettings(req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getOrg(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await settingsService.getOrganization();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function putOrg(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await settingsService.updateOrganization(req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
