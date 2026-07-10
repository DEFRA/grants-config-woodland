import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { env } from 'node:process'

const readLog = () => {
  try {
    return readFileSync(env.APP_LOG_FILE, 'utf8')
  } catch {
    return ''
  }
}

// Current size of the captured app log — used to scope a search to lines that
// arrive after an event is sent (avoids matching a previous fixture's error).
export const logMark = () => readLog().length

// Poll the captured app-container log for `substring` appearing after `mark`,
// up to `timeoutMs`. Returns true once found, false on timeout.
export const waitForLog = async (substring, mark = 0, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs
  do {
    if (readLog().slice(mark).includes(substring)) {
      return true
    }
    await delay(250)
  } while (Date.now() < deadline)
  return false
}
