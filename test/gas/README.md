# GAS integration tests

Boots a real [fg-gas-backend](../../../fg-gas-backend) (GAS) with its mocked
dependencies (replica-set MongoDB + LocalStack SNS/SQS) in Docker, uploads the
built woodland grant config, submits every `test-data/*.json` fixture wrapped in
the application request envelope, and asserts a per-fixture expectation — both
the HTTP outcome **and** the `grant_application_created` CloudEvent emitted on
LocalStack SQS.

This complements `test/schema-contract.test.js`: that validates fixtures against
the raw JSON schema only, whereas this exercises everything GAS layers on top —
the cross-field rules in `gas.json` (`fgSumEquals` / `fgSumMin` / `fgSumMax`, the
`appLandHasExistingWmp` `if/then/else`), the request envelope, and the emitted
events.

## Prerequisites

- Docker running.
- A local `../fg-gas-backend` checkout (override with `GAS_REPO_PATH`). There is
  no published GAS image, so the stack is built from source on first run.
  `setup.js` seeds `fg-gas-backend/.env` from `.env.example` if it is missing.

## Run

```bash
npm run test:gas            # build config, boot stack, submit fixtures
npm run test:gas:verbose    # same, streaming GAS container logs (PRINT_LOGS=1)
```

The suite is excluded from the default `npm test` (which is Docker-free). The
first run builds the GAS image (a few minutes); later runs reuse the stack and
replace the grant via `PUT /tmp/grants/woodland`.

## Setting expectations

`expectations.json` is keyed by fixture filename:

```jsonc
{
  "happy-path.json": { "accepted": true },
  "some-invalid.json": {
    "accepted": false,
    "errorContains": "fgSumMin validation failed"
  }
}
```

- `accepted: true` — expect `204` and a matching `grant_application_created`
  event (`data: { clientRef, code: "woodland", status }`, where `status` is the
  grant's initial `phase:stage:status`, derived from the built config).
- `accepted: false` — expect `400`; `errorContains` asserts a substring of the
  validation message, and no event must be emitted.

Every fixture must have an entry (a guard test enforces this).

## Current findings

Two curated fixtures are **valid against the raw schema but rejected by GAS's
cross-field rules**, and are therefore currently marked `accepted: false`:

- **`boundary-minimum-values.json`** — `hectaresTenOrOverYearsOld` +
  `hectaresUnderTenYearsOld` = 0.4 (`fgSumMin` requires ≥ 0.5), and
  Σ `landParcels[].areaHa` ≠ `totalHectaresForSelectedParcels` (`fgSumEquals`).
- **`complex-eligibility-flags.json`** — `appLandHasExistingWmp: true` but the
  conditionally-required `existingWmps` field is missing.

If these fixtures are meant to be accepted, reconcile the data (or the `gas.json`
rules) and flip the expectations to `accepted: true`.
