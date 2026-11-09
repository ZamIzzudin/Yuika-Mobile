// Project mission control: tab Chat (sesi) / Tasks / Files / Team / Activity /
// Terminal / Browser — semua via aksi v1.2 ber-rid. Setiap tab fetch saat
// mount + pull-to-refresh; skeleton saat loading.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Mascot } from "../components/Mascot";
import { SkeletonList } from "../components/Skeleton";
import { personaMeta } from "../personas";
import { useRemote } from "../remote/RemoteProvider";
import {
  RelayError,
  type ActivityEntry,
  type DelegationJob,
  type FileNode,
  type PersonaLite,
  type RosterEntry,
  type SessionInfo,
  type TaskNode,
} from "../relay";
import { C } from "../theme";
import { Btn, Card, Chip, EmptyState, ErrorBox, Sheet } from "../ui";

const TABS = ["Chat", "Tasks", "Files", "Team", "Activity", "Terminal", "Browser"] as const;
type Tab = (typeof TABS)[number];

export function ProjectScreen({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [tab, setTab] = useState<Tab>("Chat");
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TABS.map((t) => (
            <Chip key={t} label={t} tone="accent" active={tab === t} onPress={() => setTab(t)} />
          ))}
        </ScrollView>
      </View>
      {tab === "Chat" ? <ChatTab projectId={projectId} /> : null}
      {tab === "Tasks" ? <TasksTab projectId={projectId} /> : null}
      {tab === "Files" ? <FilesTab projectId={projectId} /> : null}
      {tab === "Team" ? <TeamTab projectId={projectId} /> : null}
      {tab === "Activity" ? <ActivityTab projectId={projectId} /> : null}
      {tab === "Terminal" ? <TerminalTab projectId={projectId} /> : null}
      {tab === "Browser" ? <BrowserTab projectId={projectId} /> : null}
      <Text style={{ color: C.faint, fontSize: 11, textAlign: "center", paddingBottom: 8 }}>{projectName}</Text>
    </View>
  );
}

// ── util bersama ────────────────────────────────────────────────────────

function useAsync<T>(run: () => Promise<T>, deps: React.DependencyList): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(e instanceof RelayError ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading: loading && data === null, reload: load };
}

function PullList<T>({
  reload,
  loading,
  children,
}: {
  reload: () => Promise<void>;
  loading: boolean;
  children: React.ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void reload().finally(() => setRefreshing(false));
          }}
          tintColor={C.accent}
        />
      }
    >
      {loading ? <SkeletonList rows={3} /> : children}
    </ScrollView>
  );
}

// ── Chat tab: sesi project + buat sesi baru ─────────────────────────────

function ChatTab({ projectId }: { projectId: string }) {
  const { rs, push, subscribe } = useRemote();
  const [newOpen, setNewOpen] = useState(false);
  const [personas, setPersonas] = useState<PersonaLite[] | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(
    () =>
      rs
        .request<{ ev: "project.sessions"; sessions: SessionInfo[] }>("project.sessions", { projectId })
        .then((e) => e.sessions),
    [projectId],
  );

  // fix #4 (stale): refresh sesi tiap turn selesai di sesi mana pun.
  useEffect(
    () =>
      subscribe((e) => {
        if (e.ev === "message.done") void reload();
      }),
    [subscribe, reload],
  );

  useEffect(() => {
    if (!newOpen || personas) return;
    void rs
      .request<{ ev: "personas.list"; personas: PersonaLite[] }>("personas.list")
      .then((e) => setPersonas(e.personas))
      .catch(() => setPersonas([]));
  }, [newOpen, personas, rs]);

  async function createSession(personaId: string): Promise<void> {
    if (creating) return;
    setCreating(personaId);
    try {
      const ev = await rs.request<{ ev: "session.snapshot" } & { sessionId: string }>(
        "session.create",
        { personaId, projectId },
      );
      setNewOpen(false);
      push({ v: "chat", sessionId: ev.sessionId, personaId, title: personaMeta(personaId).name });
    } catch (e) {
      setCreating(null);
    }
    setCreating(null);
  }

  return (
    <>
      <PullList reload={reload} loading={loading}>
        {error ? <ErrorBox msg={error} /> : null}
        <Btn label="+ New chat" onPress={() => setNewOpen(true)} />
        {(data ?? []).map((s) => (
          <Card key={s.sessionId}>
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              onPress={() =>
                push({ v: "chat", sessionId: s.sessionId, personaId: s.personaId, title: s.title || personaMeta(s.personaId).name })
              }
            >
              <Mascot personaId={s.personaId} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }} numberOfLines={1}>
                  {s.title || personaMeta(s.personaId).name}
                </Text>
                <Text style={{ color: C.dim, fontSize: 12 }}>{personaMeta(s.personaId).name}</Text>
              </View>
              <Text style={{ color: C.faint, fontSize: 11 }}>
                {new Date(s.updatedAt).toLocaleDateString() === new Date().toLocaleDateString()
                  ? new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : new Date(s.updatedAt).toLocaleDateString()}
              </Text>
            </Pressable>
          </Card>
        ))}
        {data && data.length === 0 ? (
          <EmptyState title="No sessions in this project" body="Start a new chat and assign a persona to begin." />
        ) : null}
      </PullList>

      <Sheet visible={newOpen} onClose={() => setNewOpen(false)} title="Start a new chat">
        {personas === null ? (
          <SkeletonList rows={3} />
        ) : (
          personas.map((p) => (
            <Pressable
              key={p.id}
              disabled={creating !== null}
              onPress={() => void createSession(p.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: C.inset,
                borderColor: C.line,
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <Mascot personaId={p.id} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }}>{p.name}</Text>
                <Text style={{ color: C.dim, fontSize: 12 }}>{p.model ?? "default model"}</Text>
              </View>
              <Text style={{ color: creating === p.id ? C.dim : C.accent, fontSize: 12.5, fontWeight: "700" }}>
                {creating === p.id ? "Opening…" : "Start"}
              </Text>
            </Pressable>
          ))
        )}
      </Sheet>
    </>
  );
}

// ── Tasks tab ───────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, "dim" | "accent" | "warn" | "ok"> = {
  todo: "dim",
  doing: "accent",
  review: "warn",
  done: "ok",
};

function TaskRow({ node, depth }: { node: TaskNode; depth: number }) {
  return (
    <View style={{ paddingLeft: depth * 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: C.surface,
          borderColor: C.line,
          borderWidth: 1,
          borderRadius: 10,
          padding: 10,
          marginBottom: 6,
        }}
      >
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor:
              node.status === "done" ? C.ok : node.status === "doing" ? C.accent : node.status === "review" ? C.warn : C.faint,
          }}
        />
        <Text style={{ color: node.status === "done" ? C.dim : C.text, fontSize: 13.5, flex: 1 }} numberOfLines={2}>
          {node.title}
        </Text>
        {node.assignee ? <Mascot personaId={node.assignee} size={20} /> : null}
      </View>
      {node.children.map((c) => (
        <TaskRow key={c.id} node={c} depth={depth + 1} />
      ))}
    </View>
  );
}

function TasksTab({ projectId }: { projectId: string }) {
  const { rs } = useRemote();
  const { data, error, loading, reload } = useAsync(
    () => rs.request<{ ev: "project.tasks"; tree: TaskNode[] }>("project.tasks", { projectId }).then((e) => e.tree),
    [projectId],
  );
  const flatCount = useMemo(() => {
    const n = (t: TaskNode): number => 1 + t.children.reduce((a, c) => a + n(c), 0);
    return (data ?? []).reduce((a, t) => a + n(t), 0);
  }, [data]);
  return (
    <PullList reload={reload} loading={loading}>
      {error ? <ErrorBox msg={error} /> : null}
      {data && data.length > 0 ? <Text style={{ color: C.dim, fontSize: 12.5 }}>{flatCount} tasks</Text> : null}
      {(data ?? []).map((t) => (
        <TaskRow key={t.id} node={t} depth={0} />
      ))}
      {data && data.length === 0 ? <EmptyState title="No task list yet" body="The task tree appears once planning writes tasks." /> : null}
    </PullList>
  );
}

// ── Files tab ───────────────────────────────────────────────────────────

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FileRow({ node, projectId, depth }: { node: FileNode; projectId: string; depth: number }) {
  const { push } = useRemote();
  const [open, setOpen] = useState(depth < 1);
  const children = node.children ?? [];
  return (
    <View>
      <Pressable
        onPress={() => (node.dir ? setOpen(!open) : push({ v: "file", projectId, relPath: node.relPath }))}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: depth * 14,
          paddingVertical: 7,
        }}
      >
        <Text style={{ color: node.dir ? C.warn : C.dim, fontSize: 13, width: 16 }}>
          {node.dir ? (open ? "▾" : "▸") : "·"}
        </Text>
        <Text style={{ color: C.text, fontSize: 13.5, flex: 1, fontFamily: node.dir ? undefined : "monospace" }} numberOfLines={1}>
          {node.name}
        </Text>
        {!node.dir ? <Text style={{ color: C.faint, fontSize: 11 }}>{humanSize(node.size)}</Text> : null}
      </Pressable>
      {open && children.length > 0 ? (
        <View
          style={{
            borderLeftColor: C.line,
            borderLeftWidth: depth === 0 ? 0 : 1,
          }}
        >
          {children.map((c) => (
            <FileRow key={c.relPath} node={c} projectId={projectId} depth={depth + 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FilesTab({ projectId }: { projectId: string }) {
  const { rs } = useRemote();
  const { data, error, loading, reload } = useAsync(
    () => rs.request<{ ev: "project.files"; tree: FileNode[] }>("project.files", { projectId }).then((e) => e.tree),
    [projectId],
  );
  return (
    <PullList reload={reload} loading={loading}>
      {error ? <ErrorBox msg={error} /> : null}
      {(data ?? []).map((n) => (
        <FileRow key={n.relPath} node={n} projectId={projectId} depth={0} />
      ))}
      {data && data.length === 0 ? <EmptyState title="No files yet" body="Artifacts written by the team appear here." /> : null}
    </PullList>
  );
}

// ── Team tab: roster + delegasi ─────────────────────────────────────────

const DELEGATION_TONE: Record<string, "dim" | "accent" | "ok" | "warn" | "danger"> = {
  running: "accent",
  done: "ok",
  error: "danger",
  interrupted: "warn",
};

function TeamTab({ projectId }: { projectId: string }) {
  const { rs, push } = useRemote();
  const { data, error, loading, reload } = useAsync(
    async () => {
      const e = await rs.request<{ ev: "project.team"; roster: RosterEntry[]; delegations: DelegationJob[] }>("project.team", { projectId });
      return { roster: e.roster, delegations: e.delegations };
    },
    [projectId],
  );
  return (
    <PullList reload={reload} loading={loading}>
      {error ? <ErrorBox msg={error} /> : null}
      {data && data.roster.length > 0 ? (
        <>
          <Text style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>Team</Text>
          {data.roster.map((r) => (
            <Card key={r.personaId}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Mascot personaId={r.personaId} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }}>{personaMeta(r.personaId).name}</Text>
                  <Text style={{ color: C.dim, fontSize: 12 }}>{r.role}</Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}
      {data && data.delegations.length > 0 ? (
        <>
          <Text style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 8 }}>
            Delegations
          </Text>
          {data.delegations.map((d) => (
            <Card key={d.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Mascot personaId={d.personaId} size={32} />
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: "600", flex: 1 }} numberOfLines={2}>
                  {d.goal}
                </Text>
                <Chip label={d.status} tone={DELEGATION_TONE[d.status] ?? "dim"} />
              </View>
              {d.summary ? (
                <Text style={{ color: C.dim, fontSize: 12, marginTop: 8, lineHeight: 17 }} numberOfLines={3}>
                  {d.summary}
                </Text>
              ) : null}
              {d.error ? <Text style={{ color: C.danger, fontSize: 12, marginTop: 8 }} numberOfLines={3}>{d.error}</Text> : null}
              {d.status === "running" && d.childSessionId ? (
                <Text
                  onPress={() =>
                    push({ v: "chat", sessionId: d.childSessionId, personaId: d.personaId, title: `Delegation: ${d.goal}` })
                  }
                  style={{ color: C.accent, fontSize: 12.5, fontWeight: "700", marginTop: 8 }}
                >
                  Open live session →
                </Text>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}
      {data && data.roster.length === 0 ? (
        <EmptyState title="No team assigned" body="Personas assigned to this project appear here." />
      ) : null}
    </PullList>
  );
}

// ── Activity tab ────────────────────────────────────────────────────────

const KIND_ICON: Record<string, string> = {
  tool: "⚙",
  delegation: "→",
  approval: "!",
  screen: "▣",
  vault: "◆",
  qa: "✓",
  message: "»",
  task: "✓",
  session: "»",
  file: "·",
};

function ActivityTab({ projectId }: { projectId: string }) {
  const { rs } = useRemote();
  const { data, error, loading, reload } = useAsync(
    () =>
      rs
        .request<{ ev: "project.activity"; entries: ActivityEntry[] }>("project.activity", { projectId, limit: 80 })
        .then((e) => e.entries),
    [projectId],
  );
  return (
    <PullList reload={reload} loading={loading}>
      {error ? <ErrorBox msg={error} /> : null}
      {(data ?? []).map((a, i) => (
        <View
          key={`${a.at}-${i}`}
          style={{
            flexDirection: "row",
            gap: 10,
            backgroundColor: C.surface,
            borderColor: C.line,
            borderWidth: 1,
            borderRadius: 10,
            padding: 11,
          }}
        >
          <Text style={{ color: a.isError ? C.danger : C.faint, fontSize: 14, width: 18 }}>
            {a.isError ? "×" : (KIND_ICON[a.kind] ?? "·")}
          </Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: a.isError ? C.danger : C.text, fontSize: 12.5, lineHeight: 17, fontFamily: "monospace" }}
              numberOfLines={3}
            >
              {a.label}
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 3 }}>
              {a.personaId ? personaMeta(a.personaId).name : a.kind} · {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      ))}
      {data && data.length === 0 ? <EmptyState title="No activity yet" body="Everything the team does in this project is logged here." /> : null}
    </PullList>
  );
}

// ── Terminal tab (shared PTY, detach-only) ──────────────────────────────

function TerminalTab({ projectId }: { projectId: string }) {
  const { rs, subscribe } = useRemote();
  const [attached, setAttached] = useState<{ id: string; replay: string; exited: boolean } | null>(null);
  const [buffer, setBuffer] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);

  async function open(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ev = await rs.request<{ ev: "terminal.state"; id: string; replay: string; info: { exited: boolean } }>(
        "terminal.open",
        { projectId },
      );
      setAttached({ id: ev.id, replay: ev.replay, exited: ev.info.exited });
      setBuffer(ev.replay);
    } catch (e) {
      setError(e instanceof RelayError ? e.message : "Cannot open terminal");
    } finally {
      setBusy(false);
    }
  }

  function detach(): void {
    if (attached) void rs.sendAction({ proto: 1, act: "terminal.close", rid: `tc-${Date.now()}`, id: attached.id });
    setAttached(null);
    setBuffer("");
  }

  useEffect(
    () =>
      subscribe((e) => {
        if (!attached) return;
        if (e.ev === "terminal.output" && e.id === attached.id) {
          setBuffer((b) => (b + e.data).slice(-40_000));
        } else if (e.ev === "terminal.state" && !e.rid && e.id === attached.id && e.info.exited) {
          setAttached((a) => (a ? { ...a, exited: true } : a));
        }
      }),
    [subscribe, attached],
  );

  function sendInput(): void {
    if (!attached || attached.exited || !input) return;
    void rs.sendAction({ proto: 1, act: "terminal.input", id: attached.id, data: input + "\n" });
    setInput("");
  }

  if (!attached) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        {error ? <ErrorBox msg={error} /> : null}
        <Card>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }}>Project terminal</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6, lineHeight: 18 }}>
            Opens a shell at this project workspace on the host. Shared with the studio: detaching on your phone keeps it alive.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Btn label={busy ? "Opening…" : "Open terminal"} onPress={() => void open()} disabled={busy} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Chip label={attached.exited ? "exited" : "live"} tone={attached.exited ? "danger" : "ok"} />
        <Text style={{ color: C.faint, fontSize: 11, flex: 1 }} numberOfLines={1}>
          {attached.id}
        </Text>
        {attached.exited ? (
          <Btn label="Reopen" small outline onPress={() => void open()} />
        ) : (
          <Btn label="Detach" small outline tone="dim" onPress={detach} />
        )}
      </View>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: "#0d0d0d", borderColor: C.line, borderWidth: 1, borderRadius: 10 }}
        contentContainerStyle={{ padding: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Text style={{ color: "#d7e3f4", fontSize: 12, lineHeight: 17, fontFamily: "monospace" }}>{buffer}</Text>
      </ScrollView>
      {!attached.exited ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a command…"
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={{
              flex: 1,
              color: C.text,
              backgroundColor: C.surface,
              borderColor: C.line,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 11,
              paddingVertical: 9,
              fontSize: 13,
              fontFamily: "monospace",
            }}
            onSubmitEditing={sendInput}
            returnKeyType="send"
          />
          <Btn label="Run" small onPress={sendInput} disabled={!input} />
        </View>
      ) : null}
    </View>
  );
}

// (TextInput sudah diimpor di atas.)

// ── Browser tab: screen project ini ─────────────────────────────────────

function BrowserTab({ projectId }: { projectId: string }) {
  const { rs, push } = useRemote();
  const { data, error, loading, reload } = useAsync(
    async () => {
      const e = await rs.request<{ ev: "screens.list"; screens: Array<{ key: string; personaId: string | null; url: string | null; title: string | null; status: string; viewers: number; watchers: number }> }>("list_screens");
      return e.screens.filter((s) => s.key.startsWith(`${projectId}/`));
    },
    [projectId],
  );
  return (
    <PullList reload={reload} loading={loading}>
      {error ? <ErrorBox msg={error} /> : null}
      {(data ?? []).map((s) => (
        <Card key={s.key}>
          <Pressable
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            onPress={() => push({ v: "screen", key: s.key, personaId: s.personaId, title: s.title })}
          >
            <Mascot personaId={s.personaId} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }} numberOfLines={1}>
                {s.title || "Untitled page"}
              </Text>
              <Text style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>
                {s.url || "no url"}
              </Text>
            </View>
            <Chip label={s.status} tone={s.status === "running" ? "ok" : "dim"} />
          </Pressable>
        </Card>
      ))}
      {data && data.length === 0 ? (
        <EmptyState
          title="No live browser screens"
          body="Screens opened by personas in this project stream here. Ask a persona to browse first."
        />
      ) : null}
    </PullList>
  );
}
