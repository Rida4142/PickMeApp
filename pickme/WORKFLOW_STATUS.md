# PickMe Workflow Status Report

**Assessment date:** 2026-09-28
**Scope:** Current mobile/web client and Express/MongoDB API in this repository. This is a workflow inventory, not a production security or load-test certification.

## Executive Summary

PickMe has an implemented ride-sharing loop: users can register or log in, locate stops, post recurring or one-time commutes, search and rank compatible rides, request a seat, and manage trips and profiles. The running web app and its read-only screens were exercised during this assessment. Geocoding returned results, ride search displayed ranked matches, and ride details showed live occurrence and seat data.

The main limitation is validation depth: state-changing actions were not submitted against the shared live data, and there is no automated test suite in the repository. Therefore, booking acceptance/cancellation, trip completion, rating persistence, native-device behavior, and external integrations are implemented in code but are not certified end to end here.

Two workflow defects identified in the audit were corrected in the working tree: trip completion is now scoped to a commute date, and match cards display a fallback when an older commute has no price. Expo web export, server syntax, and editor diagnostics passed after those changes.

## Workflow Inventory

| Workflow | Current implementation | Assessment |
| --- | --- | --- |
| Sign up and log in | Phone/password auth, registration validation, session storage and JWT-backed API calls. | Implemented. Live session/profile load observed; new registration and logout/login were not run. |
| Google/Apple sign-in | Buttons show a message that the providers are not connected. | Not implemented; buttons are placeholders. |
| Current location | Browser/device GPS, permission handling, reverse-geocoding to a general-area label. | Implemented in the client; permission-denied and native-device cases not exercised. |
| Search/pick a place | Debounced place suggestions from the API; map pin selection and map display are in the client. | Geocoding verified live for NUST. Map interaction and device GPS were not fully tested. |
| Route and distance | Server requests OSRM driving geometry; straight-line distance fallback is used when routing fails. | Implemented; fallback path not forced during this assessment. |
| Saved locations | Authenticated list/create/update/delete with geocoded coordinates and types. | Implemented in code; write operations not run. |
| Create and manage commutes | Recurring and one-time schedules, ride roles/modes, vehicle capacity, time flexibility and detour preferences; edit, pause, delete and cancel dates. | Implemented in code; read-only commute screens loaded live. Write actions not run. |
| Discover active rides | Loads active commutes, calculates occurrence availability, hides full listings. | Verified live: cards and available seats rendered. This is a listing, not the ranked matcher. |
| Find and rank matches | Filters by role, date, schedule, available seats and detour; scores route, time, weekday and endpoint proximity; sorts by score. | Verified live: search returned ordered match cards and opening one displayed its details. |
| Request a seat | Selects an available seat/date, holds it, creates a pending request; owner can accept/reject; passenger can cancel. Seat state is occurrence-specific. | Implemented in code; an existing pending request rendered in the live UI. New request/accept/reject/cancel transitions were not executed. |
| Inbox and notifications | Persistent in-app list, open related request/booking/commute/trip, mark one/all as read. | Inbox loaded live. Push delivery, polling/realtime updates and notification delivery timing are not implemented/verified here. |
| Trip completion and cost split | Owner records a completed trip and fare; server derives participants, stores the trip, marks related records complete and divides fare equally. | Implemented in code. Date scoping was corrected; trip writes and multi-date cases still need integration tests. |
| Reviews and ratings | Trip participants can rate each other after completion; duplicate/self/nonparticipant ratings are rejected server-side. | Implemented in code; no rating submission tested. |
| Profile and privacy | Edit personal data, vehicle, general location, visibility preferences; display rating/reviews and owned commutes. | Profile loaded live. Updates were not submitted. |
| Profile photo | Image selection and upload/removal via Cloudinary, gated by server credentials. | Implemented conditionally; Cloudinary configuration and upload were not tested. |
| WhatsApp contact | Opens a `wa.me` URL when a phone number is visible. | Implemented; external app/browser handoff not tested. |
| Report/block/safety | Authenticated report/block endpoints; blocked users are excluded from matching. | Implemented in code; writes and visibility/privacy edge cases not tested. |
| Purchases/subscriptions | RevenueCat SDK is configured at app startup. | SDK wiring only; no product catalog, paywall, purchase, restore, entitlement check, or server-side entitlement flow found. |

## Live Checks Performed

- Opened the running Expo web app at `http://localhost:8081`.
- Queried `/api/geocode?q=Nust` through the configured LAN API and `localhost:3000`; both returned HTTP 200 with place suggestions. Nominatim also returned HTTP 200 directly.
- Loaded active commute cards, submitted a ride search, viewed ranked matches and ride details, and observed date-specific seat availability.
- Loaded Requests, Inbox, Trips, and Profile screens. Existing commute/request data appeared in the UI.
- Built the Expo web export, checked server JavaScript syntax, and checked editor diagnostics after the audit fixes.

These checks used the current web app and existing data. They do not prove the whole application works on iOS/Android or that each write path succeeds under concurrent use.

## Known Gaps and Risks

1. **No automated tests are present.** There are no repository test scripts or test files covering API, model lifecycle, or UI flows.
2. **Critical mutations need a safe integration environment.** Request creation, seat concurrency, accept/reject/cancel, commute cancellation, trip completion and ratings were not exercised end to end.
3. **Social authentication is only a placeholder.** Google and Apple buttons do not authenticate.
4. **RevenueCat is not a user feature yet.** The SDK initializes, but the purchase lifecycle and entitlement enforcement are absent.
5. **Notifications are in-app records only in the inspected workflow.** Push registration/delivery and realtime refresh are not wired into the visible client flow.
6. **External service constraints need production handling.** Geocoding depends on public Nominatim and routing on public OSRM; availability, quotas/rate limits, attribution, retries and provider fallback need deliberate operational treatment.
7. **Optional infrastructure paths are unverified.** Cloudinary photo operations, native GPS permissions, WhatsApp handoff and native builds need device/configuration checks.
8. **Identity is not fully verified.** The README says CNIC is stored but not verified; phone/email verification and account recovery are not represented in the inspected auth flow.
9. **Deployment and observability need validation.** Verify production secrets/configuration, API error logging, health checks, backups, and recovery before real users depend on the service.

## Recommended Next Workflow

Prioritize an automated, isolated **two-user booking lifecycle test** before adding more features. It exercises the central value path and protects the date-scoped completion fix without touching real user records.

1. Create a dedicated test database and two seeded users: one driver and one passenger. Keep tests off the shared/live database.
2. Have the driver create a recurring commute with at least two eligible dates and available seats.
3. Have the passenger search, verify the match score/order, open ride details, select a date and seat, and submit a request.
4. Assert the seat becomes selected for that date, duplicate requests are rejected, and the driver sees the incoming request/notification.
5. Accept the request; assert a confirmed booking exists, the occurrence seat becomes booked, the passenger sees acceptance, and contact visibility follows privacy settings.
6. Repeat for another date, then cancel or reject one date and verify only that date’s seat/request is released or transitioned.
7. Complete one date only. Assert only that date’s booking/request and occurrence become completed, the other date remains unchanged, and the fare split includes the right participants.
8. Submit participant ratings; verify ratings appear in trip/profile results and duplicate or unauthorized ratings are rejected.
9. Add a concurrency test where two passengers contend for the same seat; only one request should acquire the hold.
10. Run the same core flow in a browser smoke test, then repeat permission, map, date/time and photo cases on a physical Android/iOS build.

## Suggested Follow-On Order

1. Establish a test database, seed/reset fixtures, and automated API tests for the booking lifecycle above.
2. Add UI smoke tests for registration/login, location selection, commute post, match search, requests, inbox, trips and profile.
3. Decide and implement actual product scope for social login, push notifications and purchases, or remove/disable their placeholder UI until ready.
4. Validate native-device and optional-provider integrations: GPS permissions, maps, Cloudinary, WhatsApp and store builds.
5. Prepare deployment: secrets management, health/readiness checks, rate limiting/provider policy, logs/alerts, backup/restore and production smoke tests.

## Code Map

- App routing, session startup, discover and search: `mobile/App.js`
- Authentication and current-location signup: `mobile/screens/AuthScreen.js`, `mobile/utils/location.js`
- Map/location search and route entry: `mobile/MapPick.js`
- Commute form and post flow: `mobile/components/CommuteForm.js`, `mobile/components/PostFlow.js`
- Requests, ride details, trips, profile: `mobile/screens/RideScreens.js`
- Inbox: `mobile/screens/InboxScreen.js`
- HTTP client/session token: `mobile/api.js`
- API routes, matching, occurrence/seat lifecycle, trips and ratings: `server/index.js`
- MongoDB schemas and occurrence indexes: `server/models/index.js`
- OSRM route and distance helpers: `server/services/routing.js`
- External purchase SDK initialization: `mobile/utils/purchases.js`