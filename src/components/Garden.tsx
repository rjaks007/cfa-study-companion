import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

export type GardenMood = "thriving" | "calm" | "storm";

const THEMES = {
  thriving: {
    skyTop: "#5bb8f5",
    skyMid: "#a9defb",
    skyLow: "#e8f7ff",
    hillBack: "#cfeaa3",
    hillMid: "#97d479",
    hillFront: "#5fb163",
    sun: "#ffd24d",
    glow: "#fff3c4",
  },
  calm: {
    skyTop: "#86b2cf",
    skyMid: "#bcd4e3",
    skyLow: "#e6eef4",
    hillBack: "#bcd9a0",
    hillMid: "#8cc079",
    hillFront: "#5f9d62",
    sun: "#ffdf8a",
    glow: "#fff3d6",
  },
  storm: {
    skyTop: "#28333d",
    skyMid: "#3b4d5b",
    skyLow: "#566a78",
    hillBack: "#5d7460",
    hillMid: "#4c6450",
    hillFront: "#3b5340",
    sun: "#9fb0bd",
    glow: "#7e8d99",
  },
};

const PETALS = ["#ff7aa2", "#ffb14d", "#c78bff", "#ff6b6b", "#5ec8ff"];

// A drawn vector flower with petals + stem, gently swaying. Droops and greys in a storm.
function Flower({ size, color, sad, index }: { size: number; color: string; sad: boolean; index: number }) {
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 2200 + index * 240, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 2200 + index * 240, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sway, index]);
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: sad ? ["20deg", "26deg"] : ["-6deg", "6deg"] });

  const w = size;
  const h = size * 1.7;
  const cx = w / 2;
  const cy = h * 0.32;
  const petal = sad ? "#9aa7a0" : color;
  const center = sad ? "#c7cdbf" : "#ffe27a";
  const stem = sad ? "#6f8a6f" : "#3f9d52";

  return (
    <Animated.View style={{ transform: [{ rotate }], opacity: sad ? 0.9 : 1 }}>
      <Svg width={w} height={h}>
        <Path d={`M${cx},${cy} C ${cx - 4},${h * 0.6} ${cx + 5},${h * 0.8} ${cx},${h}`} stroke={stem} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Ellipse cx={cx - 7} cy={h * 0.66} rx={6} ry={3.2} fill={stem} transform={`rotate(-28 ${cx} ${h * 0.66})`} />
        {Array.from({ length: 5 }).map((_, petalIndex) => (
          <Ellipse
            key={petalIndex}
            cx={cx}
            cy={cy - size * 0.26}
            rx={size * 0.15}
            ry={size * 0.25}
            fill={petal}
            transform={`rotate(${petalIndex * 72} ${cx} ${cy})`}
          />
        ))}
        <Circle cx={cx} cy={cy} r={size * 0.14} fill={center} />
      </Svg>
    </Animated.View>
  );
}

function Cloud({ width, top, delay, sceneWidth, dark }: { width: number; top: number; delay: number; sceneWidth: number; dark: boolean }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 19000, delay, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [drift, delay]);
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-width - 20, sceneWidth + 20] });
  const h = width * 0.62;
  const fill = dark ? "#6f808f" : "#ffffff";
  return (
    <Animated.View style={{ position: "absolute", top, transform: [{ translateX }], opacity: dark ? 0.95 : 0.96 }}>
      <Svg width={width} height={h}>
        <Path
          d={`M ${width * 0.16},${h * 0.78} C ${width * 0.02},${h * 0.78} ${width * 0.02},${h * 0.42} ${width * 0.2},${h * 0.44} C ${width * 0.24},${h * 0.18} ${width * 0.52},${h * 0.16} ${width * 0.56},${h * 0.44} C ${width * 0.74},${h * 0.28} ${width * 0.96},${h * 0.46} ${width * 0.86},${h * 0.74} C ${width * 0.86},${h * 0.86} ${width * 0.3},${h * 0.9} ${width * 0.16},${h * 0.78} Z`}
          fill={fill}
        />
      </Svg>
    </Animated.View>
  );
}

function Butterfly({ sceneWidth, sceneHeight, delay, tone }: { sceneWidth: number; sceneHeight: number; delay: number; tone: string }) {
  const fly = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(fly, { toValue: 1, duration: 9000, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(flap, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [fly, flap, delay]);
  const translateX = fly.interpolate({ inputRange: [0, 1], outputRange: [sceneWidth * 0.12, sceneWidth * 0.8] });
  const translateY = fly.interpolate({ inputRange: [0, 0.5, 1], outputRange: [sceneHeight * 0.4, sceneHeight * 0.2, sceneHeight * 0.38] });
  const wing = flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  return (
    <Animated.View style={{ position: "absolute", transform: [{ translateX }, { translateY }] }}>
      <Animated.View style={{ transform: [{ scaleX: wing }] }}>
        <Svg width={20} height={16}>
          <Ellipse cx={6} cy={5} rx={5.5} ry={4.2} fill={tone} />
          <Ellipse cx={6} cy={11} rx={4.6} ry={3.6} fill={tone} opacity={0.85} />
          <Ellipse cx={14} cy={5} rx={5.5} ry={4.2} fill={tone} />
          <Ellipse cx={14} cy={11} rx={4.6} ry={3.6} fill={tone} opacity={0.85} />
          <Rect x={9.2} y={3} width={1.6} height={11} rx={0.8} fill="#3a2c2c" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function RainStreak({ left, delay, sceneHeight }: { left: number; delay: number; sceneHeight: number }) {
  const fall = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(fall, { toValue: 1, duration: 850, delay, easing: Easing.in(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [fall, delay]);
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-14, sceneHeight] });
  const opacity = fall.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.65, 0.65, 0] });
  return <Animated.View style={{ position: "absolute", left, top: 0, width: 2, height: 13, borderRadius: 2, backgroundColor: "#c3d8e8", transform: [{ translateY }], opacity }} />;
}

function Lightning() {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(3400),
        Animated.timing(flash, { toValue: 0.5, duration: 70, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.35, duration: 55, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "#eaf2ff", opacity: flash }]} />;
}

function SunGlow({ height, sunny }: { height: number; sunny: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  if (!sunny) return null;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.05] });
  return (
    <Animated.View style={{ position: "absolute", top: height * 0.04, right: height * 0.06, transform: [{ scale }] }}>
      <Svg width={height * 0.7} height={height * 0.7}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="40%" stopColor="#fff6cf" stopOpacity={0.9} />
            <Stop offset="100%" stopColor="#fff6cf" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={height * 0.35} cy={height * 0.35} r={height * 0.34} fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}

export function GardenView({ mood, bloomCount, height, width = 330 }: { mood: GardenMood; bloomCount: number; height: number; width?: number }) {
  const theme = THEMES[mood];
  const sunny = mood !== "storm";
  const sad = mood === "storm";
  const VB_W = 330;
  const VB_H = 185;
  const flowerSize = Math.max(16, height * 0.22);
  const flowerCount = Math.min(Math.max(bloomCount, 4), 7);

  return (
    <View style={[styles.scene, { height }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.skyTop} />
            <Stop offset="55%" stopColor={theme.skyMid} />
            <Stop offset="100%" stopColor={theme.skyLow} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#sky)" />
        {sunny ? <Circle cx={262} cy={52} r={24} fill={theme.sun} /> : null}
        <Path d={`M0,118 Q90,92 180,112 T330,104 L330,185 L0,185 Z`} fill={theme.hillBack} />
        <Path d={`M0,140 Q100,118 200,136 T330,128 L330,185 L0,185 Z`} fill={theme.hillMid} />
        <Path d={`M0,162 Q110,144 220,160 T330,150 L330,185 L0,185 Z`} fill={theme.hillFront} />
      </Svg>

      <SunGlow height={height} sunny={sunny} />
      <Cloud width={height * 0.46} top={height * 0.1} delay={0} sceneWidth={width} dark={sad} />
      <Cloud width={height * 0.34} top={height * 0.3} delay={8000} sceneWidth={width} dark={sad} />

      {sad ? Array.from({ length: 12 }).map((_, index) => <RainStreak key={index} left={(width / 12) * index + 8} delay={index * 70} sceneHeight={height} />) : null}

      {mood === "thriving" ? (
        <>
          <Butterfly sceneWidth={width} sceneHeight={height} delay={0} tone="#ff9ecb" />
          <Butterfly sceneWidth={width} sceneHeight={height} delay={4200} tone="#ffd24d" />
        </>
      ) : null}

      <View style={styles.flowerRow}>
        {Array.from({ length: flowerCount }).map((_, index) => (
          <Flower key={index} size={flowerSize} color={PETALS[index % PETALS.length]} sad={sad} index={index} />
        ))}
      </View>

      {sad ? <Lightning /> : null}
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
  flowerRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingHorizontal: 14,
  },
});
