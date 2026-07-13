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

## Expectations

The GAS verdict for each fixture comes from the shared source of truth,
`test/pipeline/expectations.json` (see `test/pipeline/README.md`), keyed by
fixture filename:

```jsonc
{
  "happy-path.json": { "gas": "accept" },
  "some-invalid.json": {
    "gas": "reject",
    "errorContains": "fgSumMin validation failed"
  }
}
```

- `gas: "accept"` — expect `204` and a matching `grant_application_created`
  event (`data: { clientRef, code: "woodland", status }`, where `status` is the
  grant's initial `phase:stage:status`, derived from the built config). By the
  cross-service invariant, every such fixture must also be accepted by every
  downstream suite.
- `gas: "reject"` — expect `400`; `errorContains` asserts a substring of the
  validation message, and no event must be emitted.

`test/pipeline/expectations.test.js` guards that every fixture has an entry.

## Current findings

Four curated fixtures are rejected by GAS:

- **`boundary-minimum-values.json`** — `hectaresTenOrOverYearsOld` +
  `hectaresUnderTenYearsOld` = 0.4 (`fgSumMin` requires ≥ 0.5), and
  Σ `landParcels[].areaHa` ≠ `totalHectaresForSelectedParcels` (`fgSumEquals`).
  These are cross-field rules in `gas.json` the raw schema cannot express.
- **`complex-eligibility-flags.json`** — `appLandHasExistingWmp: true` but the
  conditionally-required `existingWmps` field is missing.
- **`decimal-numeric-values.json`** — non-integer pence, rejected by the shared
  schema's `type: integer` constraint.
- **`missing-required-fields.json`** — omits `applicant`, `payments` and
  `totalAgreementPaymentPence`, now required by the shared schema so GAS gates
  everything the downstream agreements service needs.

## No accepted cross-service gaps

GAS forwards answers verbatim, so anything GAS accepts must be accepted by every
downstream service. The shared schema was tightened (the required
`applicant`/`payments`/`totalAgreementPaymentPence` above) to close the one former
gap. The invariant is now enforced structurally — see `test/pipeline/README.md`
and `docs/downstream-schema-verification.md`.
