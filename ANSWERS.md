# ANSWERS

## What was your approach (thought process) to tackling this project?

I treated the "order splitter" as a pure domain function first, and
everything else (HTTP, validation, persistence, docs) as a thin shell around
it. The reasoning: the interesting, testable logic here is "given a
portfolio and an amount, resolve prices, compute per-stock dollar amounts
and share quantities, and pick an execution date" — none of that needs
Express, a database, or HTTP to exist or be verified. So `splitOrder()` in
`src/domain/orderSplitter.ts` takes plain data in and returns plain data out,
with its configuration (decimal precision, default price, weight tolerance)
injected as parameters rather than read from `process.env` internally. That
made it trivial to unit test exhaustively (including with a fixed `now` for
deterministic date assertions) without spinning up a server.

From there I layered outward in the conventional way: a repository
interface for persistence (in-memory only, per the requirements, but behind
an interface so it isn't a dead end), a service that wires the domain logic
to the repository and app config, thin controllers that only translate
HTTP <-> domain calls, and Zod schemas at the boundary for request shape
validation. I kept *shape* validation (types, required fields, ranges) in
Zod, and *business-rule* validation (weights summing to 100%, duplicate
symbols) in the domain layer, since the latter depends on relationships
between fields that a schema library expresses awkwardly.

I generated the OpenAPI/Swagger documentation from JSDoc annotations
directly on the route definitions (`swagger-jsdoc` + `swagger-ui-express`),
so the documented contract lives next to the code that implements it and is
harder to let drift out of sync.

## What assumptions did you make?

The brief was deliberately ambiguous in a few places; here's what I decided
and why:

1. **Rounding drift is surfaced, not hidden.** Splitting a fixed dollar
   amount by percentage weights and then rounding share quantities to N
   decimal places means the allocated dollars almost never sum exactly back
   to the requested amount. I round share quantities **down** (never up) so
   an order can never cost more than the amount authorised, and I report
   the leftover as an explicit `residualCash` field on the response instead
   of silently discarding it or forcing one arbitrary stock to "absorb" the
   remainder. I considered normalizing so the last allocation absorbs the
   remainder, but that produces uneven treatment based purely on portfolio
   ordering, which felt more surprising than an explicit residual figure.

2. **Portfolio weights must sum to 100% (within a small, configurable
   tolerance)**, rather than being auto-normalized. Silently normalizing an
   invalid portfolio (e.g. weights summing to 80%) could mask a partner-side
   bug where a stock was dropped from the payload; I'd rather reject with a
   clear error. The tolerance exists purely to absorb floating-point noise
   from callers (e.g. `33.33 + 33.33 + 33.34`).

3. **SELL uses the same computation as BUY.** Since the requirement is "no
   persistence across restarts," there's no durable concept of the
   partner's current holdings to sell *against*. I treated `side` as a
   label on otherwise-identical math (percentage of a total amount → dollar
   amount → share quantity at a resolved price) rather than inventing a
   fictitious holdings model. In a real system, SELL would almost certainly
   need to validate against actual position sizes.

4. **Execution date logic is intentionally simple.** "Markets are open
   Monday through Friday" is modeled as: if the order is submitted on a
   trading day, it executes that same day; if submitted on a weekend, it
   rolls forward to the next Monday. I did not model market holidays,
   intraday cutoff times (e.g. "orders after 4pm execute next day"), or time
   zones beyond UTC, since none of those were specified and guessing at a
   specific brokerage's cutoff rules seemed more likely to be wrong than
   useful.

5. **Decimal precision for share quantities is a deployment-time
   configuration value** (`SHARE_QUANTITY_DECIMAL_PLACES` env var), not a
   per-request field. The brief says "we should be able to configure" it
   internally, which I read as an operator/platform concern, not something
   each partner request should be able to override.

6. **`GET /orders` needs filtering and pagination** even though the brief
   just says "returns historic orders" — I added `symbol`, `side`,
   `from`/`to` (execution date range), and `limit`/`offset`, since an
   unbounded, unfilterable list is not a realistic API even for a POC.

## What challenges did you face when creating your solution?

The main technical challenge was getting money arithmetic right without
introducing floating-point bugs — e.g. `0.1 + 0.2 !== 0.3` in JS — while
still supporting an arbitrary, configurable decimal precision for share
quantities (which could be 0 or could be 7). I solved this with
`decimal.js` for all intermediate calculations and made the rounding
direction (down, for quantities; standard half-up, for currency display)
explicit and centralized in `src/domain/money.ts`, rather than rounding
ad-hoc at each call site.

The second challenge was designing the response shape so that rounding
behaviour is *legible* rather than something the caller has to reverse
engineer. Early on I considered just returning `amount` and `quantity` per
stock; I added `targetAmount` vs. `actualAmount` and `priceSource` so a
caller can see, per stock, what was requested vs. what was actually
achievable at the configured precision, and why a given price was used.

Balancing "production-grade" against "proof-of-concept, no real
persistence" was also a judgment call throughout — e.g. I added an
`OrderRepository` interface (which would matter for testability and future
swap-in of a real datastore) but deliberately did not add things like
auth, rate limiting, or a real database, since the brief explicitly scoped
those out for this stage (see below for what I'd add for production).

## If you were to migrate your code from its current standalone format to a fully functional production environment, what are some changes and controls you would put in place (e.g. security controls)?

**Persistence & data integrity**
- Replace `InMemoryOrderRepository` with a real datastore (e.g. Postgres),
  behind the same `OrderRepository` interface, so no other layer changes.
- Add idempotency keys on `POST /orders/split` so a retried request (network
  blip, partner-side retry logic) doesn't create a duplicate order.
- Move order execution from "compute and respond synchronously" to an
  async workflow: persist the order as `PENDING`, publish an event/queue
  message, and have a separate execution worker actually place the
  brokerage order and update status — real order execution shouldn't be a
  request/response cycle.

**Security**
- AuthN/AuthZ: partner-scoped API keys or OAuth2 client-credentials, with
  requests scoped to the calling partner (no `orderId` should be fetchable
  cross-partner — currently there's no partner concept at all, which is a
  real gap for production).
- Rate limiting and request size limits per partner/API key.
- Strict input validation at the edge (already have Zod) plus output
  encoding; `helmet` is already in place for baseline HTTP headers, but TLS
  termination, HSTS, and a proper CORS allow-list (currently wide open)
  are needed before this is externally reachable.
- Secrets (DB credentials, upstream market-data API keys) via a secrets
  manager, not `.env` files, with rotation.
- Audit logging of every order-affecting mutation, separate from the
  general application log stream.

**Correctness / financial controls**
- Real market-data integration with a documented staleness/fallback policy
  — right now "market price" is just whatever the caller sends, which is
  fine for a POC but not something you'd trust unvalidated in production
  (a partner could pass an arbitrary price). This needs either a trusted
  price feed or a sanity-check band against a trusted feed.
- Reconciliation: verify `sum(allocations.actualAmount) + residualCash ==
  totalAmount` as an automated invariant/alert, and reconcile against the
  broker's actual fill reports.
- A real holdings ledger if SELL is meant to validate against existing
  positions.

**Operability**
- Replace ad-hoc `console.log` timing/error logs with structured logging
  (e.g. `pino`) shipped to a log aggregator, correlation/request IDs
  threaded through, and metrics (request rate, latency percentiles, error
  rate) exported to a monitoring system rather than only visible in local
  console output.
- Health/readiness probes suitable for orchestration (Kubernetes-style
  liveness/readiness, not just the current `/health`).
- Graceful shutdown (drain in-flight requests, close DB connections) and
  horizontal scalability (the current in-memory store is inherently
  single-instance; a shared datastore is required to run more than one
  replica).
- CI pipeline running lint, typecheck, tests, and dependency vulnerability
  scanning on every change.

## If you've used LLMs to solve the challenge, describe how and where you've used it and how did it help you in tackling the challenge? Provide specific example and details

I used an LLM (Claude, via Claude Code) as a pair-programmer for scaffolding
and iteration speed, while making the architectural and business-rule
decisions myself. Concretely:

- **Scaffolding boilerplate**: project setup (`package.json`, `tsconfig.json`,
  ESLint/Prettier config, Jest config, Express app wiring, middleware
  skeletons) was generated by the assistant from a specification I gave it
  after I'd already decided the layering (domain / service / repository /
  controller / routes) and the key design decisions listed above (rounding
  direction, residual-cash reporting, price-priority rule, weekday-only
  execution logic). This saved time on repetitive setup that has one
  obviously-correct shape, letting me spend more time on the parts that
  actually required judgment — e.g. how to represent rounding drift in the
  response, and where business-rule validation should live versus schema
  validation.
- **Swagger/OpenAPI annotations**: writing complete, valid `swagger-jsdoc`
  JSDoc blocks by hand for every endpoint (including nested schema refs,
  example payloads for both the default-price and market-price-override
  cases) is mechanical and error-prone to hand-write; I specified the
  request/response shapes and had the assistant produce the annotations,
  then verified the generated `/docs.json` output actually matches the real
  Zod validation behaviour (e.g. confirmed the "weights must sum to 100%"
  rule in code has a corresponding documented 400 response).
- **Test case enumeration**: I asked for a thorough pass over edge cases for
  the splitter (empty portfolio, duplicate symbols, out-of-range weight,
  non-positive price/amount, precision widened to 7 decimals, weekend vs.
  weekday execution dates) to make sure my own mental list wasn't missing
  anything, then reviewed and adjusted the actual assertions myself (e.g.
  the rounding-down test explicitly checks that allocated total never
  exceeds the requested amount, which encodes the safety property I cared
  about, not just "some number came back").

In every case, I reviewed the generated code line by line rather than
accepting it blind — the money-rounding logic in particular I re-derived by
hand against the test cases to be confident the `decimal.js` usage does
what I intend (round shares down, round currency to cents with half-up),
since that's the part of this system I'd be least comfortable getting
wrong in a real financial context.
