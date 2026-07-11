# TSS Access Launch Notice

Date: 2026-07-11

Status: archived research note for `coursetable-ucsd`.

Source:
`https://adminrecords.ucsd.edu/Notices/2026/2026-7-10-1.html`

## Notice Summary

UC San Diego published a July 10, 2026 campus notice titled `Triton Student
System (TSS) Access for Faculty and Staff`.

Key dates and launch facts:

- Faculty and staff TSS access starts on Monday, July 13, 2026.
- Main campus student TSS access starts on Monday, July 20, 2026.
- Division of Extended Studies student TSS access starts on Friday, August 7, 2026.
- Authorized users access TSS at `http://sis.ucsd.edu` once access is granted
  and the system is available.
- FERPA training is required for TSS access.
- Many faculty, instructors, lecturers, and staff with TritonLink or ISIS access
  are automatically provisioned for launch-period access.
- Users outside the auto-provisioned groups, or users needing access changes
  after launch, use the TSS Roles and Access KBA plus CARF approval path.

## Enrollment Authorization And Booking Signals

The notice says Triton Enrollment Authorization (TEA) replaces the Enrollment
Authorization System (EASy) and becomes available on July 20, 2026.

It also states that the first wave of students begins booking classes on July
22, 2026.

Observed implication:

- TSS launch is not only an administrative migration; it introduces the live
  student-facing booking flow that replaces the legacy enrollment path.
- The July 22 booking date is the earliest concrete post-launch window to
  re-check what public or authenticated class-search behavior looks like.

## Coursetable Implications

- The notice reinforces that authoritative enrollment/booking state is moving
  into TSS, not staying in legacy WebReg.
- The notice does not publish an API, endpoint contract, or third-party
  developer integration path.
- Real-time seats still should not be promised from public documentation alone.
  Any live seats integration would need official TSS/Booking access, a UCSD
  role/data-sharing approval path, or an approved integration surface.
- Short-term `coursetable-ucsd` should keep using public Schedule of Classes
  snapshots with explicit freshness labels.
- Follow-up after July 20-22, 2026: inspect the student-facing TSS Schedule of
  Classes / booking flow and determine whether the public Schedule of Classes
  endpoint changes, redirects, freezes, or remains available in parallel.

## Operational Watchlist

- Re-check `http://sis.ucsd.edu` after TSS access is live.
- Re-check public Schedule of Classes behavior around and after July 20-22.
- Watch TSS support/training pages for updated student-facing Schedule of
  Classes and booking documentation.
- Do not infer API availability from TSS access announcements; verify an actual
  documented or technically observable interface before planning live seats.
