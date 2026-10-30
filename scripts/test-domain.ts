/**
 * Domain + persistence tests. Run: npm test
 */
import assert from "node:assert/strict";

import {
  buildInviteText,
  buildTimeline,
  catchUpStatus,
  calendarExportHint,
  intervalsOverlap,
  proposePlanWindow,
  rhythmDays,
  slotIsBooked,
} from "../src/domain/model";
import {
  completeOnboardingState,
  createPlanState,
  lookAroundFirst,
  markPlanDoneState,
  logCaughtUpState,
  skipOccurrenceOnce,
  updateSettings,
} from "../src/domain/mutations";
import { calendarDaysBetween, daysSince, startOfDay } from "../src/domain/time";
import type {
  AppData,
  ConcreteSlot,
  Friend,
  Plan,
  PlanFriend,
} from "../src/domain/types";
import {
  emptyAppData,
  migrateAndValidate,
  SCHEMA_VERSION,
} from "../src/persistence/migrate";
import { applyUpdaters } from "../src/persistence/writeQueue";
import { buildReminderSpecs } from "../src/domain/reminders";
import { buildSampleData } from "../src/domain/sampleData";
import {
  buildDayMarks,
  dayMarkSize,
  type CatchUpLog,
} from "../src/domain/catchUpHistory";

const now = new Date("2026-07-21T12:00:00.000Z");

function friend(
  partial: Partial<Friend> & Pick<Friend, "id" | "name">,
): Friend {
  return {
    photoUri: null,
    phone: "",
    shareMethod: "message",
    rhythm: "weekly",
    customDays: 45,
    lastMetAt: null,
    createdAt: now.toISOString(),
    ...partial,
  };
}

function planFriend(
  friendId: string,
  status: PlanFriend["status"],
): PlanFriend {
  return {
    friendId,
    status,
    invitationText: "",
    inviteTone: "warm",
    invitationCustomized: false,
    sentAt: null,
    displayNameSnapshot: null,
  };
}

assert.equal(
  rhythmDays(friend({ id: "1", name: "Ana", rhythm: "none" })),
  null,
);
assert.equal(
  catchUpStatus(
    friend({
      id: "1",
      name: "Ana",
      lastMetAt: null,
      createdAt: now.toISOString(),
    }),
    now,
  ),
  "none",
);
assert.equal(
  catchUpStatus(
    friend({
      id: "1",
      name: "Ana",
      lastMetAt: null,
      createdAt: "2026-01-01T12:00:00.000Z",
      rhythm: "monthly",
    }),
    now,
  ),
  "due",
);

assert.equal(intervalsOverlap(19 * 60, 22 * 60, 20 * 60, 21 * 60), true);
assert.equal(intervalsOverlap(19 * 60, 22 * 60, 22 * 60, 23 * 60), false);

const plan710: Plan = {
  id: "p1",
  title: "Catch up",
  activity: "",
  place: "",
  note: "",
  startAt: new Date(2026, 6, 23, 19, 0).toISOString(),
  endAt: new Date(2026, 6, 23, 22, 0).toISOString(),
  availabilityKey: "avail:2026-07-23:1140",
  friends: [planFriend("a", "yes")],
  status: "on",
  memoryNote: "",
  memoryPhotoUri: null,
  attendedFriendIds: [],
  completedAt: null,
  cancelledAt: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  calendarExport: null,
};

const slot89: ConcreteSlot = {
  key: "x",
  ruleId: "r",
  date: "2026-07-23",
  startMinutes: 20 * 60,
  endMinutes: 21 * 60,
  startAt: new Date(2026, 6, 23, 20, 0).toISOString(),
  endAt: new Date(2026, 6, 23, 21, 0).toISOString(),
  label: "free",
};
assert.equal(slotIsBooked(slot89, [plan710]), true);

const slot1011: ConcreteSlot = {
  ...slot89,
  startMinutes: 22 * 60,
  endMinutes: 23 * 60,
  startAt: new Date(2026, 6, 23, 22, 0).toISOString(),
  endAt: new Date(2026, 6, 23, 23, 0).toISOString(),
};
assert.equal(slotIsBooked(slot1011, [plan710]), false);
assert.equal(
  slotIsBooked(slot89, [{ ...plan710, status: "cancelled" }]),
  false,
);

const window = proposePlanWindow(
  new Date(2026, 6, 23, 19, 0).toISOString(),
  new Date(2026, 6, 23, 22, 0).toISOString(),
  60,
);
assert.equal(new Date(window.startAt).getHours(), 19);
assert.equal(new Date(window.endAt).getHours(), 20);

const invite = buildInviteText({
  name: "Ana",
  startAt: new Date(2026, 6, 23, 19, 0).toISOString(),
  endAt: new Date(2026, 6, 23, 21, 0).toISOString(),
  timeFormat24h: false,
});
assert.ok(invite.includes("Ana"));
assert.ok(!invite.includes("Attendance mandatory"));

assert.equal(
  calendarDaysBetween(
    startOfDay(new Date(2026, 2, 7)),
    startOfDay(new Date(2026, 2, 9)),
  ),
  2,
);
assert.equal(
  daysSince(
    startOfDay(new Date(2026, 2, 7)).toISOString(),
    startOfDay(new Date(2026, 2, 9)),
  ),
  2,
);

const legacy = JSON.stringify({
  onboardingComplete: true,
  friends: [
    { id: "f1", name: "Ana", rhythm: "monthly", createdAt: now.toISOString() },
  ],
  availability: [],
  skipped: [],
  plans: [],
  settings: {},
});
const migrated = migrateAndValidate(legacy);
assert.equal(migrated.ok, true);
if (migrated.ok) {
  assert.equal(migrated.data.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.data.friends[0]?.name, "Ana");
}
assert.equal(migrateAndValidate("{not json").ok, false);

let data: AppData = emptyAppData();
data = applyUpdaters(data, [
  (d) => updateSettings(d, { timeFormat24h: true }),
  (d) => updateSettings(d, { defaultDurationMinutes: 60 }),
]);
assert.equal(data.settings.timeFormat24h, true);
assert.equal(data.settings.defaultDurationMinutes, 60);

data = completeOnboardingState(
  emptyAppData(),
  {
    friend: {
      name: "Ana",
      photoUri: null,
      phone: "",
      shareMethod: "message",
      rhythm: "monthly",
      customDays: 45,
      lastMetAt: null,
    },
    availability: null,
  },
  (prefix) => `${prefix}_1`,
);
assert.equal(data.friends.length, 1);
assert.equal(data.friends[0]?.name, "Ana");
assert.equal(data.availability.length, 0);
assert.equal(lookAroundFirst(emptyAppData()).onboardingComplete, true);
assert.equal(lookAroundFirst(emptyAppData()).friends.length, 0);

data = skipOccurrenceOnce(data, "r1", "2026-07-23");
data = skipOccurrenceOnce(data, "r1", "2026-07-23");
assert.equal(data.skipped.length, 1);

const slot: ConcreteSlot = {
  key: "avail:2026-07-23:1140",
  ruleId: "avail",
  date: "2026-07-23",
  startMinutes: 19 * 60,
  endMinutes: 22 * 60,
  startAt: new Date(2026, 6, 23, 19, 0).toISOString(),
  endAt: new Date(2026, 6, 23, 22, 0).toISOString(),
  label: "free",
};
const withFriend = completeOnboardingState(
  emptyAppData(),
  {
    friend: {
      name: "Ana",
      photoUri: null,
      phone: "",
      shareMethod: "message",
      rhythm: "monthly",
      customDays: 45,
      lastMetAt: null,
    },
  },
  (p) => `${p}_x`,
);
const created = createPlanState(
  withFriend,
  slot,
  [withFriend.friends[0]!.id],
  {
    title: "",
    activity: "",
    place: "",
    note: "",
  },
  (p) => `${p}_p`,
);
assert.equal(created.ok, true);
if (created.ok) {
  const conflict = createPlanState(
    created.data,
    slot,
    [withFriend.friends[0]!.id],
    {
      title: "",
      activity: "",
      place: "",
      note: "",
    },
    (p) => `${p}_p2`,
  );
  assert.equal(conflict.ok, false);
  const done = markPlanDoneState(created.data, created.plan.id, [
    withFriend.friends[0]!.id,
  ]);
  assert.equal(
    done.plans.find((p) => p.id === created.plan.id)?.status,
    "done",
  );
  assert.equal(done.friends[0]?.lastMetAt, created.plan.startAt);
}

// Ad-hoc plan slot (no availability rule) — WP3.
const adhocSlot: ConcreteSlot = {
  key: "adhoc:2026-07-25:1140",
  ruleId: null,
  date: "2026-07-25",
  startMinutes: 19 * 60,
  endMinutes: 20 * 60,
  startAt: new Date(2026, 6, 25, 19, 0).toISOString(),
  endAt: new Date(2026, 6, 25, 20, 0).toISOString(),
  label: "Your pick",
};
const adhocCreated = createPlanState(
  withFriend,
  adhocSlot,
  [withFriend.friends[0]!.id],
  { title: "", activity: "Walk", place: "", note: "" },
  (p) => `${p}_adhoc`,
);
assert.equal(adhocCreated.ok, true);
if (adhocCreated.ok) {
  assert.equal(adhocCreated.plan.availabilityKey, adhocSlot.key);
  const adhocConflict = createPlanState(
    adhocCreated.data,
    adhocSlot,
    [withFriend.friends[0]!.id],
    { title: "", activity: "", place: "", note: "" },
    (p) => `${p}_adhoc2`,
  );
  assert.equal(adhocConflict.ok, false);
}

const timeline = buildTimeline(
  [friend({ id: "a", name: "Ana" })],
  [
    { ...plan710, status: "done" },
    {
      ...plan710,
      id: "p2",
      status: "on",
      startAt: new Date(2026, 6, 24, 19, 0).toISOString(),
      endAt: new Date(2026, 6, 24, 21, 0).toISOString(),
    },
  ],
  [],
  new Date(2026, 6, 21, 12, 0),
);
assert.ok(
  !timeline.some((item) => item.type === "plan" && item.plan.status === "done"),
);

const specs = buildReminderSpecs(
  {
    ...emptyAppData(),
    settings: {
      ...emptyAppData().settings,
      notificationsEnabled: true,
      notifyPlanTomorrow: true,
      notifyCatchUpDue: true,
      notifyAskIfHappened: true,
    },
    plans: [
      {
        ...plan710,
        startAt: new Date(2026, 6, 24, 19, 0).toISOString(),
        endAt: new Date(2026, 6, 24, 21, 0).toISOString(),
      },
    ],
  },
  new Date(2026, 6, 22, 12, 0),
);
assert.ok(specs.length >= 1);
assert.ok(specs.every((s) => !s.body.toLowerCase().includes("ana")));

// Catch-up reminder series (docs/V1_CONTRACT.md WP5).
const reminderNow = new Date(2026, 6, 22, 12, 0);
const seriesBase = {
  ...emptyAppData(),
  settings: {
    ...emptyAppData().settings,
    notificationsEnabled: true,
    notifyCatchUpDue: true,
    notifyPlanTomorrow: false,
    notifyAskIfHappened: false,
    showReminderNames: true,
  },
  friends: [
    friend({
      id: "overdue-a",
      name: "Ana",
      rhythm: "weekly",
      lastMetAt: startOfDay(new Date(2026, 5, 1)).toISOString(),
      createdAt: startOfDay(new Date(2026, 4, 1)).toISOString(),
    }),
  ],
};
const series = buildReminderSpecs(seriesBase, reminderNow).filter((s) =>
  s.key.startsWith("catchup:"),
);
assert.equal(series.length, 4);
for (let i = 0; i < 4; i += 1) {
  const trigger = series[i]!.triggerAt;
  assert.equal(trigger.getHours(), 11);
  assert.equal(trigger.getMinutes(), 0);
  if (i > 0) {
    const prev = series[i - 1]!.triggerAt;
    assert.equal((trigger.getTime() - prev.getTime()) / 86_400_000, 7);
  }
  assert.equal(series[i]!.body.includes("Ana"), true);
}

const rotated = buildReminderSpecs(
  {
    ...seriesBase,
    friends: [
      friend({
        id: "old",
        name: "Zoe",
        rhythm: "weekly",
        lastMetAt: startOfDay(new Date(2026, 4, 1)).toISOString(),
        createdAt: startOfDay(new Date(2026, 3, 1)).toISOString(),
      }),
      friend({
        id: "newer",
        name: "Ana",
        rhythm: "weekly",
        lastMetAt: startOfDay(new Date(2026, 6, 1)).toISOString(),
        createdAt: startOfDay(new Date(2026, 5, 1)).toISOString(),
      }),
    ],
  },
  reminderNow,
).filter((s) => s.key.startsWith("catchup:"));
assert.equal(rotated.length, 4);
assert.equal(rotated[0]!.body.includes("Zoe"), true);
assert.equal(rotated[1]!.body.includes("Ana"), true);
assert.equal(rotated[2]!.body.includes("Zoe"), true);
assert.equal(rotated[3]!.body.includes("Ana"), true);

const genericCatchUps = buildReminderSpecs(
  {
    ...seriesBase,
    settings: { ...seriesBase.settings, showReminderNames: false },
  },
  reminderNow,
).filter((s) => s.key.startsWith("catchup:"));
assert.ok(genericCatchUps.every((s) => !s.body.toLowerCase().includes("ana")));

const capped = buildReminderSpecs(
  {
    ...emptyAppData(),
    settings: {
      ...emptyAppData().settings,
      notificationsEnabled: true,
      notifyPlanTomorrow: true,
      notifyAskIfHappened: true,
      notifyCatchUpDue: true,
      showReminderNames: false,
    },
    friends: Array.from({ length: 8 }, (_, i) =>
      friend({
        id: `f${i}`,
        name: `Friend ${i}`,
        rhythm: "weekly",
        lastMetAt: startOfDay(new Date(2026, 4, 1)).toISOString(),
        createdAt: startOfDay(new Date(2026, 3, 1)).toISOString(),
      }),
    ),
    plans: Array.from({ length: 40 }, (_, i) => ({
      ...plan710,
      id: `plan-${i}`,
      title: `Plan ${i}`,
      startAt: new Date(2026, 6, 24 + (i % 20), 19, 0).toISOString(),
      endAt: new Date(2026, 6, 24 + (i % 20), 20, 0).toISOString(),
      status: "on" as const,
    })),
  },
  reminderNow,
);
assert.ok(capped.length <= 32);

assert.equal(
  calendarExportHint({
    status: "on",
    startAt: plan710.startAt,
    endAt: plan710.endAt,
    calendarExport: {
      exportedAt: now.toISOString(),
      startAt: plan710.startAt,
      endAt: plan710.endAt,
    },
  }),
  null,
);
assert.equal(
  calendarExportHint({
    status: "on",
    startAt: plan710.startAt,
    endAt: plan710.endAt,
    calendarExport: {
      exportedAt: now.toISOString(),
      startAt: new Date(2026, 6, 24, 19, 0).toISOString(),
      endAt: plan710.endAt,
    },
  }),
  "moved",
);
assert.equal(
  calendarExportHint({
    status: "cancelled",
    startAt: plan710.startAt,
    endAt: plan710.endAt,
    calendarExport: {
      exportedAt: now.toISOString(),
      startAt: plan710.startAt,
      endAt: plan710.endAt,
    },
  }),
  "cancelled",
);
assert.equal(
  calendarExportHint({
    status: "on",
    startAt: plan710.startAt,
    endAt: plan710.endAt,
    calendarExport: null,
  }),
  null,
);

// Months view aggregation (docs/V1_CONTRACT.md WP4 seed).
const doneJuly18: Plan = {
  ...plan710,
  id: "done-1",
  startAt: new Date(2026, 6, 18, 19, 0).toISOString(),
  endAt: new Date(2026, 6, 18, 21, 0).toISOString(),
  status: "done",
  friends: [planFriend("a", "yes"), planFriend("b", "yes")],
  attendedFriendIds: ["a", "b"],
  completedAt: new Date(2026, 6, 18, 22, 0).toISOString(),
};
const doneNobodyCame: Plan = {
  ...plan710,
  id: "done-empty",
  startAt: new Date(2026, 6, 19, 12, 0).toISOString(),
  endAt: new Date(2026, 6, 19, 13, 0).toISOString(),
  status: "done",
  attendedFriendIds: [],
  completedAt: new Date(2026, 6, 19, 14, 0).toISOString(),
};
const catchUpLogs: CatchUpLog[] = [
  {
    id: "log-1",
    friendId: "a",
    date: "2026-07-18",
    createdAt: now.toISOString(),
  },
  {
    id: "log-2",
    friendId: "c",
    date: "2026-07-18",
    createdAt: now.toISOString(),
  },
];
const marks = buildDayMarks(
  [doneJuly18, doneNobodyCame, { ...plan710, id: "upcoming-1" }],
  catchUpLogs,
);
const july18 = marks.get("2026-07-18");
assert.ok(july18);
assert.deepEqual(july18.seenFriendIds, ["a", "b", "c"]);
assert.deepEqual(july18.donePlanIds, ["done-1"]);
assert.equal(marks.get("2026-07-19"), undefined);
const july23 = marks.get("2026-07-23");
assert.ok(july23);
assert.deepEqual(july23.upcomingPlanIds, ["upcoming-1"]);
assert.deepEqual(july23.seenFriendIds, []);
assert.equal(dayMarkSize(0), "none");
assert.equal(dayMarkSize(1), "small");
assert.equal(dayMarkSize(2), "medium");
assert.equal(dayMarkSize(3), "large");
assert.equal(dayMarkSize(7), "large");

// Schema v4: migrate v3 → catchUps + calendarExport (docs/V1_CONTRACT.md WP2).
const v3Payload = JSON.stringify({
  schemaVersion: 3,
  onboardingComplete: true,
  friends: [
    { id: "f1", name: "Ana", rhythm: "monthly", createdAt: now.toISOString() },
  ],
  availability: [],
  skipped: [],
  plans: [
    {
      id: "p-v3",
      title: "Coffee",
      startAt: new Date(2026, 6, 23, 19, 0).toISOString(),
      endAt: new Date(2026, 6, 23, 20, 0).toISOString(),
      friends: [
        {
          friendId: "f1",
          status: "yes",
          invitationText: "hi",
          inviteTone: "warm",
          invitationCustomized: false,
          sentAt: null,
          displayNameSnapshot: "Ana",
        },
      ],
      status: "on",
      attendedFriendIds: [],
      memoryNote: "",
      memoryPhotoUri: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ],
  settings: {},
});
const v3Migrated = migrateAndValidate(v3Payload);
assert.equal(v3Migrated.ok, true);
if (v3Migrated.ok) {
  assert.equal(v3Migrated.data.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(v3Migrated.data.catchUps, []);
  assert.equal(v3Migrated.data.plans[0]?.calendarExport, null);
}

const malformedCatchUps = migrateAndValidate(
  JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    onboardingComplete: true,
    friends: [
      {
        id: "f1",
        name: "Ana",
        rhythm: "monthly",
        createdAt: now.toISOString(),
      },
    ],
    availability: [],
    skipped: [],
    plans: [],
    catchUps: [
      {
        id: "ok",
        friendId: "f1",
        date: "2026-07-18",
        createdAt: now.toISOString(),
      },
      {
        id: "bad-date",
        friendId: "f1",
        date: "not-a-day",
        createdAt: now.toISOString(),
      },
      { friendId: "f1", date: "2026-07-19" },
      {
        id: "gone-friend",
        friendId: "missing",
        date: "2026-07-18",
        createdAt: now.toISOString(),
      },
    ],
    settings: {},
  }),
);
assert.equal(malformedCatchUps.ok, true);
if (malformedCatchUps.ok) {
  assert.equal(malformedCatchUps.data.catchUps.length, 1);
  assert.equal(malformedCatchUps.data.catchUps[0]?.id, "ok");
  assert.ok(malformedCatchUps.warnings.length >= 1);
}

const malformedExport = migrateAndValidate(
  JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    onboardingComplete: true,
    friends: [
      {
        id: "f1",
        name: "Ana",
        rhythm: "monthly",
        createdAt: now.toISOString(),
      },
    ],
    availability: [],
    skipped: [],
    plans: [
      {
        ...JSON.parse(v3Payload).plans[0],
        id: "p-bad-export",
        calendarExport: { exportedAt: "nope", startAt: "x", endAt: "y" },
      },
      {
        ...JSON.parse(v3Payload).plans[0],
        id: "p-good-export",
        calendarExport: {
          exportedAt: now.toISOString(),
          startAt: new Date(2026, 6, 23, 19, 0).toISOString(),
          endAt: new Date(2026, 6, 23, 20, 0).toISOString(),
        },
      },
    ],
    catchUps: [],
    settings: {},
  }),
);
assert.equal(malformedExport.ok, true);
if (malformedExport.ok) {
  assert.equal(
    malformedExport.data.plans.find((p) => p.id === "p-bad-export")
      ?.calendarExport,
    null,
  );
  assert.ok(
    malformedExport.data.plans.find((p) => p.id === "p-good-export")
      ?.calendarExport,
  );
}

let catchUpData: AppData = {
  ...emptyAppData(),
  friends: [friend({ id: "a", name: "Ana" })],
};
const whenIso = startOfDay(new Date(2026, 6, 18)).toISOString();
catchUpData = logCaughtUpState(catchUpData, "a", whenIso, () => "catchup_1");
catchUpData = logCaughtUpState(catchUpData, "a", whenIso, () => "catchup_2");
assert.equal(catchUpData.catchUps.length, 1);
assert.equal(catchUpData.catchUps[0]?.id, "catchup_1");
assert.equal(catchUpData.friends[0]?.lastMetAt, whenIso);

const doneOnly = markPlanDoneState(
  {
    ...emptyAppData(),
    friends: [friend({ id: "a", name: "Ana" })],
    plans: [{ ...plan710, friends: [planFriend("a", "yes")] }],
  },
  "p1",
  ["a"],
);
assert.equal(doneOnly.catchUps.length, 0);
assert.equal(doneOnly.friends[0]?.lastMetAt, plan710.startAt);

// Sample data for store screenshots: valid, phone-free, varied statuses.
{
  const sampleNow = new Date(2026, 9, 14, 10, 0);
  let sampleSeq = 0;
  const sample = buildSampleData(
    emptyAppData(),
    sampleNow,
    (prefix) => `${prefix}_${++sampleSeq}`,
  );
  const reloaded = migrateAndValidate(JSON.stringify(sample));
  assert.ok(reloaded.ok);
  assert.deepEqual(reloaded.warnings, []);
  assert.equal(reloaded.data.friends.length, 5);
  assert.equal(reloaded.data.availability.length, 2);
  assert.equal(reloaded.data.plans.length, 3);
  assert.ok(reloaded.data.catchUps.length >= 2);
  assert.ok(reloaded.data.onboardingComplete);
  assert.ok(sample.friends.every((f) => f.phone === "" && f.photoUri === null));
  const statuses = new Set(sample.plans.map((p) => p.status));
  assert.ok(statuses.has("done"));
  assert.ok(statuses.size >= 2);
  const due = sample.friends.filter(
    (f) => catchUpStatus(f, sampleNow) === "due",
  );
  assert.ok(due.length >= 1);
}

console.log("all tests: ok");
