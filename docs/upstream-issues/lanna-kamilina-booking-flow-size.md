# refactor: BookingFlow — partly done, complexity still open

**Rules** `react-doctor/no-giant-component` (**resolved**),
`react-doctor/no-high-complexity-react-function` (**still open**)
**Confidence** High — read in full while vendoring it.
**Severity** Maintainability. No user-facing defect.

Found while vendoring the booking flow into the Unchained Business site's
interactive demo. Line numbers are `src/`-relative against Lanna-Kamilina.

## Done upstream

`src/features/booking/BookingFlow.tsx` had two step bodies still written inline
inside the flow component — the specialist chooser and the whole contact form.
`ServiceChooser`, `AvailabilityPicker`, `BookingSummary`, `Step` and
`SpecialistOption` were already extracted; these two were not.

Both were closed units, each reading only what it was given and reporting back
through one callback per control, so they came out as siblings in the same file:

- `SpecialistChooser({ eligible, selected, onSelect })`
- `ContactForm({ …values, …errors, submitError, submitting, channels, …handlers, onSubmit })`

The `BookingFlow` function went from **351 lines to 266**, and
`no-giant-component` stopped firing. `tsc --noEmit` clean and `vite build` green
after the change; the repository has no test suite.

## Still open: control-flow complexity

`no-high-complexity-react-function` still fires at `BookingFlow.tsx:61`. Size
was only half the problem — what is left is genuinely branchy, and it is the
half that needs a decision rather than a move:

- **Twelve pieces of state**, several of which invalidate each other. Choosing a
  service clears the time, the date and possibly the specialist; choosing a
  specialist clears the time; a slot going stale clears the time and reopens
  that step.
- **`submit`** carries the whole error taxonomy: validation gates, a
  `SlotUnavailableError` branch that rewinds the flow to the time step, and a
  generic delivery-failure branch.
- **`syncUrl`** translates state into query parameters, with its own
  slug-resolution rules.

### Suggested shape

A `useBookingFlow()` hook owning the state machine and returning
`{ values, actions, status }` would take all three out of the component and make
the invalidation rules testable on their own — which they are not today, and
they are the part most likely to break.

That is an architectural decision about where this flow's state should live, not
a mechanical extraction, which is why it was not done along with the rest.

## Status in the demo

The vendored copy carries the extraction, because it was made upstream and the
demo's copy was overwritten from it. The complexity that remains is carried as
the product wrote it.
