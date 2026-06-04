import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

export type MascotMood = "thriving" | "calm" | "storm";

const LOOKS = {
  thriving: { body: "#48b59e", bodyDark: "#3a9c87", belly: "#cdeee5", cheeks: true },
  calm: { body: "#6f9fd6", bodyDark: "#5d8bc2", belly: "#dbe8f6", cheeks: false },
  storm: { body: "#8b97a1", bodyDark: "#74808a", belly: "#cdd4da", cheeks: false },
};

const INK = "#26323a";
const CAP = "#2b3742";
const GOLD = "#e0b341";

// A friendly study buddy that reacts to your streak: bright and beaming when you're
// consistent, sleepy and gloomy (with a rain cloud) when you let the streak slip.
export function Mascot({ mood, size = 90 }: { mood: MascotMood; size?: number }) {
  const look = LOOKS[mood];
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = mood === "thriving" ? 1100 : mood === "calm" ? 1900 : 2600;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, mood]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, mood === "thriving" ? -5 : -2.5] });

  return (
    <Animated.View style={{ width: size, height: size * 1.12, transform: [{ translateY }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 112">
        {/* storm rain cloud */}
        {mood === "storm" ? (
          <G opacity={0.9}>
            <Ellipse cx={50} cy={15} rx={17} ry={8} fill="#6f7d88" />
            <Ellipse cx={39} cy={17} rx={9} ry={7} fill="#6f7d88" />
            <Ellipse cx={61} cy={17} rx={9} ry={7} fill="#6f7d88" />
            <Path d="M42,24 L40,30" stroke="#aebfcb" strokeWidth={2} strokeLinecap="round" />
            <Path d="M58,24 L56,30" stroke="#aebfcb" strokeWidth={2} strokeLinecap="round" />
          </G>
        ) : null}

        {/* graduation cap (tilts when gloomy) */}
        <G transform={mood === "storm" ? "rotate(-13 50 36)" : "rotate(0 50 36)"}>
          <Path d="M30,35 L50,28 L70,35 L50,42 Z" fill={CAP} />
          <Path d="M43,38 L43,46 Q50,50 57,46 L57,38" fill={CAP} />
          <Path d="M68,35 L70,47" stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={70} cy={48} r={2.4} fill={GOLD} />
        </G>

        {/* body */}
        <Ellipse cx={50} cy={70} rx={30} ry={31} fill={look.body} />
        <Ellipse cx={28} cy={96} rx={8} ry={6} fill={look.bodyDark} />
        <Ellipse cx={72} cy={96} rx={8} ry={6} fill={look.bodyDark} />
        <Ellipse cx={50} cy={76} rx={18} ry={20} fill={look.belly} />

        {/* cheeks */}
        {look.cheeks ? (
          <>
            <Circle cx={33} cy={72} r={4} fill="#ff9db0" opacity={0.75} />
            <Circle cx={67} cy={72} r={4} fill="#ff9db0" opacity={0.75} />
          </>
        ) : null}

        {/* eyes */}
        {mood === "storm" ? (
          <>
            <Path d="M34,62 Q40,58 46,62" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <Path d="M54,62 Q60,58 66,62" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <Circle cx={40} cy={62} r={6.5} fill="#ffffff" />
            <Circle cx={60} cy={62} r={6.5} fill="#ffffff" />
            <Circle cx={41} cy={63} r={3.4} fill={INK} />
            <Circle cx={61} cy={63} r={3.4} fill={INK} />
            <Circle cx={39.3} cy={60.6} r={1.4} fill="#ffffff" />
            <Circle cx={59.3} cy={60.6} r={1.4} fill="#ffffff" />
          </>
        )}

        {/* mouth */}
        {mood === "thriving" ? (
          <Path d="M42,80 Q50,89 58,80" stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        ) : mood === "calm" ? (
          <Path d="M45,82 L55,82" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        ) : (
          <Path d="M43,84 Q50,78 57,84" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        )}
      </Svg>
    </Animated.View>
  );
}

export function MascotBlock({ mood, size }: { mood: MascotMood; size?: number }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Mascot mood={mood} size={size} />
    </View>
  );
}
