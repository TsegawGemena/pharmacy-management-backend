import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as categoriesService from "./categories.service";

export async function list(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await categoriesService.listCategories();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await categoriesService.createCategory(
      req.body,
      req.user?.userId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await categoriesService.deleteCategory(
      req.params.id,
      req.user?.userId
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
