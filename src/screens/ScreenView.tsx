// Live browser viewer: watch_screen (reply screen.state) + stream frame
// (base64 jpeg). Unwatch saat unmount; reconnect host otomatis re-watch.
import React, { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";

import { Mascot } from "../components/Mascot";
import { personaMeta } from "../personas";
import { useRemote } from "../remote/RemoteProvider";
import { nextRid, RelayError, type RemoteEvent } from "../relay";
import { C } from "../theme";
import { Card, Chip, Txt, useToast } from "../ui";

export function ScreenView({
  screenKey,
  personaId,
  fallbackTitle,
}: {
  screenKey: string;
  personaId: string | null;
  fallbackTitle?: string | null;
}) {
  const { rs, subscribe } = useRemote();
  const toast = useToast();
  const [frame, setFrame] = useState<string | null>(null);
  const [state, setState] = useState<{ status: string; title: string | null; url: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watched = useRef(false);

  useEffect(() => {
    // request watch: reply screen.state ber-rid; frame dateng via bus.
    void rs
      .request<{ ev: "screen.state"; status: string; title: string | null; url: string | null }>(
        "watch_screen",
        { key: screenKey },
        15_000,
      )
      .then((e) => {
        watched.current = true;
        setState({ status: e.status, title: e.title, url: e.url });
      })
      .catch((e: Error) => {
        const msg = e instanceof RelayError ? e.message : "Cannot open screen";
        setError(msg);
        toast(msg, "danger");
      });
    return () => {
      void rs.sendAction({ proto: 1, act: "unwatch_screen", rid: nextRid() });
    };
  }, [rs, screenKey]);

  useEffect(
    () =>
      subscribe((ev: RemoteEvent) => {
        if (ev.ev === "screen.frame" && ev.key === screenKey) setFrame(ev.data);
        else if (ev.ev === "screen.state" && !ev.rid && ev.key === screenKey)
          setState({ status: ev.status, title: ev.title, url: ev.url });
      }),
    [subscribe, screenKey],
  );

  const meta = personaMeta(personaId);
  const title = state?.title || fallbackTitle || "Untitled page";

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mascot personaId={personaId} size={36} />
        <View style={{ flex: 1 }}>
          <Txt style={{ color: C.text, fontSize: 14.5, fontWeight: "700" }} numberOfLines={1}>
            {title}
          </Txt>
          <Txt style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>
            {state?.url || "no url"} · {meta.name}
          </Txt>
        </View>
        <Chip label={state?.status ?? "loading"} tone={state?.status === "running" ? "ok" : "dim"} />
      </View>

      <Card style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d0d0d" }}>
        {frame ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${frame}` }}
            style={{ width: "100%", aspectRatio: 16 / 10, borderRadius: 8 }}
            resizeMode="contain"
          />
        ) : (
          <View style={{ alignItems: "center", gap: 8 }}>
            <Txt style={{ color: C.dim, fontSize: 13 }}>{error ? "Screen unavailable" : "Waiting for first frame…"}</Txt>
            <Txt style={{ color: C.faint, fontSize: 11, fontFamily: "monospace" }}>{screenKey}</Txt>
          </View>
        )}
      </Card>

      <Txt style={{ color: C.faint, fontSize: 11, textAlign: "center" }}>
        Live stream refreshes about once per second while the persona browses.
      </Txt>
    </View>
  );
}
