# So, When? v0.2 — implementation contract

**Status:** READY FOR IMPLEMENTATION
**Branch:** `claude/first-app-evaluation-m1qxhu`
**Baseline:** all gates green at contract commit (`format:check`, `typecheck`, `test`, `expo-doctor` 20/20).

This contract is the single source of truth for the v0.2 change set. It was
produced from a full evaluation of the codebase and product. Execute the work
packages **in order**. Each work package (WP) lists rationale, exact changes,
acceptance criteria, and required test/doc updates.

---

## Working agreement (read first)

1. One WP at a time, in order WP1 → WP8. A WP is done only when **every**
   acceptance box is checked and `npm run format:check && npm run typecheck &&
npm test` pass.
2. Commit each finished WP separately: `WPn: <short summary>`. Push to this
   branch after each commit (`git push -u origin claude/first-app-evaluation-m1qxhu`).
3. Check the boxes in this file as you complete them (edit this file; include
   it in the WP commit).
4. Open questions have **defaults** (see bottom). Use the default; never stall.
5. If the contract conflicts with code reality, follow existing code patterns,
   pick the smallest faithful interpretation, and record the deviation in
   **Implementation notes** at the bottom of this file.
6. Follow AGENTS.md: NativeWind classes, existing primitives (`Card`,
   `PressableScale`, `AnimatedDialog`, `Button`, `Screen`, `ScreenHeader`,
   `Avatar`, `TextField`, `ChoiceRow`), 44pt touch targets, labeled icon
   buttons, useful empty states, warm no-guilt voice.

### Hard guardrails (non-negotiable)

- **No network calls, no analytics, no accounts, no OAuth.** The app stays
  local-only.
- **No new Android permissions.** After this contract the merged manifest must
  contain **no** `READ_CONTACTS`, `WRITE_CONTACTS`, `READ_CALENDAR`,
  `WRITE_CALENDAR`, `CAMERA`, or storage/media permissions.
- **No streaks, chains, scores, counts of consecutive anything, or guilt
  mechanics.** The Months view celebrates; it never pressures.
- **No new dependencies** except `expo-calendar` (WP6).
- Never commit secrets, keystores, or build output. Do not touch `eas.json`
  credentials or run store submissions — those are owner-manual steps.

### Out of scope for this contract

Google Play Console setup, EAS project init/builds, privacy-policy hosting,
tester recruitment, iOS release work, monetization (there is none, by
decision), Google Calendar API/OAuth sync (explicitly rejected — the calendar
feature is a one-way OS handoff, WP6).

---

## WP1 — Remove the contact picker (release blocker)

**Why.** `expo-contacts` puts `READ_CONTACTS` in the manifest, the app never
requests the runtime permission, and expo-contacts re-queries the picked
contact by ID — so on device the picker flow fails after selection
(and `OnboardingScreen.onPickContact` has no try/catch at all). Decision:
remove contact import entirely for v1; manual entry remains. This deletes the
only sensitive permission and simplifies the Data safety story to "nothing
requested."

**Changes.**

- `package.json`: remove `expo-contacts`.
- `app.json`: remove the `expo-contacts` plugin block; remove
  `ios.infoPlist.NSContactsUsageDescription`; add
  `"android.permission.READ_CONTACTS"` to `android.blockedPermissions`
  (defense in depth).
- Delete `src/services/contacts.ts`.
- `src/screens/FriendFormScreen.tsx`, `src/screens/FriendsScreen.tsx`,
  `src/screens/OnboardingScreen.tsx`: remove the "from contacts" buttons,
  `pickOneContact` imports, and picker-only state (`picking` etc.). Keep
  manual add flows intact; adjust copy so manual entry reads as the one path
  (e.g. onboarding: "Add the first friend you want to see" with name field
  focused).
- `src/screens/SettingsScreen.tsx` (~line 179): rewrite the privacy blurb that
  mentions choosing contacts.
- `src/content/privacyPolicy.ts`: remove the Contacts section; adjust the
  "your choices" line (drop "deny contacts"). Then run `npm run sync:privacy`
  so `docs/PRIVACY_POLICY.md` and `docs/privacy-policy.html` regenerate/match.
- Docs sweep — update every contact-picker mention: `README.md`, `AGENTS.md`,
  `docs/PRODUCT.md` (supporting flows), `docs/PLAY_RELEASE.md` (replace the
  "Contact permission release blocker" section with a short "Resolved: contact
  import removed in v0.2" note; drop picker rows from the preview checklist —
  WP8 rebuilds that checklist anyway), `docs/PLAY_CONSOLE_DECLARATIONS.md`
  (contacts row → not requested), `docs/PLAY_POLICY_AUDIT.md`,
  `docs/QA_ANDROID.md`.

**Acceptance.**

- [x] `expo-contacts` absent from `package.json` and `package-lock.json`.
- [x] No source reference to `expo-contacts` or `pickOneContact` remains
      (`grep -ri "expo-contacts\|pickOneContact" src App.tsx` is empty).
- [x] `npx expo prebuild --platform android --no-install` produces a manifest
      with **no** `READ_CONTACTS` (then delete `android/` and revert any
      prebuild side effects, e.g. `package.json` script rewrites).
- [x] `npm run sync:privacy` passes; policy files contain no contacts wording.
- [x] Onboarding, add-friend, and friends screens compile and flow manually
      (welcome → onboarding → add friend by name → When).

## WP2 — Schema v4: catch-up log + calendar-export snapshot

**Why.** Two later WPs need data. (a) The Months view needs _history_, but
"We caught up" (`logCaughtUp` in `src/state/AppProvider.tsx`) only overwrites
`friend.lastMetAt` — history is lost. (b) The calendar handoff (WP6) needs to
remember what was exported to detect stale copies. One schema bump covers both.

**Changes.**

- `src/domain/types.ts`: move `CatchUpLog` here from
  `src/domain/catchUpHistory.ts` (seed module already on this branch —
  re-export or import from types there so the seed's tests keep passing). Add
  `catchUps: CatchUpLog[]` to `AppData`. Add to `Plan`:
  `calendarExport: { exportedAt: string; startAt: string; endAt: string } | null`.
- `src/persistence/migrate.ts`: bump `SCHEMA_VERSION` 3 → 4. Migration v3→v4:
  `catchUps: []`; every plan gets `calendarExport: null`. Extend the existing
  sanitizers/validators for both fields following the file's current patterns
  (malformed entries dropped, never crash). `emptyAppData()` includes
  `catchUps: []`.
- `src/state/AppProvider.tsx` `logCaughtUp`: besides setting `lastMetAt`,
  append `{ id: createId("catchup"), friendId, date: formatDateKey(new Date(whenIso)), createdAt }`
  to `data.catchUps` — **idempotent**: skip if an entry with the same
  `friendId` + `date` exists.
- Single-source rule: marking a plan Done does **not** append to `catchUps`
  (done-plan attendance is derived at read time by `buildDayMarks`; the
  aggregation already dedupes by friend+day across both sources).
- Export (`exportAppDataJson`) and wipe/startFresh pick the field up
  automatically via `AppData` — verify, don't special-case.

**Acceptance.**

- [x] `SCHEMA_VERSION` is 4; loading a v3 payload migrates cleanly (test it).
- [x] `scripts/test-domain.ts` + `scripts/test-hardening.ts`: audit for
      hardcoded schema versions (e.g. "future schema" fixtures) and keep them
      relative to `SCHEMA_VERSION` where possible; add cases: v3→v4 migration,
      malformed `catchUps` entries dropped, malformed `calendarExport`
      nulled, `logCaughtUp` idempotency (same friend+day twice → one entry).
- [x] JSON export contains `catchUps`; wipe clears it.

## WP3 — "Make a plan" without availability (core-loop fix)

**Why.** Today a plan can only start from an availability slot
(`createPlan` fails without `selectedSlot`; the When FAB is "Free time").
The emotional trigger — "I miss Ana, I want to see her Saturday" — currently
dead-ends into calendar administration. `createPlanState` already accepts any
`ConcreteSlot` and `ConcreteSlot.ruleId` is nullable, so ad-hoc slots are a UI
change, not a domain change. Availability becomes an enhancer (suggestions),
not a gate.

**Changes.**

- `src/state/AppProvider.tsx`: new `ScreenId` `"pickPlanTime"`; new
  `openMakePlan(friendIds?: string[])` that stores preselected ids and pushes
  it.
- New `src/screens/PickPlanTimeScreen.tsx`: pick a date (`DateSlotPicker`) and
  start time (`TimeSlotPicker`); end = start + `settings.defaultDurationMinutes`
  (editable end time optional); validate end > start, same day. Build
  `ConcreteSlot` `{ key: "adhoc:<dateKey>:<startMinutes>", ruleId: null,
label: "Your pick", ... }` and call `openCreatePlan(slot, preselectedIds)`
  (replaceTop so back from CreatePlan returns to the time picker's parent, not
  a stale picker — match the existing replaceTop patterns).
- `src/screens/WhenScreen.tsx`: header action becomes a single "+" pill that
  opens an `AnimatedDialog` with two choices — **"Make a plan"** (primary) and
  **"Add free time"** (secondary). The `friends > 0 && availability === 0`
  empty-state card: primary button "Make a plan", secondary "Add free time",
  copy adjusted ("You don't need a schedule — pick a time and invite
  someone."). The friends-empty card stays as is.
- `src/screens/FriendProfileScreen.tsx`: add primary action "Invite {name}" →
  `openMakePlan([friendId])`. The catch-up nudge cards on When may keep
  routing to the profile — the profile now has a direct invite path.
- Hardware back / `goBack` must behave through the new screen (stack-based —
  verify, no special code expected).

**Acceptance.**

- [x] With **zero** availability rules and one friend, a plan can be created
      and shared end-to-end (unit-test `createPlanState` with a
      `ruleId: null` ad-hoc slot; manual flow check on web preview at minimum).
- [x] Slot suggestions and the InviteSheet flow still work unchanged.
- [x] Conflict rule still applies (ad-hoc slot overlapping an existing plan →
      friendly error, covered by existing `slotConflictsWithPlans`; add a test
      with an ad-hoc slot).
- [x] All three entry points work: When "+" dialog, empty-state card, friend
      profile "Invite {name}".

## WP4 — Months view with catch-up dots (replaces Day view)

**Why.** Owner decision: the Day view is surplus; replace it with a scrollable
Months view where past days you actually saw friends get dots — the
gym-app-style "look how far I've come" satisfaction, tuned to this brand:
celebration, never streaks.

**Design (pin these).**

- `WhenMode` becomes `"list" | "week" | "months"` (delete `"day"`). Toggle
  labels: List · Week · Months. Remove day-mode branches from
  `src/components/WhenCalendar.tsx` (week rendering stays; keep
  `calendarDayStartHour/EndHour` for week; update the Settings copy that
  mentions the day view; delete `onSwitchToDay`).
- New `src/components/MonthsView.tsx`: vertical `FlatList` of month grids.
  Range: from the earlier of (earliest month containing a mark) and 11 months
  back, through +3 months ahead. Initial scroll = current month. A small
  "Today" chip scrolls back to the current month. The week-mode prev/next
  header row is not used in months mode.
- Month grid: weekday header row honoring `settings.firstDayOfWeek`; day cells
  ≥44pt touch targets.
- **Dots** (data via `buildDayMarks(plans, catchUps)` +
  `dayMarkSize(seenFriendIds.length)` from `src/domain/catchUpHistory.ts`,
  seeded on this branch):
  - `small` (1 friend seen): 6dp filled dot, `color.primary`.
  - `medium` (2 friends): 9dp filled dot.
  - `large` (3+ friends — the "super dot"): 12dp filled dot with a soft
    2dp `primary-soft` ring.
  - Upcoming (`on`/`waiting` plan that day): 6dp **hollow** ring, primary.
    A day can show seen-dot and upcoming-ring together (e.g. logged catch-up
    earlier + plan tonight): render the filled dot with the ring around it.
  - Today: subtle outline on the day cell (existing calendar treatment).
- **Tap a day with any mark** → `AnimatedDialog` day sheet: date heading; for
  seen days, avatars + names of `seenFriendIds`, the done plans' titles, and
  memory note/photo thumbnail when present; upcoming plans listed and tappable
  → `openPlanDetail`. Days without marks don't open a sheet.
- Month footer (default-on, see open questions): muted caption, warm phrasing —
  "3 days with friends" / "1 day with friends" — **never** totals across
  months, never "in a row", never comparisons.
- Empty state (no marks anywhere): one warm card — "Your catch-ups will
  collect here. When a plan is done — or you log 'We caught up' — the day
  gets a dot."
- Motion: months fade/slide in via existing `ScreenTransition`/reanimated
  patterns; respect `useReduceMotion`. Performance: memoize `buildDayMarks`
  once (it's global, not per-month) and pass marks down; `FlatList` with
  `getItemLayout` if month rows are fixed-height.

**Acceptance.**

- [x] `"day"` mode is gone (type, toggle, WhenCalendar branches, settings copy)
      with no dead props left.
- [x] Dots render per spec for: 1 / 2 / 3+ friends, upcoming ring, mixed day
      (verify via seeded dev data on web preview; `buildDayMarks` unit tests
      already cover aggregation).
- [x] Day sheet shows names, plan titles, memory content; upcoming rows open
      plan detail.
- [x] Scrolling 12+ months back is smooth on web preview; initial position is
      the current month; "Today" chip returns to it.
- [x] No streak/chain/consecutive counts anywhere; month footer copy matches
      spec.
- [x] `logCaughtUp` from a friend profile immediately produces a dot (state →
      derived marks, no reload needed).

## WP5 — Reminder series that survives absence

**Why.** `buildReminderSpecs` (`src/domain/reminders.ts`) schedules exactly one
catch-up nudge (next day 11:00) for the alphabetically-first due friend. A
lapsed user gets one ping, then silence forever — and always about the same
friend. Local notifications are one-shot, so schedule a short fading series.

**Changes** (`src/domain/reminders.ts`, pure function — keep it Expo-free).

- When `notifyCatchUpDue`: compute due friends sorted **most overdue first**
  (overdue = `daysSince(lastMetAt ?? createdAt) − rhythmDays(friend)`; reuse
  existing helpers).
- Schedule up to **4** nudges at 11:00 local: the next upcoming 11:00 (existing
  tomorrow-if-passed logic), then +7, +14, +21 days. Nudge _i_ targets
  `dueFriends[i % dueFriends.length]` — rotation. Bodies keep the existing
  warm phrasing and `showReminderNames` behavior.
- Keys stay `catchup:<friendId>:<YYYY-MM-DD>`. Keep the global sort + dedupe +
  32 cap. Series naturally fades ~4 weeks after the last app open — that is
  intended ("quiet reminders that respectfully give up"); no code needed
  beyond the 4-nudge horizon.

**Acceptance.**

- [x] Tests in `scripts/test-domain.ts`: 4 specs when one friend is due
      (7 days apart, 11:00); rotation across 2+ due friends; most-overdue
      ordering; `showReminderNames: false` stays generic; total ≤ 32 with many
      plans + due friends.
- [x] `src/services/reminders.ts` / `reminderCoordinator` need no interface
      change (specs in/notifications out) — verify.

## WP6 — "Add to calendar" handoff + stale-copy hint

**Why.** Owner-approved answer to the Google Calendar request: a one-way OS
handoff, not sync. Zero permissions, no OAuth; Google does the syncing once
the event is in the user's calendar. The app can't edit the copy afterward, so
it _tells the user_ when the copy went stale — same philosophy as
"Did you send it?".

**Changes.**

- `npx expo install expo-calendar`. Add `"android.permission.READ_CALENDAR"`
  and `"android.permission.WRITE_CALENDAR"` to `android.blockedPermissions`
  (the system-UI handoff needs neither; the library manifest must not leak
  them). No plugin permission strings.
- `src/services/calendar.ts` (new): `addPlanToCalendar(plan)` → guard
  `Platform.OS === "web"` (return unsupported), then
  `Calendar.createEventInCalendarAsync({ title, startDate, endDate, location:
place, notes: note })` in try/catch. Treat a non-throw as exported.
- `src/screens/PlanDetailScreen.tsx`: for non-terminal plans, an
  "Add to calendar" row (Feather `calendar` icon, hidden on web). On tap →
  service; on success `commit` plan `calendarExport = { exportedAt: now,
startAt: plan.startAt, endAt: plan.endAt }` + a small confirmation
  ("Added — your calendar app takes it from here.").
- Stale hint: when `plan.calendarExport` exists AND
  (`calendarExport.startAt !== plan.startAt` or `endAt` differs or plan is
  cancelled) → dismissible hint row on PlanDetail: time changed → "This plan
  moved — update it in your calendar too." with actions **Add again**
  (re-export, refresh snapshot) and **Dismiss** (set `calendarExport` to
  null); cancelled → "You cancelled this — remove it from your calendar." with
  **Dismiss** only.
- Privacy policy (`src/content/privacyPolicy.ts` + `npm run sync:privacy`):
  add one line — the app can hand an event to your calendar app, which you
  confirm there; it never reads your calendar.

**Acceptance.**

- [x] Prebuild manifest contains **no** `READ_CALENDAR`/`WRITE_CALENDAR`
      (same check-and-clean procedure as WP1).
- [x] Unit-test the stale predicate (pure helper, e.g. in
      `src/domain/model.ts` or the service): unchanged → no hint; moved time →
      hint; cancelled → hint; re-export clears.
- [x] Web build hides the row; typecheck/tests green.
- [x] Docs: `docs/PLAY_CONSOLE_DECLARATIONS.md` + policy files mention the
      handoff (no calendar data read).

## WP7 — Feedback channel + dead-code cleanup

**Why.** With no analytics (by design), email and Play reviews are the only
feedback loops — there is currently no in-app contact path. Plus one dead
render path found in evaluation.

**Changes.**

- `src/content/privacyPolicy.ts` (or a small `src/content/contact.ts`): export
  `SUPPORT_EMAIL` — default `privacy@palari.io` (open question 1).
- `src/screens/SettingsScreen.tsx`: "Send feedback" row →
  `Linking.openURL("mailto:...?subject=So, When? feedback (v<version>)")`
  (version via `expo-constants` `Constants.expoConfig?.version`, already in
  the dependency tree — verify, else hardcode). Catch failure with an alert
  that shows the address to copy.
- Remove `buildInsight` (`src/domain/model.ts:258`) and the insight row +
  imports in `WhenScreen` (it always returns `null` — dead UI).

**Acceptance.**

- [x] Feedback row opens the mail composer on device/emulator; failure path
      shows the address.
- [x] `grep -r "buildInsight" src` returns nothing; gates green.

## WP8 — Release polish + full verification

**Changes.**

- `app.json`: `version` → `0.2.0` (Android versionCode is EAS-remote-managed —
  don't add one).
- Rebuild the preview-APK checklist in `docs/PLAY_RELEASE.md`: drop contact
  rows; add — ad-hoc plan with zero availability; Months dots (1/2/3+ friends,
  upcoming ring, day sheet, 12-month scroll); reminder series (due friend →
  future nudges visible via `Notifications.getAllScheduledNotificationsAsync`
  in a dev check or by device settings); add-to-calendar + stale hint +
  cancelled hint; feedback mailto; migration from a v3 install (upgrade
  in place, data intact).
- `docs/QA_ANDROID.md`: reflect the new surfaces.
- Update `README.md` app-shape section (three tabs unchanged; When modes now
  List/Week/Months; contact line removed already in WP1).
- Final verification, all of: `npm run format:check`, `npm run typecheck`,
  `npm test`, `npm run doctor`, `npm run export:android`; then
  `npx expo prebuild --platform android --no-install` and assert the manifest
  has no `READ_CONTACTS`, `WRITE_CONTACTS`, `READ_CALENDAR`, `WRITE_CALENDAR`,
  `CAMERA`, `RECORD_AUDIO`, media/storage permissions (the `tools:node="remove"`
  entries are fine); delete `android/` and revert prebuild side effects.
- Check every remaining box in this file; fill **Implementation notes**;
  commit and push.

**Acceptance.**

- [x] Every command above green; manifest assertions pass.
- [x] All WP boxes in this contract checked; Implementation notes filled in.
- [x] All commits pushed to `claude/first-app-evaluation-m1qxhu`.

---

## Open questions → defaults (use these, don't stall)

1. **Feedback address** → `privacy@palari.io` until the owner supplies a
   dedicated one.
2. **Months history depth** → earliest month with a mark, minimum 12 months
   back, +3 months forward.
3. **Month footer** → include, per WP4 copy rules.
4. **Invite tones** → keep all three (no change in this contract).
5. **iOS** → Android-first; keep iOS config consistent but no iOS-specific QA.

## Definition of Done (final gate)

- [x] WP1–WP8 all checked and individually committed + pushed.
- [x] `npm run format:check && npm run typecheck && npm test && npm run doctor
    && npm run export:android` all pass at HEAD.
- [x] Prebuild manifest clean per WP8 (no sensitive permissions).
- [x] `npm run sync:privacy` passes; in-app policy, `docs/PRIVACY_POLICY.md`,
      `docs/privacy-policy.html` agree and match actual behavior.
- [x] No new network calls, permissions, analytics, streak mechanics, or
      dependencies beyond `expo-calendar`.
- [x] `app.json` version `0.2.0`.

## Implementation notes (append during execution)

### WP1
- Prebuild still lists `READ_CONTACTS` with `tools:node="remove"` via
  `blockedPermissions` (defense in depth). No plugin grants it; DoD treats
  `tools:node="remove"` as clean.
- Kept media `kind` as `"friend" | "memory"` only (dropped unused `"contact"`).
- `.cursor/rules/so-when.mdc` updated to match AGENTS.md (no contact picker).

### WP2
- Added `logCaughtUpState` in `mutations.ts` (idempotent append) so AppProvider
  and tests share one path; plan Done still does not write `catchUps`.
- `currentSchemaShapeInvalid` only rejects non-array `catchUps` when
  `schemaVersion >= 4` and the field is present; missing `catchUps` on v3
  payloads defaults to `[]`.

### WP3
- `openCreatePlan` accepts `{ replace: true }` so PickPlanTime → CreatePlan
  uses `replaceTop`. Ad-hoc slots (`ruleId: null`) keep the user-picked
  duration instead of re-clipping to `defaultDurationMinutes`.

### WP4
- Day sheet adds section labels (“Caught up”, “Plans you did”, “Coming up”)
  for clarity; content matches the contract.
- `WhenCalendar` is week-only (removed `mode` / `onSwitchToDay`).

### WP5
- Catch-up keys use local `formatDateKey(triggerAt)` (was UTC ISO slice) so
  the date matches the local 11:00 trigger day.

### WP6
- Import `createEventInCalendarAsync` from `expo-calendar/legacy` (SDK 57
  default export throws deprecation stubs).
- Calendar permissions appear only as `tools:node="remove"` via
  `blockedPermissions`.

### WP7
- `SUPPORT_EMAIL` aliases `PRIVACY_CONTACT_EMAIL` (`privacy@palari.io`).
- Feedback uses transitive `expo-constants` (not added as a direct dep).

### WP8
- Bumped app/`package.json` to `0.2.0`.
- Ran `npx expo install --fix` so `expo-doctor` passes (patch bumps of
  existing Expo packages only; sole intentional new dep remains
  `expo-calendar` from WP6).
- Prebuild sensitive permissions appear only with `tools:node="remove"`.
- Also present (expected Expo defaults, not blocked): `INTERNET`,
  `SYSTEM_ALERT_WINDOW`, `VIBRATE`.
