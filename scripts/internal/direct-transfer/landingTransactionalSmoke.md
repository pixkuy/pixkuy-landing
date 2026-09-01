# Direct Transfer Landing transactional validations

Executor scope: this file documents the versioned validation set for DT-LANDING-TRANSACTIONAL-001R5. It is not an ad hoc runtime smoke and it was not executed by the executor.

## Existing validation reuse

- Landing validation command requested by Automation Core: `npm run check`.
- Existing Landing Direct Transfer quote smoke: `scripts/smoke-direct-transfer-quote.js`.
- Existing Booking API Direct Transfer transactional matrix: `pixkuy-booking-api/scripts/internal/direct-transfer/smokeDirectTransferMatrix.ts`.

## Required validation evidence

- Capture command, stdout, stderr and exit artifacts for each validation executed by the loop.
- Package `LOCAL_VALIDATIONS` in the review pack.
- Keep stdout and stderr artifact files even when empty.
- If Booking API, Stripe or public runtime validation cannot be run safely, do not claim runtime coverage and use the manual QA checklist in `scripts/internal/direct-transfer/landingTransactionalManualQA.md`.

## Coverage expected from validation owner

- Direct Transfer desktop checkout precheck and review handoff.
- Direct Transfer mobile checkout handoff using `data-direct-transfer-mobile-contact-field`.
- Airport guard and Airport Transfer handoff remain intact.
- Booking status confirms paid conversion only after confirmed public status.
- Checkout i18n files exist for es, en, de, fr, it, ko, pt, ru and zh-hans.
