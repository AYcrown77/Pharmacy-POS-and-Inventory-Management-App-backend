# Mustan Healthcare Pharmacy — API reference

Every endpoint the server exposes, with request bodies you can paste straight
into curl, Postman or the REST Client.

- **Base URL:** `http://localhost:5000/api/v1`
- **Through the front end** (same origin, no CORS): `http://localhost:3000/api`
  — Next rewrites `/api/*` to `/api/v1/*`

A ready-to-run collection sits in [`docs/`](docs/) — see [Testing](#testing) at
the bottom.

---

## Conventions

### The response envelope

Every response, success or failure, has the same shape. The payload is always
under `data`.

```json
{ "message": "Products retrieved", "success": true, "statusCode": 200, "data": {} }
```

The one exception is a **422 validation failure**, which comes from
express-validator as a flat list (see [Errors](#errors)).

### Authentication

Sign in once; the session travels in an **httpOnly cookie** called
`mhp_session`. The token is never returned in the response body — that is
deliberate, so no script on the page can read it.

With curl, use a cookie jar:

```bash
curl -c jar.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Pharmacy@2026","terminalId":"trm-01"}'

curl -b jar.txt http://localhost:5000/api/v1/products
```

In Postman, cookies are kept automatically once you call login.

`Authorization: Bearer <token>` is also accepted by the middleware, for scripts
that already hold a token. Login will not give you one.

Every route needs a session except `POST /auth/login` and `GET /health`.

### Roles

`ADMINISTRATOR` and `CASHIER`. Endpoints marked **Admin** return `403` for a
cashier. Some endpoints are readable by both but *scoped*: a cashier sees only
their own sales.

Seeded accounts, all with password `Pharmacy@2026`: `admin`, `sarah`, `ibrahim`.

### Money

**Always an integer number of kobo.** ₦800.00 is `80000`. Never a float, never
a decimal string. Divide by 100 only when displaying.

### Dates

- **Expiry dates** are calendar days: `"2027-01-02"`. Not timestamps — a
  timezone could shift them by a day.
- **Everything else** is an ISO timestamp: `"2026-09-05T09:59:46.000Z"`.
- **Report ranges** use `from` and `to` as `YYYY-MM-DD`, both inclusive.

### Pagination

List endpoints accept `page` (default 1) and `pageSize` (default 20, max 200),
and return:

```json
{ "data": [], "page": 1, "pageSize": 20, "total": 37, "totalPages": 2 }
```

Most also accept `search`, `sortBy` and `sortDir` (`asc` | `desc`).

---

## Authentication

### `POST /auth/login`

```json
{ "username": "admin", "password": "Pharmacy@2026", "terminalId": "trm-01" }
```

`terminalId` is optional. Sets the `mhp_session` cookie.

```json
{
  "message": "Login successful",
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "id": "72228e1f-…", "name": "Mustapha Bello", "username": "admin",
      "role": "ADMINISTRATOR", "isActive": true,
      "lastLoginAt": "2026-09-05T10:41:02.183Z",
      "createdAt": "2026-09-05T10:37:26.6Z", "updatedAt": "2026-09-05T10:41:02.184Z"
    },
    "terminal": { "id": "trm-01", "name": "Terminal 01", "location": "Front counter",
                  "type": "CHECKOUT", "isActive": true }
  }
}
```

A wrong username and a wrong password return the same `401` — the endpoint
cannot be used to discover who works at the pharmacy.

### `GET /auth/session`

Returns the signed-in user, or `401` if the cookie is gone or the account has
since been disabled.

### `POST /auth/logout`

Clears the cookie and writes a `USER_LOGOUT` audit entry.

### `GET /health`

The only unauthenticated read. Also pings the database, so a `503` means the
API is up but the database is not.

```json
{ "message": "Service healthy", "success": true, "statusCode": 200,
  "data": { "status": "ok", "serverTime": "2026-09-05T10:41:02.229Z" } }
```

---

## Products & categories

### `GET /products`

Query: `page`, `pageSize`, `search`, `sortBy` (`name` | `sellingPrice` |
`availableStock` | `category` | `createdAt`), `sortDir`, `categoryId`,
`stockStatus` (`IN_STOCK` | `LOW_STOCK` | `OUT_OF_STOCK`), `isActive`.

`search` matches name, generic name, brand name and barcode.

Each row carries derived stock, so a list needs one round trip:

```json
{
  "id": "bc959457-…", "name": "Paracetamol 500mg",
  "genericName": "Paracetamol", "brandName": "Emzor", "barcode": "6151234567890",
  "categoryId": "74494cc4-…",
  "category": { "id": "74494cc4-…", "name": "Analgesics", "description": "Pain relief and antipyretics" },
  "strength": "500mg", "dosageForm": "TABLET",
  "sellingPrice": 80000, "minimumStockLevel": 15, "unitType": "PACK",
  "isActive": true,
  "createdAt": "…", "updatedAt": "…",
  "availableStock": 70, "stockStatus": "IN_STOCK"
}
```

### `GET /products/:id`

One product with the same shape. `404` if unknown.

### `GET /products/search?q=para&limit=12`

Fast lookup for the POS search box. Returns a bare array, not a page. An exact
barcode match is ranked first, then names starting with the term.

### `GET /products/barcode/:barcode`

Active products only. **Returns `data: null` with status 200** when nothing
matches — a scan that hits nothing is a normal outcome at the till, not an
error, and the cart must not be disturbed.

### `GET /products/sale-lookup/:idOrBarcode`

Everything the till needs in one call. Accepts a product id **or** a barcode.

```json
{
  "product": { "…": "as above" },
  "availableStock": 70,
  "sellableBatches": [
    { "batchId": "…", "batchNumber": "PCM001", "expiryDate": "2027-01-02", "quantityRemaining": 20 },
    { "batchId": "…", "batchNumber": "PCM002", "expiryDate": "2027-10-09", "quantityRemaining": 50 }
  ],
  "expiredOnly": false
}
```

`sellableBatches` is in FEFO order — the order a sale will consume them.
`expiredOnly` is `true` when stock is physically on the shelf but every unit of
it has expired, so the cashier can be told that rather than a bare "out of
stock". Unknown product returns `data: null`, status 200.

### `GET /products/:id/batches`

Every batch for a product, expired included, earliest expiry first. Each batch
carries server-derived `expiryStatus` and `daysUntilExpiry`.

### `POST /products` · **Admin**

```json
{
  "name": "Paracetamol 500mg",
  "genericName": "Paracetamol",
  "brandName": "Emzor",
  "barcode": "6151234567890",
  "categoryId": "74494cc4-4d15-4999-ab1f-52f495c822c7",
  "strength": "500mg",
  "dosageForm": "TABLET",
  "sellingPrice": 80000,
  "minimumStockLevel": 15,
  "unitType": "PACK",
  "isActive": true
}
```

Nullable: `genericName`, `brandName`, `barcode`, `strength`, `dosageForm`.

`dosageForm`: `TABLET` `CAPSULE` `SYRUP` `SUSPENSION` `INJECTION` `CREAM`
`OINTMENT` `DROPS` `INHALER` `SUPPOSITORY` `POWDER`
`unitType`: `PACK` `BOTTLE` `TABLET` `SACHET` `TUBE` `VIAL` `CARTON` `PIECE`

`409` with `data.code = "DUPLICATE_BARCODE"` if the barcode is taken.

### `PATCH /products/:id` · **Admin**

Same body as create — send the whole product. A changed `sellingPrice` writes a
separate `PRICE_CHANGED` audit entry as well as `PRODUCT_UPDATED`.

### `GET /categories`

Bare array, unpaged — it is a short list that fills a select.

### `POST /categories` · **Admin**

```json
{ "name": "Antivirals", "description": "Antiviral medicines" }
```

### `PATCH /categories/:id` · **Admin**

Same body.

### `DELETE /categories/:id` · **Admin**

`409` if any product still points at it — the products have to be moved first,
or the catalogue would be left with orphans.

---

## Inventory (read-only)

Nothing here changes stock. Every write goes through [Stock](#stock-operations)
so that a change always carries a reason and a ledger entry.

### `GET /inventory`

Product-level stock aggregated across batches. Query: `page`, `pageSize`,
`search`, `sortBy` (`name` | `availableStock` | `stockValue` | `batchCount` |
`nearestExpiry` | `category`), `sortDir`, `categoryId`, `stockStatus`,
`expiryStatus`.

```json
{
  "productId": "bc959457-…",
  "product": { "…": "product with availableStock and stockStatus" },
  "availableStock": 70,
  "minimumStockLevel": 15,
  "batchCount": 2,
  "nearestExpiry": "2027-01-02",
  "stockStatus": "IN_STOCK",
  "expiryStatus": "HEALTHY",
  "stockValue": 3877500,
  "lastReceivedAt": "2026-05-01T08:00:00.000Z"
}
```

`stockValue` is at **cost**, and counts sellable units only — expired stock is
worth nothing.

### `GET /inventory/summary`

```json
{ "totalProducts": 37, "totalStockUnits": 1146, "inventoryValue": 142125000,
  "lowStockCount": 2, "outOfStockCount": 3, "expiringSoonCount": 8, "expiredCount": 2 }
```

### `GET /inventory/low-stock?limit=10`

Bare array, worst first. Everything at or below its minimum, including zero.

```json
{ "productId": "…", "productName": "Vitamin C 1000mg", "categoryName": "Vitamins & Supplements",
  "availableStock": 4, "minimumStockLevel": 20, "shortfall": 16,
  "stockStatus": "LOW_STOCK", "lastReceivedAt": "2026-05-11T08:00:00.000Z" }
```

### `GET /inventory/expiry-alerts?limit=10`

Bare array. Batches inside the 90-day window or already expired, soonest first.

```json
{ "batchId": "…", "productId": "…", "productName": "Fansidar", "batchNumber": "FAN201",
  "quantityRemaining": 8, "expiryDate": "2026-08-24", "daysUntilExpiry": -12,
  "expiryStatus": "EXPIRED", "stockValue": 800000 }
```

### `GET /inventory/expiring`

The same rows, paginated and filterable. Query: `page`, `pageSize`, `search`,
`expiryStatus`, `productId`, `sortBy` (`expiryDate` | `productName` |
`quantityRemaining` | `stockValue`), `sortDir`.

### `GET /inventory/expiry-summary`

Counts per band, across batches that still hold stock:

```json
{ "EXPIRED": 2, "CRITICAL_30": 2, "WARNING_60": 3, "NOTICE_90": 3, "HEALTHY": 30 }
```

Bands: `EXPIRED` (past) · `CRITICAL_30` (0–30 days) · `WARNING_60` (31–60) ·
`NOTICE_90` (61–90) · `HEALTHY` (beyond).

### `GET /batches`

Query: `page`, `pageSize`, `search` (batch number, supplier, product name),
`productId`, `categoryId`, `supplierName`, `expiryStatus`, `onlyInStock=true`,
`sortBy` (`expiryDate` | `batchNumber` | `quantityRemaining` | `receivedAt` |
`costPrice`), `sortDir`.

```json
{
  "id": "a746ff7f-…", "productId": "bc959457-…", "batchNumber": "PCM001",
  "expiryDate": "2027-01-02",
  "quantityReceived": 486, "quantityRemaining": 20,
  "costPrice": 55000, "sellingPrice": 80000,
  "supplierName": "Fidson Healthcare",
  "receivedAt": "2026-03-19T08:00:00.000Z",
  "receivedBy": "72228e1f-…", "receivedByName": "Mustapha Bello",
  "expiryStatus": "HEALTHY", "daysUntilExpiry": 119,
  "product": { "…": "the product, with its category" }
}
```

`expiryStatus` and `daysUntilExpiry` are computed by the server so three
terminals cannot disagree about whether a batch is critical.

### `GET /batches/:id`

One batch, same shape. `404` if unknown.

### `GET /stock-movements`

The stock ledger — append-only, and the reason the shelf can always be
explained. Query: `page`, `pageSize`, `search`, `productId`, `batchId`,
`movementType`, `userId`, `from`, `to`, `sortDir` (default newest first).

```json
{
  "id": "…", "productId": "…", "productName": "Paracetamol 500mg",
  "batchId": "…", "batchNumber": "PCM001",
  "movementType": "SALE",
  "quantity": -1, "previousQuantity": 20, "newQuantity": 19,
  "referenceType": "SALE", "referenceId": "9d8d95d6-…",
  "userId": "…", "userName": "Sarah Adeyemi",
  "reason": null,
  "createdAt": "2026-09-05T09:59:46.000Z"
}
```

`quantity` is **signed**: positive adds stock, negative removes it.
`movementType`: `STOCK_RECEIVED` `SALE` `RETURN` `DAMAGE` `EXPIRY` `ADJUSTMENT`.

### `GET /stock-movements/recent?limit=10`

Bare array, trimmed for the dashboard activity panel.

### `GET /suppliers`

Distinct supplier names already used, as a bare array of strings.

---

## Stock operations

### `POST /stock/receive` · **Admin**

```json
{
  "productId": "bc959457-c6a2-4e42-9b58-70c1fba750bc",
  "batchNumber": "PCM004",
  "expiryDate": "2028-06-30",
  "quantityReceived": 60,
  "costPrice": 60000,
  "sellingPrice": 80000,
  "supplierName": "Emzor Pharmaceuticals",
  "receivedAt": "2026-09-05"
}
```

`supplierName` and `receivedAt` are optional; `receivedAt` defaults to now.

Runs in one transaction: creates the batch, writes a `STOCK_RECEIVED` movement,
and audits it. If `sellingPrice` differs from the product's current price, the
catalogue price is updated and a separate `PRICE_CHANGED` entry is written.

`400` if the quantity is below 1 or the expiry date has already passed —
receiving expired stock is always a mistake.

### `POST /stock/adjustments` · **Admin**

```json
{
  "batchId": "a746ff7f-d41f-4ace-9358-2298aa36d10d",
  "adjustment": -2,
  "reason": "DAMAGED",
  "notes": "Crushed in transit"
}
```

`adjustment` is signed and must not be zero. `reason`: `EXPIRED` `DAMAGED`
`MISSING` `COUNT_CORRECTION` `RETURNED_TO_SUPPLIER` `OTHER`.

The reason decides how the ledger reads: `EXPIRED` writes an `EXPIRY` movement
and `DAMAGED` a `DAMAGE` one — real losses. The rest write `ADJUSTMENT`, a
correction rather than a loss, so a miscount is not badged alongside spoilage.

`400` with `data.code = "INVALID_ADJUSTMENT"` if it would take the batch below
zero.

```json
{ "id": "…", "productId": "…", "productName": "Zinc Sulphate 20mg",
  "batchId": "…", "batchNumber": "ZNC040",
  "quantityBefore": 9, "adjustment": -2, "quantityAfter": 7,
  "reason": "DAMAGED", "notes": "Crushed in transit",
  "performedBy": "…", "performedByName": "Mustapha Bello", "createdAt": "…" }
```

### `GET /stock/adjustments` · **Admin**

Query: `page`, `pageSize`, `search`, `productId`, `reason`, `userId`, `from`,
`to`, `sortDir`.

---

## Sales

### `POST /sales`

The one place money and stock move together, so it is all-or-nothing.

```json
{
  "lines": [
    { "productId": "bc959457-c6a2-4e42-9b58-70c1fba750bc", "quantity": 25 }
  ],
  "discount": 0,
  "paymentMethod": "CASH",
  "amountReceived": 2500000,
  "terminalId": "trm-01"
}
```

`paymentMethod`: `CASH` `CARD` `TRANSFER`. `amountReceived` is cash only — send
`null` for card and transfer. `discount` is in kobo and optional.

The server locks the candidate batches, allocates **FEFO** across all lines,
and only writes once every line can be filled. A cart line spanning two batches
becomes two `items` rows, because the batch a customer was handed is what a
recall or a return has to know.

```json
{
  "id": "9d8d95d6-…", "receiptNumber": "MHP-006745",
  "terminalId": "trm-01", "terminalName": "Terminal 01",
  "cashierId": "…", "cashierName": "Sarah Adeyemi",
  "subtotal": 2000000, "discount": 0, "total": 2000000,
  "paymentMethod": "CASH", "amountReceived": 2500000, "changeGiven": 500000,
  "status": "COMPLETED",
  "items": [
    { "id": "…", "saleId": "…", "productId": "…", "productName": "Paracetamol 500mg",
      "batchId": "…", "batchNumber": "PCM001",
      "quantity": 20, "unitPrice": 80000, "subtotal": 1600000, "returnedQuantity": 0 },
    { "id": "…", "saleId": "…", "productId": "…", "productName": "Paracetamol 500mg",
      "batchId": "…", "batchNumber": "PCM002",
      "quantity": 5, "unitPrice": 80000, "subtotal": 400000, "returnedQuantity": 0 }
  ],
  "createdAt": "2026-09-05T11:02:11.000Z"
}
```

Failures, all of which leave stock **completely untouched**:

| status | when | `data.code` |
|---|---|---|
| `409` | not enough sellable stock | `INSUFFICIENT_STOCK`, plus `productId`, `requested`, `available` |
| `400` | cash tendered is less than the total | `INSUFFICIENT_PAYMENT` |
| `404` | a product in the cart no longer exists | — |
| `422` | malformed body | see [Errors](#errors) |

### `GET /sales`

Query: `page`, `pageSize`, `search` (receipt number, cashier), `from`, `to`,
`cashierId`, `paymentMethod`, `status`, `terminalId`, `productId`, `sortDir`.

`status`: `COMPLETED` `PARTIALLY_RETURNED` `REVERSED`.

**A cashier only ever sees their own sales here**, whatever they pass as
`cashierId`. Administrators see everything.

### `GET /sales/:id`

One sale with its `items` and `returns`. A cashier requesting someone else's
sale gets `404`, not `403` — so the endpoint cannot be used to enumerate other
people's takings.

### `GET /sales/receipt/:receiptNumber`

e.g. `/sales/receipt/MHP-006744`. Returns `data: null` with status 200 when
there is no such receipt, because the returns screen looks this up as the user
types.

### `GET /sales/recent?limit=8`

Trimmed summaries for the dashboard: `id`, `receiptNumber`, `cashierName`,
`itemCount`, `total`, `paymentMethod`, `status`, `createdAt`.

> There is deliberately **no `DELETE /sales`**, and there never should be. A
> sale that was wrong is reversed through `/returns`, which leaves both the
> original and the reversal on the record.

---

## Returns

### `POST /returns`

```json
{
  "saleId": "9d8d95d6-0513-49ab-a2ee-02fb63df42f4",
  "items": [
    { "saleItemId": "14d9e4ed-fdb3-49b9-931b-33fd5488ecca", "quantity": 3 }
  ],
  "reason": "Customer changed mind",
  "refundMethod": "CASH"
}
```

Get `saleItemId` values from `GET /sales/:id`.

The original sale is never rewritten. A reversal record is created, the stock
goes back to **the batch it actually came out of**, a `RETURN` movement is
written, and the sale's status becomes `PARTIALLY_RETURNED` or — once every
line is fully returned — `REVERSED`.

```json
{
  "id": "…", "saleId": "…", "receiptNumber": "MHP-006744",
  "refundAmount": 240000, "refundMethod": "CASH",
  "reason": "Customer changed mind",
  "processedBy": "…", "processedByName": "Mustapha Bello",
  "items": [
    { "id": "…", "saleReturnId": "…", "saleItemId": "…",
      "productId": "…", "productName": "Aspirin 75mg",
      "batchId": "…", "batchNumber": "ASP090",
      "quantity": 3, "unitPrice": 80000, "refundAmount": 240000, "restocked": true }
  ],
  "createdAt": "…"
}
```

| status | when | `data.code` |
|---|---|---|
| `400` | more than *sold minus already returned* | `INVALID_RETURN_QUANTITY` |
| `409` | the sale is already fully reversed | — |
| `404` | unknown sale, or the line is not part of it | — |

### `GET /returns`

Query: `page`, `pageSize`, `search`, `saleId`, `processedBy`, `sortDir`.

### `GET /sales/:id/returns`

Reversal history for one sale, as a bare array.

---

## Reports · **Admin**

All amounts in kobo. A **fully reversed sale counts for nothing** and is
excluded everywhere; a partially returned one still counts at its original
total, with the refund reported separately.

### `GET /reports/dashboard`

```json
{
  "todaySales": 5030000, "todayTransactions": 17, "todayAverageSale": 295882,
  "salesChangePercent": -78.82105263157895,
  "inventory": { "…": "the /inventory/summary payload" }
}
```

`salesChangePercent` is `null` — not `0` — when yesterday took nothing, because
"no change" and "nothing to compare against" are different statements.

### `GET /reports/sales-trend?days=7`

One point per day for the last N days, ending today. Days with no sales are
returned as zero rather than omitted, so a quiet Sunday shows as a gap in
takings instead of closing up.

```json
[ { "date": "2026-09-03", "label": "03 Sept", "total": 23800000, "transactions": 61 } ]
```

`label` is pre-formatted so the chart does no date maths.

### `GET /reports/payment-mix?days=7`

```json
[ { "method": "CASH", "total": 627470000, "transactions": 1623, "share": 0.6054731600937925 } ]
```

`share` is 0–1, and is `0` rather than `NaN` when the period took nothing.

### `GET /reports/sales/summary?from=2026-08-01&to=2026-09-05`

Also accepts `cashierId` and `paymentMethod`.

```json
{
  "grossSales": 1036330000, "transactionCount": 2684, "averageSale": 386114,
  "byMethod": [ { "method": "CASH", "total": 627470000, "transactions": 1623, "share": 0.605 } ],
  "refundedAmount": 0, "refundCount": 0
}
```

`averageSale` is floored — a fraction of a kobo cannot exist.

### `GET /reports/sales/trend?from=…&to=…`

The same trend points over an explicit range. Also accepts `cashierId` and
`paymentMethod`.

### `GET /reports/cashiers?from=…&to=…`

```json
[ { "cashierId": "…", "cashierName": "Ibrahim Musa", "transactions": 1339,
    "cashSales": 316780000, "cardSales": 184500000, "transferSales": 31510000,
    "totalSales": 532790000, "averageSale": 397901 } ]
```

Sorted by takings. The three method figures always sum to `totalSales`.

### `GET /reports/stock-movements/summary?from=…&to=…`

Also accepts `productId`, `movementType`, `userId`.

```json
{ "movementCount": 4688, "unitsIn": 0, "unitsOut": 7229, "netUnits": -7229 }
```

`unitsIn` can legitimately be `0` for a recent window if no deliveries landed
in it — the seeded batches were received months ago.

---

## Users · **Admin**

Accounts are **disabled, never deleted** — sales, movements and audit entries
name the person who made them, and deleting the account would orphan years of
records. There is no `DELETE` here by design.

Password hashes never leave the database; the model excludes the column by
default.

### `GET /users`

Query: `page`, `pageSize`, `search` (name, username), `role`, `isActive`,
`sortDir`.

### `GET /users/:id`

### `POST /users`

```json
{ "name": "Amina Yusuf", "username": "amina", "role": "CASHIER", "password": "Pharmacy@2026" }
```

`role`: `ADMINISTRATOR` | `CASHIER`. Password must be at least 8 characters.
Usernames are lowercased, so `Amina` and `amina` cannot become two accounts
that look identical on the sign-in screen. `409` if taken.

### `PATCH /users/:id`

```json
{ "name": "Amina Yusuf-Bello", "username": "amina", "role": "CASHIER" }
```

### `PATCH /users/:id/status`

```json
{ "isActive": false }
```

`400` if you try to disable your own account, or the last active administrator —
either would lock everyone out of user management with no way back except a
database edit.

### `POST /users/:id/password`

```json
{ "password": "NewPassword2026" }
```

Returns `data: {}`. The new password is never echoed back, and the audit entry
records only that a reset happened.

---

## System

### `GET /settings`

Readable by any signed-in user — the receipt needs the pharmacy's name and
address.

```json
{ "id": 1, "name": "Mustan Healthcare Pharmacy",
  "address": "12 Ahmadu Bello Way, Kaduna, Nigeria", "phone": "+234 803 000 0000",
  "receiptFooter": "Your Health, Our Priority", "showLogoOnReceipt": true,
  "currency": "NGN", "lowStockAlertsEnabled": true, "expiryAlertDays": 90 }
```

### `PUT /settings` · **Admin**

```json
{
  "name": "Mustan Healthcare Pharmacy",
  "address": "12 Ahmadu Bello Way, Kaduna, Nigeria",
  "phone": "+234 803 000 0000",
  "receiptFooter": "Your Health, Our Priority",
  "showLogoOnReceipt": true,
  "lowStockAlertsEnabled": true,
  "expiryAlertDays": 90
}
```

`expiryAlertDays` must be 1–365. `currency` is fixed at `NGN` and ignored if
sent — accepting another would silently reprice the whole catalogue.

### `GET /terminals`

Bare array of the tills on the network.

### `GET /audit` · **Admin**

Read-only. There is no endpoint to write, edit or delete an entry — an audit
log that can be rewritten is not an audit log.

Query: `page`, `pageSize`, `search`, `userId`, `action`, `entityType`, `from`,
`to`, `sortDir`.

```json
{ "id": "…", "userId": "…", "userName": "Mustapha Bello",
  "action": "PRICE_CHANGED", "entityType": "PRODUCT", "entityId": "…",
  "oldValue": { "sellingPrice": 123400 }, "newValue": { "sellingPrice": 150000 },
  "createdAt": "…" }
```

`action`: `USER_LOGIN` `USER_LOGOUT` `PRODUCT_CREATED` `PRODUCT_UPDATED`
`PRICE_CHANGED` `STOCK_RECEIVED` `STOCK_ADJUSTMENT` `SALE_COMPLETED`
`SALE_REVERSAL` `USER_CREATED` `USER_UPDATED` `USER_DISABLED` `USER_ENABLED`
`SETTINGS_UPDATED`.

### `GET /audit/entity-types` · **Admin**

Distinct entity types present, for the filter dropdown.

---

## Errors

Standard failures use the envelope, with any machine-readable code under
`data`:

```json
{ "message": "Only 0 unit(s) of Adhesive Bandage are available.",
  "success": false, "statusCode": 409,
  "data": { "code": "INSUFFICIENT_STOCK", "productId": "cf4324c4-…",
            "requested": 99999, "available": 0 } }
```

**Validation (`422`) is the exception** — it comes straight from
express-validator as a flat list, with the offending field in `path`:

```json
{ "errors": [
    { "type": "field", "value": "BITCOIN", "msg": "Select a payment method",
      "path": "paymentMethod", "location": "body" }
] }
```

| status | meaning |
|---|---|
| `400` | the request is understood but the business rule says no |
| `401` | no session, or it expired — sign in again |
| `403` | signed in, but your role does not permit this |
| `404` | not found, **or** not yours to see |
| `409` | a conflict: stock ran out, a barcode is taken, a sale is already reversed |
| `422` | the body failed validation |
| `500` | server fault; the write paths log the cause to the console |
| `503` | `/health` only — the API is up, the database is not |

---

## Testing

### Smoke test

Copy-paste this to exercise the main flow end to end:

```bash
BASE=http://localhost:5000/api/v1

# 1. sign in (stores the session cookie in jar.txt)
curl -s -c jar.txt -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Pharmacy@2026","terminalId":"trm-01"}'

# 2. find something to sell
curl -s -b jar.txt "$BASE/products/search?q=paracetamol&limit=1"

# 3. see what FEFO would allocate (use the id from step 2)
curl -s -b jar.txt "$BASE/products/sale-lookup/6151234567890"

# 4. sell 25 — enough to span two batches
curl -s -b jar.txt -X POST $BASE/sales \
  -H "Content-Type: application/json" \
  -d '{"lines":[{"productId":"<PRODUCT_ID>","quantity":25}],"discount":0,
       "paymentMethod":"CASH","amountReceived":2500000,"terminalId":"trm-01"}'

# 5. confirm the ledger recorded it
curl -s -b jar.txt "$BASE/stock-movements?productId=<PRODUCT_ID>&pageSize=3"

# 6. return 3 units (saleItemId comes from the sale response)
curl -s -b jar.txt -X POST $BASE/returns \
  -H "Content-Type: application/json" \
  -d '{"saleId":"<SALE_ID>","items":[{"saleItemId":"<SALE_ITEM_ID>","quantity":3}],
       "reason":"Customer changed mind","refundMethod":"CASH"}'
```

Run `pnpm seed` afterwards to put the shop back to its clean state.

### Postman

Import [`docs/mustan-pharmacy.postman_collection.json`](docs/mustan-pharmacy.postman_collection.json).
Run **Auth → Login** first; the rest inherit the session cookie, and the ids
captured from the first few requests populate the collection variables.

### VS Code

Install the *REST Client* extension and open
[`docs/api.http`](docs/api.http) — every request is runnable inline with
**Send Request**.
