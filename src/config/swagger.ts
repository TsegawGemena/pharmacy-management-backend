import fs from "fs";
import path from "path";

export function loadOpenApiSpec(): Record<string, unknown> {
  const jsonPath = path.join(process.cwd(), "docs", "openapi.json");
  const file = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(file) as Record<string, unknown>;
}
