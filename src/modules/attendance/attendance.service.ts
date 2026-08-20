import { AppError } from "../../middleware/errorHandler";

export async function listAttendance(_userId: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function clockIn(_userId: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function clockOut(_userId: string) {
  throw new AppError("Not implemented yet", 501);
}

export async function listActivity() {
  throw new AppError("Not implemented yet", 501);
}
