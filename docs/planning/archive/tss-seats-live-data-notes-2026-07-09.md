# TSS Seats And Live Data Notes

Date: 2026-07-09

Status: archived research note for `coursetable-ucsd`.

## Source Documents Checked

- TSS application-impact Google Doc:
  `https://docs.google.com/document/d/1fHj8FpxVfecCMlojX64OC6fLsoRJNTp4xzrLUsroZ_I/edit?tab=t.0`
- UCSD Schedule of Classes:
  `https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm`
- UCSD Blink TSS training resources:
  `https://blink.ucsd.edu/instructors/resources/tss/index.html#scheduling-in-isa-training-resources`
- UCSD student tool help:
  `https://students.ucsd.edu/my-tritonlink/tools/tool-help/index.html`

## Google Doc Findings

The TSS application-impact document is useful evidence for the seats/live-data
question. Relevant rows observed in the document:

- `Enrollment/Waitlists`: retiring; application will be replaced by TSS.
- `Schedule of Classes`: retiring around mid-December; schedule will be
  available directly in TSS and linked on the TSS homepage.
- `Instructional Scheduling Assistant (ISA)`: staying; ISA will integrate with
  TSS.
- `WebReg`: retiring; scheduling of classes and student enrollment will take
  place in TSS Schedule of Classes and TSS Booking. Class planning will take
  place outside TSS in TritonGPT in the short term, then ultimately integrate
  into uAchieve.

## Interpretation For Coursetable

- UCSD is moving the authoritative schedule/enrollment surface from legacy
  WebReg and Schedule of Classes into TSS and TSS Booking.
- The application-impact document does not describe a public API or third-party
  developer interface. It is an application-impact and transition document, not
  API documentation.
- The current public Schedule of Classes endpoint remains best treated as a
  nightly/snapshot source, not a real-time enrollment feed.
- A true live seats integration would likely require official TSS/Booking
  access, institutional role approval, or a data-sharing path through UCSD, not
  only scraping the public Schedule of Classes page.
- Short-term product wording should stay `snapshot` / `updated as of` rather
  than `live`.

## Follow-Up Watchlist

- Watch TSS student launch docs for the replacement Schedule of Classes and TSS
  Booking behavior.
- Re-check whether post-launch TSS exposes any public schedule or class search
  endpoint.
- If real-time seats become a product requirement, investigate official UCSD
  TSS access, institutional role approval, and data-sharing paths before
  designing a scraper or polling workflow.
