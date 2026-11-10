// Tema Yuika mobile — selaras studio (canvas #1a1a1a, surface #212121,
// aksen #007cf7). Semua layar remote memakai token ini. Font global Nunito
// (assets/fonts, mockup 2025-11) — weight dipetakan lewat F di komponen Txt.
export const C = {
  canvas: "#1a1a1a",
  surface: "#212121",
  inset: "#101010",
  line: "#2e2e2e",
  text: "#f5f5f5",
  dim: "#9e9e9e",
  faint: "#616161",
  accent: "#007cf7",
  accentSoft: "#0d2b4d",
  ok: "#3ddc84",
  warn: "#e6a23c",
  danger: "#ff5c5c",
  dangerSoft: "#2a1a1a",
  code: "#141414",
  monoBg: "#171717",
};

export const R = {
  card: 14,
  chip: 999,
  input: 10,
  bubble: 14,
};

/** Nunito per weight (dipakai komponen Txt — jangan hard-code fontFamily). */
export const F: Record<string, string> = {
  "400": "Nunito-Regular",
  normal: "Nunito-Regular",
  "500": "Nunito-SemiBold",
  "600": "Nunito-SemiBold",
  "700": "Nunito-Bold",
  bold: "Nunito-Bold",
  "800": "Nunito-ExtraBold",
};
