// Chat sesi remote: bubble markdown utk assistant (tool/log TIDAK jadi bubble),
// auto-scroll saat dekat bawah, header persona (maskot + display name),
// Stop saat running. Snapshot via request; delta/done via bus event.
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

export function SessionChat({
  sessionId,
  personaId,
  title,
}: {
  sessionId: string;
  personaId: string;
  title: string;
}) {
  const { rs, subscribe, pop } = useRemote();
  const meta = personaMeta(personaId);
  const [bubbles, setBubbles] = useState<Bubble[] | null>(null);
  const [streaming, setStreaming] = useState("");
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Bubble> | null>(null);
  const nearBottom = useRef(true);

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
            setBubbles(
              ev.messages
                .filter((m): m is TranscriptMsg & { role: "user" | "assistant" } => m.role !== "tool")
                .map((m, i) => ({ key: `h-${i}`, role: m.role, personaId: m.personaId, text: m.text, at: m.at })),
            );
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
              setBubbles((b) => [
                ...(b ?? []),
                { key: `e-${ev.seq}`, role: "error", text: "Turn failed. The host reported an error; try again.", at: Date.now() },
              ]);
              setStreaming("");
              break;
            }
            setStreaming((s) => {
              if (s.trim().length > 0) {
                setBubbles((b) => [...(b ?? []), { key: `a-${ev.seq}`, role: "assistant", personaId, text: s, at: Date.now() }]);
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
    setBubbles((b) => [...(b ?? []), { key: `u-${Date.now()}`, role: "user", text: msg, at: Date.now() }]);
    setRunning(true);
    void rs.sendAction({ proto: 1, act: "send_prompt", rid: nextRid(), sessionId, message: msg });
  }

  function stop(): void {
    void rs.sendAction({ proto: 1, act: "cancel", rid: nextRid(), sessionId });
  }

  const data = useMemo(() => bubbles ?? [], [bubbles]);

  if (bubbles === null && !loadError) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Mascot personaId={personaId} size={42} />
          <View style={{ flex: 1 }}>
            <Txt style={{ color: C.text, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
              {title || meta.name}
            </Txt>
            <Txt style={{ color: C.dim, fontSize: 12.5 }}>{meta.name}</Txt>
          </View>
        </View>
        <Txt style={{ color: C.faint, fontSize: 12.5 }}>Loading transcript…</Txt>
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
        }}
        scrollEventThrottle={120}
        onContentSizeChange={() => {
          if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false });
        }}
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
