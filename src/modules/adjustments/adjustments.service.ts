import { AppError } from "../../middleware/errorHandler";

export async function listAdjustments(_query: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function createAdjustment(_data: unknown, _userId: string) {
  throw new AppError("Not implemented yet", 501);
}
