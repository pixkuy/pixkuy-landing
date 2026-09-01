# Direct Transfer Landing transactional manual QA

Executor scope: this checklist is for functional validation after the patch. The executor did not run runtime, Stripe, Booking API or npm validations.

## Desktop

- Open Landing and choose Direct Transfer.
- Enter a non-airport origin and destination supported by the Direct Transfer quote contract.
- Confirm the existing Direct Transfer panel layout, density, CTA placement and copy tone remain unchanged.
- Request a quote and continue to the existing contact step.
- Verify the contact step keeps the existing `#contact` flow and does not submit as a Netlify lead for transactional Direct Transfer.
- Verify legal acceptance is required before Booking API checkout.
- Verify Direct Transfer availability precheck runs before the review page.
- Verify the review page uses `direct-transfer-checkout-review.html` and scoped CSS under `data-direct-transfer-checkout-review-page`.
- Verify proceeding from review creates a checkout handoff and redirects to `booking-checkout.html`.

## Mobile

- Open the mobile Direct Transfer flow and complete route, date, time and vehicle selection.
- Confirm the existing mobile config and contact step structure remain visually unchanged except for the legal acceptance block required for checkout.
- Verify name, phone, email and notes are read from `data-direct-transfer-mobile-contact-field`.
- Verify the mobile CTA is disabled or blocked until required contact fields and legal acceptance are valid.
- Verify mobile checkout uses the Direct Transfer Booking API checkout payload and does not rely on the desktop review page.

## Domain and safety checks

- Airport-route restrictions must still hand off to Airport Transfer and must not force Direct Transfer checkout.
- Unsupported route, missing quote or stale quote states must not create Stripe checkout.
- No conversion may fire on CTA click, review proceed, Stripe redirect or success URL alone.
- Paid conversion may fire only after public booking status returns confirmed.
- Review/status visible Direct Transfer checkout copy must exist for es, en, de, fr, it, ko, pt, ru and zh-hans.
