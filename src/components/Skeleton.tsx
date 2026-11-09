// Skeleton loading state (pulse) untuk semua fetch remote.
import React from "react";
import { Animated, Easing, View } from "react-native";
import { C, R } from "../theme";

function usePulse() {
  const val = React.useRef(new Animated.Value(0.35)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(val, { toValue: 0.35, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [val]);
  return val;
}

export function Bar({ w = "100%", h = 12, radius = 6, style }: { w?: number | `${number}%` | "100%"; h?: number; radius?: number; style?: object }) {
  const opacity = usePulse();
  return <Animated.View style={[{ width: w, height: h, borderRadius: radius, backgroundColor: C.faint, opacity }, style]} />;
}

/** Kartu skeleton generik: beberapa bar dengan lebar bervariasi. */
export function SkeletonCard() {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Bar w={36} h={36} radius={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <Bar w="62%" h={12} />
          <Bar w="38%" h={10} />
        </View>
      </View>
      <Bar w="92%" h={10} />
      <Bar w="74%" h={10} />
    </View>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
