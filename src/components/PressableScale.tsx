import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "../ui/useReduceMotion";

const PRESS_IN_MS = 120;
const PRESS_OUT_MS = 160;
const PRESSED_SCALE = 0.97;

type Props = Omit<PressableProps, "style"> & {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Standard calm press feedback for cards and rows: a gentle 0.97 scale
 * instead of the harsher opacity flash. Transform only, reduce-motion aware
 * (design-system/so-when MASTER motion rules).
 *
 * className/style land on a plain inner Pressable (NativeWind-safe);
 * the outer Animated.View only carries the scale transform.
 */
export function PressableScale({
  children,
  className,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        className={className}
        style={style}
        onPressIn={(event) => {
          scale.value = withTiming(reduceMotion ? 1 : PRESSED_SCALE, {
            duration: reduceMotion ? 1 : PRESS_IN_MS,
          });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withTiming(1, {
            duration: reduceMotion ? 1 : PRESS_OUT_MS,
          });
          onPressOut?.(event);
        }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
