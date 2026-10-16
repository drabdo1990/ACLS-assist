/**
 * Release gate for the Arabic clinical wording (spec §6). Every Arabic clinical string in ar.ts is
 * marked `// draft — clinician review required`. Flip this to true only after a clinician has signed
 * off the strings listed in docs/i18n/arabic-clinical-review.md; until then Arabic mode shows a
 * notice that English is the reference text.
 */
export const AR_CLINICAL_REVIEWED = false;
