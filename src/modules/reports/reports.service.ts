import { AppError } from "../../middleware/errorHandler";

export async function getDashboard() {
  throw new AppError("Not implemented yet", 501);
}

export async function getSalesReport(_range: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function getRevenueProfit() {
  throw new AppError("Not implemented yet", 501);
}

export async function getByCategory() {
  throw new AppError("Not implemented yet", 501);
}

export async function getExpiryReport() {
  throw new AppError("Not implemented yet", 501);
}
