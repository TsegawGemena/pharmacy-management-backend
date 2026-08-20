import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as poService from "./purchase-orders.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await poService.listPurchaseOrders(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await poService.getPurchaseOrder(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await poService.createPurchaseOrder(req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await poService.updatePurchaseOrder(req.params.id, req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function submit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await poService.submitPurchaseOrder(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function receive(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await poService.receivePurchaseOrder(req.params.id, req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await poService.cancelPurchaseOrder(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
