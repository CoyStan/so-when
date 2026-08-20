/** Canonical privacy policy copy for in-app display. Keep docs/PRIVACY_POLICY.md in sync. */

export const PRIVACY_POLICY_EFFECTIVE_DATE = "July 21, 2026";
export const PRIVACY_CONTACT_EMAIL = "privacy@palari.io";
export const SUPPORT_EMAIL = PRIVACY_CONTACT_EMAIL;
export const PRIVACY_PACKAGE_ID = "com.sowhen.myapp";

export const PRIVACY_POLICY_SECTIONS: { title: string; body: string }[] = [
  {
    title: "Who we are",
    body: "So, When? is made by Palari Labs, Inc. (“Palari Labs,” “we,” “us”). This policy explains how the Android app So, When? handles information. Version 1 is a private, on-device organizer. Friends do not need the app, an account, or a link from us.",
  },
  {
    title: "Summary",
    body: "So, When? does not require an account and does not operate a So, When? backend that stores your friends, plans, or messages. Information you enter stays on your device unless you choose to share it yourself (for example through the system share sheet) or export a copy. We do not sell personal information.",
  },
  {
    title: "Information stored on your device",
    body: "Depending on how you use the app, So, When? may store locally: friend names and optional phone numbers, preferred share methods, catch-up rhythms, and last-caught-up dates; optional photos for friends or plan memories (copied into app-owned storage when possible); availability rules and skipped occurrences; plans (time, activity, place, private notes) and per-friend invitation text and reply statuses; and settings such as reminder preferences and display defaults. Android backup for app data is disabled in this release.",
  },
  {
    title: "Photos and app-owned media",
    body: "If you grant photo permission, you may attach an optional photo for a friend or a plan memory. Selected images are copied into an app-owned folder when the platform allows it. Replacing or removing a photo deletes the previous app-owned file when it was managed by So, When?. We do not upload photos to Palari Labs servers.",
  },
  {
    title: "Notifications",
    body: "Optional local reminders use the device notification system for plan and catch-up nudges. By default, lock-screen copy stays generic unless you turn on showing names in Settings. This release does not use remote push from a Palari Labs server.",
  },
  {
    title: "Sharing invitations",
    body: "When you share an invitation, the message is opened through the Android share sheet or apps you choose. Delivery after you leave So, When? is controlled by those apps. Opening a share sheet is not treated as proof that a message was sent. You may also hand a plan to your device’s calendar app through the system create-event screen; So, When? does not read your calendars.",
  },
  {
    title: "Export and deletion",
    body: "Settings lets you export a JSON copy of your text data (photos are not included). The export can contain names, phone numbers, notes, and statuses—share it carefully. Wipe deletes local state, cancels reminders, and removes app-owned media.",
  },
  {
    title: "What we do not collect in this release",
    body: "This release does not create accounts; does not send friend lists, plans, or invitation text to Palari Labs servers; and does not include analytics, advertising, crash-reporting SDKs, or social login.",
  },
  {
    title: "Children",
    body: "So, When? is not directed to children under 13. Because this release keeps data on-device, parents who install the app control the device and the data entered into it.",
  },
  {
    title: "Your choices",
    body: "You can deny photos or notification permissions; use the app without those features; export or wipe data in Settings; and uninstall the app at any time.",
  },
  {
    title: "Changes",
    body: "We may update this policy when the product’s data practices change. The effective date at the top will change when we do.",
  },
  {
    title: "Contact",
    body: `Questions about this policy: ${PRIVACY_CONTACT_EMAIL}.`,
  },
];

export const PRIVACY_POLICY_MARKDOWN = [
  `# Privacy Policy — So, When?`,
  ``,
  `**Effective date:** ${PRIVACY_POLICY_EFFECTIVE_DATE}`,
  ``,
  `**App:** So, When?`,
  `**Android package:** \`${PRIVACY_PACKAGE_ID}\``,
  `**Publisher:** Palari Labs, Inc.`,
  ``,
  ...PRIVACY_POLICY_SECTIONS.flatMap((section) => [
    `## ${section.title}`,
    ``,
    section.body,
    ``,
  ]),
].join("\n");
