import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// An Apple-Fitness-style animated progress ring: it sweeps to fill toward the next
// bloom, breathes with a soft glow, and shows the streak count in the centre.
export function StreakRing({ streak, progress, size = 124 }: { streak: number; progress: number; size?: number }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sweep, {
      toValue: Math.max(0, Math.min(1, progress / 100)),
      duration: 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // a gentle pop on the number whenever progress changes
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
  }, [progress, sweep, pop]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const strokeDashoffset = sweep.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] });
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.halo,
          { width: size * 0.82, height: size * 0.82, borderRadius: size, transform: [{ scale: haloScale }], opacity: haloOpacity },
        ]}
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Animated.View style={[styles.center, { transform: [{ scale: popScale }] }]}>
        <Text style={styles.flame}>🔥</Text>
        <Text style={styles.num}>{streak}</Text>
        <Text style={styles.label}>day streak</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    backgroundColor: colors.primary,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  flame: {
    fontSize: 18,
  },
  num: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
  },
});
