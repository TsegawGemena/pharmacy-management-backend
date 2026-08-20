import { AppError } from "../../middleware/errorHandler";

export async function listInvoices(_query: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function getInvoice(_id: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function updateInvoiceStatus(_id: string, _data: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function exportInvoices(_query: unknown) {
  throw new AppError("Not implemented yet", 501);
}
