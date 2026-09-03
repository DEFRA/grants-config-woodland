---
'grants-config-woodland': patch
---

TGC-1632: Redirect all agreement-stage GAS statuses to /agreement. The redirect rule only matched STATUS_AGREEMENT_OFFERED and STATUS_APPLICATION_COMPLETED, so any application in STATUS_AGREEMENT_ACCEPTED falls through to the confirmation page
