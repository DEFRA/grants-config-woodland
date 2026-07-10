# Agreements (WMP) integration tests

Boots [farming-grants-agreements-api](../../../farming-grants-agreements-api) with its dependencies
mocked by **floci** (SQS/SNS/S3) + replica-set MongoDB, sends each woodland `test-data/*.json`
fixture as a **`create_agreement` CloudEvent** (the way GAS forwards approved applications), and
checks the outputs — the persisted agreement in MongoDB **and** the emitted `agreement_status_updated`
event.

It complements `test/gas/` (which submits the same fixtures to GAS over HTTP). Here the service
ingests **by event**, asynchronously, so outcomes are observed rather than returned in a response.

## Prerequisites

- Docker running.
- A local `../farming-grants-agreements-api` checkout (override with `AGREEMENTS_REPO_PATH`).
- First run pulls `hectorvent/floci:1.1.0` and `defradigital/node-development:latest-24` and builds
  the app image (`mongo:6.0.13` / `amazon/aws-cli` are typically already cached) — **sizeable
  downloads**, so run on a good connection.

## Run

```bash
npm run test:agreements            # boot stack, send events, assert outcomes
npm run test:agreements:verbose    # same, streaming app logs (PRINT_LOGS=1)
```

Excluded from the default `npm test` (which stays Docker-free). The app's own compose hard-codes host
ports (floci `:4566`, mongo `:27017`, app `:3555`) — nothing else should occupy them during a run.

## How it works

- The event is sent straight to floci's `create_agreement_fifo.fifo` SQS queue (as
  `farming-grants-agreements-api/scripts/send-wmp-sqs-message.sh` does). `code: "woodland"` routes to
  the service's WMP handler.
- **Strict verbatim**: `data.answers` is the fixture unchanged. Only the CloudEvent envelope and the
  top-level `identifiers` (`sbi` derived from `applicant.business.sbi`, others defaulted) are
  synthesised — these are transport concerns, not answer content.

## Setting expectations

`expectations.json` is keyed by fixture filename:

- `accepted: true` — a `versions` document is created (`status: "offered"`, `agreementNumber`
  starting `WMP-`) **and** an `agreement_status_updated` event is emitted (`data.status: "offered"`,
  `code: "woodland"`).
- `accepted: false` — the WMP handler rejects the event: the app log contains `errorContains`
  (default `"Invalid WMP create-agreement payload"`, which the handler prefixes onto every
  validation failure), and **no** agreement version is persisted.

Because ingestion is async, rejected cases are confirmed via the captured app-container log (proving
the event was received and refused) plus absence of a persisted version.

## Current findings

With strict-verbatim wrapping, **all five woodland fixtures are rejected** — the woodland test-data
does not satisfy the agreements WMP contract:

- **`applicant.customer` shape** — the fixtures use `customer.firstName/lastName`, but the WMP schema
  (`farming-grants-agreements-api/src/api/agreement/helpers/schemas/wmp-create-agreement.schema.js`)
  requires `customer.name.{first,last}`. This affects `happy-path`, `boundary-minimum-values`,
  `complex-eligibility-flags`, and `large-multi-parcel`.
- **`optional-fields-omitted.json`** additionally omits `applicant`, `payments`, and
  `totalAgreementPaymentPence`, all required by WMP.

This is a genuine GAS→agreements contract gap (GAS forwards raw answers unchanged): either the
woodland answers should carry `customer.name.{first,last}`, or the agreements WMP schema should accept
the GAS shape. The harness documents it per fixture and is the regression guard once it's reconciled.

To prove the `accepted` path, add a correctly-shaped fixture (see
`farming-grants-agreements-api/src/api/common/helpers/sample-data/wmp-agreement.js`) and set it to
`{ "accepted": true }`.
