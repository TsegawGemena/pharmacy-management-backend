// Users module — profile CRUD (to be implemented)
import { AppError } from "../../middleware/errorHandler";

export async function getProfile(_userId: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function updateProfile(_userId: string, _data: unknown) {
  throw new AppError("Not implemented yet", 501);
}
