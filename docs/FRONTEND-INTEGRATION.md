# Gammo Pharmacy API — Frontend Integration Guide

Handoff document for frontend developers integrating with the Gammo Pharmacy backend.

---

## 1. Quick start

| Item | Value |
|------|--------|
| **Base URL (local)** | `http://localhost:5000/api` |
| **Base URL (production)** | `https://YOUR-DEPLOYED-URL/api` *(replace after deploy)* |
| **Content-Type** | `application/json` |
| **Auth** | JWT Bearer token |
| **Currency** | ETB |
| **VAT** | 15% (`0.15`) |
| **Timezone** | `Africa/Addis_Ababa` |

### Frontend env variable

```env
NEXT_PUBLIC_API_URL=https://YOUR-DEPLOYED-URL/api
```

---

## 2. Authentication flow

### Step 1 — Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "employeeId": "EMP-001",
  "password": "Pharmacy@123"
}
```

**Success `200`:**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "employeeId": "EMP-001",
    "name": "Abebe Kebede",
    "email": "abebe@gammo.et",
    "role": "Admin"
  }
}
```

**Error `401`:**

```json
{ "message": "Invalid employee ID or password" }
```

### Step 2 — Store session (client)

| Key | Value |
|-----|--------|
| `auth_token` | JWT string from login |
| `auth_user` | JSON string of `user` object |

### Step 3 — Send token on every protected request

```http
Authorization: Bearer <auth_token>
```

### Step 4 — Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

Client must also clear `auth_token` and `auth_user` from storage.

### Demo credentials (staging/dev)

| Employee ID | Password | Role |
|-------------|----------|------|
| `EMP-001` | `Pharmacy@123` | Admin |
| `EMP-002` | `Pharmacy@123` | Pharmacist |

---

## 3. Error handling

All errors return JSON:

```json
{ "message": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Validation / bad request |
| `401` | Missing, invalid, or expired token |
| `404` | Resource not found |
| `500` | Server error |
| `501` | Endpoint exists but not implemented yet |

### Validation errors

```json
{ "message": "Employee ID is required" }
```

---

## 4. API client example (TypeScript)

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data as T;
}

// Login
export function login(employeeId: string, password: string) {
  return api<{ message: string; token: string; user: object }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ employeeId, password }),
  });
}

// Current user
export function getMe() {
  return api<{ data: object }>("/auth/me");
}
```

---

## 5. Endpoint status

| Status | Meaning for frontend |
|--------|----------------------|
| ✅ **Live** | Ready to integrate |
| 🟡 **Planned** | Route exists; returns `501` until backend is built |

---

## 6. All endpoints

### Health ✅

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/health` | No |

**Response:**

```json
{
  "status": "ok",
  "service": "gammo-pharmacy-api",
  "currency": "ETB",
  "vatRate": 0.15
}
```

---

### Auth ✅

| Method | Path | Auth | Body |
|--------|------|------|------|
| `POST` | `/auth/login` | No | `{ employeeId, password }` |
| `POST` | `/auth/forgot-password` | No | `{ employeeId, email? }` |
| `GET` | `/auth/me` | Yes | — |
| `POST` | `/auth/logout` | Yes | — |
| `POST` | `/auth/change-password` | Yes | `{ currentPassword, newPassword }` |

**`GET /auth/me` response:**

```json
{
  "data": {
    "id": "uuid",
    "employeeId": "EMP-001",
    "name": "Abebe Kebede",
    "email": "abebe@gammo.et",
    "role": "Admin"
  }
}
```

**`POST /auth/change-password` body:**

```json
{
  "currentPassword": "Pharmacy@123",
  "newPassword": "NewSecurePass1"
}
```

---

### Users 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/users/me` | Yes |
| `PATCH` | `/users/me` | Yes |

**Expected `PATCH` body:**

```json
{
  "fullName": "Abebe Kebede",
  "phone": "+251 911 000 000",
  "email": "abebe@gammo.et"
}
```

---

### Products 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/products` | Yes |
| `GET` | `/products/:id` | Yes |
| `POST` | `/products` | Yes |
| `PATCH` | `/products/:id` | Yes |
| `DELETE` | `/products/:id` | Yes |

**Query params (list):** `q`, `category`, `status`, `page`, `limit`

**Product shape:**

```json
{
  "id": "1",
  "name": "Amoxicillin 500mg Caps",
  "category": "Antibiotics",
  "sku": "AMX-001",
  "manufacturer": "GSK",
  "price": "120.00",
  "stock": 145,
  "status": "Active"
}
```

---

### Inventory 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/inventory` | Yes |
| `POST` | `/inventory` | Yes |
| `PATCH` | `/inventory/:id` | Yes |
| `GET` | `/inventory/alerts` | Yes |
| `GET` | `/inventory/expiring` | Yes |

**Inventory item shape:**

```json
{
  "id": "1",
  "name": "Amoxicillin 500mg Caps",
  "category": "Antibiotics",
  "batchNo": "BX-7821",
  "stock": 450,
  "minStock": 100,
  "maxStock": 500,
  "expiryDate": "2025-10-01",
  "isExpiringSoon": false,
  "unitPrice": "245.00"
}
```

---

### Adjustments 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/adjustments` | Yes |
| `POST` | `/adjustments` | Yes |

**Types:** `Expired`, `Inventory Count`, `Damaged`, `Theft / Lost`, `Return to Supplier`

---

### Suppliers 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/suppliers` | Yes |
| `POST` | `/suppliers` | Yes |
| `PATCH` | `/suppliers/:id` | Yes |
| `DELETE` | `/suppliers/:id` | Yes |

---

### Purchase Orders 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/purchase-orders` | Yes |
| `GET` | `/purchase-orders/:id` | Yes |
| `POST` | `/purchase-orders` | Yes |
| `PATCH` | `/purchase-orders/:id` | Yes |
| `POST` | `/purchase-orders/:id/submit` | Yes |
| `POST` | `/purchase-orders/:id/receive` | Yes |
| `POST` | `/purchase-orders/:id/cancel` | Yes |

**PO status:** `DRAFT`, `PENDING`, `SHIPPED`, `RECEIVED`, `CANCELLED`

**Totals:** `subtotal + (subtotal × 0.15) + shipping`

---

### POS / Sales 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/pos/products` | Yes |
| `POST` | `/sales` | Yes |
| `POST` | `/sales/hold` | Yes |

**Checkout body:**

```json
{
  "customerName": "Walking Customer",
  "items": [
    { "productId": "1", "name": "Paracetamol 500mg Tabs", "price": 45, "qty": 2 }
  ],
  "paymentMethod": "cash",
  "amountTendered": 200,
  "notes": ""
}
```

**`paymentMethod`:** `cash` | `telebirr` | `card`

---

### Invoices 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/invoices` | Yes |
| `GET` | `/invoices/export` | Yes |
| `GET` | `/invoices/:id` | Yes |
| `PATCH` | `/invoices/:id/status` | Yes |

**Invoice status:** `Paid`, `Pending`, `Overdue`, `Cancelled`

---

### Dashboard & Reports 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/dashboard` | Yes |
| `GET` | `/reports/sales?range=week` | Yes |
| `GET` | `/reports/revenue-profit` | Yes |
| `GET` | `/reports/by-category` | Yes |
| `GET` | `/reports/expiry` | Yes |

---

### Attendance & Activity 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/attendance` | Yes |
| `POST` | `/attendance/clock-in` | Yes |
| `POST` | `/attendance/clock-out` | Yes |
| `GET` | `/activity` | Yes |

---

### Settings & Organization 🟡

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/settings/stock-alerts` | Yes |
| `PUT` | `/settings/stock-alerts` | Yes |
| `GET` | `/settings/expiry-alerts` | Yes |
| `PUT` | `/settings/expiry-alerts` | Yes |
| `GET` | `/organization` | Yes |
| `PUT` | `/organization` | Yes |

---

## 7. List response pattern (planned modules)

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 8. Roles & permissions

| Role | Access |
|------|--------|
| `Admin` | Full access |
| `Pharmacist` | POS, inventory, invoices (no system config) |

Role is in the JWT and login `user` object. Frontend should gate UI by `user.role`.

---

## 9. CORS

Backend allows requests from `CORS_ORIGIN` env var.

- **Local dev:** `http://localhost:3000`
- **Production:** set to your deployed frontend URL (e.g. `https://gammo-pharmacy.vercel.app`)

Tell the backend team your frontend URL before go-live.

---

## 10. Testing with curl

```bash
BASE=http://localhost:5000/api

# Health
curl $BASE/health

# Login
curl -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP-001","password":"Pharmacy@123"}'

# Me (replace TOKEN)
curl $BASE/auth/me -H "Authorization: Bearer TOKEN"
```

---

## 11. OpenAPI / Postman

Import `docs/openapi.yaml` into:

- [Swagger Editor](https://editor.swagger.io)
- Postman → Import → OpenAPI 3.0
- Insomnia

---

## 12. Integration checklist for frontend

- [ ] Set `NEXT_PUBLIC_API_URL` to deployed API base
- [ ] Implement login → save `auth_token` + `auth_user`
- [ ] Add `Authorization: Bearer` header to all protected calls
- [ ] Redirect to `/login` when `401` received
- [ ] Call `logout()` and clear storage on sign-out
- [ ] Use `user.role` for permission-based UI
- [ ] Handle `501` gracefully for modules not yet live
- [ ] Format amounts as ETB with 15% VAT on POS/PO screens

---

## 13. Contact / handoff info

| Field | Value |
|-------|--------|
| API repo | *(your git URL)* |
| Staging API URL | *(fill after deploy)* |
| Production API URL | *(fill after deploy)* |
| Backend contact | *(your name/email)* |
