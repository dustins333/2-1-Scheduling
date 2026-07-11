# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A two-page referral scheduling tool for Kova Strength gym, backed by two serverless functions that talk to GoHighLevel / "Gym Lead Machine" (GLM) via its API. A current member picks open times from a real GLM calendar, texts a link to a friend, and the friend books one of those times — which books real appointments in GLM for both people and tags their contacts.

## Commands

```
npm install       # install dependencies
npm run dev       # start local dev server (localhost:3000), loads .env.local
npm run build     # production build
npm start         # run a production build locally
```

There is no automated test suite. The two API routes are verified by curling them directly against the real GLM account (there is no mock/sandbox mode):

```
curl "http://localhost:3000/api/slots?date=YYYY-MM-DD"
curl -X POST "http://localhost:3000/api/book" -H "Content-Type: application/json" \
  -d '{"name":"...","phone":"...","consent":true,"startTime":"<iso-slot-id>","ref":"...","refName":"..."}'
```

Any manual test against `/api/book` creates a **real** appointment and a **real** contact in the live GLM account — there is no staging environment. Use clearly-fake names (e.g. prefixed `TEST`) and clean them up afterward in GLM.

## Required environment variables (`.env.local`, gitignored)

```
GLM_API_TOKEN               # GLM Private Integration Token (server-only, never exposed to client)
GLM_LOCATION_ID             # GLM sub-account/location ID
GLM_CALENDAR_ID             # the "Referral Intro Session" calendar ID
NEXT_PUBLIC_GLM_TIMEZONE    # IANA timezone the gym's calendar is in (currently America/Boise)
```

`.env.local.example` documents the shape without real values. On Vercel these are set separately under Project Settings → Environment Variables (not synced automatically from `.env.local`).

## Architecture

**Flow:** `pages/index.js` (member's page, at `/`) → generates an `sms:` link pointing at `pages/invite.js` (friend's page, at `/invite`) → friend submits → `pages/api/book.js` books real appointments.

There is no database. State passes entirely through the URL query string between the two pages: `/invite?slots=<comma-separated-ids>&ref=<member-phone>&refName=<member-name>`.

**The key trick that keeps this database-free:** a slot's `id` (as returned by `pages/api/slots.js`) is *the GLM ISO datetime string itself* (e.g. `2026-07-08T13:30:00-06:00`), not an opaque ID. This means `pages/invite.js` can parse the date and time directly out of the slot ID with `new Date(iso)` — no second API call or lookup table needed to turn a slot ID back into a human-readable time. If GLM's slot IDs ever stop being raw timestamps, this parsing (`slotFromIso` in `invite.js`) breaks and needs rethinking.

**`lib/dateUtils.js`** — generic calendar-day math (today/add-days/format) used only for Page 1's day-by-day navigation. Not tied to GLM.

**`lib/timezone.js`** — single `GYM_TIMEZONE` constant used both server-side (formatting slot times in `slots.js`) and client-side (parsing slot IDs in `invite.js`). Must match the timezone the GLM calendar is actually configured in, or displayed times will be wrong by whatever offset separates the two zones (this happened once already — was defaulted to America/New_York, actual gym is America/Boise).

**`pages/api/slots.js`** (read-only) — wraps GLM's `GET /calendars/:calendarId/free-slots`. Known GLM quirk: this endpoint does *not* remove a slot from the list once it hits its "max bookings per slot" capacity — it keeps showing as free even when full. A booking attempt against a full slot is still correctly rejected at booking time (handled below), it just isn't filtered out of the picker in advance.

**`pages/api/book.js`** (writes) — on a friend's submission:
1. Upserts the friend's GLM contact (by phone) and tags it `Referral-Lead`.
2. Books the friend's appointment at `startTime`. If GLM rejects with "no longer available" (400), this is translated to a `{ error: "slot_taken" }` / 409 response so the frontend can show a friendly message and let her pick a different pre-selected time instead of dead-ending.
3. If `ref`/`refName` are present, upserts the *referring member's* contact too, tags it `Referral-Client`, and books a **second, separate appointment for her at the same `startTime`** ("bringing a friend" — both attend together). This only works because the GLM calendar's "Max Bookings Per Slot" is set to 2 in GLM's own settings (not in this code) — if that capacity setting is ever reduced back to 1, the referrer's booking will start failing every time since the friend's booking already fills the slot. If the referrer's appointment booking fails, the friend's booking is not rolled back — her booking already succeeded and is left intact; the referrer failure is just returned in the response body for now.

Consent is required (both server- and client-enforced) before a booking can be submitted — GLM's "Add Guests" feature was investigated as an alternative way to attach a second person to one appointment and confirmed (by testing directly against the live API) to be a booking-widget-only feature that the plain Create Appointment API silently ignores; hence the "two separate appointments on the same slot" approach above instead.

GLM API calls use a `Version: 2021-04-15` header (hardcoded as `GLM_API_VERSION` in both API route files) and bearer auth via `GLM_API_TOKEN`. Tags added via `POST /contacts/:id/tags` are additive, not a replace — removing an old tag requires an explicit `DELETE` call with that tag name first.

## Deployment

Hosted on Vercel, connected to GitHub repo `dustins333/2-1-Scheduling`, auto-deploys on push to `main`. Framework Preset in Vercel project settings must be "Next.js" (this repo has hit the generic/"Other" preset by mistake before, which produces an instant no-op build and every route 404s).
