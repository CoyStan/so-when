import { makeOneOffSlot } from "./model";
import {
  addAvailabilityRule,
  createPlanState,
  lookAroundFirst,
  logCaughtUpState,
  markInviteSentState,
  markPlanDoneState,
  setInviteStatusState,
  upsertFriend,
  type FriendInput,
} from "./mutations";
import { formatDateKey } from "./time";
import type { AppData } from "./types";

/**
 * Fictional friends and plans for store screenshots. Only reachable from
 * builds with EXPO_PUBLIC_SAMPLE_DATA=1 — never a production build.
 * `base` is an empty AppData (keeps this module free of persistence).
 */
export function buildSampleData(
  base: AppData,
  now: Date,
  createId: (prefix: string) => string,
): AppData {
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const friendInputs: FriendInput[] = [
    sampleFriend("Ana", "monthly", "whatsapp", at(-40, 19)),
    sampleFriend("Marcus", "weekly", "sms", at(-3, 18)),
    sampleFriend("Priya", "monthly", "whatsapp", at(-24, 12)),
    sampleFriend("Jordan", "quarterly", "message", at(-100, 20)),
    sampleFriend("Sam", "none", "other", null),
  ];

  let data = lookAroundFirst(base);
  const ids: string[] = [];
  for (const input of friendInputs) {
    const result = upsertFriend(data, input, createId);
    data = result.data;
    ids.push(result.friend.id);
  }
  const [ana, marcus, priya, jordan] = ids as [string, string, string, string];

  const startDate = formatDateKey(at(-30, 0));
  data = addAvailabilityRule(
    data,
    {
      kind: "recurring",
      label: "Weeknights",
      daysOfWeek: [2, 4],
      startMinutes: 18 * 60 + 30,
      endMinutes: 21 * 60,
      recurrence: "weekly",
      startDate,
      endDate: null,
      oneOffDate: null,
      enabled: true,
    },
    createId,
  );
  data = addAvailabilityRule(
    data,
    {
      kind: "recurring",
      label: "Weekend afternoons",
      daysOfWeek: [0, 6],
      startMinutes: 13 * 60,
      endMinutes: 17 * 60,
      recurrence: "weekly",
      startDate,
      endDate: null,
      oneOffDate: null,
      enabled: true,
    },
    createId,
  );

  const plan = (
    start: Date,
    friendIds: string[],
    details: { title: string; activity: string; place: string },
  ) => {
    const end = new Date(start.getTime() + 2 * 60 * 60_000);
    const result = createPlanState(
      data,
      makeOneOffSlot(start, end),
      friendIds,
      { ...details, note: "" },
      createId,
    );
    if (!result.ok) throw new Error(`Sample plan failed: ${result.message}`);
    data = result.data;
    return result.plan.id;
  };

  const dinner = plan(at(2, 19), [ana, priya], {
    title: "Dinner at Lola's",
    activity: "dinner",
    place: "Lola's",
  });
  data = markInviteSentState(data, dinner, ana, true);
  data = markInviteSentState(data, dinner, priya, true);
  data = setInviteStatusState(data, dinner, ana, "yes");
  data = setInviteStatusState(data, dinner, priya, "maybe");

  const coffee = plan(at(6, 10, 30), [jordan], {
    title: "Coffee with Jordan",
    activity: "coffee",
    place: "Corner Bakery",
  });
  data = markInviteSentState(data, coffee, jordan, true);

  const walk = plan(at(-10, 17), [marcus], {
    title: "Walk by the river",
    activity: "walk",
    place: "Riverside path",
  });
  data = markInviteSentState(data, walk, marcus, true);
  data = setInviteStatusState(data, walk, marcus, "yes");
  data = markPlanDoneState(data, walk, [marcus]);

  data = logCaughtUpState(data, marcus, at(-3, 18).toISOString(), createId);
  data = logCaughtUpState(data, priya, at(-24, 12).toISOString(), createId);

  return data;
}

function sampleFriend(
  name: string,
  rhythm: FriendInput["rhythm"],
  shareMethod: FriendInput["shareMethod"],
  lastMet: Date | null,
): FriendInput {
  return {
    name,
    photoUri: null,
    phone: "",
    shareMethod,
    rhythm,
    customDays: 30,
    lastMetAt: lastMet ? lastMet.toISOString() : null,
  };
}
