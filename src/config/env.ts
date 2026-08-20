import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  vatRate: Number(process.env.VAT_RATE) || 0.15,
  currency: process.env.CURRENCY || "ETB",
  tz: process.env.TZ || "Africa/Addis_Ababa",
};
