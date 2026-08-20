import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, BackHandler } from "react-native";

import {
  addAvailabilityRule,
  completeOnboardingState,
  createPlanState,
  deleteAvailabilityRule,
  lookAroundFirst,
  logCaughtUpState,
  markInviteSentState,
  markPlanCancelledState,
  markPlanDoneState,
  moveFriendToSlotState,
  plansAffectedByFriendDeletion,
  removeFriend,
  isTerminalPlan,
  setAvailabilityEnabledState,
  setInviteStatusState,
  skipOccurrenceOnce,
  unskipOccurrence,
  updateAvailabilityRule,
  updateInvitationTextState,
  updateSettings as patchSettings,
  upsertFriend,
  type AvailabilityInput,
  type FriendInput,
} from "../domain/mutations";
import {
  buildInviteText,
  buildTimeline,
  expandAvailability,
  makeOneOffSlot,
  proposePlanWindow,
  sortFriendsForPicker,
} from "../domain/model";
import { formatDateKey, parseDateKey, startOfDay } from "../domain/time";
import type {
  AppData,
  AppSettings,
  AvailabilityRule,
  ConcreteSlot,
  Friend,
  InviteStatus,
  InviteTone,
  Plan,
  PlanStatus,
} from "../domain/types";
import {
  clearAppData,
  createId,
  emptyAppData,
  exportAppDataJson,
  loadAppData,
  saveAppData,
  startFreshStorage,
} from "../persistence/storage";
import { WriteQueue } from "../persistence/writeQueue";
import { invitationCustomizedAfterShare } from "../domain/invitationUi";
import {
  reconcileRemindersOnForeground,
  reminderCoordinator,
  rescheduleReminders,
} from "../services/reminders";
import { clearOwnedMediaDirectory } from "../services/media";
import { shareInviteMessage } from "../services/share";

export type AddFriendForPlanOrigin = "inviteSheet" | "createPlan";

export type TabId = "when" | "friends" | "settings";
export type WhenMode = "list" | "week" | "months";
export type NavMotion = "none" | "push" | "pop" | "replace";
export type ScreenId =
  | "loading"
  | "welcome"
  | "onboarding"
  | "when"
  | "friends"
  | "settings"
  | "addFriend"
  | "editFriend"
  | "friendProfile"
  | "addAvailability"
  | "editAvailability"
  | "availability"
  | "createPlan"
  | "pickPlanTime"
  | "planDetail"
  | "moveFriend"
  | "privacyPolicy"
  | "pastPlans"
  | "recovery";

export type { FriendInput, AvailabilityInput };

type AppContextValue = {
  ready: boolean;
  loadError: string | null;
  /** Failed persistence op — Retry repeats this op, never resaves after wipe/startFresh. */
  persistError: { op: "save" | "wipe" | "startFresh"; message: string } | null;
  /** @deprecated alias of persistError?.message when op===save — prefer persistError */
  saveError: string | null;
  /** Reminder API failures — separate from persistence. */
  reminderError: string | null;
  dismissReminderError: () => void;
  recoveryWarnings: string[];
  data: AppData;
  now: Date;
  screen: ScreenId;
  tab: TabId;
  /** How the current screen was reached — drives ScreenTransition. */
  navMotion: NavMotion;
  selectedSlot: ConcreteSlot | null;
  selectedFriendIds: string[];
  activePlanId: string | null;
  activeFriendId: string | null;
  activeAvailabilityId: string | null;
  moveFriendId: string | null;
  whenMode: WhenMode;
  whenFocusDate: Date;
  setWhenMode: (mode: WhenMode) => void;
  setWhenFocusDate: (date: Date) => void;
  timeline: ReturnType<typeof buildTimeline>;
  slots: ConcreteSlot[];
  sortedFriends: Friend[];
  spotlightPlan: Plan | null;
  activePlan: Plan | null;
  activeFriend: Friend | null;
  goWhen: () => void;
  goFriends: () => void;
  goSettings: () => void;
  goBack: () => void;
  openAddFriend: () => void;
  openAddFriendForPlan: (
    slot: ConcreteSlot,
    friendIds?: string[],
    origin?: AddFriendForPlanOrigin,
  ) => void;
  openEditFriend: (friendId: string) => void;
  openFriendProfile: (friendId: string) => void;
  openAddAvailability: () => void;
  openEditAvailability: (ruleId: string) => void;
  openAvailability: () => void;
  openPrivacyPolicy: () => void;
  openOnboarding: () => void;
  /** Route to pickPlanTime so availability is optional. */
  openMakePlan: (friendIds?: string[]) => void;
  openCreatePlan: (
    slot: ConcreteSlot,
    friendIds?: string[],
    options?: { replace?: boolean },
  ) => void;
  /** Update the selected plan window (Create Plan date/time editors). */
  setSelectedPlanWindow: (startAt: string, endAt: string) => void;
  openPlanDetail: (planId: string) => void;
  openPastPlans: () => void;
  toggleFriendSelection: (friendId: string) => void;
  saveFriend: (input: FriendInput, friendId?: string) => Promise<void>;
  deleteFriend: (friendId: string) => Promise<void>;
  getFriendDeletionImpact: (friendId: string) => Plan[];
  addAvailability: (input: AvailabilityInput) => Promise<void>;
  updateAvailability: (
    ruleId: string,
    input: AvailabilityInput,
  ) => Promise<void>;
  skipOccurrence: (ruleId: string, date: string) => Promise<void>;
  unskipOccurrence: (ruleId: string, date: string) => Promise<void>;
  deleteAvailability: (ruleId: string) => Promise<void>;
  setAvailabilityEnabled: (ruleId: string, enabled: boolean) => Promise<void>;
  savePlanMemory: (note: string, photoUri: string | null) => Promise<void>;
  completeOnboarding: (input: {
    friend?: FriendInput | null;
    availability?: AvailabilityInput | null;
  }) => Promise<void>;
  skipOnboardingExplore: () => Promise<void>;
  createPlan: (input: {
    title: string;
    activity: string;
    place: string;
    note: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  updatePlan: (
    patch: Partial<
      Pick<Plan, "title" | "activity" | "place" | "note" | "startAt" | "endAt">
    >,
  ) => Promise<void>;
  setFriendInviteStatus: (
    friendId: string,
    status: InviteStatus,
  ) => Promise<void>;
  updateInvitationText: (
    friendId: string,
    text: string,
    customized?: boolean,
  ) => Promise<void>;
  resetInvitationSuggested: (
    friendId: string,
    tone?: InviteTone,
  ) => Promise<void>;
  shareInvite: (friendId: string, message: string) => Promise<boolean>;
  confirmInviteSent: (friendId: string, sent: boolean) => Promise<void>;
  markPlanDone: (attendedFriendIds: string[]) => Promise<void>;
  /** Optional planId for When list chips; defaults to activePlanId. */
  markPlanStatus: (status: PlanStatus, planId?: string) => Promise<void>;
  setPlanCalendarExport: (snapshot: Plan["calendarExport"]) => Promise<void>;
  openMoveFriend: (friendId: string) => void;
  moveFriendToSlot: (
    slot: ConcreteSlot,
  ) => Promise<{ ok: boolean; message?: string }>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  exportData: () => Promise<string>;
  wipeData: () => Promise<{ ok: boolean; message?: string }>;
  retryLoad: () => Promise<void>;
  retrySave: () => Promise<void>;
  retryPersist: () => Promise<void>;
  startFresh: () => Promise<{ ok: boolean; message?: string }>;
  logCaughtUp: (friendId: string, whenIso: string) => Promise<void>;
  dismissRecoveryWarnings: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<{
    op: "save" | "wipe" | "startFresh";
    message: string;
  } | null>(null);
  const saveError = persistError?.op === "save" ? persistError.message : null;
  const [reminderError, setReminderError] = useState<string | null>(null);
  const addingFriendForPlanRef = useRef<AddFriendForPlanOrigin | null>(null);
  const [recoveryWarnings, setRecoveryWarnings] = useState<string[]>([]);
  const [data, setData] = useState<AppData>(emptyAppData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const writeQueue = useRef(new WriteQueue()).current;
  const revisionRef = useRef(0);
  const [stack, setStack] = useState<ScreenId[]>(["loading"]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const [navMotion, setNavMotion] = useState<NavMotion>("none");
  const [tab, setTab] = useState<TabId>("when");
  const [selectedSlot, setSelectedSlot] = useState<ConcreteSlot | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [activeAvailabilityId, setActiveAvailabilityId] = useState<
    string | null
  >(null);
  const [moveFriendId, setMoveFriendId] = useState<string | null>(null);
  const [whenMode, setWhenMode] = useState<WhenMode>("list");
  const [whenFocusDateKey, setWhenFocusDateKey] = useState(() =>
    formatDateKey(startOfDay(new Date())),
  );
  const [nowTick, setNowTick] = useState(() => Date.now());

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const whenFocusDate = useMemo(
    () => startOfDay(parseDateKey(whenFocusDateKey)),
    [whenFocusDateKey],
  );

  const setWhenFocusDate = useCallback((date: Date) => {
    setWhenFocusDateKey(formatDateKey(startOfDay(date)));
  }, []);

  const screen: ScreenId = stack[stack.length - 1] ?? "loading";

  const resetTo = useCallback((next: ScreenId) => {
    setNavMotion("none");
    setStack([next]);
  }, []);
  const push = useCallback((next: ScreenId) => {
    setNavMotion("push");
    setStack((current) => [...current, next]);
  }, []);
  const replaceTop = useCallback((next: ScreenId) => {
    setNavMotion("replace");
    setStack((current) => [...current.slice(0, -1), next]);
  }, []);
  const goBack = useCallback(() => {
    if (stackRef.current.length <= 1) {
      return;
    }
    setNavMotion("pop");
    setStack((current) => current.slice(0, -1));
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stackRef.current.length > 1) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [goBack]);

  const syncReminderError = useCallback(() => {
    setReminderError(reminderCoordinator.error);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNowTick(Date.now());
        if (reminderCoordinator.isResetting) return;
        void reconcileRemindersOnForeground(
          dataRef.current,
          revisionRef.current,
        ).then(syncReminderError);
      }
    });
    const midnight = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => {
      sub.remove();
      clearInterval(midnight);
    };
  }, [syncReminderError]);

  const clearSelectionState = useCallback(() => {
    setSelectedSlot(null);
    setSelectedFriendIds([]);
    setActivePlanId(null);
    setActiveFriendId(null);
    setActiveAvailabilityId(null);
    setMoveFriendId(null);
  }, []);

  const commit = useCallback(
    async (updater: (current: AppData) => AppData) => {
      if (writeQueue.isResetting) {
        return;
      }
      const next = updater(dataRef.current);
      dataRef.current = next;
      setData(next);
      const revision = ++revisionRef.current;
      await writeQueue.enqueue(async (generation) => {
        if (generation !== writeQueue.wipeGeneration || writeQueue.isResetting)
          return;
        await saveAppData(next);
        if (generation !== writeQueue.wipeGeneration || writeQueue.isResetting)
          return;
        // Latest-snapshot-wins: only schedule if this revision is still current.
        if (revision === revisionRef.current) {
          await rescheduleReminders(next, revision);
          setReminderError(reminderCoordinator.error);
        }
      });
      setPersistError(
        writeQueue.error ? { op: "save", message: writeQueue.error } : null,
      );
    },
    [writeQueue],
  );

  const hydrate = useCallback(async () => {
    setLoadError(null);
    try {
      const loaded = await loadAppData();
      if (!loaded.ok) {
        setLoadError(loaded.message);
        setRecoveryWarnings([]);
        setReady(true);
        resetTo("recovery");
        return;
      }
      dataRef.current = loaded.data;
      setData(loaded.data);
      setRecoveryWarnings(loaded.warnings);
      resetTo(!loaded.data.onboardingComplete ? "welcome" : "when");
      setTab("when");
      setReady(true);
      revisionRef.current += 1;
      void rescheduleReminders(loaded.data, revisionRef.current).then(
        syncReminderError,
      );
      const referenced = [
        ...loaded.data.friends.map((friend) => friend.photoUri),
        ...loaded.data.plans.map((plan) => plan.memoryPhotoUri),
      ];
      void import("../services/media").then(({ garbageCollectOwnedMedia }) =>
        garbageCollectOwnedMedia(referenced),
      );
    } catch {
      setLoadError("Could not load your plans. Please try again.");
      setReady(true);
      resetTo("recovery");
    }
  }, [resetTo, syncReminderError]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const dismissReminderError = useCallback(() => {
    setReminderError(null);
  }, []);

  const slots = useMemo(
    () =>
      expandAvailability(data.availability, data.skipped, startOfDay(now), 21),
    [data.availability, data.skipped, now],
  );

  const spotlightPlan = useMemo(() => {
    const todayKey = formatDateKey(now);
    return (
      data.plans
        .filter(
          (plan) =>
            plan.status !== "done" &&
            plan.status !== "cancelled" &&
            formatDateKey(new Date(plan.startAt)) === todayKey &&
            new Date(plan.endAt).getTime() >= now.getTime(),
        )
        .sort((a, b) => a.startAt.localeCompare(b.startAt))[0] ?? null
    );
  }, [data.plans, now]);

  const timeline = useMemo(
    () =>
      buildTimeline(data.friends, data.plans, slots, now, {
        spotlightPlanId: spotlightPlan?.id ?? null,
      }),
    [data.friends, data.plans, slots, now, spotlightPlan],
  );

  const sortedFriends = useMemo(
    () => sortFriendsForPicker(data.friends, data.plans, now),
    [data.friends, data.plans, now],
  );

  const activePlan = useMemo(
    () => data.plans.find((plan) => plan.id === activePlanId) ?? null,
    [activePlanId, data.plans],
  );

  const activeFriend = useMemo(
    () => data.friends.find((friend) => friend.id === activeFriendId) ?? null,
    [activeFriendId, data.friends],
  );

  const goWhen = useCallback(() => {
    setTab("when");
    resetTo("when");
    setSelectedSlot(null);
    setMoveFriendId(null);
  }, [resetTo]);

  const goFriends = useCallback(() => {
    setTab("friends");
    resetTo("friends");
  }, [resetTo]);

  const goSettings = useCallback(() => {
    setTab("settings");
    resetTo("settings");
  }, [resetTo]);

  const openAddFriend = useCallback(() => {
    addingFriendForPlanRef.current = null;
    setActiveFriendId(null);
    push("addFriend");
  }, [push]);

  const openAddFriendForPlan = useCallback(
    (
      slot: ConcreteSlot,
      friendIds?: string[],
      origin: AddFriendForPlanOrigin = "inviteSheet",
    ) => {
      const window = proposePlanWindow(
        slot.startAt,
        slot.endAt,
        dataRef.current.settings.defaultDurationMinutes,
      );
      const proposed: ConcreteSlot = {
        ...slot,
        startAt: window.startAt,
        endAt: window.endAt,
        startMinutes:
          new Date(window.startAt).getHours() * 60 +
          new Date(window.startAt).getMinutes(),
        endMinutes:
          new Date(window.endAt).getHours() * 60 +
          new Date(window.endAt).getMinutes(),
      };
      setSelectedSlot(proposed);
      if (friendIds) {
        setSelectedFriendIds(friendIds);
      }
      addingFriendForPlanRef.current = origin;
      setActiveFriendId(null);
      push("addFriend");
    },
    [push],
  );

  const openEditFriend = useCallback(
    (friendId: string) => {
      setActiveFriendId(friendId);
      push("editFriend");
    },
    [push],
  );

  const openFriendProfile = useCallback(
    (friendId: string) => {
      setActiveFriendId(friendId);
      push("friendProfile");
    },
    [push],
  );

  const openAddAvailability = useCallback(() => {
    setActiveAvailabilityId(null);
    push("addAvailability");
  }, [push]);

  const openEditAvailability = useCallback(
    (ruleId: string) => {
      setActiveAvailabilityId(ruleId);
      push("editAvailability");
    },
    [push],
  );

  const openAvailability = useCallback(() => push("availability"), [push]);
  const openPrivacyPolicy = useCallback(() => push("privacyPolicy"), [push]);
  const openOnboarding = useCallback(() => push("onboarding"), [push]);

  const openMakePlan = useCallback(
    (friendIds?: string[]) => {
      setSelectedFriendIds(friendIds ?? []);
      setSelectedSlot(null);
      push("pickPlanTime");
    },
    [push],
  );

  const openCreatePlan = useCallback(
    (
      slot: ConcreteSlot,
      friendIds?: string[],
      options?: { replace?: boolean },
    ) => {
      const durationMinutes =
        slot.ruleId === null
          ? Math.max(30, slot.endMinutes - slot.startMinutes)
          : dataRef.current.settings.defaultDurationMinutes;
      const window = proposePlanWindow(
        slot.startAt,
        slot.endAt,
        durationMinutes,
      );
      setSelectedSlot({
        ...slot,
        startAt: window.startAt,
        endAt: window.endAt,
        startMinutes:
          new Date(window.startAt).getHours() * 60 +
          new Date(window.startAt).getMinutes(),
        endMinutes:
          new Date(window.endAt).getHours() * 60 +
          new Date(window.endAt).getMinutes(),
      });
      setSelectedFriendIds(friendIds ?? []);
      if (options?.replace) {
        replaceTop("createPlan");
      } else {
        push("createPlan");
      }
    },
    [push, replaceTop],
  );

  const setSelectedPlanWindow = useCallback(
    (startAt: string, endAt: string) => {
      setSelectedSlot(makeOneOffSlot(startAt, endAt));
    },
    [],
  );

  const openPlanDetail = useCallback(
    (planId: string) => {
      setActivePlanId(planId);
      push("planDetail");
    },
    [push],
  );

  const openPastPlans = useCallback(() => push("pastPlans"), [push]);

  const toggleFriendSelection = useCallback((friendId: string) => {
    setSelectedFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId],
    );
  }, []);

  const saveFriend = useCallback(
    async (input: FriendInput, friendId?: string) => {
      if (!input.name.trim()) return;
      const forPlan = addingFriendForPlanRef.current && selectedSlot;
      let createdId: string | null = null;
      const previousPhoto = friendId
        ? (dataRef.current.friends.find((friend) => friend.id === friendId)
            ?.photoUri ?? null)
        : null;
      await commit((current) => {
        const result = upsertFriend(current, input, createId, friendId);
        createdId = result.friend.id;
        return result.data;
      });
      if (
        !writeQueue.error &&
        previousPhoto &&
        previousPhoto !== input.photoUri
      ) {
        void import("../services/media").then(({ deleteOwnedMedia }) =>
          deleteOwnedMedia(previousPhoto),
        );
      }
      if (friendId) {
        setActiveFriendId(friendId);
        if (stackRef.current.includes("friendProfile")) {
          setNavMotion("replace");
          setStack((current) => {
            const profileIdx = current.lastIndexOf("friendProfile");
            return profileIdx >= 0
              ? current.slice(0, profileIdx + 1)
              : [...current.slice(0, -1), "friendProfile"];
          });
        } else {
          replaceTop("friendProfile");
        }
        return;
      }
      if (forPlan && createdId && selectedSlot) {
        const origin = addingFriendForPlanRef.current;
        setSelectedFriendIds((ids) =>
          ids.includes(createdId!) ? ids : [...ids, createdId!],
        );
        addingFriendForPlanRef.current = null;
        if (origin === "createPlan") {
          goBack();
        } else {
          // From InviteSheet or pickPlanTime: enter CreatePlan exactly once.
          replaceTop("createPlan");
        }
        return;
      }
      addingFriendForPlanRef.current = null;
      goBack();
    },
    [commit, goBack, replaceTop, selectedSlot, writeQueue],
  );

  const deleteFriend = useCallback(
    async (friendId: string) => {
      await commit((current) => removeFriend(current, friendId));
      goFriends();
    },
    [commit, goFriends],
  );

  const getFriendDeletionImpact = useCallback(
    (friendId: string) =>
      plansAffectedByFriendDeletion(dataRef.current, friendId),
    [],
  );

  const addAvailability = useCallback(
    async (input: AvailabilityInput) => {
      await commit((current) => addAvailabilityRule(current, input, createId));
      goBack();
    },
    [commit, goBack],
  );

  const updateAvailability = useCallback(
    async (ruleId: string, input: AvailabilityInput) => {
      await commit((current) => updateAvailabilityRule(current, ruleId, input));
      goBack();
    },
    [commit, goBack],
  );

  const skipOccurrence = useCallback(
    async (ruleId: string, date: string) => {
      await commit((current) => skipOccurrenceOnce(current, ruleId, date));
    },
    [commit],
  );

  const unskip = useCallback(
    async (ruleId: string, date: string) => {
      await commit((current) => unskipOccurrence(current, ruleId, date));
    },
    [commit],
  );

  const deleteAvailability = useCallback(
    async (ruleId: string) => {
      await commit((current) => deleteAvailabilityRule(current, ruleId));
    },
    [commit],
  );

  const setAvailabilityEnabled = useCallback(
    async (ruleId: string, enabled: boolean) => {
      await commit((current) =>
        setAvailabilityEnabledState(current, ruleId, enabled),
      );
    },
    [commit],
  );

  const savePlanMemory = useCallback(
    async (note: string, photoUri: string | null) => {
      if (!activePlanId) return;
      const previous =
        dataRef.current.plans.find((plan) => plan.id === activePlanId)
          ?.memoryPhotoUri ?? null;
      await commit((current) => ({
        ...current,
        plans: current.plans.map((plan) =>
          plan.id === activePlanId
            ? {
                ...plan,
                memoryNote: note,
                memoryPhotoUri: photoUri,
                updatedAt: new Date().toISOString(),
              }
            : plan,
        ),
      }));
      if (!writeQueue.error && previous && previous !== photoUri) {
        void import("../services/media").then(({ deleteOwnedMedia }) =>
          deleteOwnedMedia(previous),
        );
      }
    },
    [activePlanId, commit, writeQueue],
  );

  const completeOnboarding = useCallback(
    async (input: {
      friend?: FriendInput | null;
      availability?: AvailabilityInput | null;
    }) => {
      await commit((current) =>
        completeOnboardingState(current, input, createId),
      );
      resetTo("when");
      setTab("when");
    },
    [commit, resetTo],
  );

  const skipOnboardingExplore = useCallback(async () => {
    await commit((current) => lookAroundFirst(current));
    resetTo("when");
    setTab("when");
  }, [commit, resetTo]);

  const createPlan = useCallback(
    async (input: {
      title: string;
      activity: string;
      place: string;
      note: string;
    }) => {
      if (!selectedSlot) {
        return { ok: false, message: "Pick a free time first." };
      }
      let message: string | undefined;
      let planId: string | null = null;
      await commit((current) => {
        const result = createPlanState(
          current,
          selectedSlot,
          selectedFriendIds,
          input,
          createId,
        );
        if (!result.ok) {
          message = result.message;
          return current;
        }
        planId = result.plan.id;
        return result.data;
      });
      if (!planId) {
        return { ok: false, message: message ?? "Could not create the plan." };
      }
      setSelectedSlot(null);
      setSelectedFriendIds([]);
      setActivePlanId(planId);
      replaceTop("planDetail");
      return { ok: true };
    },
    [commit, replaceTop, selectedFriendIds, selectedSlot],
  );

  const updatePlan = useCallback(
    async (
      patch: Partial<
        Pick<
          Plan,
          "title" | "activity" | "place" | "note" | "startAt" | "endAt"
        >
      >,
    ) => {
      if (!activePlanId) return;
      await commit((current) => ({
        ...current,
        plans: current.plans.map((plan) => {
          if (plan.id !== activePlanId || isTerminalPlan(plan)) return plan;
          const updated = {
            ...plan,
            ...patch,
            updatedAt: new Date().toISOString(),
          };
          const timeOrPlaceChanged = Boolean(
            patch.startAt ||
            patch.endAt ||
            patch.activity !== undefined ||
            patch.place !== undefined,
          );
          if (timeOrPlaceChanged) {
            updated.friends = updated.friends.map((item) => {
              if (item.invitationCustomized) return item;
              const friend = current.friends.find(
                (entry) => entry.id === item.friendId,
              );
              return {
                ...item,
                invitationText: buildInviteText({
                  name: friend?.name ?? item.displayNameSnapshot ?? "there",
                  startAt: updated.startAt,
                  endAt: updated.endAt,
                  activity: updated.activity,
                  place: updated.place,
                  timeFormat24h: current.settings.timeFormat24h,
                  tone: item.inviteTone,
                }),
              };
            });
          }
          return updated;
        }),
      }));
    },
    [activePlanId, commit],
  );

  const setFriendInviteStatus = useCallback(
    async (friendId: string, status: InviteStatus) => {
      if (!activePlanId) return;
      await commit((current) =>
        setInviteStatusState(current, activePlanId, friendId, status),
      );
    },
    [activePlanId, commit],
  );

  const updateInvitationText = useCallback(
    async (friendId: string, text: string, customized = true) => {
      if (!activePlanId) return;
      await commit((current) =>
        updateInvitationTextState(
          current,
          activePlanId,
          friendId,
          text,
          customized,
        ),
      );
    },
    [activePlanId, commit],
  );

  const resetInvitationSuggested = useCallback(
    async (friendId: string, tone: InviteTone = "warm") => {
      if (!activePlan || !activePlanId) return;
      const friend = dataRef.current.friends.find(
        (item) => item.id === friendId,
      );
      const text = buildInviteText({
        name: friend?.name ?? "there",
        startAt: activePlan.startAt,
        endAt: activePlan.endAt,
        activity: activePlan.activity,
        place: activePlan.place,
        timeFormat24h: dataRef.current.settings.timeFormat24h,
        tone,
      });
      await commit((current) => ({
        ...updateInvitationTextState(
          current,
          activePlanId,
          friendId,
          text,
          false,
        ),
        plans: current.plans.map((plan) =>
          plan.id !== activePlanId
            ? plan
            : {
                ...plan,
                friends: plan.friends.map((item) =>
                  item.friendId === friendId
                    ? {
                        ...item,
                        inviteTone: tone,
                        invitationText: text,
                        invitationCustomized: false,
                      }
                    : item,
                ),
              },
        ),
      }));
    },
    [activePlan, activePlanId, commit],
  );

  const shareInvite = useCallback(
    async (friendId: string, message: string) => {
      // Persist the exact visible text; do not mark unchanged generated text custom.
      if (activePlanId) {
        await commit((current) => {
          const plan = current.plans.find((item) => item.id === activePlanId);
          const existing = plan?.friends.find(
            (item) => item.friendId === friendId,
          );
          const customized = invitationCustomizedAfterShare(existing, message);
          return updateInvitationTextState(
            current,
            activePlanId,
            friendId,
            message,
            customized,
          );
        });
      }
      const friend = dataRef.current.friends.find(
        (item) => item.id === friendId,
      );
      return shareInviteMessage({
        message,
        method: friend?.shareMethod ?? "other",
        phone: friend?.phone,
      });
    },
    [activePlanId, commit],
  );

  const confirmInviteSent = useCallback(
    async (friendId: string, sent: boolean) => {
      if (!activePlanId) return;
      await commit((current) =>
        markInviteSentState(current, activePlanId, friendId, sent),
      );
    },
    [activePlanId, commit],
  );

  const markPlanDone = useCallback(
    async (attendedFriendIds: string[]) => {
      if (!activePlanId) return;
      await commit((current) =>
        markPlanDoneState(current, activePlanId, attendedFriendIds),
      );
    },
    [activePlanId, commit],
  );

  const markPlanStatus = useCallback(
    async (status: PlanStatus, planId?: string) => {
      const targetId = planId ?? activePlanId;
      if (!targetId) return;
      if (status === "cancelled") {
        await commit((current) => markPlanCancelledState(current, targetId));
        if (!planId) {
          goWhen();
        }
        return;
      }
      if (status === "done") {
        const plan = dataRef.current.plans.find((item) => item.id === targetId);
        if (!plan) return;
        const yesIds = plan.friends
          .filter((item) => item.status === "yes")
          .map((item) => item.friendId);
        const fallbackIds = plan.friends
          .filter((item) => item.status !== "moved")
          .map((item) => item.friendId);
        await commit((current) =>
          markPlanDoneState(
            current,
            targetId,
            yesIds.length > 0 ? yesIds : fallbackIds,
          ),
        );
        if (!planId) {
          goWhen();
        }
        return;
      }
      await commit((current) => ({
        ...current,
        plans: current.plans.map((plan) =>
          plan.id === targetId
            ? { ...plan, status, updatedAt: new Date().toISOString() }
            : plan,
        ),
      }));
      if (!planId) {
        goWhen();
      }
    },
    [activePlanId, commit, goWhen],
  );

  const setPlanCalendarExport = useCallback(
    async (snapshot: Plan["calendarExport"]) => {
      if (!activePlanId) return;
      await commit((current) => ({
        ...current,
        plans: current.plans.map((plan) =>
          plan.id === activePlanId
            ? {
                ...plan,
                calendarExport: snapshot,
                updatedAt: new Date().toISOString(),
              }
            : plan,
        ),
      }));
    },
    [activePlanId, commit],
  );

  const openMoveFriend = useCallback(
    (friendId: string) => {
      setMoveFriendId(friendId);
      push("moveFriend");
    },
    [push],
  );

  const moveFriendToSlot = useCallback(
    async (slot: ConcreteSlot) => {
      if (!activePlanId || !moveFriendId) {
        return { ok: false, message: "Nothing to move." };
      }
      let message: string | undefined;
      let newPlanId: string | null = null;
      await commit((current) => {
        const result = moveFriendToSlotState(
          current,
          activePlanId,
          moveFriendId,
          slot,
          createId,
        );
        if (!result.ok) {
          message = result.message;
          return current;
        }
        newPlanId = result.newPlan.id;
        return result.data;
      });
      if (!newPlanId) {
        return { ok: false, message: message ?? "Could not move that plan." };
      }
      setMoveFriendId(null);
      setActivePlanId(newPlanId);
      setNavMotion("replace");
      setStack(["when", "planDetail"]);
      return { ok: true };
    },
    [activePlanId, commit, moveFriendId],
  );

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      await commit((current) => patchSettings(current, patch));
    },
    [commit],
  );

  const exportData = useCallback(
    async () => exportAppDataJson(dataRef.current),
    [],
  );

  const wipeData = useCallback(async () => {
    try {
      await writeQueue.runExclusive(async () => {
        await reminderCoordinator.resetAndCancel({
          afterBarrierRaised: async () => {
            await clearAppData();
            await clearOwnedMediaDirectory();
          },
        });
      });
      const empty = emptyAppData();
      dataRef.current = empty;
      setData(empty);
      clearSelectionState();
      setPersistError(null);
      setReminderError(null);
      setRecoveryWarnings([]);
      resetTo("welcome");
      setTab("when");
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not delete all data.";
      setPersistError({ op: "wipe", message });
      return { ok: false, message };
    }
  }, [clearSelectionState, resetTo, writeQueue]);

  const retrySave = useCallback(async () => {
    const snapshot = dataRef.current;
    const revision = ++revisionRef.current;
    await writeQueue.enqueue(async (generation) => {
      if (generation !== writeQueue.wipeGeneration || writeQueue.isResetting)
        return;
      await saveAppData(snapshot);
      if (generation !== writeQueue.wipeGeneration || writeQueue.isResetting)
        return;
      if (revision === revisionRef.current) {
        await rescheduleReminders(snapshot, revision);
        setReminderError(reminderCoordinator.error);
      }
    });
    setPersistError(
      writeQueue.error ? { op: "save", message: writeQueue.error } : null,
    );
  }, [writeQueue]);

  const startFresh = useCallback(async () => {
    try {
      await writeQueue.runExclusive(async () => {
        await reminderCoordinator.resetAndCancel({
          afterBarrierRaised: async () => {
            await startFreshStorage();
            await clearOwnedMediaDirectory();
          },
        });
      });
      const empty = emptyAppData();
      dataRef.current = empty;
      setData(empty);
      clearSelectionState();
      setLoadError(null);
      setPersistError(null);
      setReminderError(null);
      setRecoveryWarnings([]);
      resetTo("welcome");
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start fresh.";
      setPersistError({ op: "startFresh", message });
      return { ok: false, message };
    }
  }, [clearSelectionState, resetTo, writeQueue]);

  const retryPersist = useCallback(async () => {
    if (!persistError) return;
    if (persistError.op === "wipe") {
      await wipeData();
      return;
    }
    if (persistError.op === "startFresh") {
      await startFresh();
      return;
    }
    await retrySave();
  }, [persistError, retrySave, startFresh, wipeData]);

  const dismissRecoveryWarnings = useCallback(() => {
    setRecoveryWarnings([]);
  }, []);

  const logCaughtUp = useCallback(
    async (friendId: string, whenIso: string) => {
      await commit((current) =>
        logCaughtUpState(current, friendId, whenIso, createId),
      );
    },
    [commit],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      loadError,
      persistError,
      saveError,
      reminderError,
      dismissReminderError,
      recoveryWarnings,
      data,
      now,
      screen,
      tab,
      navMotion,
      selectedSlot,
      selectedFriendIds,
      activePlanId,
      activeFriendId,
      activeAvailabilityId,
      moveFriendId,
      whenMode,
      whenFocusDate,
      setWhenMode,
      setWhenFocusDate,
      timeline,
      slots,
      sortedFriends,
      spotlightPlan,
      activePlan,
      activeFriend,
      goWhen,
      goFriends,
      goSettings,
      goBack,
      openAddFriend,
      openAddFriendForPlan,
      openEditFriend,
      openFriendProfile,
      openAddAvailability,
      openEditAvailability,
      openAvailability,
      openPrivacyPolicy,
      openOnboarding,
      openMakePlan,
      openCreatePlan,
      setSelectedPlanWindow,
      openPlanDetail,
      openPastPlans,
      toggleFriendSelection,
      saveFriend,
      deleteFriend,
      getFriendDeletionImpact,
      addAvailability,
      updateAvailability,
      skipOccurrence,
      unskipOccurrence: unskip,
      deleteAvailability,
      setAvailabilityEnabled,
      savePlanMemory,
      completeOnboarding,
      skipOnboardingExplore,
      createPlan,
      updatePlan,
      setFriendInviteStatus,
      updateInvitationText,
      resetInvitationSuggested,
      shareInvite,
      confirmInviteSent,
      markPlanDone,
      markPlanStatus,
      setPlanCalendarExport,
      openMoveFriend,
      moveFriendToSlot,
      updateSettings,
      exportData,
      wipeData,
      retryLoad: hydrate,
      retrySave,
      retryPersist,
      startFresh,
      logCaughtUp,
      dismissRecoveryWarnings,
    }),
    [
      ready,
      loadError,
      persistError,
      saveError,
      reminderError,
      dismissReminderError,
      recoveryWarnings,
      data,
      now,
      screen,
      tab,
      navMotion,
      selectedSlot,
      selectedFriendIds,
      activePlanId,
      activeFriendId,
      activeAvailabilityId,
      moveFriendId,
      whenMode,
      whenFocusDate,
      setWhenFocusDate,
      timeline,
      slots,
      sortedFriends,
      spotlightPlan,
      activePlan,
      activeFriend,
      goWhen,
      goFriends,
      goSettings,
      goBack,
      openAddFriend,
      openAddFriendForPlan,
      openEditFriend,
      openFriendProfile,
      openAddAvailability,
      openEditAvailability,
      openAvailability,
      openPrivacyPolicy,
      openOnboarding,
      openMakePlan,
      openCreatePlan,
      setSelectedPlanWindow,
      openPlanDetail,
      openPastPlans,
      toggleFriendSelection,
      saveFriend,
      deleteFriend,
      addAvailability,
      updateAvailability,
      skipOccurrence,
      unskip,
      deleteAvailability,
      setAvailabilityEnabled,
      savePlanMemory,
      completeOnboarding,
      skipOnboardingExplore,
      createPlan,
      updatePlan,
      setFriendInviteStatus,
      updateInvitationText,
      resetInvitationSuggested,
      shareInvite,
      confirmInviteSent,
      markPlanDone,
      markPlanStatus,
      setPlanCalendarExport,
      openMoveFriend,
      moveFriendToSlot,
      updateSettings,
      exportData,
      wipeData,
      hydrate,
      retrySave,
      retryPersist,
      startFresh,
      logCaughtUp,
      dismissRecoveryWarnings,
      getFriendDeletionImpact,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useApp must be used within AppProvider");
  }
  return value;
}
