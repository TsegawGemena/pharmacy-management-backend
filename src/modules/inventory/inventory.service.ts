import { AppError } from "../../middleware/errorHandler";

export async function listInventory(_query: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function addStock(_data: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function updateStock(_id: string, _data: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function getAlerts() {
  throw new AppError("Not implemented yet", 501);
}

export async function getExpiring() {
  throw new AppError("Not implemented yet", 501);
}
