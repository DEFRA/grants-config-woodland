---
'grants-config-woodland': minor
---

Remove the TASK_SITI_REFERENCE task from TASK_GROUP_CRM_RECORD in PHASE_PRE_AWARD:STAGE_AGREEMENT_ACCEPTED in the woodland CW workflow definition, in both cw.json and cw.next.json. The Forestry Commission now accepts the WMP-xxx-xxx case reference directly, so caseworkers no longer need to capture the 7 digit SitiAgri reference before forwarding an application. No data migration: cases that already captured a reference keep it, and the case details banner configuration is unchanged so a previously captured reference is still displayed.
