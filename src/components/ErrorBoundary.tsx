import { Component, Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "./Button";
import { Card } from "./Card";
import { Screen } from "./Screen";

type Props = { children: ReactNode };

type State = { failed: boolean; attempt: number };

/**
 * Last-resort catch for render crashes. Must not use `useApp()` — the
 * provider may be what failed. "Try again" remounts the whole tree so
 * AppProvider reloads from storage.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  private retry = () => {
    this.setState((prev) => ({ failed: false, attempt: prev.attempt + 1 }));
  };

  render() {
    if (!this.state.failed) {
      return (
        <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
      );
    }

    return (
      <Screen scroll={false} contentClassName="justify-center">
        <Card elevation="lift">
          <Text
            accessibilityRole="header"
            className="font-sans-bold text-title text-ink"
          >
            Something went sideways
          </Text>
          <Text className="mt-2 text-body text-muted">
            Your friends and plans are still saved on this phone.
          </Text>
          <View className="mt-6">
            <Button label="Try again" onPress={this.retry} />
          </View>
        </Card>
      </Screen>
    );
  }
}
