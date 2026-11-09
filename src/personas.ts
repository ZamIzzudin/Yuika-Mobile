// Meta persona untuk remote mobile: display name resmi (PERSONA_ALIAS studio)
// + identitas visual maskot (bentuk geometri + warna). ID teknis tidak berubah;
// persona kustom fallback "Yui <Short>" + bentuk default.
export type MascotShape =
  | "diamond"
  | "pentagon"
  | "crescent"
  | "circle"
  | "triangle"
  | "hexagon"
  | "star"
  | "square"
  | "ring";

export interface PersonaMeta {
  name: string;
  shape: MascotShape;
  color: string;
}

export const PERSONA_META: Record<string, PersonaMeta> = {
  "yui-conductor": { name: "Maestro Yui", shape: "diamond", color: "#f0b429" },
  "yui-planner": { name: "Rommel Yui", shape: "pentagon", color: "#e05252" },
  "yui-analyst": { name: "Nighty Yui", shape: "crescent", color: "#7b61ff" },
  "yui-scholar": { name: "Pierre Yui", shape: "circle", color: "#4f9cf9" },
  "yui-scribe": { name: "Poe Yui", shape: "triangle", color: "#38bdf8" },
  "yui-coder": { name: "Hiro Yui", shape: "hexagon", color: "#22c55e" },
  "yui-designer": { name: "Picasso Yui", shape: "star", color: "#ec4899" },
  "yui-operator": { name: "Neo Yui", shape: "square", color: "#94a3b8" },
  "yui-sherlock": { name: "Watson Yui", shape: "ring", color: "#d97706" },
};

export function personaMeta(id: string | null | undefined): PersonaMeta {
  if (id && PERSONA_META[id]) return PERSONA_META[id];
  const short = (id ?? "yui").replace(/^yui-/, "");
  return {
    name: `Yui ${short.charAt(0).toUpperCase()}${short.slice(1)}`,
    shape: "circle",
    color: "#6b7280",
  };
}
