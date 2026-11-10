// Maskot persona mobile — port persis Orin v8 studio (orinShapes.tsx geometri
// + rig, OrinPortrait.tsx paint). Identitas persona = BENTUK (bukan tint):
// 15 bentuk (SHAPE_ORDER), gradient radial terang->warna->bayangan, mata
// kapsul tegak dengan highlight. Idle pose + breathe/blink animated.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";

// ── geometri (koordinat ruang 400x400, pusat 0,0 — persis studio) ────────

interface OrinShape {
  name: string;
  color: string;
  fy: number; // offset vertikal mata
  gs: number; // jarak antar mata (gap scale)
  es: number; // skala mata
  gr: number;
  bodyScale?: number;
  geom: React.ReactNode;
}

const SHAPES: Record<string, OrinShape> = {
  orb: { name: "Ball", color: "#F2620F", fy: 0, gs: 1, es: 1, gr: 1, geom: <Circle r={130} /> },
  cloud: {
    name: "Cloud", color: "#F5A00A", fy: 8, gs: 0.92, es: 0.9, gr: 0.8,
    geom: <Path d="M-105,74C-130,62 -139,37 -128,12C-119,-10 -98,-23 -72,-21C-67,-65 -31,-99 13,-99C57,-99 88,-70 94,-31C126,-27 143,-4 139,27C136,56 115,77 84,80L-82,80C-91,80 -99,78 -105,74Z" />,
  },
  blob: {
    name: "Egg", color: "#2B8CF0", fy: 0, gs: 1, es: 1, gr: 1,
    geom: <Path d="M-122,10C-126,-70 -50,-126 10,-122C80,-117 126,-60 122,10C117,80 60,126 0,123C-70,121 -120,80 -122,10Z" />,
  },
  square: {
    name: "Box", color: "#12D1A0", fy: 0, gs: 1.05, es: 1, gr: 0.9,
    geom: <Path d="M-58,-119C-29,-123 28,-123 58,-119C98,-114 119,-91 121,-53C124,-20 124,22 121,55C118,96 96,117 57,120C23,123 -25,123 -58,120C-98,117 -118,95 -121,56C-124,22 -124,-21 -121,-55C-118,-94 -97,-114 -58,-119Z" />,
  },
  tri: {
    name: "Triangle", color: "#F0278E", fy: 36, gs: 0.78, es: 0.82, gr: 0.6,
    geom: <Path d="M-7,-120C-1,-130 8,-130 15,-119C34,-91 50,-57 72,-17L115,62C132,93 116,116 83,116L-83,116C-116,116 -132,93 -115,62L-72,-17C-50,-57 -28,-93 -7,-120Z" />,
  },
  pill: {
    name: "Capsule", color: "#2BC4D8", fy: 0, gs: 1.22, es: 1, gr: 1.1,
    geom: <G transform="rotate(-6)"><Path d="M-132,-8C-132,-52 -99,-80 -55,-80L57,-80C102,-80 134,-51 134,-8L134,8C134,52 102,80 57,80L-55,80C-99,80 -132,52 -132,8Z" /></G>,
  },
  bean: {
    name: "Bean", color: "#A653C8", fy: -20, gs: 0.95, es: 0.9, gr: 0.8,
    geom: <Path d="M-70,-112C-20,-132 55,-125 88,-80C115,-42 100,-5 72,20C50,40 48,62 62,80C82,105 70,130 35,135C-30,142 -105,100 -118,28C-126,-30 -108,-92 -70,-112Z" />,
  },
  drop: {
    name: "Drop", color: "#FF7662", fy: 30, gs: 0.8, es: 0.85, gr: 0.6,
    geom: <Path d="M0,-132C20,-100 98,-30 108,30C118,92 70,128 0,128C-70,128 -118,92 -108,30C-98,-30 -20,-100 0,-132Z" />,
  },
  star: {
    name: "Star", color: "#8FDB6F", fy: 6, gs: 0.78, es: 0.8, gr: 0.5, bodyScale: 1.18,
    geom: <Path d="M9.3,-94.1L26.4,-53.9Q31.2,-42.9 43.1,-41.8L86.6,-38Q110.3,-35.8 92.3,-20.2L59.5,8.5Q50.4,16.4 53.1,28.1L62.8,70.6Q68.2,93.8 47.7,81.6L10.3,59.2Q0,53 -10.3,59.2L-47.7,81.6Q-68.2,93.8 -62.8,70.6L-53.1,28.1Q-50.4,16.4 -59.5,8.5L-92.3,-20.2Q-110.3,-35.8 -86.6,-38L-43.1,-41.8Q-31.2,-42.9 -26.4,-53.9L-9.3,-94.1Q0,-116 9.3,-94.1Z" />,
  },
  flower: {
    name: "Flower", color: "#C48DEB", fy: 0, gs: 1, es: 1, gr: 0.9,
    geom: <Path d="M0,-126C28,-126 34,-91 50,-76C67,-94 88,-112 108,-94C128,-76 105,-52 94,-32C119,-24 139,-8 132,18C125,43 94,42 73,53C84,78 95,104 72,119C50,134 32,105 12,88C-2,111 -17,136 -42,127C-67,118 -58,87 -60,63C-85,73 -114,84 -127,59C-140,34 -109,17 -90,0C-111,-16 -134,-36 -121,-59C-108,-82 -78,-66 -55,-61C-53,-87 -50,-117 -24,-125C-13,-129 -7,-127 0,-126Z" />,
  },
  hex: {
    name: "Hexagon", color: "#A8D83E", fy: 0, gs: 1, es: 1, gr: 0.85,
    geom: <Path d="M-11,-111C-4,-115 5,-115 12,-111L89,-65C99,-59 105,-48 105,-36L105,36C105,48 99,59 89,65L12,111C5,115 -4,115 -12,111L-89,65C-99,59 -105,48 -105,36L-105,-36C-105,-48 -99,-59 -89,-65Z" />,
  },
  trap: {
    name: "Trapezoid", color: "#E8503A", fy: 8, gs: 0.95, es: 0.95, gr: 0.8,
    geom: <Path d="M-42,-111C-36,-116 -29,-118 -20,-118L20,-118C29,-118 36,-116 42,-111L112,77C122,103 107,119 80,119L-80,119C-107,119 -122,103 -112,77Z" />,
  },
  diamond: {
    name: "Diamond", color: "#3A4FB0", fy: 0, gs: 0.86, es: 0.9, gr: 0.65,
    geom: <Path d="M0,-124C9,-124 17,-118 26,-109L109,-26C129,-6 129,6 109,26L26,109C8,127 -8,127 -26,109L-109,26C-129,6 -129,-6 -109,-26L-26,-109C-17,-118 -9,-124 0,-124Z" />,
  },
  dome: {
    name: "Dome", color: "#E6DC3A", fy: 6, gs: 1.05, es: 0.95, gr: 0.9,
    geom: <Path d="M-125,95C-125,-60 -70,-125 0,-125C70,-125 125,-60 125,95Q125,120 100,120L-100,120Q-125,120 -125,95Z" />,
  },
  tube: {
    name: "Tube", color: "#1F9A9A", fy: -18, gs: 0.82, es: 1, gr: 0.65,
    geom: <Path d="M-73,-73C-73,-112 -49,-132 -12,-132L12,-132C49,-132 73,-112 73,-73L73,74C73,112 49,132 12,132L-12,132C-49,132 -73,112 -73,74Z" />,
  },
};

export const SHAPE_ORDER = ["orb", "cloud", "blob", "square", "tri", "pill", "bean", "drop", "star", "flower", "hex", "trap", "diamond", "dome", "tube"] as const;

/** default studio PERSONA_SHAPE */
const PERSONA_SHAPE: Record<string, string> = {
  "yui-conductor": "orb",
  "yui-scholar": "cloud",
  "yui-scribe": "blob",
  "yui-coder": "square",
  "yui-designer": "tri",
  "yui-analyst": "diamond",
  "yui-operator": "hex",
  "yui-planner": "star",
};

/** override aktif (workspace/persona-shapes.json) + usulan sherlock */
const SHAPE_OVERRIDES: Record<string, string> = {
  "yui-analyst": "diamond",
  "yui-conductor": "flower",
  "yui-planner": "dome",
  "yui-scholar": "bean",
  "yui-scribe": "drop",
  "yui-sherlock": "trap",
};

function shapeFor(personaId?: string | null): OrinShape {
  const key = (personaId && (SHAPE_OVERRIDES[personaId] ?? PERSONA_SHAPE[personaId])) || "orb";
  return SHAPES[key] ?? SHAPES.orb;
}

/** persis orinShapes.tsx: paintBody gradient terang & bayangan */
function mixHex(hex: string, other: string, amount: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(hex);
  const b = p(other);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("");
}

let gidSeq = 0;

export function Mascot({ personaId, size = 36 }: { personaId?: string | null; size?: number }) {
  const sh = shapeFor(personaId);
  const gid = `orin-${++gidSeq}`;

  // breathe: translateY kecil 5.3s loop; blink: scaleY kapsul mata tiap ~5.6s
  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const [eyeScale, setEyeScale] = useState(1);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(5150),
        Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.delay(270),
      ]),
    );
    const id = blink.addListener(({ value }) => setEyeScale(value));
    loop.start();
    blinkLoop.start();
    return () => {
      loop.stop();
      blinkLoop.stop();
      blink.removeListener(id);
    };
  }, [breathe, blink]);

  const cLight = mixHex(sh.color, "#FFFFFF", 0.48);
  const cShade = mixHex(sh.color, "#151728", 0.34);

  const w = 30 * sh.es;
  const h = 68 * sh.es;
  const g = 34 * sh.gs;

  const eye = (dir: number) => (
    <G transform={`translate(${dir * g} 0)`}>
      <G transform={`scale(1 ${eyeScale.toFixed(3)})`}>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w / 2} fill="#11121A" />
        <Circle cx={-w * 0.2} cy={-h * 0.23} r={Math.max(2.7, w * 0.14)} fill="#fff" opacity={0.88} />
        <Circle cx={w * 0.17} cy={-h * 0.12} r={Math.max(1.2, w * 0.055)} fill="#fff" opacity={0.72} />
      </G>
    </G>
  );

  const body = sh.bodyScale && sh.bodyScale !== 1 ? <G transform={`scale(${sh.bodyScale})`}>{sh.geom}</G> : sh.geom;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.012] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 400 400">
        <Defs>
          <RadialGradient id={gid} cx="34%" cy="24%" r="82%">
            <Stop offset="0%" stopColor={cLight} />
            <Stop offset="52%" stopColor={sh.color} />
            <Stop offset="100%" stopColor={cShade} />
          </RadialGradient>
        </Defs>
        <G transform="translate(200 200)">
          <G fill={`url(#${gid})`}>{body}</G>
          <G transform={`translate(0 ${sh.fy})`}>
            {eye(-1)}
            {eye(1)}
          </G>
        </G>
      </Svg>
    </Animated.View>
  );
}
