// Missions (mission control mini, MOB-5): pantau delegasi LINTAS project
// dari satu layar. Sumber data: list_projects → project.team per project
// (delegations), lalu live patch via event `delegation.update` (sessionless
// broadcast dari host, relay v1.2). Cron host-side belum ada (P2 cron v1
// backlog) — layar ini delegations-only dulu.
import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { Bar } from "../components/Skeleton";
import { Mascot } from "../components/Mascot";
import { personaMeta } from "../personas";
import { useRemote, type StackEntry } from "../remote/RemoteProvider";
import type { DelegationJob, ProjectSummary, RemoteEvent } from "../relay";
import { C } from "../theme";
import { Card, Chip, EmptyState, Txt } from "../ui";

const MAX_PROJECTS = 10; // muat team per project — jaga payload tetap ramping

interface MissionItem {
  projectId: string;
  projectName: string;
  job: DelegationJob;
}

const TONE: Record<string, "dim" | "accent" | "ok" | "warn" | "danger"> = {
  running: "accent",
  done: "ok",
  error: "danger",
  interrupted: "warn",
};

const rel = (at: number): string => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export function MissionsScreen() {
  const { rs, push, subscribe } = useRemote();
  const [items, setItems] = useState<MissionItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(): Promise<void> {
    const e = await rs.request<{ ev: "projects.list"; projects: ProjectSummary[] }>("list_projects");
    const out: MissionItem[] = [];
    for (const p of e.projects.slice(0, MAX_PROJECTS)) {
      const t = await rs
        .request<{ ev: "project.team"; delegations: DelegationJob[] }>("project.team", { projectId: p.project.id })
        .catch(() => null);
      if (!t) continue;
      for (const job of t.delegations) out.push({ projectId: p.project.id, projectName: p.project.name, job });
    }
    // running dulu (terbaru), lalu selesai terbaru
    out.sort((a, b) => {
      const rank = (j: DelegationJob): number => (j.status === "running" ? 0 : 1);
      return rank(a.job) - rank(b.job) || b.job.createdAt - a.job.createdAt;
    });
    setItems(out);
  }

  useEffect(() => {
    void load().catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rs]);

  // live patch: delegation.update sessionless — status berubah tanpa reload.
  useEffect(
    () =>
      subscribe((ev: RemoteEvent) => {
        if (ev.ev !== "delegation.update") return;
        setItems((prev) => {
          if (!prev) return prev;
          const next = prev.map((it) =>
            it.job.childSessionId === ev.jobId
              ? {
                  ...it,
                  job: {
                    ...it.job,
                    status: ev.state === "started" || ev.state === "progress" ? "running" : ev.state === "done" ? "done" : ev.state === "paused" ? "interrupted" : it.job.status,
                  },
                }
              : it,
          );
          return next;
        });
        // done/error selesai → muat summary final (ringan, sekali per event).
        if (ev.state === "done") void load().catch(() => undefined);
      }),
    [subscribe],
  );

  const running = (items ?? []).filter((i) => i.job.status === "running");
  const finished = (items ?? []).filter((i) => i.job.status !== "running").slice(0, 8);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load()
              .catch(() => undefined)
              .finally(() => setRefreshing(false));
          }}
          tintColor={C.accent}
        />
      }
    >
      {items === null ? <MissionsSkeleton /> : null}
      {items !== null && running.length === 0 && finished.length === 0 ? (
        <EmptyState
          title="No missions yet"
          body="Delegations started on this host appear here, across all projects."
        />
      ) : null}

      {running.length > 0 ? (
        <Txt style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>
          Running now
        </Txt>
      ) : null}
      {running.map((it) => (
        <MissionCard key={it.job.id} item={it} push={push} />
      ))}

      {finished.length > 0 ? (
        <Txt style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 8 }}>
          Recently finished
        </Txt>
      ) : null}
      {finished.map((it) => (
        <MissionCard key={it.job.id} item={it} push={push} />
      ))}
    </ScrollView>
  );
}

function MissionCard({ item, push }: { item: MissionItem; push: (e: StackEntry) => void }) {
  const { job } = item;
  const meta = personaMeta(job.personaId);
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mascot personaId={job.personaId} size={34} />
        <View style={{ flex: 1 }}>
          <Txt style={{ color: C.text, fontSize: 13.5, fontWeight: "600" }} numberOfLines={2}>
            {job.goal}
          </Txt>
          <Txt style={{ color: C.faint, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            {item.projectName} · {meta.name} · {rel(job.createdAt)}
          </Txt>
        </View>
        <Chip label={job.status} tone={TONE[job.status] ?? "dim"} />
      </View>
      {job.summary ? (
        <Txt style={{ color: C.dim, fontSize: 12, marginTop: 8, lineHeight: 17 }} numberOfLines={3}>
          {job.summary}
        </Txt>
      ) : null}
      {job.error ? (
        <Txt style={{ color: C.danger, fontSize: 12, marginTop: 8 }} numberOfLines={3}>
          {job.error}
        </Txt>
      ) : null}
      {job.status === "running" && job.childSessionId ? (
        <Txt
          onPress={() => push({ v: "chat", sessionId: job.childSessionId, personaId: job.personaId, title: `Delegation: ${job.goal}` })}
          style={{ color: C.accent, fontSize: 12.5, fontWeight: "700", marginTop: 8 }}
        >
          Open live session →
        </Txt>
      ) : null}
    </Card>
  );
}

function MissionsSkeleton() {
  return (
    <>
      <Bar w="38%" h={10} />
      <Card style={{ gap: 8 }}>
        <Bar w="72%" h={13} />
        <Bar w="46%" h={9} />
      </Card>
      <Card style={{ gap: 8 }}>
        <Bar w="60%" h={13} />
        <Bar w="38%" h={9} />
      </Card>
      <Bar w="46%" h={10} />
      <Card style={{ gap: 8 }}>
        <Bar w="80%" h={13} />
        <Bar w="52%" h={9} />
      </Card>
    </>
  );
}
