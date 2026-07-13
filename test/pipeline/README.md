# Cross-service pipeline contract

Woodland applications flow:

```
author ─▶ GAS (fg-gas-backend) ─▶ downstream services (agreements today, more later)
```

GAS forwards the application `answers` **verbatim** to downstream services (it computes nothing).
So the contract we must never break is:

> **If GAS accepts an application, every downstream service must accept it too.**

A GAS-accepted application that a downstream service rejects is stuck in production — it cannot be
processed and cannot be cleanly rejected back to the applicant.

## How the invariant is enforced

`expectations.json` is the **single source of truth**. It declares **only** each fixture's GAS
verdict — `{ "gas": "accept" }` or `{ "gas": "reject", "errorContains": "…" }`. There is deliberately
**no** per-downstream accept/reject file, so a gap can't be quietly declared as expected.

The rule lives in the suites, not the data:

- **`test/gas`** asserts GAS's real behaviour matches the declared verdict (accept → `204` + a
  `application.created` event; reject → `400` containing `errorContains`). This proves the
  accept-list is truthful.
- **Each downstream suite** (`test/agreements`, …) reuses `gasAcceptedFixtures` from `fixtures.js`
  and, for **every GAS-accepted fixture**, asserts that service **accepts** it. A rejection fails the
  build with an explicit contract-violation message.

The conjunction — "GAS accepts exactly these" ∧ "every downstream accepts all of those" — is the
invariant. Neither suite can be made green while a gap exists.

`expectations.test.js` is a fast, Docker-free guard that keeps `expectations.json` well-formed and in
lock-step with the fixtures on disk.

## Running it

```bash
npm run test:pipeline     # GAS suite then every downstream suite (the invariant, end to end)
npm run test:gas
npm run test:agreements
```

## Adding a downstream service

1. Add `test/<service>/…` that boots the service.
2. Import `gasAcceptedFixtures` and `loadFixture` from `test/pipeline/fixtures.js`.
3. For each GAS-accepted fixture, submit it to the service and assert it is **accepted** — fail with
   a clear "GAS accepts X but <service> rejected it" message otherwise.
4. Add the service to the `test:pipeline` script.

No change to `expectations.json` or the other suites is needed — the invariant extends automatically.

## Closing gaps

Because GAS is the gate, the shared schema (`configurations/woodland/gas/woodland-application.schema.json`)
plus the `gas.json` cross-field rules must be at least as strict as the union of what all downstream
services require. When a new downstream requirement is found (a required field, a cross-field rule),
close the gap by tightening the GAS gate — not by relaxing the downstream or declaring an exception.
