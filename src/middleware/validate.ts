import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type Target = "body" | "query" | "params";

export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const message = result.error.errors[0]?.message || "Validation failed";
      res.status(400).json({ message });
      return;
    }
    req[target] = result.data;
    next();
  };
}
