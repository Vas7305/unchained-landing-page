# refactor: BookingFlow is ~660 lines and holds five steps plus the form

**Rules** `react-doctor/no-giant-component`
**Confidence** High — read in full while vendoring it.
**Severity** Maintainability. No user-facing defect.

Found while vendoring the booking flow into the Unchained Business site's
interactive demo. Line numbers are `src/`-relative against Lanna-Kamilina as of
that copy.

## Where

`src/features/booking/BookingFlow.tsx:61`

## What is in there

One component holding the whole funnel:

1. the service step, with its category grouping;
2. the specialist step, including the "без предпочтения" pooling;
3. the date step;
4. the time step, delegating to `AvailabilityPicker`;
5. the contact form — name, telephone, comment, consent, channel choice;
6. the submit handler, its `SlotUnavailableError` recovery, and the URL sync
   that keeps the flow shareable and the back button meaningful.

It also carries roughly a dozen pieces of state and the derived values over
them. The step components at the bottom of the file (`Step`, `Choice`,
`SummaryRow`) are already extracted, which is what keeps it readable at all.

## Suggested shape

Each step is already a closed unit with an obvious input and one output — the
value it sets. Extracting them as siblings in the same file, each taking the
props it needs, would leave the parent as the state and the sequencing, which
is what it should be:

```tsx
function ServiceStep({ value, onChange, open, onOpen }) { … }
function SpecialistStep({ serviceId, value, onChange, open, onOpen }) { … }
function WhenStep({ availability, date, time, onPick, open, onOpen }) { … }
function ContactStep({ values, errors, onChange, onSubmit, channels }) { … }
```

The URL sync and the submit handler stay in the parent. Nothing about the data
flow changes — every one of these already reads only from props and the two
hooks the parent owns.

## Status in the demo

Not applied there. The vendored tree is kept as a verbatim copy so that
re-copying from this repository is an overwrite rather than a merge —
a property this pass exercised five times, fixing findings upstream and
overwriting the demo's copies from them. Restructuring the file inside the demo
would put a permanent manual reconciliation in the middle of that. The benefit
is only lasting if it happens here.
