import { AppError } from "../../middleware/errorHandler";

export async function listProducts(_query: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function getProduct(_id: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function createProduct(_data: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function updateProduct(_id: string, _data: unknown) {
  throw new AppError("Not implemented yet", 501);
}

export async function deleteProduct(_id: string) {
  throw new AppError("Not implemented yet", 501);
}
