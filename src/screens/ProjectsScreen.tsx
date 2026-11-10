// Tab Projects: daftar project host + ringkasan misi (task stats, delegasi
// aktif, sesi terakhir). Skeleton saat fetch, pull-to-refresh.
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { useRemote } from "../remote/RemoteProvider";
import type { ProjectSummary } from "../relay";
import { RelayError } from "../relay";
import { SkeletonList } from "../components/Skeleton";
import { personaMeta } from "../personas";
import { C, R } from "../theme";
import { Bar } from "../components/Skeleton";
import { Card, Chip, EmptyState, Txt, useToast } from "../ui";

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
  const toast = useToast();

  useEffect(() => {
    if (error) toast(error, "danger");
  }, [error, toast]);

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
              {done && projects.length > 0 ? (
            <Txt style={{ color: C.dim, fontSize: 12.5, textAlign: "center" }}>
              {projects.length} Project{projects.length === 1 ? "" : "s"} with {total} Task{total === 1 ? "" : "s"}
            </Txt>
          ) : null}
        </>
      }
      renderItem={({ item }) => <ProjectCard p={item} />}
      ListEmptyComponent={
        !done ? (
          <>
            <ProjectSkeleton />
            <ProjectSkeleton />
          </>
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
          <Txt style={{ color: C.text, fontSize: 15.5, fontWeight: "700" }} numberOfLines={1}>
            {p.project.name}
          </Txt>
          {p.project.description ? (
            <Txt style={{ color: C.dim, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {p.project.description}
            </Txt>
          ) : null}
        </View>
        {p.activeDelegations > 0 ? <Chip label={`${p.activeDelegations} running`} tone="accent" solid /> : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Stat label="Doing" value={t.doing} tone="accent" />
        <Stat label="Review" value={t.review} tone="warn" />
        <Stat label="Todo" value={t.todo} />
        <Stat label="Done" value={t.done} tone="ok" />
      </View>

      {lastSession ? (
        <Txt style={{ color: C.faint, fontSize: 11, marginTop: 10 }}>Last update {relative(lastSession.updatedAt)}</Txt>
      ) : null}

      <Txt
        onPress={() => push({ v: "project", projectId: p.project.id, name: p.project.name })}
        style={{ color: C.accent, fontSize: 13, fontWeight: "700", marginTop: 12 }}
      >
        Open mission control →
      </Txt>
    </Card>
  );
}

// ── stat kecil (mockup 2.1) ─────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "warn" | "ok" }) {
  const color = tone === "accent" ? C.accent : tone === "warn" ? C.warn : tone === "ok" ? C.ok : C.text;
  return (
    <View style={{ flex: 1, backgroundColor: C.inset, borderRadius: 10, padding: 10 }}>
      <Txt style={{ color: C.faint, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</Txt>
      <Txt style={{ color, fontSize: 14, fontWeight: "700", marginTop: 3 }}>{value}</Txt>
    </View>
  );
}

function ProjectSkeleton() {
  return (
    <Card style={{ gap: 10 }}>
      <Bar w="48%" h={13} />
      <Bar w="80%" h={10} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Bar style={{ flex: 1 }} h={42} radius={10} />
        <Bar style={{ flex: 1 }} h={42} radius={10} />
        <Bar style={{ flex: 1 }} h={42} radius={10} />
        <Bar style={{ flex: 1 }} h={42} radius={10} />
      </View>
      <Bar w="30%" h={9} />
    </Card>
  );
}
