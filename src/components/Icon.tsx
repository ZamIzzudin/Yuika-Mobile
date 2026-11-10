// Icon system Lucide-style — digenerate dari sprite design/mockup-current.html
// (stroke currentColor, 24x24). Ukuran default 20px (card/row), 16px chevron.
import React from "react";
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";

import { C } from "../theme";

const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, React.ReactNode> = {
  "monitor": (
    <>
      <Rect x={2} y={3} width={20} height={14} rx={2} {...P} />
      <Path d="M8 21h8M12 17v4" {...P} />
    </>
  ),
  "globe": (
    <>
      <Circle cx={12} cy={12} r={10} {...P} />
      <Path d="M2 12h20" {...P} />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {...P} />
    </>
  ),
  "wrench": (
    <>
      <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" {...P} />
    </>
  ),
  "check": (
    <>
      <Path d="M20 6 9 17l-5-5" {...P} />
    </>
  ),
  "x": (
    <>
      <Path d="M18 6 6 18M6 6l12 12" {...P} />
    </>
  ),
  "arrow-r": (
    <>
      <Path d="M5 12h14M12 5l7 7-7 7" {...P} />
    </>
  ),
  "alert": (
    <>
      <Circle cx={12} cy={12} r={10} {...P} />
      <Path d="M12 8v4M12 16h.01" {...P} />
    </>
  ),
  "triangle": (
    <>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" {...P} />
      <Path d="M12 9v4M12 17h.01" {...P} />
    </>
  ),
  "info": (
    <>
      <Circle cx={12} cy={12} r={10} {...P} />
      <Path d="M12 16v-4M12 8h.01" {...P} />
    </>
  ),
  "check-c": (
    <>
      <Circle cx={12} cy={12} r={10} {...P} />
      <Path d="m9 12 2 2 4-4" {...P} />
    </>
  ),
  "chev-r": (
    <>
      <Path d="m9 18 6-6-6-6" {...P} />
    </>
  ),
  "chev-d": (
    <>
      <Path d="m6 9 6 6 6-6" {...P} />
    </>
  ),
  "chev-l": (
    <>
      <Path d="m15 18-6-6 6-6" {...P} />
    </>
  ),
  "folder": (
    <>
      <Path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" {...P} />
    </>
  ),
  "plus": (
    <>
      <Path d="M5 12h14M12 5v14" {...P} />
    </>
  ),
  "grid": (
    <>
      <Rect x={3} y={3} width={7} height={7} rx={1} {...P} />
      <Rect x={14} y={3} width={7} height={7} rx={1} {...P} />
      <Rect x={14} y={14} width={7} height={7} rx={1} {...P} />
      <Rect x={3} y={14} width={7} height={7} rx={1} {...P} />
    </>
  ),
  "message": (
    <>
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...P} />
    </>
  ),
  "list": (
    <>
      <Path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" {...P} />
    </>
  ),
  "users": (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...P} />
      <Circle cx={9} cy={7} r={4} {...P} />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...P} />
    </>
  ),
  "activity": (
    <>
      <Path d="M22 12h-4l-3 9L9 3l-3 9H2" {...P} />
    </>
  ),
  "terminal": (
    <>
      <Path d="m4 17 6-6-6-6M12 19h8" {...P} />
    </>
  ),
  "plug": (
    <>
      <Path d="M12 22v-5" {...P} />
      <Path d="M9 8V2" {...P} />
      <Path d="M15 8V2" {...P} />
      <Path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" {...P} />
    </>
  ),
  "shield": (
    <>
      <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" {...P} />
    </>
  ),
  "send": (
    <>
      <Path d="m22 2-7 20-4-9-9-4Z" {...P} />
      <Path d="M22 2 11 13" {...P} />
    </>
  ),
  "file": (
    <>
      <Path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" {...P} />
      <Polyline points="14 2 14 8 20 8" {...P} />
    </>
  ),
  "file-code": (
    <>
      <Path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" {...P} />
      <Polyline points="14 2 14 8 20 8" {...P} />
      <Polyline points="10 13 8 15 10 17" {...P} />
      <Polyline points="14 13 16 15 14 17" {...P} />
    </>
  ),
  "file-text": (
    <>
      <Path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" {...P} />
      <Polyline points="14 2 14 8 20 8" {...P} />
      <Line  {...P} />
      <Line  {...P} />
      <Line  {...P} />
    </>
  ),
  "gear": (
    <>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" {...P} />
      <Circle cx={12} cy={12} r={3} {...P} />
    </>
  ),
};

export type IconName = "monitor" | "globe" | "wrench" | "check" | "x" | "arrow-r" | "alert" | "triangle" | "info" | "check-c" | "chev-r" | "chev-d" | "chev-l" | "folder" | "plus" | "grid" | "message" | "list" | "users" | "activity" | "terminal" | "plug" | "shield" | "send" | "file" | "file-code" | "file-text" | "gear";

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" color={color ?? C.text}>
      {ICONS[name]}
    </Svg>
  );
}
