# Play Policy Audit — advisory only

**Status:** Advisory scan notes — **not** a compliance certification.
**Scan context:** So, When? / `@palari-labs/so-when` local-first Expo app.

This document does **not** certify Play approval. Google Play Review has final authority. Declarations must be checked against the **final AAB** and live Data safety forms.

## Notes

- On-device AsyncStorage persistence (`sowhen.v1` / schemaVersion) stores friends, plans, and settings locally.
- No first-party network backend, analytics, or ads SDKs are part of this release’s intended surface.
- Optional photo picker copies selected images on-device.
- Optional local notifications only.
- Do not treat an on-device friend name as “collected by Palari Labs” for Data safety “shared” claims.
- Update this file whenever permissions or data flows change.

## Operator checklist

- [ ] Privacy policy hosted at HTTPS
- [ ] Data safety form matches final binary
- [ ] Merged manifest reviewed for unjustified permissions
- [ ] Internal testing track smoke journey completed on device
