// Renderer markdown ringan untuk bubble chat mobile — tanpa dependensi baru.
// Cakupan: heading, bullet/numbered list, fenced code, inline code, bold,
// italic, link (buka via Linking), blockquote, hr, paragraf.
import React from "react";
import { Linking, View } from "react-native";

import { Txt } from "../ui";
import { C, R } from "../theme";

// ── inline: **bold** *italic* `code` [t](url) ─────────────────────────
type InlineTok =
  | { t: "text"; v: string }
  | { t: "bold"; v: string }
  | { t: "italic"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; v: string; url: string };

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)\s]+\))/g;

export function tokenizeInline(src: string): InlineTok[] {
  const out: InlineTok[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: "text", v: src.slice(last, i) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ t: "bold", v: tok.slice(2, -2) });
    else if (tok.startsWith("`")) out.push({ t: "code", v: tok.slice(1, -1) });
    else if (tok.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (mm) out.push({ t: "link", v: mm[1], url: mm[2] });
      else out.push({ t: "text", v: tok });
    } else out.push({ t: "italic", v: tok.slice(1, -1) });
    last = i + tok.length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

export function InlineText({ src, dim = false }: { src: string; dim?: boolean }) {
  const toks = React.useMemo(() => tokenizeInline(src), [src]);
  return (
    <Txt style={{ color: dim ? C.dim : C.text, fontSize: 14, lineHeight: 20 }}>
      {toks.map((tk, i) => {
        if (tk.t === "bold") return <Txt key={i} style={{ fontWeight: "700", color: C.text }}>{tk.v}</Txt>;
        if (tk.t === "italic") return <Txt key={i} style={{ fontStyle: "italic" }}>{tk.v}</Txt>;
        if (tk.t === "code")
          return (
            <Txt
              key={i}
              style={{ fontFamily: "monospace", fontSize: 12.5, color: "#8ec4ff", backgroundColor: C.code, borderRadius: 4, overflow: "hidden", paddingHorizontal: 4 }}
            >
              {tk.v}
            </Txt>
          );
        if (tk.t === "link")
          return (
            <Txt key={i} style={{ color: C.accent, textDecorationLine: "underline" }} onPress={() => void Linking.openURL(tk.url).catch(() => undefined)}>
              {tk.v}
            </Txt>
          );
        return <Txt key={i}>{tk.v}</Txt>;
      })}
    </Txt>
  );
}

// ── blok ───────────────────────────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <View style={{ backgroundColor: C.monoBg, borderRadius: R.bubble, borderWidth: 1, borderColor: C.line, padding: 10, marginVertical: 6 }}>
      {lang ? <Txt style={{ color: C.faint, fontSize: 11, marginBottom: 4, fontFamily: "monospace" }}>{lang}</Txt> : null}
      <Txt style={{ color: "#d7e3f4", fontSize: 12.5, lineHeight: 18, fontFamily: "monospace" }} selectable>
        {code}
      </Txt>
    </View>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return (
    <View style={{ gap: 2 }}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "code":
            return <CodeBlock key={i} code={b.code} lang={b.lang} />;
          case "h":
            return (
              <Txt key={i} style={{ color: C.text, fontSize: b.level >= 3 ? 14.5 : 16.5, fontWeight: "700", marginTop: 6 }}>
                {b.v}
              </Txt>
            );
          case "li":
            return (
              <View key={i} style={{ flexDirection: "row", paddingLeft: 8, paddingVertical: 1.5 }}>
                <Txt style={{ color: C.dim, fontSize: 14, width: 16 }}>{b.ordered ? `${b.n}.` : "•"}</Txt>
                <View style={{ flex: 1 }}>
                  <InlineText src={b.v} />
                </View>
              </View>
            );
          case "quote":
            return (
              <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 10, marginVertical: 4 }}>
                <InlineText src={b.v} dim />
              </View>
            );
          case "hr":
            return <View key={i} style={{ height: 1, backgroundColor: C.line, marginVertical: 8 }} />;
          default:
            return (
              <View key={i} style={{ paddingVertical: 1 }}>
                <InlineText src={b.v} />
              </View>
            );
        }
      })}
    </View>
  );
}

type Block =
  | { t: "p"; v: string }
  | { t: "h"; v: string; level: number }
  | { t: "li"; v: string; ordered: boolean; n: number }
  | { t: "quote"; v: string }
  | { t: "hr" }
  | { t: "code"; code: string; lang?: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let code: string[] | null = null;
  let codeLang: string | undefined;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push({ t: "p", v: para.join("\n").trim() });
      para = [];
    }
  };

  let liNum = 0;
  let liOrdered = false;
  const flushLi = () => {
    if (liNum > 0) liNum = 0;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (code !== null) {
      if (/^```/.test(line.trim())) {
        out.push({ t: "code", code: code.join("\n"), lang: codeLang });
        code = null;
        codeLang = undefined;
      } else code.push(raw);
      continue;
    }
    if (/^```/.test(line.trim())) {
      flushPara();
      flushLi();
      code = [];
      codeLang = /^```\w+/.exec(line.trim())?.[0]?.slice(3) || undefined;
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      flushLi();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushLi();
      out.push({ t: "h", v: h[2], level: h[1].length });
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      flushLi();
      out.push({ t: "hr" });
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      flushLi();
      out.push({ t: "quote", v: q[1] });
      continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      if (ul) {
        if (liOrdered) { liOrdered = false; liNum = 0; }
        liNum += 1;
        out.push({ t: "li", v: ul[1], ordered: false, n: liNum });
      } else {
        if (!liOrdered) { liOrdered = true; liNum = 0; }
        liNum = parseInt(ol![1], 10);
        out.push({ t: "li", v: ol![2], ordered: true, n: liNum });
      }
      continue;
    }
    flushLi();
    para.push(line);
  }
  if (code !== null) out.push({ t: "code", code: code.join("\n"), lang: codeLang });
  flushPara();
  return out;
}
