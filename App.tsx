import "./global.css";

import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from "@expo-google-fonts/quicksand";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomNav } from "./src/components/BottomNav";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { MuiPickerProvider } from "./src/components/MuiPickerProvider";
import { SaveErrorBanner } from "./src/components/SaveErrorBanner";
import { ScreenTransition } from "./src/components/ScreenTransition";
import { TabPane } from "./src/components/TabPane";
import { color } from "./src/foundation";
import { AddAvailabilityScreen } from "./src/screens/AddAvailabilityScreen";
import { AvailabilityScreen } from "./src/screens/AvailabilityScreen";
import { CreatePlanScreen } from "./src/screens/CreatePlanScreen";
import { FriendFormScreen } from "./src/screens/FriendFormScreen";
import { FriendProfileScreen } from "./src/screens/FriendProfileScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { MoveFriendScreen } from "./src/screens/MoveFriendScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { PastPlansScreen } from "./src/screens/PastPlansScreen";
import { PickPlanTimeScreen } from "./src/screens/PickPlanTimeScreen";
import { PlanDetailScreen } from "./src/screens/PlanDetailScreen";
import { PrivacyPolicyScreen } from "./src/screens/PrivacyPolicyScreen";
import { RecoveryScreen } from "./src/screens/RecoveryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { WhenScreen } from "./src/screens/WhenScreen";
import { AppProvider, useApp, type ScreenId } from "./src/state/AppProvider";

function renderStackScreen(screen: ScreenId) {
  switch (screen) {
    case "welcome":
      return <WelcomeScreen />;
    case "addFriend":
      return <FriendFormScreen key="create" mode="create" />;
    case "editFriend":
      return <FriendFormScreen key="edit" mode="edit" />;
    case "friendProfile":
      return <FriendProfileScreen />;
    case "addAvailability":
      return <AddAvailabilityScreen key="add" />;
    case "editAvailability":
      return <AddAvailabilityScreen key="edit" />;
    case "availability":
      return <AvailabilityScreen />;
    case "onboarding":
      return <OnboardingScreen />;
    case "recovery":
      return <RecoveryScreen />;
    case "createPlan":
      return <CreatePlanScreen />;
    case "pickPlanTime":
      return <PickPlanTimeScreen />;
    case "planDetail":
      return <PlanDetailScreen />;
    case "moveFriend":
      return <MoveFriendScreen />;
    case "pastPlans":
      return <PastPlansScreen />;
    case "privacyPolicy":
      return <PrivacyPolicyScreen />;
    case "loading":
      return null;
    // Tab roots are rendered separately (keep-alive). Fallback only.
    case "friends":
      return <FriendsScreen />;
    case "settings":
      return <SettingsScreen />;
    case "when":
    default:
      return <WhenScreen />;
  }
}

function Root() {
  const { ready, screen, tab, navMotion, goWhen, goFriends, goSettings } =
    useApp();

  if (!ready || screen === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color={color.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  const isTabRoot =
    screen === "when" || screen === "friends" || screen === "settings";

  return (
    <View className="flex-1 bg-canvas font-sans" style={{ overflow: "hidden" }}>
      {/*
        Tab peers: keep mounted, plain visibility swap, no ScreenTransition.
        Avoids opacity/slide flashes (teal “green squares”) on every tab tap.
      */}
      <View
        style={{
          flex: 1,
          display: isTabRoot ? "flex" : "none",
          overflow: "hidden",
        }}
        pointerEvents={isTabRoot ? "auto" : "none"}
      >
        <TabPane active={tab === "when"}>
          <WhenScreen />
        </TabPane>
        <TabPane active={tab === "friends"}>
          <FriendsScreen />
        </TabPane>
        <TabPane active={tab === "settings"}>
          <SettingsScreen />
        </TabPane>
      </View>

      {!isTabRoot ? (
        <View style={{ flex: 1, overflow: "hidden" }}>
          <ScreenTransition screenKey={screen} motion={navMotion}>
            {renderStackScreen(screen)}
          </ScreenTransition>
        </View>
      ) : null}

      {isTabRoot ? (
        <BottomNav
          active={tab}
          onWhen={goWhen}
          onFriends={goFriends}
          onSettings={goSettings}
        />
      ) : null}
      <SaveErrorBanner />
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color={color.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <MuiPickerProvider>
          <AppProvider>
            <Root />
          </AppProvider>
        </MuiPickerProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
