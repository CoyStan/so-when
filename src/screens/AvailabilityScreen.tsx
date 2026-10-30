import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AnimatedDialog } from "../components/AnimatedDialog";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { PressableScale } from "../components/PressableScale";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatClock } from "../domain/model";
import { DAY_LABELS } from "../domain/time";
import type { AvailabilityRule } from "../domain/types";
import { color } from "../foundation";
import { hapticTick } from "../services/haptics";
import { useApp } from "../state/AppProvider";
import { cn } from "../ui/cn";

function formatRuleSummary(
  rule: AvailabilityRule,
  timeFormat24h: boolean,
): string {
  if (rule.kind === "oneoff") {
    const date = rule.oneOffDate ?? rule.startDate;
    return `One-time · ${date} · ${formatClock(rule.startMinutes, timeFormat24h)} – ${formatClock(rule.endMinutes, timeFormat24h)}`;
  }
  const days = rule.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ");
  const freq = rule.recurrence === "biweekly" ? "every 2 wks" : "weekly";
  return `${days} · ${formatClock(rule.startMinutes, timeFormat24h)} – ${formatClock(rule.endMinutes, timeFormat24h)} · ${freq}`;
}

export function AvailabilityScreen() {
  const {
    data,
    goBack,
    openAddAvailability,
    openEditAvailability,
    setAvailabilityEnabled,
    deleteAvailability,
  } = useApp();
  const [pendingDelete, setPendingDelete] = useState<AvailabilityRule | null>(
    null,
  );

  const recurring = data.availability.filter((r) => r.kind === "recurring");
  const oneoffs = data.availability.filter((r) => r.kind === "oneoff");
  const timeFormat24h = data.settings.timeFormat24h;

  const onToggle = (rule: AvailabilityRule) => {
    hapticTick();
    void setAvailabilityEnabled(rule.id, !rule.enabled);
  };

  const onConfirmDelete = () => {
    if (pendingDelete) {
      void deleteAvailability(pendingDelete.id);
      setPendingDelete(null);
    }
  };

  const renderRuleCard = (rule: AvailabilityRule, showPause: boolean) => (
    <Card key={rule.id} className="flex-row items-center gap-2 p-4">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Edit ${rule.label}`}
        onPress={() => openEditAvailability(rule.id)}
        className="min-h-[44px] flex-1 justify-center"
      >
        <Text className="font-sans-semibold text-body text-ink">
          {rule.label}
        </Text>
        <Text className="mt-0.5 text-caption text-muted">
          {formatRuleSummary(rule, timeFormat24h)}
        </Text>
        {!rule.enabled ? (
          <Text className="mt-1 text-caption italic text-muted">
            Paused — won’t appear in your timeline
          </Text>
        ) : null}
      </PressableScale>

      {showPause ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: rule.enabled }}
          accessibilityLabel={
            rule.enabled ? `Pause ${rule.label}` : `Resume ${rule.label}`
          }
          onPress={() => onToggle(rule)}
          className={cn(
            "h-8 w-[52px] items-center justify-center rounded-full",
            rule.enabled ? "bg-primary" : "bg-border",
          )}
        >
          <View
            className="h-6 w-6 rounded-full bg-white"
            style={{ transform: [{ translateX: rule.enabled ? 12 : -12 }] }}
          />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${rule.label}`}
        onPress={() => {
          hapticTick();
          setPendingDelete(rule);
        }}
        className="h-11 w-11 items-center justify-center"
      >
        <Icon name="trash-2" size={18} color={color.muted} />
      </Pressable>
    </Card>
  );

  return (
    <Screen contentClassName="gap-5">
      <ScreenHeader title="Availability" onBack={goBack} />

      <Button label="Add availability" onPress={openAddAvailability} />

      {data.availability.length === 0 ? (
        <Card>
          <Text className="text-body text-muted">
            No availability set yet. Add some free windows and they'll appear
            here.
          </Text>
        </Card>
      ) : null}

      {recurring.length > 0 ? (
        <View className="gap-2">
          <Text className="font-sans-bold text-section text-ink">
            Recurring
          </Text>
          {recurring.map((rule) => renderRuleCard(rule, true))}
        </View>
      ) : null}

      {oneoffs.length > 0 ? (
        <View className="gap-2">
          <Text className="font-sans-bold text-section text-ink">One-time</Text>
          {oneoffs.map((rule) => renderRuleCard(rule, false))}
        </View>
      ) : null}

      <AnimatedDialog
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        accessibilityLabel="Delete availability"
      >
        <View className="gap-3 px-5 pb-4">
          <Text className="font-sans-bold text-section text-ink">
            Delete "{pendingDelete?.label}"?
          </Text>
          <Text className="text-body text-muted">
            This removes the rule and it won't show in your timeline again.
          </Text>
          <Button label="Delete" variant="ghost" onPress={onConfirmDelete} />
          <Button label="Keep it" onPress={() => setPendingDelete(null)} />
        </View>
      </AnimatedDialog>
    </Screen>
  );
}
