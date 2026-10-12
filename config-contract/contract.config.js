// Reviewed, structural facts about each scheme's configs — NOT a way to silence
// genuine divergences. Each entry documents things that cannot be derived from the
// configs themselves (because they are the values under test) or that are
// intentionally absent from the GAS front-door schema.
//
// Adding a new scheme directory under configurations/ requires an entry here; the
// suites assert the entry exists so a new scheme is never silently left untested.

export const schemeContract = {
  woodland: {
    // grants-ui submission.grantCode / gas.json "code"
    code: 'woodland',
    // Scheme prefix shared across agreement, payment and the grants-ui reference number
    prefix: 'WMP',
    // Capital item / scheme code shared between the GAS entitlement and payment config
    capitalItem: 'PA3',
    // GAS-required answers that have no grants-ui input component because a UI
    // controller computes them (here: totalHectaresForSelectedParcels is summed from
    // the selected landParcels). applicant is GAS-optional and comes from the
    // business-details lookup, so it is not listed.
    derivedFields: ['totalHectaresForSelectedParcels'],
    // grants-ui input fields that gate eligibility (routing to terminal exit pages)
    // and are deliberately not part of the validated submission. GAS's schema is open
    // (no additionalProperties:false) so these are tolerated if ever sent.
    uiOnlyGatingFields: ['counterSignature', 'tenantObligations'],
    // Answers populated AFTER submission (payment calculation / details confirmation),
    // so downstream services may read them but GAS legitimately does not require them at
    // the front door. The requiredness check (C4) skips these so it flags only genuinely
    // missing requireds.
    optionalAnswerFields: [
      'payments',
      'totalAgreementPaymentPence',
      'detailsConfirmedAt'
    ]
  }
}
