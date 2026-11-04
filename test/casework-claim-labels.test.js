import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = JSON.parse(
  readFileSync(
    new URL('../configurations/woodland/cw/cw.next.json', import.meta.url),
    'utf8'
  )
)
const claimTasks = workflow.phases
  .find((phase) => phase.code === 'PHASE_CLAIM')
  .stages.find((stage) => stage.code === 'STAGE_PREPARE_CLAIM')
  .taskGroups.find((group) => group.code === 'TASK_GROUP_CLAIM_PREP').tasks

describe('Woodland claim preparation outcome labels', () => {
  it.each([
    ['TASK_RECORD_ELIGIBLE_AREA', 'STATUS_RECORDED', 'Created'],
    [
      'TASK_NOTIFY_READY_TO_CLAIM',
      'STATUS_NOTIFICATION_SENT',
      'Notification sent'
    ]
  ])(
    'shows Completed on the task list and the specific outcome on %s radios',
    (taskCode, outcomeCode, radioLabel) => {
      const task = claimTasks.find((task) => task.code === taskCode)
      const outcome = task.valueOptions.find(
        (option) => option.code === outcomeCode
      )

      // Casework uses name for task-list status and altName for radio labels.
      expect(outcome.name).toBe('Completed')
      expect(outcome.altName).toBe(radioLabel)
      expect(outcome.completes).toBe(true)
      expect(outcome.theme).toBe('SUCCESS')
    }
  )

  it('keeps comments disabled for recording eligible area and required for notification', () => {
    const areaTask = claimTasks.find(
      (task) => task.code === 'TASK_RECORD_ELIGIBLE_AREA'
    )
    const notificationTask = claimTasks.find(
      (task) => task.code === 'TASK_NOTIFY_READY_TO_CLAIM'
    )

    expect(
      areaTask.valueOptions.find((option) => option.code === 'STATUS_RECORDED')
        .comment
    ).toBeNull()
    expect(
      notificationTask.valueOptions.find(
        (option) => option.code === 'STATUS_NOTIFICATION_SENT'
      ).comment.mandatory
    ).toBe(true)
  })
})
