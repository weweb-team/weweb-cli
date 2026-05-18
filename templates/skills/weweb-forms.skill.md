---
name: weweb-forms
description: Form layouts and input handling with `ww-form-container` and `ww-input-*` elements. Load whenever building a form (sign-in, sign-up, contact, data entry, search bars).
metadata:
  type: weweb
---

# Forms skill

## Layout

- For a standard form (auth, data edition, etc.), the best practice is to use `ww-form-container` and inside it use any `ww-input-xxx` elements for user inputs, plus a `ww-button` with `type: 'submit'` (or `'reset'`) to submit/reset.
- Available form input elements:
  - `ww-input-basic` (text, email, password, number, etc.)
  - `ww-input-select` (dropdowns)
  - `ww-input-checkbox` (boolean checkboxes, terms acceptance, toggles)
  - `ww-input-toggle` (on/off toggle switches)
  - `ww-input-radio` (single-choice selection from a list of mutually exclusive options)
  - `ww-input-range` (numeric slider with min/max/step and optional tooltip)
  - `ww-input-rich-text` (rich text / WYSIWYG editor, HTML or Markdown output)
  - `ww-input-date-time-picker` (dates, date ranges, multi-date selection)
  - `ww-input-recaptcha` (Google reCAPTCHA v2)
  - `ww-input-qr-code` (QR/barcode scanner via device camera)
  - `ww-input-otp` (one-time-password / PIN / verification-code input)
  - `ww-input-mask` (pattern-formatted text — phone numbers, postal codes, credit cards)

## Logic

### Handle input values

- All `ww-input-*` elements expose a variable `value`. Do **not** store the value of the input in a separate variable — use the variable `value` directly in a binding or a workflow.

### Submit the form

- The submit workflow should be attached to the `ww-form-container` with the event `submit`. It's triggered automatically when the user clicks a `ww-button` with `type: 'submit'` inside the form — no separate workflow on the button is needed.

## What to do and not to do

- **Do not** store input values in a variable — use the input's own `value` variable
- **Do not** place the submit button outside the `ww-form-container`
- **Do not** add a click workflow on the submit button — let the form's `submit` event handle it
