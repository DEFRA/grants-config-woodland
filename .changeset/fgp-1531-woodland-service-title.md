---
'grants-config-woodland': patch
---

Set the Woodland agreement serviceTitle to "Woodland Management Plan", so the service navigation on GAS-driven agreement pages no longer says "Farm payments".

Requires the fg-gas-backend FGP-1531 change to be deployed first: earlier GAS versions reject agreement definitions with a serviceTitle.
