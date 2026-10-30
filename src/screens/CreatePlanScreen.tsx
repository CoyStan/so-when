import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DateSlotPicker } from "../components/DateSlotPicker";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { TextField } from "../components/TextField";
import { TimeSlotPicker } from "../components/TimeSlotPicker";
import { ACTIVITY_OPTIONS, catchUpStatus, formatClock } from "../domain/model";
import { dateAtMinutes, formatDayHeading } from "../domain/time";
import { color, shadowSoft } from "../foundation";
import { useApp } from "../state/AppProvider";
import { cn } from "../ui/cn";

export function CreatePlanScreen() {
  const {
    selectedSlot,
    selectedFriendIds,
    sortedFriends,
    toggleFriendSelection,
    createPlan,
    goBack,
    openAddFriendForPlan,
    setSelectedPlanWindow,
    data,
  } = useApp();

  const [step, setStep] = useState<"friends" | "details">(
    selectedFriendIds.length > 0 ? "details" : "friends",
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activity, setActivity] = useState("");
  const [customActivity, setCustomActivity] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const durationMinutes = useMemo(() => {
    if (!selectedSlot) {
      return data.settings.defaultDurationMinutes;
    }
    return Math.max(
      30,
      selectedSlot.endMinutes - selectedSlot.startMinutes ||
        data.settings.defaultDurationMinutes,
    );
  }, [data.settings.defaultDurationMinutes, selectedSlot]);

  const slotLabel = useMemo(() => {
    if (!selectedSlot) {
      return "";
    }
    const start = new Date(selectedSlot.startAt);
    const end = new Date(selectedSlot.endAt);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    return `${formatDayHeading(start)} · ${formatClock(startMin, data.settings.timeFormat24h)} – ${formatClock(endMin, data.settings.timeFormat24h)}`;
  }, [data.settings.timeFormat24h, selectedSlot]);

  if (!selectedSlot) {
    return (
      <Screen>
        <ScreenHeader title="Make a plan" onBack={goBack} />
        <Text className="text-body text-muted">
          Something went wrong picking a time. Go back and try again.
        </Text>
      </Screen>
    );
  }

  const applyWindow = (dateKey: string, startMinutes: number) => {
    const start = dateAtMinutes(dateKey, startMinutes);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    setSelectedPlanWindow(start.toISOString(), end.toISOString());
  };

  const resolvedActivity =
    activity === "custom" ? customActivity.trim() : activity;

  const onContinue = () => {
    if (selectedFriendIds.length === 0) {
      Alert.alert("Choose friends", "Select at least one person to invite.");
      return;
    }
    setStep("details");
  };

  const onCreate = async () => {
    setSaving(true);
    try {
      const result = await createPlan({
        title,
        activity: resolvedActivity,
        place,
        note,
      });
      if (!result.ok) {
        Alert.alert(
          "Could not create invitation",
          result.message ?? "Something went wrong. Try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentClassName="gap-4">
      <ScreenHeader
        title={step === "friends" ? "Who’s coming?" : "Plan details"}
        onBack={step === "friends" ? goBack : () => setStep("friends")}
      />
      <View className="gap-1">
        <View className="self-start rounded-full bg-primary-soft px-3 py-1.5">
          <Text className="text-caption font-sans-semibold text-primary">
            {slotLabel}
          </Text>
        </View>
        <Text className="text-caption text-muted">
          {step === "friends"
            ? "Step 1 of 2 · Pick your people"
            : "Step 2 of 2 · When and details"}
        </Text>
      </View>

      {step === "friends" ? (
        <>
          {sortedFriends.length === 0 ? (
            <Card className="gap-3">
              <Text className="text-body text-muted">
                Add a friend before making a plan.
              </Text>
              <Button
                label="Add a friend"
                onPress={() =>
                  openAddFriendForPlan(
                    selectedSlot,
                    selectedFriendIds,
                    "createPlan",
                  )
                }
              />
            </Card>
          ) : (
            <View className="gap-2">
              <Button
                label="Add someone new"
                variant="ghost"
                onPress={() =>
                  openAddFriendForPlan(
                    selectedSlot,
                    selectedFriendIds,
                    "createPlan",
                  )
                }
              />
              {sortedFriends.map((friend) => {
                const selected = selectedFriendIds.includes(friend.id);
                const due = catchUpStatus(friend) === "due";
                return (
                  <Pressable
                    key={friend.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={friend.name}
                    onPress={() => toggleFriendSelection(friend.id)}
                    className={cn(
                      "flex-row items-center gap-3 rounded-card p-3",
                      selected
                        ? "border border-primary bg-primary-soft"
                        : "bg-surface",
                    )}
                    style={selected ? undefined : shadowSoft}
                  >
                    <Avatar
                      name={friend.name}
                      photoUri={friend.photoUri}
                      size={44}
                    />
                    <View className="flex-1">
                      <Text className="font-sans-semibold text-body text-ink">
                        {friend.name}
                      </Text>
                      <Text className="text-caption text-muted">
                        {due ? "Due for a catch-up" : "Available"}
                      </Text>
                    </View>
                    <View
                      className={cn(
                        "h-6 w-6 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary"
                          : "border-border",
                      )}
                    >
                      {selected ? (
                        <Icon
                          name="check"
                          size={14}
                          color={color.primaryText}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Button
            label="Continue"
            onPress={onContinue}
            disabled={selectedFriendIds.length === 0}
          />
        </>
      ) : (
        <>
          <Card className="gap-3 p-4">
            <Text className="font-sans-semibold text-body text-ink">When</Text>
            <Text className="text-caption text-muted">
              Change this anytime — free-time suggestions are optional.
            </Text>
            <DateSlotPicker
              label="Date"
              date={selectedSlot.date}
              onChange={(dateKey) =>
                applyWindow(dateKey, selectedSlot.startMinutes)
              }
            />
            <TimeSlotPicker
              label="Starts"
              minutes={selectedSlot.startMinutes}
              timeFormat24h={data.settings.timeFormat24h}
              onChange={(minutes) => applyWindow(selectedSlot.date, minutes)}
            />
            <Text className="text-caption text-muted">
              Ends{" "}
              {formatClock(
                selectedSlot.endMinutes,
                data.settings.timeFormat24h,
              )}{" "}
              ({durationMinutes} min)
            </Text>
          </Card>

          <Card className="gap-2 p-4">
            <Text className="text-body text-ink">
              {selectedFriendIds.length === 1
                ? `You’ll invite ${sortedFriends.find((f) => f.id === selectedFriendIds[0])?.name ?? "one friend"}.`
                : `You’ll invite ${selectedFriendIds.length} people.`}
            </Text>
            <Text className="text-caption text-muted">
              You can edit the message and share from the next screen.
            </Text>
          </Card>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            accessibilityLabel="Add a detail"
            onPress={() => setDetailsOpen((open) => !open)}
            className="min-h-[44px] flex-row items-center justify-between rounded-control border border-border bg-surface px-4 py-3"
          >
            <Text className="font-sans-semibold text-body text-ink">
              Add a detail
            </Text>
            <Text className="text-caption text-muted">
              {detailsOpen ? "Hide" : "Show"}
            </Text>
          </Pressable>

          {detailsOpen ? (
            <View className="gap-3">
              <TextField
                label="Title (optional)"
                value={title}
                onChangeText={setTitle}
                placeholder="Catch up with…"
              />

              <View className="gap-2">
                <Text className="text-caption font-sans-semibold text-ink">
                  Activity (optional)
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map((option) => {
                    const selected = activity === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setActivity(selected ? "" : option)}
                        className={cn(
                          "min-h-[44px] items-center justify-center rounded-full border px-4",
                          selected
                            ? "border-primary bg-primary-soft"
                            : "border-border bg-surface",
                        )}
                      >
                        <Text
                          className={cn(
                            "text-center font-sans-semibold text-caption leading-5",
                            selected ? "text-primary" : "text-ink",
                          )}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: activity === "custom" }}
                    onPress={() =>
                      setActivity(activity === "custom" ? "" : "custom")
                    }
                    className={cn(
                      "min-h-[44px] items-center justify-center rounded-full border px-4",
                      activity === "custom"
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-surface",
                    )}
                  >
                    <Text
                      className={cn(
                        "text-center font-sans-semibold text-caption leading-5",
                        activity === "custom" ? "text-primary" : "text-ink",
                      )}
                    >
                      custom
                    </Text>
                  </Pressable>
                </View>
                {activity === "custom" ? (
                  <TextField
                    label="Custom activity"
                    value={customActivity}
                    onChangeText={setCustomActivity}
                    placeholder="Board games"
                  />
                ) : null}
              </View>

              <TextField
                label="Place (optional)"
                value={place}
                onChangeText={setPlace}
                placeholder="Bar Central"
              />
              <TextField
                label="Private note (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="Just for you — not shared"
              />
            </View>
          ) : null}

          <Button
            label="Create invitation"
            loading={saving}
            onPress={() => void onCreate()}
          />
        </>
      )}
    </Screen>
  );
}
