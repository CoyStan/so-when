# Fast path to Google Play

## Already prepared

- Expo managed app **So, When?** by **Palari Labs, Inc.**
- Android package `com.sowhen.myapp` (must match Google Play Console).
- Brand assets in `assets/` (app icon, adaptive icons, splash, store icon, feature graphic).
- `eas.json` with internal preview and production profiles.
- Existing EAS link in `app.json`: owner `palari.io`, project ID `511080a9-ef93-40b2-8948-8e84de2cadd5`.
- Android-first scope, visual rules, and quality gate in AGENTS.md.

## EAS project (manual — requires Expo login)

The repository is linked to the existing EAS project owned by `palari.io`. The
EAS slug remains `vemos` until an Expo owner renames that project in the EAS
dashboard. Do not change the local slug by itself because it must keep matching
the linked project.

To verify the link, authenticate with the Palari Expo organization account and run:

```bash
npx eas-cli@22.0.0 login
npx eas-cli@22.0.0 project:info
```

Then build a preview:

```bash
npx eas-cli@22.0.0 build --platform android --profile preview
```

## Privacy policy hosting (manual)

1. Host `docs/privacy-policy.html` (same body as `docs/PRIVACY_POLICY.md` / in-app copy) at a public HTTPS URL.
2. Paste that URL into Google Play Console → App content → Privacy policy.
3. Keep deployment notes **here only** — not in the in-app or public-facing policy body.

## Brand assets for Play Console

| File | Use |
| --- | --- |
| `assets/store-icon-512.png` | Play Store high-res icon (512×512) |
| `assets/store-feature-graphic.png` | Feature graphic (1024×500) |
| `assets/icon.png` | App icon source (1024×1024) |
| `assets/android-icon-*.png` | Adaptive icon layers |

Wordmark: teal **So,** stacked above ink **When?** in Quicksand Bold on warm canvas.

## Contact permission — resolved

Contact import was removed for v0.2. Friends are added by typing a name only. `expo-contacts` is gone; `READ_CONTACTS` is listed in `android.blockedPermissions` so a prebuild cannot reintroduce it.

## Preview APK test checklist (physical Android)

Before calling an internal release ready, install the preview APK and verify:

- [ ] Fresh install → welcome/onboarding
- [ ] Upgrade from a v3 (0.1.x) install → data migrates to schema v4; friends/plans intact
- [ ] Add friend manually
- [ ] Make a plan with **zero** availability (When + → Make a plan, or Invite from profile)
- [ ] Months view: dots for 1 / 2 / 3+ friends seen; upcoming hollow ring; day sheet; scroll ~12 months; Today chip
- [ ] Catch-up reminder series: due friend → up to 4 weekly 11:00 nudges (dev check via scheduled notifications or Settings)
- [ ] Add to calendar → OS create-event UI; move plan → stale hint (Add again / Dismiss); cancel → cancelled hint
- [ ] Settings → Send feedback opens mailto
- [ ] Gallery friend photo + plan memory photo survive **relaunch**
- [ ] Process death (force-stop) → state restored from primary/backup
- [ ] Invitation share sheet; edit text; Yes/Maybe/No preserved when dismissing send confirm
- [ ] JSON export share and **cancel** (temp file cleaned); export includes `catchUps`
- [ ] Local reminders (permission on/off, settings toggles)
- [ ] Forced save failure → banner Retry resaves latest (does not wipe)
- [ ] Wipe all data → empty welcome; Retry wipe if wipe failed (does not resave old snapshot)
- [ ] Recovery Start Fresh → confirm; failure surfaces as start-fresh error, not save error

## Production upload

1. Create **So, When?** in Google Play Console under Palari Labs, Inc.
2. Complete Store Listing, App Content, Data safety, content rating, and privacy-policy requirements based on the real app behavior.
3. Run: `npx eas-cli@22.0.0 build --platform android --profile production`
4. Run: `npx eas-cli@22.0.0 submit --platform android --profile production`
5. Start in the internal track, then promote only after testing and automated checks pass.

Do not claim no data collected if analytics, crash reporting, accounts, or remote services are introduced later. Update Play forms and the privacy policy with every data-flow change.
