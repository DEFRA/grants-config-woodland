# Verifying downstream service contracts

## Purpose

A woodland application is authored against one shared JSON Schema
(`configurations/woodland/gas/woodland-application.schema.json`) and then flows
through several independently-owned services:

```
author ─▶ GAS (fg-gas-backend) ─▶ [create-agreement event] ─▶ Agreements (farming-grants-agreements-api)
                                └▶ [create-case event]      ─▶ Casework (fg-cw-backend)
```

The shared schema is the _authority_, but each downstream service applies its
**own** validation to the same data. Because **GAS forwards the answers verbatim**,
if a downstream service expects more than the shared schema guarantees, an
application can be accepted by GAS and then **rejected downstream** — stuck in
production. That class of defect is **not acceptable**: anything GAS accepts must
be accepted by every downstream service.

**The invariant is now enforced by the pipeline suites** (`test/pipeline`,
`test/gas`, `test/agreements`): the shared schema + `gas.json` rules that make up
the GAS gate must be at least as strict as the union of what all downstream
services require. When a downstream requirement is found, it is closed by
**tightening the GAS gate**, not by tolerating a gap.

Constraints already pulled into the GAS gate:

| Constraint enforced downstream                                           | Where                                                  | GAS gate now                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| `applicant.customer.name.{first,last}` / `business.name` required        | Agreements Joi (`wmp-create-agreement.schema.js`)      | ✅ typed & required in the shared schema                       |
| `applicant` / `payments` / `totalAgreementPaymentPence` required         | Agreements Joi                                         | ✅ added to the shared schema `required`                       |
| `totalAgreementPaymentPence` / `agreementTotalPence` must be **integer** | Agreements Joi (`moneyPence = Joi.number().integer()`) | ✅ `type: integer`                                             |

Constraints JSON Schema **cannot faithfully express** are enforced by GAS's own
custom keywords or remain candidates to pull into the gate as fixtures exercise
them:

| Constraint enforced downstream                            | Where                                           | GAS gate                                                                 |
| --------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `sum(hectares…)` min / max / equals rules                 | Agreements + GAS AJV custom keywords            | ✅ `fgSumMin/Max/Equals` in `gas.json`                                   |
| `sum(agreementTotalPence) === totalAgreementPaymentPence` | Agreements Joi (`checkPaymentTotal`)            | ⚠️ not yet in the gate — add an `fgSumEquals`-style rule to `gas.json` if a fixture reaches it |
| hectares / `areaHa` limited to 4 decimal places           | Agreements Joi (`.precision(4)`)                | ⚠️ `multipleOf: 0.0001` yields floating-point false-negatives in AJV, so not enforced in schema; would need a custom keyword |

> Note: `decimal-numeric-values.json` (non-integer pence) and
> `missing-required-fields.json` (omits `applicant`/`payments`/`totalAgreementPaymentPence`)
> are now **rejected by GAS itself**, so they never reach a downstream service —
> the gaps they once illustrated are closed at the gate.

Two verification strategies are available. They are complementary, not
alternatives; this document sets out the merits and pitfalls of each so we can
decide how to combine them.

---

## Approach A — Dynamic pipeline testing (the method in use today)

### How it works

`test/gas/**` and `test/agreements/**` boot the **real** downstream services in
Docker via Testcontainers, with their infrastructure dependencies **mocked**
(LocalStack / floci for SQS/SNS/S3, a throwaway replica-set MongoDB):

- `test/gas/setup.js` builds `fg-gas-backend` from source and waits on `/health`.
- `test/agreements/setup.js` builds `farming-grants-agreements-api` from source
  behind its `full` compose profile.
- Each suite iterates the fixtures in
  `configurations/woodland/gas/test-data/*.json`, wraps them
  (`test/gas/envelope.js`, `test/agreements/event.js`), submits/publishes them,
  and asserts the real outcome against `expectations.json` (a 204 + emitted
  CloudEvent, a persisted `offered` agreement version, or a specific rejection
  message in the app log).

In other words: **send objects that match the schema to a real instance of the
service and observe what actually happens.**

### Merits

- **Behaviourally faithful.** It exercises the _actual_ validator, the _actual_
  event envelope, serialization, persistence and emitted events. If the service
  rejects, mis-maps, or 500s, the test sees it. No modelling error.
- **Catches everything, including the inexpressible.** Custom cross-field rules
  (`checkPaymentTotal`, `fgSumMin/Max/Equals`), numeric precision, type
  coercion, ordering, encoding — all are enforced by the real code, so all are
  covered without us having to re-describe them.
- **Tests the whole pipeline, not just a schema.** It confirms GAS→SQS→Agreements
  wiring, message-group/dedup behaviour, and downstream state, not merely that a
  payload shape is acceptable.
- **Regression guard with intent.** `expectations.json` documents each known gap
  (`accepted:false` + `errorContains`) as an executable assertion, so a fix or a
  regression is caught the moment behaviour changes.
- **No cross-team contract artifact required.** Works today, against the code as
  it actually is, with nothing to publish or keep in sync.

### Pitfalls

- **Only tests the fixtures you wrote.** Coverage is by example. A field
  combination nobody thought to encode is simply never exercised. (This is the
  gap our earlier property-based / fuzzing discussion aimed at.)
- **Needs local checkouts of every service.** The suites resolve
  `../../../fg-gas-backend` and `../../../farming-grants-agreements-api`
  (overridable via `GAS_REPO_PATH` / `AGREEMENTS_REPO_PATH`). **This does not fit
  CI** without cloning and building each service — the specific constraint that
  motivated looking at a static approach.
- **Slow and heavy.** Docker build-from-source + replica-set Mongo + LocalStack
  per suite; `hookTimeout` is 180–240s. Minutes per run, not seconds.
- **Flake surface.** Async ingestion (poll-for-version, log-scraping),
  container start-up races, port collisions, image-build failures — all are
  sources of non-determinism unrelated to the contract under test.
- **Mocked dependencies can hide or invent behaviour.** LocalStack/floci are not
  byte-for-byte AWS; an SNS→SQS envelope quirk or an S3 edge case may differ
  from production either way.
- **Version drift is invisible.** The test builds whatever is checked out on
  disk. It gives no signal about the version actually deployed in an environment.

---

## Approach B — Static schema-contract diff (proposed)

### How it works

Each service **publishes**, generated from the same validator it runs at
runtime, a machine-readable schema for every payload it ingests:

- HTTP request bodies via **OpenAPI** (hapi-swagger already does this in
  `land-grants-api`).
- Event payloads (create-agreement, create-case) via **AsyncAPI**, or as a named
  JSON Schema published in the OpenAPI `components/schemas` section. _This piece
  is essential — see the first pitfall._

This repo's CI then, **without any local checkout**:

1. Fetches each service's published spec from GitHub (a committed
   `openapi.json` / `*.schema.json` via raw URL or `gh api`, or a release asset).
2. Extracts the relevant ingest-payload schema.
3. Runs a **semantic subset diff** against
   `woodland-application.schema.json`, asserting the property:

   > _every instance the shared schema accepts must also be accepted by the
   > downstream schema._

   Any counterexample (a field the downstream requires but the shared schema
   doesn't guarantee, a stricter type, a different shape) is a contract gap,
   reported in the `expectations.json` idiom and failing CI when a **new** gap
   appears against a committed baseline.

In other words: **compare the schemas themselves and reason about the whole
input space at once, without sending any data or running any service.**

### Merits

- **Exhaustive over the input space.** A subset diff reasons about _all_
  schema-valid instances simultaneously, not a handful of fixtures. It cannot
  "miss a case you didn't think of."
- **CI-native, no service runtime.** Fetch two JSON documents, diff them. No
  Docker, no Mongo, no LocalStack, no local checkouts — runs in seconds and
  fits CI cleanly (the original requirement).
- **Fast and deterministic.** No async ingestion, no containers, so effectively
  zero flake.
- **Language / framework neutral.** Once each service emits an open-standard
  spec, the diff is indifferent to Joi vs AJV vs Zod. The published artifact is
  also independently useful (docs, client generation, governance).
- **Version-anchored.** Diffing a _released_ spec tells you about a specific,
  identifiable version rather than "whatever is on my disk."
- **Pinpoints the shape mismatch precisely.** It reports "`answers.applicant.
customer.name` required / not provided by shared schema" directly, rather than
  inferring intent from a runtime error string.

### Pitfalls

- **The risky contracts here are events, not HTTP.** hapi-swagger documents Hapi
  **routes**. But Agreements validates the create-agreement payload
  _imperatively inside an SQS consumer_ (`wmp-create-offer.js`), and Casework's
  create-case is likewise an SQS event with no schema at all. GAS's HTTP submit
  route is the one synchronous surface — and it already reuses the shared schema,
  so there is nothing to diff there. **OpenAPI alone would document the wrong
  boundary and miss the create-agreement contract entirely.** Covering it
  requires AsyncAPI or explicitly publishing the event Joi schema as a component.
- **Drift between spec and enforcement.** A generated spec is only trustworthy if
  it is produced from the _same object_ that validates at runtime, and each
  service's CI fails when the artifact is stale. A hand-maintained or
  loosely-coupled spec gives false confidence.
- **Lossy conversion of the interesting constraints.** Joi→JSON Schema drops
  exactly the subtle rules: `.precision(4)` has no faithful equivalent
  (`multipleOf: 0.0001` is an approximation), `Joi.alternatives()` converts
  awkwardly, and **custom cross-field validators cannot be expressed at all** —
  `checkPaymentTotal` and GAS's `fgSum*` keywords simply vanish from a published
  spec. The static diff is therefore a **lower bound**: it can prove a shape
  mismatch exists, but cannot see rules that live in code.
- **Cross-team dependency and governance.** Every service must add
  spec-generation + a publish/freshness check to its own repo and pipeline.
  Larger blast radius than a self-contained test in this repo.
- **JSON Schema dialect skew.** hapi-swagger typically emits OpenAPI 3.0, whose
  schema object is a JSON-Schema _variant_ (nullable handling, not draft
  2020-12). The shared schema is 2020-12; the diff must normalise dialects.
- **Rename blindness in off-the-shelf diff tools.** `firstName` → `name.first`
  reads to a generic differ as "unknown property removed" + "new required
  property", not as the shape change it is. The semantic comparator still has to
  be written by us; OpenAPI only standardises the _input format_.
- **Cannot see behaviour.** Persistence failures, event-envelope bugs,
  serialization, ordering, mocked-vs-real infra differences — none of these are
  schema properties, so a static diff is blind to them.

---

## Side-by-side

| Dimension                                                  | A — Dynamic pipeline                  | B — Static schema diff                         |
| ---------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| Input coverage                                             | Only the fixtures written             | Exhaustive over the schema's input space       |
| Runs in CI without local checkouts                         | No (builds services from source)      | Yes (fetches specs from GitHub)                |
| Speed                                                      | Minutes (Docker + Mongo + LocalStack) | Seconds (two documents)                        |
| Flake risk                                                 | Real (containers, async ingestion)    | Negligible                                     |
| Custom / cross-field rules (`checkPaymentTotal`, `fgSum*`) | Covered (real validator runs)         | **Not covered** (inexpressible)                |
| Numeric precision / type coercion                          | Covered exactly                       | Partial / lossy                                |
| Shape & required-field mismatches                          | Covered, via runtime error            | Covered, precisely and up front                |
| Event (non-HTTP) contracts                                 | Covered natively                      | Only if AsyncAPI / component schemas published |
| Behaviour, persistence, wiring                             | Covered                               | **Not covered**                                |
| Version anchored                                           | "Whatever is on disk"                 | A specific released spec                       |
| Cross-team prerequisite                                    | None                                  | Each service must publish a spec               |

## What each approach would catch

Against the gaps listed at the top:

| Gap                                                    | A — Dynamic           | B — Static                 |
| ------------------------------------------------------ | --------------------- | -------------------------- |
| `customer.name.{first,last}` vs `firstName`/`lastName` | ✅ rejection observed | ✅ shape/required diff     |
| `business.name` required                               | ✅                    | ✅                         |
| Integer-only pence (`decimal-numeric-values.json`)     | ✅                    | ✅ (`integer` vs `number`) |
| `.precision(4)` on hectares / `areaHa`                 | ✅                    | ⚠️ approximate only        |
| `checkPaymentTotal` cross-field                        | ✅                    | ❌ inexpressible           |
| GAS `fgSumMin/Max/Equals`                              | ✅                    | ❌ inexpressible           |
| Serialization / persistence / event wiring             | ✅                    | ❌ out of scope            |

---

## Recommendation: use both, deliberately

The two approaches fail in **opposite** directions, which is why they belong
together rather than in competition:

- **Static diff** is exhaustive over the input space but blind to behaviour and
  to any rule that lives in code. Best as a **fast CI gate** that catches
  structural drift — required fields, shapes, types — the moment a downstream
  spec and the shared schema diverge, on every PR, with no service running.
- **Dynamic pipeline testing** samples the input space but is behaviourally
  exact. Best as a **deeper, slower stage** (or nightly) that proves the custom
  rules, wiring and persistence the static diff cannot express — ideally driven
  by property-based generation so it stops depending on hand-written fixtures.

Suggested split:

1. **CI gate (static, per PR):** fetch published downstream specs from GitHub,
   run the semantic subset diff against `woodland-application.schema.json`, fail
   on any gap not in a committed baseline (same regression-guard idiom as
   `expectations.json`). Prerequisite: each service publishes a generated,
   drift-checked spec — OpenAPI for HTTP, AsyncAPI / component schema for events.
2. **Deep stage (dynamic, scheduled or on-demand):** keep the Testcontainers
   suites for the rules and behaviour static analysis can't see, and extend them
   with property-based generation + shrinking to turn discovered failures into
   new fixtures.

The static gate removes the CI-coupling and coverage-by-example weaknesses of
the dynamic suite; the dynamic suite covers the custom-rule and behavioural
blind spots of the static gate. Neither is sufficient alone.
