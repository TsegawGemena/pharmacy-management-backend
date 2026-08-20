import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as invoicesService from "./invoices.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await invoicesService.listInvoices(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await invoicesService.getInvoice(req.params.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await invoicesService.updateInvoiceStatus(
      req.params.id,
      req.body
    );
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await invoicesService.exportInvoices(req.query);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
