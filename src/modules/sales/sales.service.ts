import { AppError } from "../../middleware/errorHandler";

export async function listPosProducts(_query: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function completeSale(_data: unknown, _userId: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function holdSale(_data: unknown, _userId: string) {
  throw new AppError("Not implemented yet", 501);
}
