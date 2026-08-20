import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as inventoryService from "./inventory.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await inventoryService.listInventory(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await inventoryService.addStock(req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await inventoryService.updateStock(req.params.id, req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function alerts(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await inventoryService.getAlerts();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function expiring(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await inventoryService.getExpiring();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
