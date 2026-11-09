// Maskot persona mobile: bentuk geometri Orin-lite (satu wajah per persona,
// bentuk + warna khas + dua mata). react-native-svg — native module bawaan
// Expo SDK 58 (terinstal via `expo install`), tidak butuh konfigurasi.
import Svg, { Circle, G, Polygon } from "react-native-svg";
import { personaMeta, type MascotShape } from "../personas";

function shapePoints(shape: MascotShape, s: number): string {
  const c = s / 2;
  switch (shape) {
    case "diamond":
      return `${c},3 ${s - 3}, ${c} ${c},${s - 3} 3,${c}`;
    case "pentagon":
      return `${c},3 ${s - 4},${c * 0.38} ${s * 0.8},${s - 5} ${s * 0.2},${s - 5} 4,${c * 0.38}`;
    case "triangle":
      return `${c},4 ${s - 5},${s - 6} 5,${s - 6}`;
    case "hexagon": {
      const q = s * 0.25;
      return `${q},5 ${s - q},5 ${s - 4},${c} ${s - q},${s - 5} ${q},${s - 5} 4,${c}`;
    }
    case "star": {
      const o = 0.5 * s;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s / 2 - 2 : s / 4.6;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push([o + r * Math.cos(a), o + r * Math.sin(a)]);
      }
      return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    }
    case "square":
      return `5,5 ${s - 5},5 ${s - 5},${s - 5} 5,${s - 5}`;
    default:
      return `5,5 ${s - 5},5 ${s - 5},${s - 5} 5,${s - 5}`;
  }
}

export function Mascot({ personaId, size = 36 }: { personaId?: string | null; size?: number }) {
  const meta = personaMeta(personaId);
  const s = size;
  const eyeY = s * 0.44;
  const eyeDX = s * 0.18;
  const eyeR = Math.max(2, s * 0.075);
  const pupilR = Math.max(1, s * 0.035);
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {meta.shape === "circle" && <Circle cx={s / 2} cy={s / 2} r={s / 2 - 2} fill={meta.color} />}
      {meta.shape === "ring" && (
        <Circle cx={s / 2} cy={s / 2} r={s / 2 - 3} fill="none" stroke={meta.color} strokeWidth={Math.max(3, s * 0.12)} />
      )}
      {meta.shape === "crescent" ? (
        <G>
          <Circle cx={s / 2} cy={s / 2} r={s / 2 - 2} fill={meta.color} />
          <Circle cx={s * 0.68} cy={s * 0.36} r={s * 0.34} fill="#1a1a1a" />
        </G>
      ) : (
        meta.shape !== "circle" &&
        meta.shape !== "ring" && <Polygon points={shapePoints(meta.shape, s)} fill={meta.color} />
      )}
      <Circle cx={s / 2 - eyeDX} cy={eyeY} r={eyeR} fill="#ffffff" />
      <Circle cx={s / 2 + eyeDX} cy={eyeY} r={eyeR} fill="#ffffff" />
      <Circle cx={s / 2 - eyeDX} cy={eyeY} r={pupilR} fill="#111111" />
      <Circle cx={s / 2 + eyeDX} cy={eyeY} r={pupilR} fill="#111111" />
    </Svg>
  );
}
