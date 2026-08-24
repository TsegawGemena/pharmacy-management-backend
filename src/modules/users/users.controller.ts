import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as usersService from "./users.service";

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.getProfile(req.user!.userId);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.updateProfile(req.user!.userId, req.body);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await usersService.listEmployees(
      req.query as Record<string, unknown>
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.getEmployee(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.createEmployee(
      req.body,
      req.user?.userId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.updateEmployee(
      req.params.id,
      req.body,
      req.user?.userId
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await usersService.updateEmployeeStatus(
      req.params.id,
      req.body.status,
      req.user?.userId
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function stats(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await usersService.getEmployeeStats();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
