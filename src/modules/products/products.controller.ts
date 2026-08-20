import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as productsService from "./products.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await productsService.listProducts(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await productsService.getProduct(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await productsService.createProduct(req.body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await productsService.updateProduct(req.params.id, req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await productsService.deleteProduct(req.params.id);
    res.status(200).json({ message: "Product deactivated" });
  } catch (err) {
    next(err);
  }
}
