---
'grants-config-woodland': patch
---

TGC-1632: Route all agreement-stage GAS statuses to /agreement. The redirect rule only matched STATUS_AGREEMENT_OFFERED and STATUS_APPLICATION_COMPLETED, so an application in STATUS_AGREEMENT_ACCEPTED (applicant accepted the agreement) fell through to the static "Application submitted" confirmation page, and an application still in STATUS_AGREEMENT_READY_FOR_APPLICANT (agreements service has offered the agreement, case working has not yet advanced the status) did the same. The rule now matches every workflow status from which the agreement is customer-accessible. The literal STATUS_AGREEMENT_OFFERED state already routed to /agreement in this configuration, so the reported offered-agreement case is not reproduced by current rule data; closing it out needs the deployed definition version, the actual GAS status response, and redirect-path/log evidence.
