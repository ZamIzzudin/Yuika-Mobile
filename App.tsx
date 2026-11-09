import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DEFAULT_PORTAL, loginWithPortal, PortalError } from "./src/portal";
import {
  listHosts,
  nextRid,
  RelayError,
  RemoteSession,
  type HostEntry,
  type RemoteConnState,
  type RemoteEvent,
  type SessionInfo,
  type TranscriptMsg,
} from "./src/relay";
import {
  clearSession,
  loadSession,
  saveSession,
  type Session,
} from "./src/store";

// Tema Yuika dark (canvas #1a1a1a, surface #212121, aksen #007cf7).
const C = {
  canvas: "#1a1a1a",
  surface: "#212121",
  inset: "#101010",
  line: "#2e2e2e",
  text: "#f5f5f5",
  dim: "#9e9e9e",
  faint: "#616161",
  accent: "#007cf7",
  warn: "#e6a23c",
  danger: "#ff5c5c",
};

type Screen =
  | { name: "boot" }
  | { name: "login" }
  | { name: "hosts"; session: Session }
  | { name: "remote"; session: Session; host: HostEntry };

const KIND_ICON: Record<string, string> = {
  desktop: "🖥",
  web: "🌐",
  mobile: "📱",
};

function relative(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "boot" });
  const [portalUrl, setPortalUrl] = useState(DEFAULT_PORTAL);
  const [signingIn, setSigningIn] = useState(false);
  const [hosts, setHosts] = useState<HostEntry[] | null>(null);
  const [hostsError, setHostsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await loadSession();
      setScreen(s ? { name: "hosts", session: s } : { name: "login" });
    })();
  }, []);

  const refresh = useCallback(async (session: Session) => {
    setRefreshing(true);
    setHostsError(null);
    try {
      setHosts(await listHosts(session.relayUrl, session.device));
    } catch (e) {
      setHostsError(e instanceof RelayError ? e.message : "relay error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const session = screen.name === "hosts" ? screen.session : null;
  useEffect(() => {
    if (screen.name === "hosts" && screen.session) void refresh(screen.session);
  }, [screen, refresh]);

  async function signIn(): Promise<void> {
    setSigningIn(true);
    try {
      const existing = (await loadSession())?.device; // kunci stabil → idempotent
      const r = await loginWithPortal(
        portalUrl.trim() || DEFAULT_PORTAL,
        existing,
      );
      const session: Session = {
        portalUrl: portalUrl.trim() || DEFAULT_PORTAL,
        relayUrl: r.relayUrl,
        accountId: r.accountId,
        email: r.email,
        device: r.device,
      };
      await saveSession(session);
      setHosts(null);
      setScreen({ name: "hosts", session });
    } catch (e) {
      const msg = e instanceof PortalError ? e.message : "sign-in failed";
      Alert.alert("Sign in", msg);
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut(): Promise<void> {
    await clearSession();
    setHosts(null);
    setScreen({ name: "login" });
  }

  if (screen.name === "boot") {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <Image
          source={require("./assets/logo.png")}
          style={styles.logoBoot}
          resizeMode="contain"
        />
        <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (screen.name === "login") {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <Image
          source={require("./assets/logo.png")}
          style={styles.logoLogin}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Studio Persona for Agentic AI</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in with the Yuika portal</Text>
          <Text style={styles.cardBody}>
            Your phone becomes a remote for every host signed in with this
            account: deployed studios and desktop hosts appear here.
          </Text>
          <Text style={styles.label}>Portal URL</Text>
          <TextInput
            value={portalUrl}
            onChangeText={setPortalUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://yuika.notu.dev"
            placeholderTextColor={C.faint}
            style={styles.input}
          />
          <Pressable
            style={[styles.button, signingIn && styles.buttonDisabled]}
            disabled={signingIn}
            onPress={() => void signIn()}
          >
            {signingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue to portal</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (screen.name === "remote") {
    return (
      <RemoteScreen
        key={screen.host.deviceId}
        session={screen.session}
        host={screen.host}
        onBack={() => {
          setHosts(null); // paksa refresh daftar host saat kembali
          setScreen({ name: "hosts", session: screen.session });
        }}
        onLoggedOut={() => void signOut()}
      />
    );
  }

  // hosts
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Image
          source={require("./assets/logo.png")}
          style={styles.logoHeader}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Hosts</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {session?.email}
          </Text>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      {hostsError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{hostsError}</Text>
        </View>
      )}
      <FlatList
        contentContainerStyle={styles.list}
        data={hosts ?? []}
        keyExtractor={(h) => h.deviceId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (session) void refresh(session);
            }}
            tintColor={C.accent}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              setScreen({ name: "remote", session: screen.session, host: item })
            }
          >
            <Text style={styles.rowIcon}>{KIND_ICON[item.kind] ?? "🔌"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.kind} · seen {relative(item.lastSeen)}
              </Text>
            </View>
            <Text style={styles.rowOpen}>Open</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          refreshing ? undefined : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No hosts online</Text>
              <Text style={styles.emptyBody}>
                Sign in to a Yuika studio or desktop host with this account and
                it will appear here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ── Remote control screen (B8) ──────────────────────────────────────────────

interface Approval {
  approvalId: string;
  title: string;
  summary: string;
  risk: "low" | "medium" | "high";
  sessionId?: string;
}

interface SessionTranscript {
  messages: TranscriptMsg[];
  streaming: string;
  running: boolean;
}

function RemoteScreen({
  session,
  host,
  onBack,
  onLoggedOut,
}: {
  session: Session;
  host: HostEntry;
  onBack: () => void;
  onLoggedOut: () => void;
}) {
  const [conn, setConn] = useState<{ state: RemoteConnState; detail?: string }>(
    { state: "connecting" },
  );
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [transcripts, setTranscripts] = useState<
    Record<string, SessionTranscript>
  >({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const sessRef = useRef<RemoteSession | null>(null);
  const listRef = useRef<FlatList<TranscriptMsg> | null>(null);

  const send = useCallback(
    (action: Parameters<RemoteSession["sendAction"]>[0]) => {
      void sessRef.current?.sendAction(action);
    },
    [],
  );

  useEffect(() => {
    const rs = new RemoteSession({
      relayUrl: session.relayUrl,
      device: session.device,
      hostId: host.deviceId,
      onState: (state, detail) => {
        setConn({ state, detail });
        if (state === "logged-out") {
          Alert.alert(
            "Device unlinked",
            "This device was unlinked from the portal account. Sign in again to continue.",
            [{ text: "OK", onPress: onLoggedOut }],
          );
        }
      },
      onEvent: (ev: RemoteEvent) => {
        setTranscripts((prev) => {
          const next = { ...prev };
          switch (ev.ev) {
            case "message.delta": {
              const t = next[ev.sessionId];
              if (t)
                next[ev.sessionId] = {
                  ...t,
                  streaming: t.streaming + ev.delta,
                  running: true,
                };
              break;
            }
            case "message.done": {
              const t = next[ev.sessionId];
              if (!t) break;
              const finished: TranscriptMsg[] =
                t.streaming.length > 0
                  ? [
                      ...t.messages,
                      { role: "assistant", text: t.streaming, at: Date.now() },
                    ]
                  : t.messages;
              next[ev.sessionId] = {
                messages: ev.finish === "error" ? finished : finished,
                streaming: "",
                running:
                  ev.finish !== "stop" && ev.finish !== "cancelled"
                    ? false
                    : false,
              };
              break;
            }
            default:
              break;
          }
          return next;
        });
        switch (ev.ev) {
          case "host.state":
            setSessions(ev.sessions);
            break;
          case "session.list":
            setSessions(ev.sessions);
            break;
          case "session.snapshot":
            setTranscripts((prev) => ({
              ...prev,
              [ev.sessionId]: {
                messages: ev.messages,
                streaming: "",
                running: false,
              },
            }));
            break;
          case "approval.request":
            setApprovals((prev) => [
              {
                approvalId: ev.approvalId,
                title: ev.title,
                summary: ev.summary,
                risk: ev.risk,
                sessionId: ev.sessionId,
              },
              ...prev.filter((a) => a.approvalId !== ev.approvalId),
            ]);
            break;
          case "approval.resolved":
            setApprovals((prev) =>
              prev.filter((a) => a.approvalId !== ev.approvalId),
            );
            break;
          default:
            break;
        }
      },
    });
    sessRef.current = rs;
    rs.connect();
    return () => {
      rs.close();
      sessRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host.deviceId]);

  const openSession = useMemo(
    () => sessions.find((s) => s.sessionId === openId) ?? null,
    [sessions, openId],
  );
  const transcript = openId ? transcripts[openId] : undefined;

  function openTalk(s: SessionInfo): void {
    setOpenId(s.sessionId);
    if (!transcripts[s.sessionId]) {
      setTranscripts((prev) => ({
        ...prev,
        [s.sessionId]: { messages: [], streaming: "", running: false },
      }));
      send({
        proto: 1,
        act: "subscribe",
        rid: nextRid(),
        sessions: [s.sessionId],
      });
    }
  }

  function closeTalk(): void {
    if (openId)
      send({
        proto: 1,
        act: "unsubscribe",
        rid: nextRid(),
        sessions: [openId],
      });
    setOpenId(null);
    setDraft("");
  }

  function sendPrompt(): void {
    const msg = draft.trim();
    if (!msg || !openId) return;
    setDraft("");
    setTranscripts((prev) => ({
      ...prev,
      [openId]: {
        ...prev[openId]!,
        messages: [
          ...prev[openId]!.messages,
          { role: "user", text: msg, at: Date.now() },
        ],
        running: true,
      },
    }));
    send({
      proto: 1,
      act: "send_prompt",
      rid: nextRid(),
      sessionId: openId,
      message: msg,
    });
  }

  function cancelRun(): void {
    if (!openId) return;
    send({ proto: 1, act: "cancel", rid: nextRid(), sessionId: openId });
  }

  function resolveApproval(id: string, ok: boolean): void {
    send({
      proto: 1,
      act: ok ? "approve" : "reject",
      rid: nextRid(),
      approvalId: id,
    });
    // optimistis; approval.resolved akan menghapus bila balasan datang
    setApprovals((prev) => prev.filter((a) => a.approvalId !== id));
  }

  const statusText = (() => {
    switch (conn.state) {
      case "connecting":
        return "Connecting…";
      case "joined":
        return `Live · ${host.name}`;
      case "host-offline":
        return "Host offline — holding your spot";
      case "reconnecting":
        return conn.detail ? `Reconnecting: ${conn.detail}` : "Reconnecting…";
      case "gone":
        return conn.detail ?? "Host is not reachable";
      case "logged-out":
        return "Device unlinked from the account";
    }
  })();

  if (openId && openSession) {
    const data = transcript ?? { messages: [], streaming: "", running: false };
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar style="light" />
        <View style={styles.header}>
          <Pressable onPress={closeTalk} hitSlop={8} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitleSm} numberOfLines={1}>
              {openSession.title || "Session"}
            </Text>
            <Text style={styles.headerSub}>{openSession.personaId}</Text>
          </View>
          {data.running && (
            <Pressable
              onPress={cancelRun}
              hitSlop={8}
              style={styles.chipDanger}
            >
              <Text style={styles.chipDangerText}>Stop</Text>
            </Pressable>
          )}
        </View>
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 12, gap: 10 }}
          data={data.messages}
          keyExtractor={(m, i) => `${i}-${m.at}`}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.bubbleUser : styles.bubbleAi,
              ]}
            >
              {item.personaId && item.role !== "user" && (
                <Text style={styles.bubblePersona}>{item.personaId}</Text>
              )}
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          )}
          ListFooterComponent={
            data.running ? (
              <View style={[styles.bubble, styles.bubbleAi]}>
                <Text style={styles.bubbleText}>{data.streaming || "…"}</Text>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>
                No transcript yet — send the first message.
              </Text>
            </View>
          }
        />
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message this session…"
            placeholderTextColor={C.faint}
            style={styles.composerInput}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, !draft.trim() && { opacity: 0.5 }]}
            disabled={!draft.trim()}
            onPress={sendPrompt}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitleSm} numberOfLines={1}>
            {host.name}
          </Text>
          <Text style={styles.headerSub}>
            {host.kind} host · {statusText}
          </Text>
        </View>
        <View
          style={[
            styles.dot,
            conn.state === "joined"
              ? styles.dotOk
              : conn.state === "gone" || conn.state === "logged-out"
                ? styles.dotBad
                : styles.dotWait,
          ]}
        />
      </View>

      {conn.state === "gone" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {conn.detail ?? "Host is not reachable."}
          </Text>
        </View>
      )}

      {approvals.length > 0 && (
        <FlatList
          style={{ maxHeight: approvals.length > 1 ? 220 : 132 }}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          data={approvals}
          keyExtractor={(a) => a.approvalId}
          renderItem={({ item }) => (
            <View style={styles.apprCard}>
              <View style={styles.apprHead}>
                <Text style={styles.apprTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.riskChip,
                    item.risk === "high" && styles.riskHigh,
                    item.risk === "medium" && styles.riskMedium,
                    item.risk === "low" && styles.riskLow,
                  ]}
                >
                  {item.risk}
                </Text>
              </View>
              <Text style={styles.apprSummary} numberOfLines={4}>
                {item.summary}
              </Text>
              <View style={styles.apprActions}>
                <Pressable
                  style={styles.apprReject}
                  onPress={() => resolveApproval(item.approvalId, false)}
                >
                  <Text style={styles.apprRejectText}>Reject</Text>
                </Pressable>
                <Pressable
                  style={styles.apprApprove}
                  onPress={() => resolveApproval(item.approvalId, true)}
                >
                  <Text style={styles.apprApproveText}>Approve</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        data={sessions}
        keyExtractor={(s) => s.sessionId}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() =>
              send({ proto: 1, act: "list_sessions", rid: nextRid() })
            }
            tintColor={C.accent}
          />
        }
        renderItem={({ item }) => {
          const t = transcripts[item.sessionId];
          return (
            <Pressable style={styles.row} onPress={() => openTalk(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.title || item.sessionId}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.personaId} · updated {relative(item.updatedAt)}
                </Text>
              </View>
              {t?.running && <View style={styles.liveDot} />}
              <Text style={styles.rowOpen}>Open</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No active sessions</Text>
            <Text style={styles.emptyBody}>
              Sessions running on the host appear here. Approvals arrive live,
              whatever you have open.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas, padding: 20 },
  center: { alignItems: "center", justifyContent: "center" },
  logoBoot: { width: 72, height: 72, borderRadius: 18 },
  logoLogin: { width: 88, height: 88, borderRadius: 22, marginBottom: 6 },
  logoHeader: { width: 34, height: 34, borderRadius: 9, marginRight: 12 },
  tagline: { color: C.dim, fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 36,
    width: "100%",
    maxWidth: 360,
    gap: 10,
  },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: "600" },
  cardBody: { color: C.dim, fontSize: 12.5, lineHeight: 18 },
  label: {
    color: C.dim,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },
  input: {
    color: C.text,
    backgroundColor: C.canvas,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: { color: C.text, fontSize: 24, fontWeight: "700" },
  headerTitleSm: { color: C.text, fontSize: 18, fontWeight: "700" },
  headerSub: { color: C.dim, fontSize: 12.5, marginTop: 2 },
  signOut: { color: C.dim, fontSize: 13 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  backIcon: { color: C.text, fontSize: 20, lineHeight: 24, marginTop: -2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  dotOk: { backgroundColor: "#3ddc84" },
  dotWait: { backgroundColor: C.warn },
  dotBad: { backgroundColor: C.danger },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
    marginRight: 8,
  },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowIcon: { fontSize: 22 },
  rowName: { color: C.text, fontSize: 14.5, fontWeight: "600" },
  rowMeta: { color: C.dim, fontSize: 12, marginTop: 2 },
  rowOpen: { color: C.accent, fontSize: 13, fontWeight: "600" },
  errorBox: {
    backgroundColor: "#2a1a1a",
    borderColor: "#5c2a2a",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorText: { color: C.danger, fontSize: 12.5 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 6 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: "600" },
  emptyBody: {
    color: C.dim,
    fontSize: 12.5,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  // approvals
  apprCard: {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  apprHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  apprTitle: { color: C.text, fontSize: 14, fontWeight: "700", flex: 1 },
  apprSummary: { color: C.dim, fontSize: 12.5, lineHeight: 18 },
  apprActions: { flexDirection: "row", gap: 8, marginTop: 2 },
  apprApprove: {
    flex: 1,
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  apprApproveText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  apprReject: {
    flex: 1,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  apprRejectText: { color: C.dim, fontSize: 13, fontWeight: "600" },
  riskChip: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  riskHigh: { color: C.danger, borderColor: C.danger, borderWidth: 1 },
  riskMedium: { color: C.warn, borderColor: C.warn, borderWidth: 1 },
  riskLow: { color: C.dim, borderColor: C.line, borderWidth: 1 },
  // transcript
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "86%",
    gap: 4,
  },
  bubbleUser: { backgroundColor: C.accent, alignSelf: "flex-end" },
  bubbleAi: {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  bubblePersona: { color: C.faint, fontSize: 10.5 },
  bubbleText: { color: C.text, fontSize: 13.5, lineHeight: 19 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
    borderTopColor: C.line,
    borderTopWidth: 1,
  },
  composerInput: {
    flex: 1,
    color: C.text,
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    maxHeight: 110,
  },
  sendBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  sendText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  chipDanger: {
    borderColor: C.danger,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipDangerText: { color: C.danger, fontSize: 12.5, fontWeight: "700" },
});
