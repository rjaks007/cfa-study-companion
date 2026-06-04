import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

export type GardenMood = "thriving" | "calm" | "storm";

const PALETTE = {
  thriving: { sky: "#a9e1ff", skyLow: "#d8f3ff", ground: "#7ec97e", groundDark: "#5fae5f" },
  calm: { sky: "#c4d6e4", skyLow: "#e3eef5", ground: "#8bc18b", groundDark: "#6fa56f" },
  storm: { sky: "#3f5160", skyLow: "#56697a", ground: "#5b7a5b", groundDark: "#46604a" },
};

const PETAL_COLORS = ["#ff7aa2", "#ffb84d", "#c78bff", "#ff6b6b", "#7ad6ff"];
const SAD_PETAL = "#9fb0ad";

function useLoop(toDuration: number, fromDuration = toDuration) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: toDuration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: fromDuration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, toDuration, fromDuration]);
  return value;
}

function Sun({ size, sunny }: { size: number; sunny: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  if (!sunny) return null;
  return (
    <Animated.View style={{ position: "absolute", top: size * 0.18, right: size * 0.16, transform: [{ rotate }] }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <View
          key={index}
          style={{
            position: "absolute",
            width: 3,
            height: size * 0.5,
            backgroundColor: "#ffe08a",
            borderRadius: 2,
            top: -size * 0.1,
            left: size * 0.15,
            transform: [{ rotate: `${index * 45}deg` }],
          }}
        />
      ))}
      <View style={{ width: size * 0.32, height: size * 0.32, borderRadius: size, backgroundColor: "#ffd24d" }} />
    </Animated.View>
  );
}

function Cloud({ width, top, delay, dark, sceneWidth }: { width: number; top: number; delay: number; dark: boolean; sceneWidth: number }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 16000, delay, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [drift, delay]);
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-width, sceneWidth + width] });
  const color = dark ? "#6b7c8c" : "#ffffff";
  return (
    <Animated.View style={{ position: "absolute", top, transform: [{ translateX }], opacity: dark ? 0.92 : 0.95 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <View style={{ width: width * 0.5, height: width * 0.5, borderRadius: width, backgroundColor: color }} />
        <View style={{ width: width * 0.7, height: width * 0.7, borderRadius: width, backgroundColor: color, marginLeft: -width * 0.3 }} />
        <View style={{ width: width * 0.5, height: width * 0.5, borderRadius: width, backgroundColor: color, marginLeft: -width * 0.3 }} />
      </View>
    </Animated.View>
  );
}

function Flower({ size, color, sad, index }: { size: number; color: string; sad: boolean; index: number }) {
  const sway = useLoop(2200 + index * 250);
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: sad ? ["18deg", "26deg"] : ["-7deg", "7deg"] });
  const petalSize = size * 0.46;
  const radius = size * 0.3;
  return (
    <Animated.View style={{ alignItems: "center", transform: [{ rotate }], opacity: sad ? 0.85 : 1 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {Array.from({ length: 5 }).map((_, petal) => {
          const angle = (petal * 72 * Math.PI) / 180;
          return (
            <View
              key={petal}
              style={{
                position: "absolute",
                width: petalSize,
                height: petalSize,
                borderRadius: petalSize,
                backgroundColor: sad ? SAD_PETAL : color,
                transform: [{ translateX: radius * Math.cos(angle) }, { translateY: radius * Math.sin(angle) }],
              }}
            />
          );
        })}
        <View style={{ width: size * 0.34, height: size * 0.34, borderRadius: size, backgroundColor: sad ? "#c7cfc2" : "#ffe27a" }} />
      </View>
      <View style={{ width: 3, height: size * 0.95, backgroundColor: sad ? "#6f8a6f" : "#3f9d52", borderRadius: 2, marginTop: -size * 0.1 }} />
    </Animated.View>
  );
}

function Butterfly({ sceneWidth, sceneHeight, delay, tone }: { sceneWidth: number; sceneHeight: number; delay: number; tone: string }) {
  const fly = useRef(new Animated.Value(0)).current;
  const flap = useLoop(220);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(fly, { toValue: 1, duration: 9000, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [fly, delay]);
  const translateX = fly.interpolate({ inputRange: [0, 1], outputRange: [sceneWidth * 0.1, sceneWidth * 0.8] });
  const translateY = fly.interpolate({ inputRange: [0, 0.5, 1], outputRange: [sceneHeight * 0.42, sceneHeight * 0.22, sceneHeight * 0.4] });
  const wing = flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });
  return (
    <Animated.View style={{ position: "absolute", transform: [{ translateX }, { translateY }] }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Animated.View style={{ width: 9, height: 11, borderRadius: 6, backgroundColor: tone, transform: [{ scaleX: wing }] }} />
        <View style={{ width: 2, height: 8, backgroundColor: "#3a2c2c", borderRadius: 2 }} />
        <Animated.View style={{ width: 9, height: 11, borderRadius: 6, backgroundColor: tone, transform: [{ scaleX: wing }] }} />
      </View>
    </Animated.View>
  );
}

function RainDrop({ left, delay, sceneHeight }: { left: number; delay: number; sceneHeight: number }) {
  const fall = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(fall, { toValue: 1, duration: 900, delay, easing: Easing.in(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [fall, delay]);
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-10, sceneHeight] });
  const opacity = fall.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.7, 0.7, 0] });
  return <Animated.View style={{ position: "absolute", left, top: 0, width: 2, height: 12, borderRadius: 2, backgroundColor: "#bcd4e6", transform: [{ translateY }], opacity }} />;
}

function Lightning({ active }: { active: boolean }) {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(3200),
        Animated.timing(flash, { toValue: 0.55, duration: 80, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.4, duration: 60, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, flash]);
  if (!active) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "#ffffff", opacity: flash }]} />;
}

export function GardenView({ mood, bloomCount, height, width = 320 }: { mood: GardenMood; bloomCount: number; height: number; width?: number }) {
  const sunny = mood !== "storm";
  const sad = mood === "storm";
  const showButterflies = mood === "thriving";
  const palette = PALETTE[mood];
  const flowerSize = Math.max(18, height * 0.26);
  const flowerCount = Math.min(Math.max(bloomCount, 4), Math.max(4, Math.floor(width / 46)));

  return (
    <View style={[styles.scene, { height, backgroundColor: palette.sky }]}>
      <View style={[styles.skyGlow, { backgroundColor: palette.skyLow, height: height * 0.55 }]} />
      <Sun size={height} sunny={sunny} />
      <Cloud width={height * 0.4} top={height * 0.12} delay={0} dark={sad} sceneWidth={width} />
      <Cloud width={height * 0.3} top={height * 0.3} delay={7000} dark={sad} sceneWidth={width} />

      {sad
        ? Array.from({ length: 10 }).map((_, index) => (
            <RainDrop key={index} left={(width / 10) * index + 6} delay={index * 90} sceneHeight={height} />
          ))
        : null}

      {showButterflies ? (
        <>
          <Butterfly sceneWidth={width} sceneHeight={height} delay={0} tone="#ff9ecb" />
          <Butterfly sceneWidth={width} sceneHeight={height} delay={3500} tone="#ffd24d" />
        </>
      ) : null}

      <View style={[styles.ground, { height: height * 0.26, backgroundColor: palette.ground }]} />
      <View style={[styles.flowerRow, { height: height * 0.6 }]}>
        {Array.from({ length: flowerCount }).map((_, index) => (
          <Flower key={index} size={flowerSize} color={PETAL_COLORS[index % PETAL_COLORS.length]} sad={sad} index={index} />
        ))}
      </View>

      <Lightning active={sad} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  skyGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  flowerRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
});
