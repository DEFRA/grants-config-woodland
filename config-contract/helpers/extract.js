// Pure extractors over parsed configs. No I/O, no assertions — just shape the data
// so each suite can state its invariant once.

const PRE_AWARD = 'PHASE_PRE_AWARD'

// --- GAS front-door schema (phases[].questions) ---

export const gasQuestions = (gas, phaseCode = PRE_AWARD) =>
  gas.phases.find((phase) => phase.code === phaseCode)?.questions ?? {}

// Declared answer properties, including those only defined under the conditional
// `then` branch (e.g. existingWmps).
export const gasProperties = (gas) => {
  const questions = gasQuestions(gas)
  return new Set([
    ...Object.keys(questions.properties ?? {}),
    ...Object.keys(questions.then?.properties ?? {})
  ])
}

// Unconditionally required answers. Conditionally-required fields (then.required)
// are asserted separately.
export const gasRequired = (gas) => gasQuestions(gas).required ?? []

export const gasConditionalRequired = (gas) =>
  gasQuestions(gas).then?.required ?? []

export const gasEnum = (gas, field) =>
  gasQuestions(gas).properties?.[field]?.enum ?? null

// Every status code defined across all phases/stages.
export const gasStatusCodes = (gas) =>
  new Set(
    gas.phases.flatMap((phase) =>
      phase.stages.flatMap((stage) =>
        stage.statuses.map((status) => status.code)
      )
    )
  )

// --- grants-ui form config ---

const uiPages = (ui) => ui.pages ?? []

// Field is an input (produces an answer) if its component type ends in "Field".
// Html/content components are excluded.
export const uiInputFieldNames = (ui) =>
  uiPages(ui).flatMap((page) =>
    (page.components ?? [])
      .filter((c) => typeof c.type === 'string' && c.type.endsWith('Field'))
      .map((c) => c.name)
  )

export const uiHiddenFieldNames = (ui) =>
  uiPages(ui).flatMap((page) => Object.keys(page.config?.hiddenFields ?? {}))

export const uiConfirmationField = (ui) =>
  ui.metadata?.detailsPage?.confirmationFieldName ?? null

// All answer-producing field names the UI knows about.
export const uiAnswerFields = (ui) =>
  new Set([
    ...uiInputFieldNames(ui),
    ...uiHiddenFieldNames(ui),
    ...(uiConfirmationField(ui) ? [uiConfirmationField(ui)] : [])
  ])

export const uiListValues = (ui, listName) =>
  (ui.lists?.find((list) => list.name === listName)?.items ?? []).map(
    (item) => item.value
  )

export const uiPageByPath = (ui, path) =>
  uiPages(ui).find((page) => page.path === path) ?? null

// Non-`default` GAS status tokens referenced by post-submission redirect rules.
export const uiRedirectGasStatuses = (ui) => {
  const rules = ui.metadata?.grantRedirectRules?.postSubmission ?? []
  return new Set(
    rules
      .flatMap((rule) => String(rule.gasStatus ?? '').split(','))
      .map((token) => token.trim())
      .filter((token) => token && token !== 'default')
  )
}

// --- JSONata-style "$." answer references in downstream configs ---

const REF_PATTERN = /\$\.\w+(?:\.\w+)*/g

const walkStrings = (value, visit) => {
  if (typeof value === 'string') {
    visit(value)
  } else if (Array.isArray(value)) {
    value.forEach((item) => walkStrings(item, visit))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => walkStrings(item, visit))
  }
}

// Collect the full dotted answer paths referenced under any of `roots`
// (e.g. "$.application." or "$.payload.answers."). REF_PATTERN stops at "[", so array
// markers like [*]/[] are dropped: "$.application.landParcels[*]" -> "landParcels" and
// "$.application.applicant.business.address.line1" -> "applicant.business.address.line1".
export const jsonataAnswerPaths = (obj, roots) => {
  const paths = new Set()
  walkStrings(obj, (str) => {
    const matches = str.match(REF_PATTERN) ?? []
    for (const token of matches) {
      for (const root of roots) {
        if (token.startsWith(root)) {
          const rest = token.slice(root.length)
          if (rest) paths.add(rest)
          break
        }
      }
    }
  })
  return paths
}

// Resolve a dotted answer path against a GAS questions schema, descending through object
// `properties` and transparently through array `items` (so "landParcels.parcelId" works).
// Root properties are merged with the conditional `then.properties` (for existingWmps).
// Returns { ok: true } or { ok: false, resolved, missing } naming the first undeclared segment.
export const resolveAnswerPath = (questions, path) => {
  const rootProps = {
    ...(questions.properties ?? {}),
    ...(questions.then?.properties ?? {})
  }
  let node = { properties: rootProps }
  const segments = path.split('.')
  for (let i = 0; i < segments.length; i++) {
    while (node && node.type === 'array') node = node.items
    if (!node || !node.properties) {
      return {
        ok: false,
        resolved: segments.slice(0, i).join('.'),
        missing: segments[i]
      }
    }
    node = node.properties[segments[i]]
    if (!node) {
      return {
        ok: false,
        resolved: segments.slice(0, i).join('.'),
        missing: segments[i]
      }
    }
  }
  return { ok: true }
}

// Resolve a fgSum field spec ("landParcels[].areaHa") to its top-level property.
export const topLevelField = (spec) => spec.split(/[.[]/)[0]
