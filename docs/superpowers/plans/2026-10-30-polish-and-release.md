# So, When? polish and release plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks marked **YOU** are for the owner; Claude prepares everything around them and guides the owner step by step.

**Goal:** Take So, When? from "built but never really tested" to a polished app on the Google Play internal testing track, used by the owner and 5 to 10 friends.

**Architecture:** No product changes. The v0.2 feature set stays as it is. The work is a dependency refresh, a crash safety net, a real-device test pass, visual polish (icon, screenshots), and the Play Console paperwork.

**Tech stack:** Expo (SDK 57 moving to 58), React Native, TypeScript, NativeWind, EAS Build, Google Play Console.

**Spec:** `AGENTS.md` (product rules), `docs/PRODUCT.md`, `docs/PLAY_RELEASE.md` (device checklist).

## In plain words (read this first)

| Phase | What happens | Who | Effort |
| --- | --- | --- | --- |
| 0. Foundations | Update packages, add a crash safety net | Claude | ½ to 1 day |
| 1. First real build | Build an APK, you install it and try every screen | Claude + you (1 to 2 h) | 1 day |
| 2. Polish | New app icon, accessibility pass, wording pass, store pictures | Claude, you pick options | 2 to 3 days |
| 3. Use it yourself | Plan real catch-ups with it for a week, note annoyances | You (~0 effort) | 1 week |
| 4. Play Store | Privacy page, Play listing, upload to internal testing | Claude + you (2 h) | 1 day |
| 5. Friends test | 5 to 10 friends use it for 3 weeks, two short check-ins | You + Claude fixes | 3 weeks, light |
| 6. Decide | Go public, keep private, or stop | You | 15 min |

Things only you can do: log in to accounts (Expo, Google Play), hold the phone, choose between design options, and invite friends. Claude never needs your passwords; when a token is needed, Claude asks for it through a secure prompt.

## Global constraints

- Package id stays `com.sowhen.myapp`. Publisher stays Palari Labs, Inc.
- No accounts, backend, analytics, crash reporting, ads, or payments (AGENTS.md).
- No new Android permissions. The `blockedPermissions` list in `app.json` stays.
- Voice: warm, low-pressure, no guilt. "Want to invite Ana?", never "Ana is overdue."
- Touch targets at least 44x44, labels on icon-only buttons, text must survive the largest system font size.
- Every code task ends green on: `npm run format:check && npm run typecheck && npm run check:privacy && npm test && npm run doctor && npm run export:android`.
- Work on branch `claude/polish-and-release`; commit per task; push and open a PR only when the owner says so.

## Review focus

1. A render crash anywhere must show a calm recovery screen, never a blank white app (Task 2).
2. Data saved under SDK 57 must load unchanged after the SDK 58 upgrade (Task 3, checked on device in Task 5).
3. Largest Android font size must not clip names, times, or buttons on a 360 dp wide phone (Task 8).
4. Notifications denied must leave reminders off and the app fully usable (Task 5 checklist).
5. Sample data used for screenshots must never appear in a store build (Task 10).

---

## Phase 0. Foundations (Claude)

### Task 1: Fix dependency drift so CI is green again

**Files:** Modify `package.json`, `package-lock.json`.

- [ ] Run `npx expo install --fix`.
- [ ] Run the full gate list. Expected: `expo-doctor` reports 21/21 checks passed; everything else passes.
- [ ] Commit `Fix Expo dependency drift so expo-doctor passes`.

### Task 2: Root error boundary

**Files:** Create `src/components/ErrorBoundary.tsx`. Modify `App.tsx` (wrap the app tree inside `SafeAreaProvider`).

**Interfaces:** Produces `ErrorBoundary` (React class component, props `{ children: ReactNode }`).

- [ ] Implement `ErrorBoundary` with `getDerivedStateFromError`. Fallback uses `Screen`, `Card`, `Button`, Quicksand, `foundation.ts` colors. Copy (exact):
  - Title: `Something went sideways`
  - Body: `Your friends and plans are still saved on this phone.`
  - Button: `Try again` (clears the error state and re-renders children)
- [ ] The fallback must not depend on `useApp()` (the provider may be what crashed).
- [ ] Run the gate list. Expected: all pass.
- [ ] Commit `Add root error boundary with calm recovery screen`.

### Task 3: Upgrade to Expo SDK 58

Why: SDK 58 is current (released 2026-09-29). Building the first tester release on an old SDK means a second, riskier upgrade later, and the store version of Expo Go only opens the current SDK.

**Files:** `package.json`, `package-lock.json`, possibly `app.json`, any file the changelog flags.

- [ ] Run `npx expo install expo@^58.0.0 --fix`.
- [ ] Read the SDK 58 changelog for packages this app uses: `expo-calendar` (the app imports `expo-calendar/legacy`), `expo-notifications`, `expo-file-system`, `expo-image-picker`, `expo-sharing`, `react-native-reanimated`, `nativewind`. Fix any breaking change.
- [ ] Run the gate list. Expected: all pass, `expo-doctor` 21/21.
- [ ] Start Metro and request the Android bundle: `curl -s -o /dev/null -w '%{http_code}' 'localhost:8081/index.bundle?platform=android&dev=true'`. Expected: `200`.
- [ ] Commit `Upgrade to Expo SDK 58`.
- [ ] If an upgrade blocker cannot be fixed in half a day, revert this task and stay on SDK 57 for testers. Note the blocker here.

## Phase 1. First real build

### Task 4: Expo login for builds (YOU, 10 min)

- [ ] YOU: sign in at expo.dev with the `palari.io` account. Open Account settings, then Access tokens, then create a token named `vps-builds`.
- [ ] Claude asks for it with the secure secret prompt and runs `npx eas-cli@latest whoami` and `project:info`. Expected: shows the `so-when` project.

### Task 5: Preview APK and device test (Claude builds, YOU test, 1 to 2 h)

- [ ] Claude: `npx eas-cli@latest build --platform android --profile preview --non-interactive`. Send the owner the install link.
- [ ] YOU: install on your Android phone (allow "install unknown apps" when asked).
- [ ] YOU: go through the checklist in `docs/PLAY_RELEASE.md` ("Preview APK test checklist"). For every problem, send a screenshot and one line saying what you expected.
- [ ] Also test: turn on the largest font size (Settings, Display, Font size) and walk When, Friends, a plan, and Settings.

### Task 6: Fix what the device test found (Claude, budget 1 day)

- [ ] One commit per fix, each with the gate list green.
- [ ] Rebuild the preview APK; YOU re-check only the items that failed.

## Phase 2. Polish

### Task 7: App icon that reads at home-screen size

Why: the current icon is the full "So, When?" wordmark. At 48 dp on a home screen the words are too small to read.

**Files:** `scripts/generate-brand-assets.py`, all of `assets/*.png` except `favicon.png` (regenerate that too).

- [ ] Claude drafts 3 symbol-only options in brand colors (teal `#147A78`, coral `#F28C78`, canvas `#FAF8F5`), for example a speech bubble with a question mark, or a teal comma. Shows each at real size (48 px) and large.
- [ ] YOU pick one.
- [ ] Claude regenerates icon, adaptive foreground/background/monochrome, splash, notification icon, store icon, and feature graphic from the script. Gate list, commit.

### Task 8: Accessibility and large-font pass

**Files:** screens flagged by the pass, likely `CreatePlanScreen.tsx` and `AddAvailabilityScreen.tsx` (fewer accessibility labels than pressables).

- [ ] Every `Pressable`/`PressableScale` has text children or an `accessibilityLabel`, plus an `accessibilityRole`.
- [ ] Every touch target is at least 44x44 (`minHeight`/`hitSlop`).
- [ ] Fix anything the Task 5 large-font walk clipped.
- [ ] Gate list, commit.

### Task 9: Wording pass

- [ ] Use the `design:ux-copy` skill across every screen, empty state, error, and notification. Rules: AGENTS.md voice, one clear next action per screen, no guilt.
- [ ] Keep the in-app privacy text in sync (`npm run sync:privacy`).
- [ ] YOU skim the before/after list and veto anything that doesn't sound like you.
- [ ] Gate list, commit.

### Task 10: Sample data for store screenshots

**Files:** Create `src/domain/sampleData.ts`. Modify `src/screens/SettingsScreen.tsx`, `eas.json`.

**Interfaces:** Produces `buildSampleData(now: Date): AppData` (5 friends with fictional names, 2 recurring availability rules, 3 plans in different statuses, 2 catch-up logs).

- [ ] Test first in `scripts/test-domain.ts`: `buildSampleData` output passes the existing migration/validation path unchanged and contains no phone numbers.
- [ ] Settings shows a "Load sample friends" row only when `process.env.EXPO_PUBLIC_SAMPLE_DATA === "1"`. It asks for confirmation, then replaces all data.
- [ ] Add an EAS profile `screenshots` (copy of `preview` plus `"env": { "EXPO_PUBLIC_SAMPLE_DATA": "1" }`). The `production` profile must not set it.
- [ ] Gate list, commit.

### Task 11: Store screenshots and feature graphic

- [ ] Claude builds the `screenshots` APK. YOU install it, load sample friends, and take 5 screenshots: When list, a plan with the invite text, Friends, Months view, friend profile.
- [ ] Claude frames them (canvas background, one short caption each, Quicksand) into 1080x1920 PNGs under `assets/store/`, and rebuilds the feature graphic with the new icon and the short description.
- [ ] Update `docs/PLAY_LISTING.md` with the file list. Commit.

## Phase 3. Use it yourself (YOU, 1 week)

- [ ] Install the latest preview APK. Add the real friends you want to see.
- [ ] Plan at least 2 real catch-ups with it.
- [ ] Keep one running note of every annoyance. Send it to Claude at the end of the week.
- [ ] Claude fixes the batch (budget 1 day).
- [ ] Gate: if you didn't plan 2 real catch-ups with it, stop here and decide whether it's worth continuing.

## Phase 4. Play Store

### Task 12: Host the privacy policy

- [ ] With your OK, Claude turns on GitHub Pages for `CoyStan/so-when` serving `docs/`. Policy URL becomes `https://coystan.github.io/so-when/privacy-policy.html`. (Alternative: host it on a palari.io page if you prefer the company domain.)
- [ ] Claude checks the URL returns the policy, then records it in `docs/PLAY_RELEASE.md`.

### Task 13: Support email check (YOU, 2 min)

- [ ] Send a test email to `privacy@palari.io`. If it doesn't reach you, tell Claude which address to use; Claude updates `src/content/privacyPolicy.ts` and runs `npm run sync:privacy`.

### Task 14: Play Console setup (YOU, guided, about 1 h)

- [ ] Check the Play developer account type. Organization (Palari Labs, Inc.): no testing-period rule. Personal: a closed test with 12 testers for 14 days is required before production.
- [ ] Create the app "So, When?". Store listing: paste from `docs/PLAY_LISTING.md`, upload icon, feature graphic, screenshots.
- [ ] App content: privacy policy URL (Task 12), Data safety from `docs/PLAY_CONSOLE_DECLARATIONS.md`, content rating questionnaire, target audience (adults), no ads.
- [ ] Claude stays on hand to answer each form question.

### Task 15: Production build and first upload

- [ ] Claude bumps `app.json` version to `1.0.0` and runs `npx eas-cli@latest build --platform android --profile production`.
- [ ] YOU upload the `.aab` in Play Console, Testing, Internal testing (Google requires the first upload to be manual). Later uploads can use `eas submit`.

### Task 16: Invite testers (YOU, 10 min)

- [ ] Add 5 to 10 friends' Gmail addresses to the internal testing list and send them the opt-in link.

## Phase 5. Friends test (3 weeks)

- [ ] Week 1 and week 3, message each tester these 3 questions:
  1. How many invites did you send from it?
  2. What almost made you stop using it?
  3. Would you still have it on your phone in a month?
- [ ] Claude turns the answers into a fix list; one fix round per check-in.

## Phase 6. Decide (YOU, 15 min)

| Result at week 3 | Do this |
| --- | --- |
| 3+ testers sent invites and 2+ still use it unprompted | Go public on Play: production track, free. Light free marketing (store keywords, one r/androidapps post, Product Hunt). |
| Testers installed but rarely sent invites | Keep it as your own app on the internal track. Stop active work. |
| You stopped using it yourself | Archive the repo. |

Not in this plan on purpose: iPhone/TestFlight, payments, analytics, accounts, splitting `AppProvider.tsx`. Revisit only after Phase 6.
