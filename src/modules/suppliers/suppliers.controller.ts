import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as suppliersService from "./suppliers.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await suppliersService.listSuppliers(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await suppliersService.createSupplier(
      req.body,
      req.user?.userId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await suppliersService.updateSupplier(
      req.params.id,
      req.body,
      req.user?.userId
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await suppliersService.deleteSupplier(
      req.params.id,
      req.user?.userId
    );
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
