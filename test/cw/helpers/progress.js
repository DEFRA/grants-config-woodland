import { styleText } from 'node:util'

// Lightweight progress logging for the cw integration harness. Writes straight
// to stdout (not console.*) so lines appear inline and in order, rather than
// being buffered/regrouped by vitest's console interception.
const ts = () => new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm

const write = (color, prefix, msg) =>
  process.stdout.write(styleText(color, `${prefix} [${ts()}] ${msg}\n`))

// A new phase of work (booting a stack, sending an event, running a fixture).
export const step = (msg) => write('cyan', '▶', msg)

// Sub-detail within a step (repo paths, retry attempts, chosen values).
export const info = (msg) => write('gray', ' ·', msg)

// A step completed successfully.
export const ok = (msg) => write('green', '✓', msg)
