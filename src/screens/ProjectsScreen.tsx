// Tab Projects: daftar project host + ringkasan misi (task stats, delegasi
// aktif, sesi terakhir). Skeleton saat fetch, pull-to-refresh.
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { useRemote } from "../remote/RemoteProvider";
import type { ProjectSummary } from "../relay";
import { RelayError } from "../relay";
import { SkeletonList } from "../components/Skeleton";
import { personaMeta } from "../personas";
import { C, R } from "../theme";
import { Card, Chip, EmptyState, ErrorBox } from "../ui";

function relative(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ProjectsScreen() {
  const { rs, subscribe } = useRemote();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const ev = await rs.request<{ ev: "projects.list"; projects: ProjectSummary[] }>("list_projects");
      setProjects(ev.projects);
      setError(null);
    } catch (e) {
      setError(e instanceof RelayError ? e.message : "Failed to load projects");
    }
  }, [rs]);

  useEffect(() => {
    void load();
    // host.state ulang (reconnect) → refresh otomatis
    return subscribe((e) => {
      if (e.ev === "host.state") void load();
    });
  }, [load, subscribe]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const done = projects !== null;
  const total = projects?.reduce((a, p) => a + p.taskStats.todo + p.taskStats.doing + p.taskStats.review + p.taskStats.done, 0) ?? 0;

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
      data={projects ?? []}
      keyExtractor={(p) => p.project.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.accent} />}
      ListHeaderComponent={
        <>
          {error ? <ErrorBox msg={error} /> : null}
          {done && projects.length > 0 ? (
            <Text style={{ color: C.dim, fontSize: 12.5 }}>
              {projects.length} project{projects.length === 1 ? "" : "s"} · {total} task{total === 1 ? "" : "s"} on this host
            </Text>
          ) : null}
        </>
      }
      renderItem={({ item }) => <ProjectCard p={item} />}
      ListEmptyComponent={
        !done ? (
          <SkeletonList rows={3} />
        ) : (
          <EmptyState
            title="No projects yet"
            body="Projects created on this host appear here. Open the studio or desktop app to start one."
          />
        )
      }
    />
  );
}

function ProjectCard({ p }: { p: ProjectSummary }) {
  const { push } = useRemote();
  const t = p.taskStats;
  const lastSession = p.sessions[0];
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15.5, fontWeight: "700" }} numberOfLines={1}>
            {p.project.name}
          </Text>
          {p.project.description ? (
            <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {p.project.description}
            </Text>
          ) : null}
        </View>
        {p.activeDelegations > 0 ? <Chip label={`${p.activeDelegations} running`} tone="accent" solid /> : null}
      </View>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {t.doing > 0 ? <Chip label={`${t.doing} doing`} tone="accent" /> : null}
        {t.review > 0 ? <Chip label={`${t.review} review`} tone="warn" /> : null}
        <Chip label={`${t.todo} todo`} />
        <Chip label={`${t.done} done`} tone="ok" />
      </View>

      {lastSession ? (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopColor: C.line, borderTopWidth: 1 }}>
          <Text style={{ color: C.faint, fontSize: 11 }}>
            Last: {lastSession.title || personaMeta(lastSession.personaId).name} · {relative(lastSession.updatedAt)}
          </Text>
        </View>
      ) : null}

      <Text
        onPress={() => push({ v: "project", projectId: p.project.id, name: p.project.name })}
        style={{ color: C.accent, fontSize: 13, fontWeight: "700", marginTop: 12 }}
      >
        Open mission control →
      </Text>
    </Card>
  );
}
