// Tab Screens (root): semua live browser host, lintas project.
import React from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Mascot } from "../components/Mascot";
import { SkeletonList } from "../components/Skeleton";
import { personaMeta } from "../personas";
import { useRemote } from "../remote/RemoteProvider";
import type { ScreenInfo } from "../relay";
import { C } from "../theme";
import { Card, Chip, EmptyState, Txt, useToast } from "../ui";

export function ScreensScreen() {
  const { rs, push, subscribe } = useRemote();
  const [screens, setScreens] = React.useState<ScreenInfo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const toast = useToast();

  React.useEffect(() => {
    if (error) toast(error, "danger");
  }, [error, toast]);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const e = await rs.request<{ ev: "screens.list"; screens: ScreenInfo[] }>("list_screens");
      setScreens(e.screens);
      setError(null);
    } catch {
      setError("Failed to load screens");
    }
  }, [rs]);

  React.useEffect(() => {
    void load();
    return subscribe((e) => {
      if (e.ev === "host.state") void load();
    });
  }, [load, subscribe]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
          tintColor={C.accent}
        />
      }
    >
      {screens === null ? (
        <SkeletonList rows={2} />
      ) : (
        <>
          {screens.map((s) => {
            const persona = personaMeta(s.personaId);
            const project = s.key.includes("/") ? s.key.split("/")[0] : null;
            return (
              <Card key={s.key}>
                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  onPress={() => push({ v: "screen", key: s.key, personaId: s.personaId, title: s.title })}
                >
                  <Mascot personaId={s.personaId} size={40} />
                  <View style={{ flex: 1 }}>
                    <Txt style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }} numberOfLines={1}>
                      {s.title || "Untitled page"}
                    </Txt>
                    <Txt style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>
                      {persona.name}
                      {project ? ` · ${project}` : ""} · {s.url || "no url"}
                    </Txt>
                  </View>
                  <Chip label={s.status} tone={s.status === "running" ? "ok" : "dim"} />
                </Pressable>
              </Card>
            );
          })}
          {screens.length === 0 ? (
            <EmptyState
              title="No live screens"
              body="When personas browse on the host, their screens stream here for you to watch live."
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
