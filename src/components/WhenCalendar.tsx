import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from "react-native";

import { formatClock, PLAN_STATUS_LABELS, slotIsBooked } from "../domain/model";
import type { ConcreteSlot, Plan, PlanStatus } from "../domain/types";
import {
  DAY_END_HOUR,
  DAY_LABELS,
  DAY_START_HOUR,
  formatDateKey,
  formatDayTitle,
  HOUR_HEIGHT,
} from "../domain/time";
import { color, shadowSoft } from "../foundation";
import { cn } from "../ui/cn";

const TIME_GUTTER = 52;

const PLAN_CHIP: Record<
  PlanStatus,
  { bg: string; fg: string; border: string }
> = {
  draft: { bg: color.softCoral, fg: color.coralDeep, border: "#F5C4B8" },
  waiting: { bg: color.softTeal, fg: color.primary, border: "#B7E0DD" },
  on: { bg: "#ECFDF3", fg: color.success, border: "#A7F3C0" },
  needs_time: { bg: color.softCoral, fg: color.coralDeep, border: "#F5C4B8" },
  done: { bg: color.canvas, fg: color.muted, border: color.border },
  cancelled: { bg: color.canvas, fg: color.muted, border: color.border },
};

type Props = {
  days: Date[];
  focusDate: Date;
  slots: ConcreteSlot[];
  plans: Plan[];
  friends: { id: string; name: string }[];
  timeFormat24h: boolean;
  /** First hour shown in the grid (defaults from domain constants). */
  dayStartHour?: number;
  /** Exclusive end hour for the grid. */
  dayEndHour?: number;
  onFocusDate: (date: Date) => void;
  onOpenSlot: (slot: ConcreteSlot) => void;
  onSkipSlot?: (slot: ConcreteSlot) => void;
  onOpenPlan: (planId: string) => void;
  /** Provider minute tick — drives the current-time line. */
  now: Date;
};

export function WhenCalendar({
  days,
  focusDate,
  slots,
  plans,
  friends,
  timeFormat24h,
  dayStartHour = DAY_START_HOUR,
  dayEndHour = DAY_END_HOUR,
  onFocusDate,
  onOpenSlot,
  onSkipSlot,
  onOpenPlan,
  now,
}: Props) {
  const [gridWidth, setGridWidth] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const todayKey = formatDateKey(now);
  const focusKey = formatDateKey(focusDate);
  const startHour = Math.max(0, Math.min(23, dayStartHour));
  const endHour = Math.max(startHour + 1, Math.min(24, dayEndHour));
  const hours = endHour - startHour;
  const gridHeight = hours * HOUR_HEIGHT;

  const daysAreaWidth = Math.max(0, gridWidth - TIME_GUTTER);
  const dayWidth = days.length > 0 ? daysAreaWidth / days.length : 0;

  const nowMinutes = useMemo(() => {
    return now.getHours() * 60 + now.getMinutes();
  }, [now]);

  const activePlans = plans.filter((plan) => plan.status !== "cancelled");

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== gridWidth) {
      setGridWidth(next);
    }
  };

  // Land near "now" so the grid feels oriented when opening Week.
  useEffect(() => {
    if (gridWidth <= 0) {
      return;
    }
    const offset = Math.max(
      0,
      ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT - HOUR_HEIGHT * 1.5,
    );
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: false });
    }, 40);
    return () => clearTimeout(timer);
  }, [gridWidth, focusKey, startHour, nowMinutes]);

  return (
    <View
      className="w-full flex-1 overflow-hidden rounded-card bg-surface"
      style={shadowSoft}
      onLayout={onLayout}
    >
      {gridWidth <= 0 ? (
        <View className="flex-1" />
      ) : (
        <>
          <View
            className="flex-row border-b border-border py-2"
            style={{ width: gridWidth }}
          >
            <View style={{ width: TIME_GUTTER }} />
            <View className="flex-row" style={{ width: daysAreaWidth }}>
              {days.map((day) => {
                const key = formatDateKey(day);
                const isToday = key === todayKey;
                const isFocus = key === focusKey;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={formatDayTitle(day)}
                    onPress={() => onFocusDate(day)}
                    className="items-center gap-1"
                    style={{ width: dayWidth }}
                  >
                    <Text
                      className={cn(
                        "text-[11px] font-sans-semibold uppercase tracking-[0.4px]",
                        isToday ? "text-primary" : "text-muted",
                      )}
                    >
                      {DAY_LABELS[day.getDay()]}
                    </Text>
                    <View
                      className={cn(
                        "h-7 w-7 items-center justify-center rounded-full",
                        isToday && "bg-primary-soft",
                        isFocus && !isToday && "bg-coral-soft",
                      )}
                    >
                      <Text
                        className={cn(
                          "text-caption font-sans-bold",
                          isToday ? "text-primary" : "text-ink",
                        )}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 24, width: gridWidth }}
            showsVerticalScrollIndicator={false}
          >
            <View
              className="flex-row"
              style={{ width: gridWidth, height: gridHeight }}
            >
              <View style={{ width: TIME_GUTTER }}>
                {Array.from({ length: hours }, (_, i) => {
                  const hour = startHour + i;
                  return (
                    <View key={hour} style={{ height: HOUR_HEIGHT }}>
                      <Text className="-mt-[7px] pr-2 text-right text-[11px] text-muted">
                        {formatClock(hour * 60, timeFormat24h)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View className="flex-row" style={{ width: daysAreaWidth }}>
                {days.map((day, dayIndex) => {
                  const dateKey = formatDateKey(day);
                  const daySlots = slots.filter(
                    (slot) => slot.date === dateKey,
                  );
                  const dayPlans = activePlans.filter(
                    (plan) => formatDateKey(new Date(plan.startAt)) === dateKey,
                  );
                  const showNow =
                    dateKey === todayKey &&
                    nowMinutes >= startHour * 60 &&
                    nowMinutes < endHour * 60;

                  return (
                    <View
                      key={dateKey}
                      className="relative"
                      style={{ width: dayWidth, height: gridHeight }}
                    >
                      {Array.from({ length: hours }, (_, i) => (
                        <View
                          key={`${dateKey}-h-${i}`}
                          className="absolute left-0 right-0 border-t border-border"
                          style={{ top: i * HOUR_HEIGHT, opacity: 0.55 }}
                        />
                      ))}

                      {daySlots.map((slot) => (
                        <FreeBlockView
                          key={slot.key}
                          slot={slot}
                          dayWidth={dayWidth}
                          dayStartHour={startHour}
                          booked={slotIsBooked(slot, plans)}
                          timeFormat24h={timeFormat24h}
                          onPress={() => {
                            if (!slotIsBooked(slot, plans)) {
                              onOpenSlot(slot);
                            }
                          }}
                          onLongPress={
                            onSkipSlot &&
                            slot.ruleId &&
                            !slotIsBooked(slot, plans)
                              ? () => onSkipSlot(slot)
                              : undefined
                          }
                        />
                      ))}

                      {dayPlans.map((plan) => (
                        <PlanBlockView
                          key={plan.id}
                          plan={plan}
                          dayWidth={dayWidth}
                          dayStartHour={startHour}
                          label={planTitle(plan, friends)}
                          onPress={() => onOpenPlan(plan.id)}
                        />
                      ))}

                      {showNow ? (
                        <View
                          pointerEvents="none"
                          className="absolute left-0 right-0 z-[3] flex-row items-center"
                          style={{
                            top:
                              ((nowMinutes - startHour * 60) / 60) *
                              HOUR_HEIGHT,
                          }}
                        >
                          <View className="-ml-[3px] h-2 w-2 rounded-full bg-coral" />
                          <View className="h-0.5 flex-1 bg-coral" />
                        </View>
                      ) : null}

                      {dayIndex < days.length - 1 ? (
                        <View className="absolute bottom-0 right-0 top-0 w-px bg-border" />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

function planTitle(
  plan: Plan,
  friends: { id: string; name: string }[],
): string {
  if (plan.title.trim()) {
    return plan.title;
  }
  const names = plan.friends
    .map((item) => friends.find((friend) => friend.id === item.friendId)?.name)
    .filter(Boolean);
  return names[0] ?? "Plan";
}

function FreeBlockView({
  slot,
  dayWidth,
  dayStartHour,
  booked,
  timeFormat24h,
  onPress,
  onLongPress,
}: {
  slot: ConcreteSlot;
  dayWidth: number;
  dayStartHour: number;
  booked: boolean;
  timeFormat24h: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const top = ((slot.startMinutes - dayStartHour * 60) / 60) * HOUR_HEIGHT;
  const height = ((slot.endMinutes - slot.startMinutes) / 60) * HOUR_HEIGHT;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Free ${formatClock(slot.startMinutes, timeFormat24h)} to ${formatClock(slot.endMinutes, timeFormat24h)}${onLongPress ? ". Double-tap and use Skip action to skip this time" : ""}`}
      accessibilityHint={
        onLongPress
          ? "Activate Skip action to hide this occurrence once"
          : undefined
      }
      accessibilityActions={
        onLongPress
          ? [
              { name: "activate" },
              { name: "skip", label: "Skip this free time" },
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "skip") {
          onLongPress?.();
          return;
        }
        if (event.nativeEvent.actionName === "activate") {
          onPress();
        }
      }}
      disabled={booked}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={420}
      className="absolute z-[1] rounded-[10px] border border-dashed border-primary-softBorder bg-primary-soft px-1.5 py-1"
      style={{
        top,
        height: Math.max(height - 3, 44),
        width: Math.max(dayWidth - 4, 12),
        left: 2,
        opacity: booked ? 0.4 : 1,
      }}
    >
      <Text
        className="text-[10px] font-sans-bold text-primary"
        numberOfLines={2}
      >
        {booked ? "Booked" : "Free"}
      </Text>
    </Pressable>
  );
}

function PlanBlockView({
  plan,
  dayWidth,
  dayStartHour,
  label,
  onPress,
}: {
  plan: Plan;
  dayWidth: number;
  dayStartHour: number;
  label: string;
  onPress: () => void;
}) {
  const start = new Date(plan.startAt);
  const end = new Date(plan.endAt);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const top = ((startMinutes - dayStartHour * 60) / 60) * HOUR_HEIGHT;
  const height =
    ((Math.max(endMinutes, startMinutes + 30) - startMinutes) / 60) *
    HOUR_HEIGHT;
  const chip = PLAN_CHIP[plan.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${PLAN_STATUS_LABELS[plan.status]}`}
      onPress={onPress}
      className="absolute z-[2] rounded-[10px] border px-1.5 py-1"
      style={{
        top,
        height: Math.max(height - 3, 44),
        width: Math.max(dayWidth - 4, 12),
        left: 2,
        backgroundColor: chip.bg,
        borderColor: chip.border,
      }}
    >
      <Text
        className="font-sans-bold text-[11px]"
        style={{ color: chip.fg }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {height > 40 ? (
        <Text
          className="mt-0.5 text-[10px] opacity-90"
          style={{ color: chip.fg }}
          numberOfLines={1}
        >
          {PLAN_STATUS_LABELS[plan.status]}
        </Text>
      ) : null}
    </Pressable>
  );
}
