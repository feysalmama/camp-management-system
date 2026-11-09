# Hosted acceptance scenarios

Use a new test Supabase project and synthetic records. Automated tests are run with `npm test`; these scenarios verify real Auth, PostgREST, Storage and hosting configuration.

1. Register account A, confirm it proceeds directly to onboarding without an email step, and create a company under Saudi Arabia. Confirm A is company admin and ten default issue types exist.
2. Register B and select A's company. Before approval B must see only the pending screen. A approves B as camp manager in Team & access. Refresh B's workspace.
3. Register C and create a separate company. Confirm C sees none of A's camps, users, incidents, attachments or situation reports.
4. In A, add and edit a camp, provider and issue type. Delete an unused record. Confirm deleting an issue type referenced by an incident fails; deactivate it instead.
5. As B, create a draft incident. Confirm it stays Draft, then submit it. Select a critical issue and verify its default severity is Critical. Assign an active company member and provider.
6. Add a comment and upload a PDF or image under 10 MB. Download it through the authorized link. Attempt the same object path using C's session; access must be denied. Reject unsupported files and files over 10 MB.
7. Try resolving without recording an action; the database must reject it. Record an action and resolve. B must not be able to close or escalate. A or a supervisor can close.
8. Escalate an open incident as A. Confirm exactly one Tool 10 appears and the incident becomes Escalated. Repeating escalation must reuse the same linked report.
9. Fill Tool 10 impact/recommendations, submit, and approve. Approved reports must reject later edits. Print both report types and save PDFs; verify page breaks against the supplied official templates when available.
10. Verify dashboard counts, issue chart, incident search, severity/status filters, CSV output, and audit events. A CSV cell beginning with `=` must be exported as text.
11. Approve a separate user as Viewer. Confirm it can read company reports but cannot create/edit reports, upload, manage catalogs, or escalate, including through direct API requests.
12. Schedule a Mina–Arafat movement. Arrival with mismatched pilgrim counts must fail. Matching arrival must save.
13. Prepare a camp departure. Clearance must fail until pilgrim and baggage counts match and both transport confirmation and final sweep are checked.
14. Provision a country admin using a super-admin account. Confirm the country admin can only open companies in the assigned country. Confirm ordinary users cannot grant themselves platform access.
15. Reset a password through email and verify the new password works on the deployed domain. Sign out and verify refreshing does not reopen an authenticated workspace.
16. Review desktop, tablet and mobile widths; keyboard tab order; dialog Escape/close behavior; long descriptions and names; empty lists; connection failure/retry; direct URL navigation.
17. If report emails are configured, verify delivery to the intended recipient, failure logs and a duplicate webhook retry. Do not enable a public mail flow with Supabase's test-only default SMTP.
18. If Stripe is configured, complete checkout with Stripe test cards, verify signed webhook updates, portal cancellation, duplicate/reordered event handling and unauthorized checkout rejection. Keep paid billing disabled until this is verified.

Current verification: embedded PostgreSQL policy/workflow tests, form tests, integration-authentication tests, TypeScript checks, production build, and browser review of sign-in/registration at mobile and desktop widths. Hosted service acceptance remains pending account configuration.
