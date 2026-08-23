import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { loadOpenApiSpec } from "./config/swagger";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";
import * as attendanceController from "./modules/attendance/attendance.controller";
import * as settingsController from "./modules/settings/settings.controller";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import productsRoutes from "./modules/products/products.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import adjustmentsRoutes from "./modules/adjustments/adjustments.routes";
import suppliersRoutes from "./modules/suppliers/suppliers.routes";
import purchaseOrdersRoutes from "./modules/purchase-orders/purchase-orders.routes";
import salesRoutes from "./modules/sales/sales.routes";
import invoicesRoutes from "./modules/invoices/invoices.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import settingsRoutes from "./modules/settings/settings.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "gammo-pharmacy-api",
      currency: env.currency,
      vatRate: env.vatRate,
    });
  });

  const openApiSpec = loadOpenApiSpec();
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/api/docs/openapi.json", (_req, res) => {
    res.type("application/json").sendFile("openapi.json", {
      root: `${process.cwd()}/docs`,
    });
  });
  app.get("/api/docs/openapi.yaml", (_req, res) => {
    res.type("text/yaml").sendFile("openapi.yaml", {
      root: `${process.cwd()}/docs`,
    });
  });

  // Feature routes under /api
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/adjustments", adjustmentsRoutes);
  app.use("/api/suppliers", suppliersRoutes);
  app.use("/api/purchase-orders", purchaseOrdersRoutes);
  app.use("/api", salesRoutes); // /api/pos/products, /api/sales
  app.use("/api/invoices", invoicesRoutes);
  app.use("/api", reportsRoutes); // /api/dashboard, /api/reports/*
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/settings", settingsRoutes);

  // Top-level settings-adjacent routes from the API contract
  app.get("/api/activity", requireAuth, attendanceController.activity);
  app.get("/api/organization", requireAuth, settingsController.getOrg);
  app.put("/api/organization", requireAuth, settingsController.putOrg);

  app.use(errorHandler);

  return app;
}
