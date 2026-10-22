---
'grants-config-woodland': minor
---

Stop the woodland claim being offered to the applicant before Casework has completed the claim-prep task, in gas.next.json only.

Approving the Forestry Commission review moves the Casework case to PHASE_CLAIM:STAGE_PREPARE_CLAIM:STATUS_PREPARING_CLAIM, but GAS mapped that straight to PHASE_CLAIM:STAGE_AWAITING_CLAIM:STATUS_AWAITING_CLAIM. Because the entitlement was both available and claimable at STATUS_AWAITING_CLAIM, the claim appeared in Grants UI as soon as the entitlement was created in Grant Ops. If the applicant claimed at that point, GAS moved to STATUS_CLAIM_COMPLETE and Casework rejected the update ("transition does not exist"), leaving the two services holding different states for the case.

Changes, all in configurations/woodland/gas/gas.next.json:

- Add GAS stage PHASE_CLAIM:STAGE_PREPARE_CLAIM with status STATUS_PREPARING_CLAIM, valid from PHASE_PRE_AWARD:STAGE_AGREEMENT_ACCEPTED:STATUS_AGREEMENT_ACCEPTED.
- Map Casework's STATUS_PREPARING_CLAIM to that new status instead of STATUS_AWAITING_CLAIM.
- Add STAGE_PREPARE_CLAIM to the PHASE_CLAIM section of externalStatusMap, so that an application sitting at the new status still acts on Casework's ACTION_CLAIM_PREP_COMPLETE. Mappings are resolved against the application's current phase and stage, so without this entry the event would be dropped.
- Allow STATUS_AWAITING_CLAIM from either STATUS_PREPARING_CLAIM or STATUS_AGREEMENT_ACCEPTED, and keep a mapping for Casework's STATUS_AWAITING_CLAIM at STAGE_AGREEMENT_ACCEPTED, so a caseworker who completes the claim-prep task before GAS has seen STATUS_PREPARING_CLAIM is still handled.
- Make the PA3 entitlement available at both STATUS_PREPARING_CLAIM and STATUS_AWAITING_CLAIM, so the entitlement can be created during claim prep and for records already at STATUS_AWAITING_CLAIM. claimableAt and claims.onClaimApproval stay on STATUS_AWAITING_CLAIM, so the claim only opens once Casework has completed the task.

Only environments running CONFIGURATION_VARIANT=next are affected. gas.json, cw.json and cw.next.json are unchanged, and no GAS or Casework code changes are needed.

Released as a minor so that existing woodland applications and cases, which roll forward within the same major, pick up the fix. Records already diverged (GAS at STATUS_AWAITING_CLAIM or STATUS_CLAIM_COMPLETE while Casework is at STATUS_PREPARING_CLAIM) are not repaired by this change and still need a data fix.
