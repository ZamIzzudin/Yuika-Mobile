// Chat sesi remote: bubble markdown utk assistant (tool/log TIDAK jadi bubble),
// auto-scroll saat dekat bawah, header persona (maskot + display name),
// Stop saat running. Snapshot via request; delta/done via bus event.
//
// Performa: snapshot penuh disimpan di state, tapi FlatList hanya merender
// WINDOW terakhir (default 8 bubble) — transcript panjang tidak merender
// ratusan Markdown sekaligus. Scroll ke atas memuat batch sebelumnya
// (+16) dengan offset dipertahankan. Bubble kosong (tool/thinking tanpa
// teks) difilter — tidak ada bubble blank.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";

import { Icon } from "../components/Icon";
import { Markdown } from "../components/Markdown";
import { Mascot } from "../components/Mascot";
import { Bar } from "../components/Skeleton";
import { personaMeta } from "../personas";
import { useRemote } from "../remote/RemoteProvider";
import { nextRid, type RemoteEvent, type TranscriptMsg } from "../relay";
import { C, R } from "../theme";
import { Chip, Txt } from "../ui";

interface Bubble {
  key: string;
  role: "user" | "assistant" | "error";
  personaId?: string;
  text: string;
  at: number;
}

const WINDOW_FIRST = 8; // bubble yang dirender pertama kali
const WINDOW_STEP = 16; // batch tambahan saat scroll ke atas

export function SessionChat({
  sessionId,
  personaId,
  title,
}: {
  sessionId: string;
  personaId: string;
  title: string;
}) {
  const { rs, subscribe } = useRemote();
  const meta = personaMeta(personaId);
  const [all, setAll] = useState<Bubble[] | null>(null);
  const [window_, setWindow] = useState(WINDOW_FIRST);
  const [streaming, setStreaming] = useState("");
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Bubble> | null>(null);
  const nearBottom = useRef(true);
  // load-earlier: simpan metrik sebelum batch baru agar offset dipertahankan
  const restoring = useRef(false);
  const prevMetrics = useRef<{ offset: number; height: number } | null>(null);

  // snapshot awal (request ber-rid → reply session.snapshot).
  useEffect(() => {
    let alive = true;
    void rs
      .request("subscribe", { sessions: [sessionId] })
      .then(() => undefined)
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
      void rs.sendAction({ proto: 1, act: "unsubscribe", rid: nextRid(), sessions: [sessionId] });
    };
  }, [rs, sessionId]);

  // bus event: snapshot / delta / done / error utk sesi ini.
  useEffect(
    () =>
      subscribe((ev: RemoteEvent) => {
        if ("sessionId" in ev && ev.sessionId !== sessionId) return;
        switch (ev.ev) {
          case "session.snapshot":
            setAll(
              ev.messages
                .filter(
                  (m): m is TranscriptMsg & { role: "user" | "assistant" } =>
                    (m.role === "user" || m.role === "assistant") && m.text.trim().length > 0,
                )
                .map((m, i) => ({ key: `h-${i}`, role: m.role, personaId: m.personaId, text: m.text, at: m.at })),
            );
            setWindow(WINDOW_FIRST);
            setStreaming("");
            setRunning(false);
            break;
          case "message.delta":
            setStreaming((s) => s + ev.delta);
            setRunning(true);
            break;
          case "message.done": {
            setRunning(false);
            if (ev.finish === "error") {
              setAll((b) => [
                ...(b ?? []),
                { key: `e-${ev.seq}`, role: "error", text: "Turn failed. The host reported an error; try again.", at: Date.now() },
              ]);
              setStreaming("");
              break;
            }
            setStreaming((s) => {
              if (s.trim().length > 0) {
                setAll((b) => [...(b ?? []), { key: `a-${ev.seq}`, role: "assistant", personaId, text: s, at: Date.now() }]);
                return "";
              }
              return s;
            });
            break;
          }
          default:
            break;
        }
      }),
    [subscribe, sessionId, personaId],
  );

  function sendPrompt(): void {
    const msg = draft.trim();
    if (!msg || running) return;
    setDraft("");
    setAll((b) => [...(b ?? []), { key: `u-${Date.now()}`, role: "user", text: msg, at: Date.now() }]);
    setRunning(true);
    void rs.sendAction({ proto: 1, act: "send_prompt", rid: nextRid(), sessionId, message: msg });
  }

  function stop(): void {
    void rs.sendAction({ proto: 1, act: "cancel", rid: nextRid(), sessionId });
  }

  const data = useMemo(() => {
    if (all === null) return [];
    return all.slice(Math.max(0, all.length - window_));
  }, [all, window_]);

  const hiddenCount = all === null ? 0 : Math.max(0, all.length - window_);

  if (all === null && !loadError) {
    // skeleton bubbles (mockup: loading state chat) — bukan label polos.
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
          <Mascot personaId={personaId} size={40} />
          <View style={{ flex: 1 }}>
            <Txt style={{ color: C.text, fontSize: 15.5, fontWeight: "700" }} numberOfLines={1}>
              {title || meta.name}
            </Txt>
            <Txt style={{ color: C.dim, fontSize: 12 }}>{meta.name}</Txt>
          </View>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
          <View style={{ alignSelf: "flex-end", maxWidth: "70%", gap: 6 }}>
            <Bar w="86%" h={12} radius={8} style={{ alignSelf: "flex-end" }} />
            <Bar w="54%" h={12} radius={8} style={{ alignSelf: "flex-end" }} />
          </View>
          <View style={{ alignSelf: "flex-start", maxWidth: "80%", gap: 6 }}>
            <Bar w="92%" h={12} radius={8} />
            <Bar w="76%" h={12} radius={8} />
            <Bar w="40%" h={12} radius={8} />
          </View>
          <View style={{ alignSelf: "flex-end", maxWidth: "60%", gap: 6 }}>
            <Bar w="70%" h={12} radius={8} style={{ alignSelf: "flex-end" }} />
          </View>
          <View style={{ alignSelf: "flex-start", maxWidth: "85%", gap: 6 }}>
            <Bar w="88%" h={12} radius={8} />
            <Bar w="62%" h={12} radius={8} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        <Mascot personaId={personaId} size={40} />
        <View style={{ flex: 1 }}>
          <Txt style={{ color: C.text, fontSize: 15.5, fontWeight: "700" }} numberOfLines={1}>
            {title || meta.name}
          </Txt>
          <Txt style={{ color: C.dim, fontSize: 12 }}>{meta.name}</Txt>
        </View>
        {running ? (
          <Pressable
            onPress={stop}
            hitSlop={8}
            style={{ borderColor: C.danger, borderWidth: 1, borderRadius: R.chip, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Txt style={{ color: C.danger, fontSize: 12.5, fontWeight: "700" }}>Stop</Txt>
          </Pressable>
        ) : null}
      </View>

      {loadError ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Chip label={loadError} tone="danger" />
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        data={data}
        keyExtractor={(b) => b.key}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
          // dekat atas & masih ada history → muat batch sebelumnya
          if (
            !restoring.current &&
            contentOffset.y < 48 &&
            hiddenCount > 0
          ) {
            restoring.current = true;
            prevMetrics.current = { offset: contentOffset.y, height: contentSize.height };
            setWindow((w) => w + WINDOW_STEP);
          }
        }}
        scrollEventThrottle={120}
        onContentSizeChange={(w, h) => {
          if (restoring.current && prevMetrics.current) {
            // pertahankan posisi baca: geser offset sebesar tinggi batch baru
            const delta = h - prevMetrics.current.height;
            listRef.current?.scrollToOffset({
              offset: Math.max(0, prevMetrics.current.offset + delta),
              animated: false,
            });
            restoring.current = false;
            prevMetrics.current = null;
            return;
          }
          if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false });
        }}
        ListHeaderComponent={
          hiddenCount > 0 ? (
            <Txt style={{ color: C.faint, fontSize: 11, textAlign: "center", paddingVertical: 6 }}>
              {hiddenCount} earlier message{hiddenCount === 1 ? "" : "s"} — scroll up to load
            </Txt>
          ) : undefined
        }
        renderItem={({ item }) =>
          item.role === "error" ? (
            <View
              style={{
                alignSelf: "center",
                backgroundColor: C.dangerSoft,
                borderColor: "#5c2a2a",
                borderWidth: 1,
                borderRadius: R.chip,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Txt style={{ color: C.danger, fontSize: 11.5 }}>{item.text}</Txt>
            </View>
          ) : item.role === "user" ? (
            <View style={{ backgroundColor: C.accent, alignSelf: "flex-end", borderRadius: R.bubble, paddingHorizontal: 13, paddingVertical: 9, maxWidth: "86%" }}>
              <Txt style={{ color: "#fff", fontSize: 14, lineHeight: 19 }}>{item.text}</Txt>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: C.surface,
                borderColor: C.line,
                borderWidth: 1,
                alignSelf: "flex-start",
                borderRadius: R.bubble,
                paddingHorizontal: 13,
                paddingVertical: 9,
                maxWidth: "92%",
              }}
            >
              <Markdown text={item.text} />
            </View>
          )
        }
        ListFooterComponent={
          running ? (
            <View
              style={{
                backgroundColor: C.surface,
                borderColor: C.line,
                borderWidth: 1,
                alignSelf: "flex-start",
                borderRadius: R.bubble,
                paddingHorizontal: 13,
                paddingVertical: 9,
                maxWidth: "92%",
              }}
            >
              <Markdown text={streaming || "…"} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Txt style={{ color: C.dim, fontSize: 12.5, textAlign: "center", maxWidth: 260 }}>
              No Messages Yet
            </Txt>
          </View>
        }
      />

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopColor: C.line, borderTopWidth: 1 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={C.faint}
          multiline
          style={{
            flex: 1,
            color: C.text,
            backgroundColor: C.surface,
            borderColor: C.line,
            borderWidth: 1,
            borderRadius: R.bubble,
            paddingHorizontal: 12,
            paddingVertical: 9,
            fontSize: 14,
            maxHeight: 110,
          }}
        />
        <Pressable
          onPress={sendPrompt}
          disabled={!draft.trim() || running}
          hitSlop={6}
          style={{
            backgroundColor: C.accent,
            borderRadius: R.bubble,
            width: 38,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
            opacity: !draft.trim() || running ? 0.45 : 1,
          }}
        >
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// TranscriptMsg dipakai tipe helper.
export type { TranscriptMsg };
