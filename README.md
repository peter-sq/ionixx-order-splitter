# Ionixx Order Splitter API

A proof-of-concept REST API for a robo-advisor partner integration. Given a
model portfolio (a set of stocks with target percentage weights) and a total
order amount, the API splits the order across the portfolio's constituents,
returning the dollar amount and share quantity to buy/sell for each stock,
resolves the next valid trading-day execution date, and exposes historic
orders.

Built with **Node.js + TypeScript + Express**. Data is held **in memory only**
and does not survive an application restart, per the assessment's
requirements.

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API overview](#api-overview)
- [Request examples](#request-examples)
- [Design notes](#design-notes)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Dependencies](#dependencies)

## Quick start

Requires **Node.js >= 18**.

```bash
npm install
cp .env.example .env      # optional — sensible defaults are built in
npm run dev                # starts on http://localhost:3000 with hot reload
```

Or run the compiled build:

```bash
npm run build
npm start
```

Once running:

- API base URL: `http://localhost:3000/api/v1`
- Interactive Swagger UI: `http://localhost:3000/docs`
- Raw OpenAPI 3.0 document: `http://localhost:3000/docs.json`
- Health check: `http://localhost:3000/health`

Every request's response time is logged to the console in milliseconds, and
also returned via the `X-Response-Time-Ms` response header.

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable                         | Default | Description                                                                 |
|-----------------------------------|---------|-------------------------------------------------------------------------------|
| `PORT`                            | `3000`  | HTTP port                                                                     |
| `SHARE_QUANTITY_DECIMAL_PLACES`   | `3`     | Decimal precision for computed share quantities. Change without a code deploy to widen/narrow precision (e.g. `3` → `7`). |
| `DEFAULT_STOCK_PRICE`             | `100`   | Fixed fallback price (USD) used when a stock in the portfolio has no partner-supplied price. |
| `PORTFOLIO_WEIGHT_TOLERANCE`      | `0.01`  | Tolerance, in percentage points, allowed when validating that portfolio weights sum to 100%. |

## API overview

| Method | Path                  | Description                                             |
|--------|------------------------|-----------------------------------------------------------|
| POST   | `/api/v1/orders/split` | Split an amount across a model portfolio; creates and persists an order. |
| GET    | `/api/v1/orders`       | List historic orders (filterable, paginated).             |
| GET    | `/api/v1/orders/:orderId` | Fetch a single historic order by id.                    |

Full request/response schemas, including validation rules, are documented in
Swagger UI at `/docs`.

## Request examples

### Split an order (fixed default price)

The canonical example from the assessment: $100 split 60% AAPL / 40% TSLA at
the platform's fixed $100/share price.

```bash
curl -X POST http://localhost:3000/api/v1/orders/split \
  -H "Content-Type: application/json" \
  -d '{
    "side": "BUY",
    "amount": 100,
    "portfolio": [
      { "symbol": "AAPL", "weight": 60 },
      { "symbol": "TSLA", "weight": 40 }
    ]
  }'
```

```json
{
  "orderId": "b3b6c8b2-...",
  "side": "BUY",
  "totalAmount": 100,
  "requestedAt": "2026-08-29T12:00:00.000Z",
  "executionDate": "2026-08-31",
  "quantityDecimalPlaces": 3,
  "allocations": [
    { "symbol": "AAPL", "weight": 60, "priceUsed": 100, "priceSource": "DEFAULT", "targetAmount": 60, "quantity": 0.6, "actualAmount": 60 },
    { "symbol": "TSLA", "weight": 40, "priceUsed": 100, "priceSource": "DEFAULT", "targetAmount": 40, "quantity": 0.4, "actualAmount": 40 }
  ],
  "residualCash": 0
}
```

### Split an order with a partner-supplied market price

`price` on any portfolio entry overrides the fixed `$100` default for that
stock only.

```bash
curl -X POST http://localhost:3000/api/v1/orders/split \
  -H "Content-Type: application/json" \
  -d '{
    "side": "BUY",
    "amount": 1000,
    "portfolio": [
      { "symbol": "AAPL", "weight": 60, "price": 150.25 },
      { "symbol": "TSLA", "weight": 40 }
    ]
  }'
```

### List historic orders

```bash
curl "http://localhost:3000/api/v1/orders?symbol=AAPL&side=BUY&limit=10"
```

> **Note on `from`/`to`**: these filter on `executionDate` (the date the order
> will *trade*), not `requestedAt` (the date it was *placed*). Since markets
> are closed on weekends, an order placed on a Saturday/Sunday gets an
> `executionDate` on the following Monday. Filtering `from=<today>&to=<today>`
> for an order placed over the weekend will therefore return no results —
> filter on the `executionDate` shown in the order response instead.

### Fetch a single order

```bash
curl http://localhost:3000/api/v1/orders/<orderId>
```

### Error example (weights not summing to 100%)

```bash
curl -X POST http://localhost:3000/api/v1/orders/split \
  -H "Content-Type: application/json" \
  -d '{ "side": "BUY", "amount": 100, "portfolio": [{ "symbol": "AAPL", "weight": 50 }] }'
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Model portfolio weights must sum to 100% (got 50%).",
    "details": { "totalWeight": 50 }
  }
}
```

## Design notes

- **Money math**: all dollar and share-quantity arithmetic uses
  [`decimal.js`](https://mikemcl.github.io/decimal.js/) rather than native JS
  floats, to avoid binary floating-point rounding errors when computing
  percentage splits.
- **Rounding strategy**: share quantities are always rounded **down** to the
  configured precision. This guarantees an order never costs more than the
  amount the partner authorised. Any leftover cash from rounding is reported
  explicitly as `residualCash` on the response rather than silently absorbed,
  so the caller can decide what to do with it (see `ANSWERS.md` for the full
  reasoning and alternatives considered).
- **Price resolution**: `price` on a portfolio entry, when present, always
  wins over the platform's fixed default; `priceSource` on each allocation
  makes that decision transparent to the caller.
- **Execution scheduling**: markets are treated as open Monday–Friday. A
  request submitted on a trading day executes that same day; a request
  submitted on a weekend rolls forward to the following Monday. No market
  holidays or intraday cutoff times are modeled (documented assumption).
- **Persistence**: an `OrderRepository` interface abstracts storage; the only
  implementation provided is in-memory, matching the "must not survive a
  restart" requirement. Swapping in a real database later is isolated to one
  file.

## Testing

```bash
npm test              # unit + integration tests
npm run test:coverage # with coverage report
```

Test suite covers:
- The exact 60/40 example from the assessment brief.
- Price override precedence (request price vs. fixed default).
- Configurable decimal precision (including widening from 3 to 7 places).
- Rounding-down behaviour and residual cash reporting.
- BUY and SELL sides.
- Validation errors: non-positive amount, empty portfolio, duplicate
  symbols, weights not summing to 100%, out-of-range weight, non-positive
  price override.
- Trading-day scheduling (weekday vs. weekend submission).
- Full HTTP-level integration tests (supertest) for both success and error
  paths on all three endpoints, plus health check and OpenAPI document
  availability.

## Project structure

```
src/
  app.ts                 Express app assembly (middleware, routes, error handling)
  index.ts                Process bootstrap (listens on PORT)
  config/                 Environment-driven, validated app configuration
  domain/                 Pure business logic: order splitter, money helpers, market calendar
  schemas/                Zod request/response validation schemas
  middlewares/            Validation, error handling, request timing instrumentation
  services/                Orchestrates domain logic + persistence
  repositories/            In-memory OrderRepository (swappable interface)
  controllers/              Thin HTTP handlers
  routes/                    Route wiring + OpenAPI (Swagger) JSDoc annotations
  docs/                       swagger-jsdoc spec assembly
tests/
  unit/                     Domain-layer unit tests
  integration/               HTTP-level tests via supertest
```

## Dependencies

**Runtime**
- `express` — HTTP framework
- `zod` — request validation and type inference
- `decimal.js` — precise decimal arithmetic for money/share quantities
- `uuid` — order id generation
- `helmet`, `cors` — baseline HTTP security headers / CORS
- `swagger-jsdoc`, `swagger-ui-express` — OpenAPI spec generation and interactive docs UI

**Development**
- `typescript`, `ts-node-dev` — compilation and hot-reload dev server
- `jest`, `ts-jest`, `supertest` — unit and HTTP integration testing
- `eslint`, `@typescript-eslint/*`, `prettier`, `eslint-config-prettier` — linting and formatting

See `ANSWERS.md` for the write-up on approach, assumptions, challenges, and
production-readiness considerations.
# ionixx-order-splitter
