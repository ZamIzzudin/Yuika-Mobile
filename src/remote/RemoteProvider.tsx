// Kerangka remote mobile: satu RemoteSession (E2E) + navigasi stack +
// overlay approvals. Semua layar turun lewat RemoteCtx (request RPC + bus
// event). Project-oriented: tab Projects / Screens / Settings.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import type { DeviceKeys } from "../crypto";
import type { HostEntry } from "../relay";
import { RemoteSession, nextRid, type RemoteConnState, type RemoteEvent } from "../relay";
import { C } from "../theme";
import { Btn, Card, Chip } from "../ui";
import { ProjectsScreen } from "../screens/ProjectsScreen";
import { ProjectScreen } from "../screens/ProjectScreen";
import { SessionChat } from "../screens/SessionChat";
import { ScreenView } from "../screens/ScreenView";
import { ScreensScreen } from "../screens/ScreensScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { FileViewer } from "../screens/FileViewer";

export type StackEntry =
  | { v: "project"; projectId: string; name: string }
  | { v: "chat"; sessionId: string; personaId: string; title: string }
  | { v: "screen"; key: string; personaId: string | null; title: string | null }
  | { v: "file"; projectId: string; relPath: string };

export interface RemoteApi {
  rs: RemoteSession;
  conn: { state: RemoteConnState; detail?: string };
  host: HostEntry;
  subscribe(fn: (e: RemoteEvent) => void): () => void;
  push(e: StackEntry): void;
  pop(): void;
}

const RemoteCtx = createContext<RemoteApi | null>(null);

export function useRemote(): RemoteApi {
  const ctx = useContext(RemoteCtx);
  if (!ctx) throw new Error("useRemote outside RemoteProvider");
  return ctx;
}

interface Approval {
  approvalId: string;
  title: string;
  summary: string;
  risk: "low" | "medium" | "high";
}

type Tab = "projects" | "screens" | "settings";

export function RemoteProvider({
  relayUrl,
  device,
  host,
  onGone,
}: {
  relayUrl: string;
  device: DeviceKeys;
  host: HostEntry;
  onGone: () => void;
}) {
  const [conn, setConn] = useState<{ state: RemoteConnState; detail?: string }>({ state: "connecting" });
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [tab, setTab] = useState<Tab>("projects");
  const listeners = useRef(new Set<(e: RemoteEvent) => void>());
  const subscribe = useCallback((fn: (e: RemoteEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  // RemoteSession dibuat sekali per host (konstruksi murni; connect di efek).
  const rs = useMemo(
    () =>
      new RemoteSession({
        relayUrl,
        device,
        hostId: host.deviceId,
        onState: (state, detail) => {
          setConn({ state, detail });
          if (state === "logged-out") {
            Alert.alert("Device unlinked", "This device was unlinked from the portal account. Sign in again to continue.", [
              { text: "OK", onPress: onGone },
            ]);
          }
        },
        onEvent: (ev) => {
          for (const fn of listeners.current) fn(ev);
          if (ev.ev === "approval.request") {
            setApprovals((prev) => [
              { approvalId: ev.approvalId, title: ev.title, summary: ev.summary, risk: ev.risk },
              ...prev.filter((a) => a.approvalId !== ev.approvalId),
            ]);
          } else if (ev.ev === "approval.resolved") {
            setApprovals((prev) => prev.filter((a) => a.approvalId !== ev.approvalId));
          } else if (ev.ev === "reset.acked") {
            setStack([]);
            Alert.alert("Reset acknowledged", "The host is wiping data and restarting. It will reconnect when ready.");
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [host.deviceId],
  );

  useEffect(() => {
    rs.connect();
    return () => {
      rs.close();
      listeners.current.clear();
    };
  }, [rs]);

  const push = useCallback((e: StackEntry) => setStack((s) => [...s, e]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  const api = useMemo<RemoteApi>(() => ({ rs, conn, host, subscribe, push, pop }), [rs, conn, host, subscribe, push, pop]);

  function resolveApproval(id: string, ok: boolean): void {
    void rs.sendAction({ proto: 1, act: ok ? "approve" : "reject", rid: nextRid(), approvalId: id });
    setApprovals((prev) => prev.filter((a) => a.approvalId !== id));
  }

  const top = stack[stack.length - 1];
  let body: React.ReactNode;
  if (top) {
    switch (top.v) {
      case "project":
        body = <ProjectScreen key={top.projectId} projectId={top.projectId} projectName={top.name} />;
        break;
      case "chat":
        body = (
          <SessionChat key={top.sessionId} sessionId={top.sessionId} personaId={top.personaId} title={top.title} />
        );
        break;
      case "screen":
        body = <ScreenView key={top.key} screenKey={top.key} personaId={top.personaId} fallbackTitle={top.title} />;
        break;
      case "file":
        body = <FileViewer projectId={top.projectId} relPath={top.relPath} />;
        break;
    }
  } else if (tab === "projects") body = <ProjectsScreen />;
  else if (tab === "screens") body = <ScreensScreen />;
  else body = <SettingsScreen />;

  const statusText = (() => {
    switch (conn.state) {
      case "connecting":
        return "Connecting";
      case "joined":
        return "Live";
      case "host-offline":
        return "Host offline";
      case "reconnecting":
        return "Reconnecting";
      case "gone":
        return conn.detail ?? "Host is not reachable";
      case "logged-out":
        return "Signed out on host";
    }
  })();

  return (
    <RemoteCtx.Provider value={api}>
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingTop: 14,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
        >
          {stack.length > 0 ? (
            <Pressable
              onPress={pop}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: C.surface,
                borderColor: C.line,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: C.text, fontSize: 20, lineHeight: 24, marginTop: -2 }}>‹</Text>
            </Pressable>
          ) : null}
          <Text style={{ color: C.text, fontSize: 17, fontWeight: "700", flex: 1 }} numberOfLines={1}>
            {host.name}
          </Text>
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor:
                conn.state === "joined" ? C.ok : conn.state === "gone" || conn.state === "logged-out" ? C.danger : C.warn,
            }}
          />
          <Text style={{ color: C.dim, fontSize: 12.5 }}>{statusText}</Text>
        </View>

        <View style={{ flex: 1 }}>{body}</View>

        {approvals.length > 0 ? (
          <View style={{ maxHeight: 300, paddingHorizontal: 16, paddingBottom: 6 }}>
            {approvals.slice(0, 2).map((a) => (
              <Card key={a.approvalId} style={{ marginBottom: 8, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Chip label={a.risk} tone={a.risk === "high" ? "danger" : a.risk === "medium" ? "warn" : "dim"} />
                </View>
                <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18 }} numberOfLines={4}>
                  {a.summary}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn label="Reject" tone="dim" outline small onPress={() => resolveApproval(a.approvalId, false)} />
                  <View style={{ flex: 1 }}>
                    <Btn label="Approve" small onPress={() => resolveApproval(a.approvalId, true)} />
                  </View>
                </View>
              </Card>
            ))}
            {approvals.length > 2 ? (
              <Text style={{ color: C.faint, fontSize: 11.5, textAlign: "center" }}>
                +{approvals.length - 2} more waiting
              </Text>
            ) : null}
          </View>
        ) : null}

        {stack.length === 0 ? (
          <View
            style={{
              flexDirection: "row",
              borderTopColor: C.line,
              borderTopWidth: 1,
              backgroundColor: C.surface,
              paddingBottom: 18,
              paddingTop: 8,
            }}
          >
            {(
              [
                ["projects", "Projects"],
                ["screens", "Screens"],
                ["settings", "Settings"],
              ] as Array<[Tab, string]>
            ).map(([t, label]) => {
              const active = tab === t;
              return (
                <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
                  <Text style={{ color: active ? C.accent : C.dim, fontSize: 12.5, fontWeight: active ? "700" : "500" }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </RemoteCtx.Provider>
  );
}
