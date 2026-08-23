import fs from "fs";
import path from "path";

const errorRef = { $ref: "#/components/schemas/Error" };
const bearer = [{ bearerAuth: [] }];
const json = (schema) => ({
  "application/json": { schema },
});

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Gammo Pharmacy API",
    description:
      "REST API for Gammo Pharmacy Clinical Management System.\n\n" +
      "- Auth: JWT Bearer token on protected routes\n" +
      "- Currency: ETB | VAT: 15%\n" +
      "- ✅ Live endpoints work now\n" +
      "- 🟡 Planned endpoints return 501 until implemented",
    version: "1.0.0",
    contact: { name: "Gamo Development Association" },
  },
  servers: [
    { url: "http://localhost:5000/api", description: "Local development" },
    {
      url: "https://YOUR-DEPLOYED-URL/api",
      description: "Production (replace after deploy)",
    },
  ],
  tags: [
    { name: "Health", description: "API health check" },
    { name: "Auth", description: "Authentication (✅ live)" },
    { name: "Users", description: "Staff profile (🟡 planned)" },
    { name: "Products", description: "Product catalog (🟡 planned)" },
    { name: "Inventory", description: "Stock & batches (🟡 planned)" },
    { name: "Adjustments", description: "Stock corrections (🟡 planned)" },
    { name: "Suppliers", description: "Supplier directory (🟡 planned)" },
    { name: "Purchase Orders", description: "Procurement (🟡 planned)" },
    { name: "POS / Sales", description: "Point of sale (🟡 planned)" },
    { name: "Invoices", description: "Billing records (🟡 planned)" },
    { name: "Reports", description: "Dashboard & analytics (🟡 planned)" },
    { name: "Attendance", description: "Clock in/out (🟡 planned)" },
    { name: "Settings", description: "Alerts & organization (🟡 planned)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT from POST /auth/login. Format: Bearer <token>",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { message: { type: "string" } },
        example: { message: "Invalid employee ID or password" },
      },
      MessageResponse: {
        type: "object",
        properties: { message: { type: "string" } },
        example: { message: "Operation successful" },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 100 },
          totalPages: { type: "integer", example: 5 },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          employeeId: { type: "string", example: "EMP-001" },
          name: { type: "string", example: "Abebe Kebede" },
          email: { type: "string", nullable: true, example: "abebe@gammo.et" },
          role: { type: "string", enum: ["Admin", "Pharmacist"] },
          phone: { type: "string", nullable: true },
          status: { type: "string", enum: ["Active", "Inactive"] },
          avatarUrl: { type: "string", nullable: true },
          dateJoined: { type: "string", format: "date-time" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["employeeId", "password"],
        properties: {
          employeeId: { type: "string", example: "EMP-001" },
          password: { type: "string", example: "Pharmacy@123" },
        },
        example: { employeeId: "EMP-001", password: "Pharmacy@123" },
      },
      LoginResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Login successful" },
          token: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
        },
        example: {
          message: "Login successful",
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          user: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            employeeId: "EMP-001",
            name: "Abebe Kebede",
            email: "abebe@gammo.et",
            role: "Admin",
          },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string" },
          newPassword: { type: "string", minLength: 8 },
        },
        example: {
          currentPassword: "Pharmacy@123",
          newPassword: "NewSecurePass1",
        },
      },
      ForgotPasswordRequest: {
        type: "object",
        required: ["employeeId"],
        properties: {
          employeeId: { type: "string", example: "EMP-001" },
          email: { type: "string", format: "email" },
        },
        example: { employeeId: "EMP-001", email: "abebe@gammo.et" },
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          fullName: { type: "string" },
          phone: { type: "string", example: "+251 911 000 000" },
          email: { type: "string", format: "email" },
        },
        example: {
          fullName: "Abebe Kebede",
          phone: "+251 911 000 000",
          email: "abebe@gammo.et",
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "Amoxicillin 500mg Caps" },
          category: { type: "string", example: "Antibiotics" },
          sku: { type: "string", example: "AMX-001" },
          manufacturer: { type: "string", example: "GSK" },
          price: { type: "string", example: "120.00" },
          stock: { type: "integer", example: 145 },
          status: { type: "string", enum: ["Active", "Inactive"] },
        },
      },
      InventoryItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          batchNo: { type: "string", example: "BX-7821" },
          stock: { type: "integer" },
          minStock: { type: "integer" },
          maxStock: { type: "integer" },
          expiryDate: { type: "string", format: "date" },
          isExpiringSoon: { type: "boolean" },
          unitPrice: { type: "string", example: "245.00" },
        },
      },
      Adjustment: {
        type: "object",
        properties: {
          id: { type: "string", example: "#ADJ-001" },
          date: { type: "string", format: "date" },
          productName: { type: "string" },
          sku: { type: "string" },
          type: {
            type: "string",
            enum: [
              "Expired",
              "Inventory Count",
              "Damaged",
              "Theft / Lost",
              "Return to Supplier",
            ],
          },
          qtyChange: { type: "integer" },
          adjustedBy: { type: "string" },
          status: { type: "string", enum: ["Completed", "Pending Review"] },
          reason: { type: "string" },
        },
      },
      Supplier: {
        type: "object",
        properties: {
          id: { type: "string", example: "SUP-001" },
          name: { type: "string" },
          category: {
            type: "string",
            enum: ["Medications", "Medical Supplies", "Equipment", "Diagnostics"],
          },
          contact: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
          },
          address: { type: "string" },
          rating: { type: "integer", minimum: 1, maximum: 5 },
          status: { type: "string", enum: ["Active", "Inactive"] },
        },
      },
      PurchaseOrder: {
        type: "object",
        properties: {
          id: { type: "string", example: "PO-2023-1045" },
          supplier: {
            type: "object",
            properties: {
              name: { type: "string" },
              avatar: { type: "string" },
            },
          },
          dateOrdered: { type: "string", format: "date" },
          expectedDelivery: { type: "string", format: "date" },
          isDelayed: { type: "boolean" },
          total: { type: "string", example: "45200.00" },
          status: {
            type: "string",
            enum: ["DRAFT", "PENDING", "SHIPPED", "RECEIVED", "CANCELLED"],
          },
        },
      },
      SaleCheckoutRequest: {
        type: "object",
        required: ["items", "paymentMethod"],
        properties: {
          customerName: { type: "string", example: "Walking Customer" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                name: { type: "string" },
                price: { type: "number" },
                qty: { type: "integer" },
              },
            },
          },
          paymentMethod: {
            type: "string",
            enum: ["cash", "telebirr", "card"],
          },
          amountTendered: { type: "number" },
          notes: { type: "string" },
        },
        example: {
          customerName: "Walking Customer",
          items: [
            { productId: "1", name: "Paracetamol 500mg Tabs", price: 45, qty: 2 },
          ],
          paymentMethod: "cash",
          amountTendered: 200,
          notes: "",
        },
      },
      SaleCheckoutResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          invoiceNumber: { type: "string", example: "INV-2023-0892" },
          subtotal: { type: "number" },
          vat: { type: "number" },
          total: { type: "number" },
          changeDue: { type: "number" },
          paymentMethod: { type: "string" },
        },
        example: {
          message: "Sale completed",
          invoiceNumber: "INV-2023-0892",
          subtotal: 90,
          vat: 13.5,
          total: 103.5,
          changeDue: 96.5,
          paymentMethod: "cash",
        },
      },
      Invoice: {
        type: "object",
        properties: {
          id: { type: "string", example: "INV-2023-0891" },
          customerName: { type: "string" },
          date: { type: "string", format: "date" },
          amount: { type: "string", example: "4500.00" },
          paymentMethod: {
            type: "string",
            enum: ["Cash", "Card", "Bank Transfer", "Telebirr"],
          },
          status: {
            type: "string",
            enum: ["Paid", "Pending", "Overdue", "Cancelled"],
          },
        },
      },
      Dashboard: {
        type: "object",
        properties: {
          stats: {
            type: "object",
            properties: {
              todaySales: { type: "number" },
              totalProducts: { type: "integer" },
              lowStockCount: { type: "integer" },
              expiringSoonCount: { type: "integer" },
            },
          },
          salesOverview: { type: "object" },
          recentSales: { type: "array", items: { type: "object" } },
          expiryAlerts: { type: "array", items: { type: "object" } },
          lowStockAlerts: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
  paths: {},
};

function ok200(schema, description = "Success", example) {
  const content = { schema };
  if (example) content.example = example;
  return {
    "200": { description, content: json(content.schema ? schema : schema) },
  };
}

function planned(summary, tag, method = "get", extra = {}) {
  return {
    tags: [tag],
    summary: `${summary} (🟡 planned)`,
    security: bearer,
    responses: {
      "501": {
        description: "Not implemented yet",
        content: json({
          type: "object",
          properties: { message: { type: "string" } },
          example: { message: "Not implemented yet" },
        }),
      },
    },
    ...extra,
  };
}

function live(summary, tag, responses, extra = {}) {
  return { tags: [tag], summary, responses, ...extra };
}

// --- Health ---
spec.paths["/health"] = {
  get: live("Health check", "Health", {
    "200": {
      description: "API is running",
      content: json({
        type: "object",
        properties: {
          status: { type: "string" },
          service: { type: "string" },
          currency: { type: "string" },
          vatRate: { type: "number" },
        },
        example: {
          status: "ok",
          service: "gammo-pharmacy-api",
          currency: "ETB",
          vatRate: 0.15,
        },
      }),
    },
  }),
};

// --- Auth (live) ---
spec.paths["/auth/login"] = {
  post: live("Login with employee ID and password", "Auth", {
    "200": {
      description: "Login successful",
      content: json({ $ref: "#/components/schemas/LoginResponse" }),
    },
    "400": { description: "Validation error", content: json(errorRef) },
    "401": { description: "Invalid credentials", content: json(errorRef) },
  }, {
    requestBody: {
      required: true,
      content: json({ $ref: "#/components/schemas/LoginRequest" }),
    },
  }),
};

spec.paths["/auth/forgot-password"] = {
  post: live("Request password reset", "Auth", {
    "200": {
      description: "Generic success (does not reveal if account exists)",
      content: json({
        type: "object",
        properties: { message: { type: "string" } },
        example: {
          message:
            "If an account exists with that employee ID, password reset instructions will be sent.",
        },
      }),
    },
    "400": { description: "Validation error", content: json(errorRef) },
  }, {
    requestBody: {
      required: true,
      content: json({ $ref: "#/components/schemas/ForgotPasswordRequest" }),
    },
  }),
};

spec.paths["/auth/me"] = {
  get: live("Get current authenticated user", "Auth", {
    "200": {
      description: "Current user",
      content: json({
        type: "object",
        properties: { data: { $ref: "#/components/schemas/User" } },
        example: {
          data: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            employeeId: "EMP-001",
            name: "Abebe Kebede",
            email: "abebe@gammo.et",
            role: "Admin",
          },
        },
      }),
    },
    "401": { description: "Unauthorized", content: json(errorRef) },
  }, { security: bearer }),
};

spec.paths["/auth/logout"] = {
  post: live("Logout (client clears token)", "Auth", {
    "200": {
      description: "Logged out",
      content: json({ $ref: "#/components/schemas/MessageResponse" }),
    },
    "401": { description: "Unauthorized", content: json(errorRef) },
  }, { security: bearer }),
};

spec.paths["/auth/change-password"] = {
  post: live("Change password", "Auth", {
    "200": {
      description: "Password changed",
      content: json({
        type: "object",
        properties: { message: { type: "string" } },
        example: { message: "Password changed successfully" },
      }),
    },
    "400": { description: "Validation or wrong current password", content: json(errorRef) },
    "401": { description: "Unauthorized", content: json(errorRef) },
  }, {
    security: bearer,
    requestBody: {
      required: true,
      content: json({ $ref: "#/components/schemas/ChangePasswordRequest" }),
    },
  }),
};

// --- Users ---
spec.paths["/users/me"] = {
  get: planned("Get profile", "Users"),
  patch: planned("Update profile", "Users", "patch", {
    requestBody: {
      content: json({ $ref: "#/components/schemas/UpdateProfileRequest" }),
    },
  }),
};

// --- Products ---
const productListParams = [
  { name: "q", in: "query", schema: { type: "string" } },
  { name: "category", in: "query", schema: { type: "string" } },
  { name: "status", in: "query", schema: { type: "string" } },
  { name: "page", in: "query", schema: { type: "integer" } },
  { name: "limit", in: "query", schema: { type: "integer" } },
];

spec.paths["/products"] = {
  get: planned("List/search products", "Products", "get", { parameters: productListParams }),
  post: planned("Create product", "Products", "post", {
    requestBody: { content: json({ $ref: "#/components/schemas/Product" }) },
  }),
};

spec.paths["/products/{id}"] = {
  get: planned("Get product by ID", "Products", "get", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
  patch: planned("Update product", "Products", "patch", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: { content: json({ $ref: "#/components/schemas/Product" }) },
  }),
  delete: planned("Deactivate product", "Products", "delete", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
};

// --- Inventory ---
spec.paths["/inventory"] = {
  get: planned("List inventory batches", "Inventory"),
  post: planned("Add stock / new batch", "Inventory", "post", {
    requestBody: { content: json({ $ref: "#/components/schemas/InventoryItem" }) },
  }),
};

spec.paths["/inventory/{id}"] = {
  patch: planned("Update inventory batch", "Inventory", "patch", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
};

spec.paths["/inventory/alerts"] = { get: planned("Low/critical stock alerts", "Inventory") };
spec.paths["/inventory/expiring"] = { get: planned("Near-expiry batches", "Inventory") };

// --- Adjustments ---
spec.paths["/adjustments"] = {
  get: planned("List stock adjustments", "Adjustments"),
  post: planned("Create adjustment", "Adjustments", "post", {
    requestBody: { content: json({ $ref: "#/components/schemas/Adjustment" }) },
  }),
};

// --- Suppliers ---
spec.paths["/suppliers"] = {
  get: planned("List suppliers", "Suppliers"),
  post: planned("Create supplier", "Suppliers", "post", {
    requestBody: { content: json({ $ref: "#/components/schemas/Supplier" }) },
  }),
};

spec.paths["/suppliers/{id}"] = {
  patch: planned("Update supplier", "Suppliers", "patch", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
  delete: planned("Deactivate supplier", "Suppliers", "delete", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
};

// --- Purchase Orders ---
spec.paths["/purchase-orders"] = {
  get: planned("List purchase orders", "Purchase Orders"),
  post: planned("Create purchase order", "Purchase Orders", "post", {
    requestBody: { content: json({ $ref: "#/components/schemas/PurchaseOrder" }) },
  }),
};

spec.paths["/purchase-orders/{id}"] = {
  get: planned("Get PO detail", "Purchase Orders", "get", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
  patch: planned("Update draft PO", "Purchase Orders", "patch", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
};

["submit", "receive", "cancel"].forEach((action) => {
  spec.paths[`/purchase-orders/{id}/${action}`] = {
    post: planned(`${action} purchase order`, "Purchase Orders", "post", {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    }),
  };
});

// --- POS / Sales ---
spec.paths["/pos/products"] = { get: planned("POS catalog with live stock", "POS / Sales") };
spec.paths["/sales"] = {
  post: planned("Complete checkout", "POS / Sales", "post", {
    requestBody: { content: json({ $ref: "#/components/schemas/SaleCheckoutRequest" }) },
  }),
};
spec.paths["/sales/hold"] = { post: planned("Hold cart", "POS / Sales", "post") };

// --- Invoices ---
spec.paths["/invoices"] = {
  get: planned("List invoices", "Invoices", "get", {
    parameters: [
      { name: "status", in: "query", schema: { type: "string" } },
      { name: "dateFrom", in: "query", schema: { type: "string", format: "date" } },
      { name: "dateTo", in: "query", schema: { type: "string", format: "date" } },
      { name: "q", in: "query", schema: { type: "string" } },
    ],
  }),
};

spec.paths["/invoices/export"] = { get: planned("Export invoices CSV", "Invoices") };

spec.paths["/invoices/{id}"] = {
  get: planned("Get invoice detail", "Invoices", "get", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
  }),
};

spec.paths["/invoices/{id}/status"] = {
  patch: planned("Update invoice status", "Invoices", "patch", {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
      content: json({
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["Paid", "Pending", "Overdue", "Cancelled"],
          },
        },
      }),
    },
  }),
};

// --- Reports ---
spec.paths["/dashboard"] = { get: planned("Dashboard KPIs", "Reports") };
spec.paths["/reports/sales"] = {
  get: planned("Sales report", "Reports", "get", {
    parameters: [
      {
        name: "range",
        in: "query",
        schema: { type: "string", enum: ["today", "week", "month"] },
      },
    ],
  }),
};
spec.paths["/reports/revenue-profit"] = { get: planned("Revenue & profit chart", "Reports") };
spec.paths["/reports/by-category"] = { get: planned("Sales by category", "Reports") };
spec.paths["/reports/expiry"] = { get: planned("Expiry analytics", "Reports") };

// --- Attendance ---
spec.paths["/attendance"] = { get: planned("Attendance history", "Attendance") };
spec.paths["/attendance/clock-in"] = { post: planned("Clock in", "Attendance", "post") };
spec.paths["/attendance/clock-out"] = { post: planned("Clock out", "Attendance", "post") };
spec.paths["/activity"] = { get: planned("Activity audit log", "Attendance") };

// --- Settings ---
spec.paths["/settings/stock-alerts"] = {
  get: planned("Get stock alert settings", "Settings"),
  put: planned("Update stock alert settings", "Settings", "put"),
};
spec.paths["/settings/expiry-alerts"] = {
  get: planned("Get expiry alert settings", "Settings"),
  put: planned("Update expiry alert settings", "Settings", "put"),
};
spec.paths["/organization"] = {
  get: planned("Get organization profile", "Settings"),
  put: planned("Update organization profile", "Settings", "put"),
};

const out = path.join(process.cwd(), "docs", "openapi.json");
fs.writeFileSync(out, JSON.stringify(spec, null, 2));
console.log(`Written ${out}`);
console.log(`Paths: ${Object.keys(spec.paths).length}`);
console.log(`Schemas: ${Object.keys(spec.components.schemas).length}`);
