# grants-config-woodland

Configuration for woodland grant journeys, including Woodland Management Plan application and lifecycle behaviour.

## Language

**Woodland**
The grant family represented by `configurations/woodland`.
_Avoid_: Land grants, Grasslands, Generic grant when this configuration is meant

**Woodland Management Plan**
The woodland grant journey commonly abbreviated as WMP.
_Avoid_: Woodland grant when the specific plan journey matters, Forest plan

**Grant configuration**
A versioned set of files that describes a woodland journey and related integration metadata.
_Avoid_: Source code, Runtime state, Test script

**Grants UI config**
Configuration consumed by Grants UI to render pages, routes, components, and validation.
_Avoid_: GAS config, Casework config, Test data

**GAS config**
Configuration used by the Grants Application Service integration.
_Avoid_: Grants UI config, Casework config, Backend state

**Casework config**
Configuration used by casework-facing flows or downstream administration.
_Avoid_: Grants UI config, GAS config, User answers

**Grant journey**
The end-to-end user flow rendered from the woodland configuration.
_Avoid_: Wizard, Survey, Funnel

**Changeset**
The release note/version marker required for configuration changes.
_Avoid_: Changelog entry when the `.changeset` file is meant, Commit message

**Journey test**
An end-to-end Playwright browser test in `test/grants-ui` that exercises a woodland grant journey through Grants UI.
_Avoid_: Unit test, Smoke test, Performance test

**Application journey**
The full eligible WMP application path from sign-in through confirmation.
_Avoid_: Scenario when the whole user journey is meant, Script

**Application lifecycle**
The post-submission path through amend, offer sent, claim, and withdrawn states.
_Avoid_: Browser lifecycle, Test lifecycle, Deployment lifecycle

**CRN**
Customer Reference Number: the Defra ID identifier for an individual user.
_Avoid_: SBI, User ID, Account number
