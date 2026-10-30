import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AnimatedDialog } from "./AnimatedDialog";
import { Avatar } from "./Avatar";
import { Card } from "./Card";
import { PressableScale } from "./PressableScale";
import {
  buildDayMarks,
  dayMarkSize,
  type DayMark,
} from "../domain/catchUpHistory";
import { PLAN_STATUS_LABELS } from "../domain/model";
import {
  DAY_LABELS,
  formatDateKey,
  formatDayTitle,
  MONTH_LABELS_SHORT,
  pad2,
  parseDateKey,
} from "../domain/time";
import type { CatchUpLog, Friend, Plan } from "../domain/types";
import { color, shadowSoft } from "../foundation";
import { cn } from "../ui/cn";
import { useReduceMotion } from "../ui/useReduceMotion";

const DAY_CELL_SIZE = 44;
const MONTH_TITLE_HEIGHT = 44;
const WEEKDAY_HEADER_HEIGHT = 28;
const MONTH_FOOTER_HEIGHT = 36;
const MONTH_CARD_PADDING = 16;
const MONTH_BOTTOM_GAP = 16;

function daysInMonth(monthStart: Date): number {
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
}

function weekRowsForMonth(monthStart: Date, firstDayOfWeek: number): number {
  const leadingBlanks = (monthStart.getDay() - firstDayOfWeek + 7) % 7;
  return Math.ceil((leadingBlanks + daysInMonth(monthStart)) / 7);
}

function monthRowHeight(weekRows: number): number {
  return (
    MONTH_CARD_PADDING * 2 +
    MONTH_TITLE_HEIGHT +
    WEEKDAY_HEADER_HEIGHT +
    weekRows * DAY_CELL_SIZE +
    MONTH_FOOTER_HEIGHT +
    MONTH_BOTTOM_GAP
  );
}

type Props = {
  plans: Plan[];
  catchUps: CatchUpLog[];
  friends: Friend[];
  firstDayOfWeek: number;
  now: Date;
  onOpenPlan: (planId: string) => void;
};

type MonthItem = {
  key: string;
  monthStart: Date;
};

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return startOfMonth(result);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function buildMonthRange(
  dayMarks: Map<string, DayMark>,
  now: Date,
): MonthItem[] {
  const currentMonth = startOfMonth(now);
  const elevenBack = addMonths(currentMonth, -11);

  let earliestMark = elevenBack;
  for (const dateKey of dayMarks.keys()) {
    const markMonth = startOfMonth(parseDateKey(dateKey));
    if (markMonth.getTime() < earliestMark.getTime()) {
      earliestMark = markMonth;
    }
  }

  const start =
    earliestMark.getTime() < elevenBack.getTime() ? earliestMark : elevenBack;
  const end = addMonths(currentMonth, 3);

  const items: MonthItem[] = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    items.push({ key: monthKey(cursor), monthStart: new Date(cursor) });
    cursor = addMonths(cursor, 1);
  }
  return items;
}

function weekdayOrder(firstDayOfWeek: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (firstDayOfWeek + i) % 7);
}

function countDaysWithFriends(
  monthStart: Date,
  dayMarks: Map<string, DayMark>,
): number {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  let count = 0;
  for (let day = 1; day <= daysInMonth(monthStart); day += 1) {
    const key = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const mark = dayMarks.get(key);
    if (mark && mark.seenFriendIds.length > 0) {
      count += 1;
    }
  }
  return count;
}

function formatMonthHeading(monthStart: Date): string {
  const month = MONTH_LABELS_SHORT[monthStart.getMonth()] ?? "";
  return `${month} ${monthStart.getFullYear()}`;
}

function friendById(friends: Friend[], id: string): Friend | undefined {
  return friends.find((friend) => friend.id === id);
}

function hasAnyMark(mark: DayMark | undefined): boolean {
  if (!mark) {
    return false;
  }
  return mark.seenFriendIds.length > 0 || mark.upcomingPlanIds.length > 0;
}

function DayMarkDot({ mark }: { mark: DayMark }) {
  const seenCount = mark.seenFriendIds.length;
  const hasUpcoming = mark.upcomingPlanIds.length > 0;
  const size = dayMarkSize(seenCount);

  if (seenCount === 0 && hasUpcoming) {
    return (
      <View
        className="rounded-full border border-primary bg-transparent"
        style={{ width: 6, height: 6 }}
      />
    );
  }

  if (seenCount === 0) {
    return null;
  }

  const dotSize = size === "small" ? 6 : size === "medium" ? 9 : 12;

  const filledDot = (
    <View
      className="rounded-full bg-primary"
      style={{ width: dotSize, height: dotSize }}
    />
  );

  let dot: ReactNode = filledDot;

  if (size === "large") {
    dot = (
      <View
        className="items-center justify-center rounded-full border-2 border-primary-soft bg-transparent"
        style={{ width: dotSize + 4, height: dotSize + 4 }}
      >
        {filledDot}
      </View>
    );
  }

  if (hasUpcoming) {
    return (
      <View
        className="items-center justify-center rounded-full border border-primary bg-transparent"
        style={{ padding: 2 }}
      >
        {dot}
      </View>
    );
  }

  return dot;
}

function MonthGrid({
  monthStart,
  dayMarks,
  firstDayOfWeek,
  todayKey,
  onDayPress,
}: {
  monthStart: Date;
  dayMarks: Map<string, DayMark>;
  firstDayOfWeek: number;
  todayKey: string;
  onDayPress: (dateKey: string) => void;
}) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const totalDays = daysInMonth(monthStart);
  const leadingBlanks = (monthStart.getDay() - firstDayOfWeek + 7) % 7;
  const weekRows = weekRowsForMonth(monthStart, firstDayOfWeek);

  const cells: Array<{ day: number | null; dateKey: string | null }> = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ day: null, dateKey: null });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      day,
      dateKey: `${year}-${pad2(month + 1)}-${pad2(day)}`,
    });
  }
  while (cells.length < weekRows * 7) {
    cells.push({ day: null, dateKey: null });
  }

  const rows = Array.from({ length: weekRows }, (_, rowIndex) =>
    cells.slice(rowIndex * 7, rowIndex * 7 + 7),
  );

  const weekdays = weekdayOrder(firstDayOfWeek);

  return (
    <View>
      <View className="flex-row" style={{ height: WEEKDAY_HEADER_HEIGHT }}>
        {weekdays.map((dow) => (
          <View
            key={dow}
            className="flex-1 items-center justify-center"
            style={{ height: WEEKDAY_HEADER_HEIGHT }}
          >
            <Text className="text-[11px] font-sans-semibold uppercase tracking-[0.4px] text-muted">
              {DAY_LABELS[dow]}
            </Text>
          </View>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} className="flex-row">
          {row.map((cell, cellIndex) => {
            if (cell.day === null || !cell.dateKey) {
              return (
                <View
                  key={`blank-${rowIndex}-${cellIndex}`}
                  className="flex-1"
                  style={{ height: DAY_CELL_SIZE }}
                />
              );
            }

            const mark = dayMarks.get(cell.dateKey);
            const marked = hasAnyMark(mark);
            const isToday = cell.dateKey === todayKey;

            return (
              <Pressable
                key={cell.dateKey}
                accessibilityRole="button"
                accessibilityLabel={
                  marked
                    ? `${cell.day}, ${formatDayTitle(parseDateKey(cell.dateKey))}, has activity`
                    : `${cell.day}`
                }
                disabled={!marked}
                onPress={() => onDayPress(cell.dateKey!)}
                className={cn(
                  "flex-1 items-center justify-center",
                  isToday && "rounded-full border border-primary-softBorder",
                )}
                style={{ height: DAY_CELL_SIZE }}
              >
                <Text
                  className={cn(
                    "text-caption font-sans-semibold",
                    isToday ? "text-primary" : "text-ink",
                  )}
                >
                  {cell.day}
                </Text>
                <View className="mt-0.5 h-4 items-center justify-center">
                  {mark ? <DayMarkDot mark={mark} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function MonthRow({
  item,
  dayMarks,
  firstDayOfWeek,
  todayKey,
  onDayPress,
}: {
  item: MonthItem;
  dayMarks: Map<string, DayMark>;
  firstDayOfWeek: number;
  todayKey: string;
  onDayPress: (dateKey: string) => void;
}) {
  const friendDays = countDaysWithFriends(item.monthStart, dayMarks);
  const footerLabel =
    friendDays === 1 ? "1 day with friends" : `${friendDays} days with friends`;

  return (
    <View style={{ marginBottom: MONTH_BOTTOM_GAP }}>
      <Card
        className="gap-1 overflow-hidden"
        elevation="soft"
        style={{ padding: 16 }}
      >
        <Text
          className="font-sans-bold text-[22px] tracking-[-0.5px] text-ink"
          style={{ height: MONTH_TITLE_HEIGHT, lineHeight: MONTH_TITLE_HEIGHT }}
        >
          {formatMonthHeading(item.monthStart)}
        </Text>
        <MonthGrid
          monthStart={item.monthStart}
          dayMarks={dayMarks}
          firstDayOfWeek={firstDayOfWeek}
          todayKey={todayKey}
          onDayPress={onDayPress}
        />
        <Text
          className="text-caption text-muted"
          style={{
            height: MONTH_FOOTER_HEIGHT,
            lineHeight: MONTH_FOOTER_HEIGHT,
          }}
        >
          {footerLabel}
        </Text>
      </Card>
    </View>
  );
}

function DayDetailSheet({
  dateKey,
  mark,
  plans,
  friends,
  onOpenPlan,
  onClose,
}: {
  dateKey: string;
  mark: DayMark;
  plans: Plan[];
  friends: Friend[];
  onOpenPlan: (planId: string) => void;
  onClose: () => void;
}) {
  const donePlans = mark.donePlanIds
    .map((id) => plans.find((plan) => plan.id === id))
    .filter((plan): plan is Plan => plan !== undefined);

  const upcomingPlans = mark.upcomingPlanIds
    .map((id) => plans.find((plan) => plan.id === id))
    .filter((plan): plan is Plan => plan !== undefined);

  return (
    <View className="gap-4 px-5 pb-4">
      <Text className="font-sans-bold text-section text-ink">
        {formatDayTitle(parseDateKey(dateKey))}
      </Text>

      {mark.seenFriendIds.length > 0 ? (
        <View className="gap-2">
          <Text className="font-sans-semibold text-caption text-muted">
            Caught up
          </Text>
          {mark.seenFriendIds.map((friendId) => {
            const friend = friendById(friends, friendId);
            if (!friend) {
              return null;
            }
            return (
              <View key={friendId} className="flex-row items-center gap-3">
                <Avatar
                  name={friend.name}
                  photoUri={friend.photoUri}
                  size={40}
                />
                <Text className="font-sans-semibold text-body text-ink">
                  {friend.name}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {donePlans.length > 0 ? (
        <View className="gap-3">
          <Text className="font-sans-semibold text-caption text-muted">
            Plans you did
          </Text>
          {donePlans.map((plan) => (
            <View key={plan.id} className="gap-2">
              <Text className="font-sans-bold text-body text-ink">
                {plan.title.trim() || "Plan"}
              </Text>
              {plan.memoryPhotoUri ? (
                <Image
                  source={{ uri: plan.memoryPhotoUri }}
                  accessibilityLabel="Memory photo"
                  className="rounded-control bg-border"
                  style={{ width: 72, height: 72 }}
                />
              ) : null}
              {plan.memoryNote ? (
                <Text className="text-body text-muted">{plan.memoryNote}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {upcomingPlans.length > 0 ? (
        <View className="gap-2">
          <Text className="font-sans-semibold text-caption text-muted">
            Coming up
          </Text>
          {upcomingPlans.map((plan) => (
            <PressableScale
              key={plan.id}
              accessibilityRole="button"
              accessibilityLabel={`${plan.title}, ${PLAN_STATUS_LABELS[plan.status]}`}
              onPress={() => {
                onClose();
                onOpenPlan(plan.id);
              }}
            >
              <View className="rounded-control bg-primary-soft px-3 py-2.5">
                <Text className="font-sans-bold text-body text-ink">
                  {plan.title.trim() || "Plan"}
                </Text>
                <Text className="mt-0.5 text-caption text-primary">
                  {PLAN_STATUS_LABELS[plan.status]}
                </Text>
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MonthsView({
  plans,
  catchUps,
  friends,
  firstDayOfWeek,
  now,
  onOpenPlan,
}: Props) {
  const dayMarks = useMemo(
    () => buildDayMarks(plans, catchUps),
    [plans, catchUps],
  );
  const months = useMemo(() => buildMonthRange(dayMarks, now), [dayMarks, now]);
  const todayKey = formatDateKey(now);
  const currentMonthKey = monthKey(startOfMonth(now));
  const currentMonthIndex = months.findIndex(
    (item) => item.key === currentMonthKey,
  );

  const listRef = useRef<ScrollViewInstance>(null);
  const [sheetDateKey, setSheetDateKey] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();
  const enterProgress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    enterProgress.value = reduceMotion ? 1 : 0;
    enterProgress.value = withTiming(1, {
      duration: reduceMotion ? 1 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [enterProgress, reduceMotion]);

  const offsetForMonthIndex = (index: number) => {
    let y = 0;
    for (let i = 0; i < index; i += 1) {
      const item = months[i];
      if (!item) {
        continue;
      }
      y += monthRowHeight(weekRowsForMonth(item.monthStart, firstDayOfWeek));
    }
    return y;
  };

  useEffect(() => {
    if (currentMonthIndex < 0) {
      return;
    }
    const timer = setTimeout(() => {
      listRef.current?.scrollTo({
        y: offsetForMonthIndex(currentMonthIndex),
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [currentMonthIndex, firstDayOfWeek, months]);

  // Opacity only — avoid transform on the scroll parent (breaks wheel scroll on web).
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
  }));

  const scrollToToday = () => {
    if (currentMonthIndex >= 0) {
      listRef.current?.scrollTo({
        y: offsetForMonthIndex(currentMonthIndex),
        animated: true,
      });
    }
  };

  const onDayPress = (dateKey: string) => {
    const mark = dayMarks.get(dateKey);
    if (!hasAnyMark(mark)) {
      return;
    }
    setSheetDateKey(dateKey);
  };

  const sheetMark = sheetDateKey ? dayMarks.get(sheetDateKey) : undefined;

  if (dayMarks.size === 0) {
    return (
      <Card className="gap-3">
        <Text className="text-body text-muted">
          Your catch-ups will collect here. When a plan is done — or you log 'We
          caught up' — the day gets a dot.
        </Text>
      </Card>
    );
  }

  return (
    <Animated.View style={[{ flex: 1, minHeight: 0 }, enterStyle]}>
      <View className="mb-3 flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to current month"
          onPress={scrollToToday}
          className="min-h-11 items-center justify-center rounded-full bg-surface px-4 active:bg-primary-soft"
          style={shadowSoft}
        >
          <Text className="text-center text-caption font-sans-semibold leading-5 text-ink">
            Today
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={listRef}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {months.map((item) => (
          <MonthRow
            key={item.key}
            item={item}
            dayMarks={dayMarks}
            firstDayOfWeek={firstDayOfWeek}
            todayKey={todayKey}
            onDayPress={onDayPress}
          />
        ))}
      </ScrollView>

      <AnimatedDialog
        visible={sheetDateKey !== null && sheetMark !== undefined}
        onClose={() => setSheetDateKey(null)}
        accessibilityLabel="Day details"
      >
        {sheetDateKey && sheetMark ? (
          <DayDetailSheet
            dateKey={sheetDateKey}
            mark={sheetMark}
            plans={plans}
            friends={friends}
            onOpenPlan={onOpenPlan}
            onClose={() => setSheetDateKey(null)}
          />
        ) : null}
      </AnimatedDialog>
    </Animated.View>
  );
}
