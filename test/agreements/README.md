# Agreements (WMP) integration tests — downstream half of the pipeline invariant

Boots [farming-grants-agreements-api](../../../farming-grants-agreements-api) with its dependencies
mocked by **floci** (SQS/SNS/S3) + replica-set MongoDB, and enforces the cross-service contract for
this downstream service:

> **Every application GAS accepts must be accepted by agreements.**

GAS forwards the answers verbatim, so a rejection here is a stuck-in-production incident. The suite
therefore sends **only the GAS-accepted fixtures** (`gasAcceptedFixtures` from
`test/pipeline/fixtures.js`) as a **`create_agreement` CloudEvent** (the way GAS forwards approved
applications) and asserts each is **accepted** — a persisted `offered` agreement in MongoDB **and** an
emitted `agreement_status_updated` event. Any rejection fails with a `CONTRACT VIOLATION` message.

It is the downstream counterpart to `test/gas/` (which asserts GAS's verdicts). See
`test/pipeline/README.md` for the shared source of truth and the invariant. GAS-rejected fixtures
never reach agreements in production, so they are not exercised here; agreements' own negative
validation lives in its own repo.

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

## Which fixtures run

The suite reads `gasAcceptedFixtures` from `test/pipeline/fixtures.js` — the fixtures whose GAS
verdict is `accept` in `test/pipeline/expectations.json`. Each must produce a `versions` document
(`status: "offered"`, `agreementNumber` starting `WMP`) **and** an emitted `agreement_status_updated`
event (`data.status: "offered"`, `code: "woodland"`). There is no per-fixture accept/reject file here
by design — the rule is fixed ("GAS-accept ⟹ agreements accepts"), so a gap can only surface as a
failure, never be declared away.

Currently GAS accepts `happy-path` and `large-multi-parcel`; both must be accepted here. The canonical
accepted shape is
`farming-grants-agreements-api/src/api/common/helpers/sample-data/wmp-agreement.js`.

## Closing gaps

If a fixture GAS accepts is rejected here, do **not** relax agreements or add an exception — tighten
the GAS gate (the shared schema in `configurations/woodland/gas/woodland-application.schema.json` or
the `gas.json` cross-field rules) so GAS stops accepting it. That is how the former
`applicant`/`payments`/`totalAgreementPaymentPence` gap was closed.
