# Mustan Healthcare Pharmacy — API

Express + TypeScript + PostgreSQL back end for the pharmacy's point-of-sale and
inventory system. It runs on the pharmacy's own machine on the local network;
no internet is needed for daily operation.

The front end lives beside this repo in `mustaan-frontend`.

**Endpoint reference: [API.md](API.md)** — every route with request bodies you
can paste straight into curl, Postman or the REST Client.

---

## Getting started

You need **Node 20+**, **pnpm**, and **PostgreSQL 14 or newer** running locally.
You do *not* need to create the database by hand — `pnpm setup` does that.

```bash
pnpm install

cp .env.example .env      # then fill in the two blanks, see below

pnpm setup                # creates the database, builds the schema, seeds it
pnpm dev                  # http://localhost:5000
```

### Filling in `.env`

Two values have no sensible default:

| key | what to put |
|---|---|
| `DB_PASSWORD` | the password for your local `postgres` user |
| `SECRET_KEY`  | any long random string — it signs the session cookie |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`.env` is gitignored and must stay that way — it holds the database password
and the session signing key.

---

## What `pnpm setup` gives you

You start with a **working pharmacy, not an empty database**. Every screen has
something true to show, because the seed is built so the figures agree with
each other rather than merely existing.

- **37 products** across 10 categories — real Nigerian pharmacy stock
  (Paracetamol, Coartem, Augmentin, Ampiclox, ORS, Ventolin…), priced in naira
- **111 batches** spread deliberately across the expiry bands
- **~6,700 sales over 90 days**, averaging about ₦3,900 a basket, so the
  reports, charts and cashier totals have real history behind them

The stock is arranged so every state in the interface is reachable:

| state | where to see it |
|---|---|
| Out of stock | Adhesive Bandage — no batches at all |
| Low stock | Vitamin C (4 of 20), Zinc Sulphate (9 of 10) |
| Expired stock on the shelf | Fansidar, Benylin — units present, all expired |
| Expiring soon | Panadol Extra (14 days), Coartem (25 days) |
| Multi-batch FEFO | Paracetamol 500mg — two batches, different expiries |

Two invariants hold across the seeded data, and are worth preserving if you
change it: every batch satisfies `quantityReceived − unitsSold = quantityRemaining`
with the stock ledger walking that path step by step, and nothing is dated in
the future.

### Signing in

All three seeded accounts use the password **`Pharmacy@2026`**:

| username | role |
|---|---|
| `admin` | Administrator |
| `sarah` | Cashier |
| `ibrahim` | Cashier |

---

## Scripts

| command | does |
|---|---|
| `pnpm setup` | `db:create` then `seed` — the one command a new machine needs |
| `pnpm db:create` | creates the database if it does not exist; safe to re-run |
| `pnpm seed` | wipes and re-seeds. Run it whenever you want a clean shop back |
| `pnpm dev` | development server with reload, on `PORT` (default 5000) |
| `pnpm build` | compiles TypeScript to `dist/` |
| `pnpm start` | runs the compiled build |

The schema itself is created by `sequelize.sync()` when the server or the seed
connects, so there is no separate migration step to run.

> **`pnpm seed` deletes every sale, return, stock movement and audit entry.**
> That is what you want on a development machine. It refuses to run when
> `NODE_ENV=production` unless you pass `--force`, because on the pharmacy's
> server those rows are the business records.

---

## How the code is laid out

A request flows in one direction, one layer per file:

```
routes/<domain>/index.ts        URL, auth guard, validation
  → controllers/<domain>/…      thin; reads the request, calls the service
    → services/<domain>/…       all the business logic
      → schemas/<domain>/…      Sequelize models
```

Every response uses the same envelope, which the front end unwraps in one place:

```json
{ "message": "...", "success": true, "statusCode": 200, "data": { } }
```

Base path is `/api/v1`. The front end talks to `/api/*` on its own origin and
Next rewrites it here, so session cookies work with no CORS.

### Things worth knowing before you change anything

- **Money is an integer number of kobo**, never a float and never a decimal
  string. `pg.defaults.parseInt8` is set in `database/db.ts` so `BIGINT`
  columns arrive as numbers; without it every total would be string
  concatenation.
- **Stock is never a column.** A product's quantity is always the sum of its
  batches, recomputed per request. There is no cached total to go stale.
- **Expiry dates are `DATEONLY`,** handled as `YYYY-MM-DD` strings with
  day-based arithmetic. Putting one through a timestamp lets a timezone shift
  it by a day and mark a batch expired early.
- **Nothing is deleted.** Sales are reversed through `/returns`, staff accounts
  are disabled rather than removed, and the audit log has no write endpoint at
  all. There is deliberately no `DELETE /sales`.
- **FEFO is decided here, not in the browser.** `POST /sales` locks the
  candidate batches, plans every line, and only then writes — so a sale that
  cannot be filled changes nothing and the till can safely keep its cart.

---

## Troubleshooting

**`Could not reach postgres`** — postgres is not running, or `DB_PASSWORD` in
`.env` is blank or wrong. That is the usual cause.

**`/api/v1/health` returns 503** — the API is up but cannot reach the database.
Same checks as above.

**Everything returns 401** — you are not signed in. Every route except
`/api/v1/health` and `/api/v1/auth/login` needs a session cookie.

**Port 5000 already in use** — change `PORT` in `.env`, and update
`API_PROXY_ORIGIN` in the front end's `.env.local` to match.
