---
'grants-config-woodland': minor
---

Add PHASE_CLAIM to the woodland GAS grant definition and CW workflow definition for the claims journey. GAS: remove STAGE_APPLICATION_COMPLETED and STAGE_PREPARE_CLAIM from PHASE_PRE_AWARD, update externalStatusMap with new PHASE_CLAIM mapping, and update entitlementTemplates availableAt to reference the new claim position. CW: re-target ACTION_APPROVE_FC_REVIEW into PHASE_CLAIM:STAGE_PREPARE_CLAIM, add three new claim stages (STAGE_PREPARE_CLAIM, STAGE_AWAITING_CLAIM, STAGE_CLAIM_COMPLETE) with claim-preparation tasks and transitions.
