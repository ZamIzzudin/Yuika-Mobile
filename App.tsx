// Yuika mobile — remote mission control untuk host studio/desktop.
// Boot → login portal → daftar host → RemoteProvider (Projects/Screens/
// Settings, lihat src/remote/RemoteProvider.tsx).
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { RemoteProvider } from "./src/remote/RemoteProvider";
import { DEFAULT_PORTAL, loginWithPortal, PortalError } from "./src/portal";
import { listHosts, RelayError, type HostEntry } from "./src/relay";
import { clearSession, loadSession, saveSession, type Session } from "./src/store";
import { C } from "./src/theme";

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

type Screen =
  | { name: "boot" }
  | { name: "login" }
  | { name: "hosts"; session: Session }
  | { name: "remote"; session: Session; host: HostEntry };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "boot" });
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
      const r = await loginWithPortal(DEFAULT_PORTAL, existing);
      const session: Session = {
        portalUrl: DEFAULT_PORTAL,
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
        <Image source={require("./assets/logo.png")} style={styles.logoBoot} resizeMode="contain" />
        <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (screen.name === "login") {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <Image source={require("./assets/logo.png")} style={styles.logoLogin} resizeMode="contain" />
        <Text style={styles.tagline}>Studio Persona for Agentic AI</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in with the Yuika portal</Text>
          <Text style={styles.cardBody}>
            Your phone becomes mission control for every host signed in with this account: deployed studios, desktop
            hosts, projects, tasks, team, terminals, and live screens.
          </Text>
          <Pressable style={[styles.button, signingIn && styles.buttonDisabled]} disabled={signingIn} onPress={() => void signIn()}>
            {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  if (screen.name === "remote") {
    return (
      <RemoteProvider
        key={screen.host.deviceId}
        relayUrl={screen.session.relayUrl}
        device={screen.session.device}
        host={screen.host}
        onGone={() => {
          setHosts(null); // paksa refresh daftar host saat kembali
          setScreen({ name: "hosts", session: screen.session });
        }}
      />
    );
  }

  // hosts
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Image source={require("./assets/logo.png")} style={styles.logoHeader} resizeMode="contain" />
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
      {hostsError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{hostsError}</Text>
        </View>
      ) : null}
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
          <Pressable style={styles.row} onPress={() => setScreen({ name: "remote", session: screen.session, host: item })}>
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
                Sign in to a Yuika studio or desktop host with this account and it will appear here.
              </Text>
            </View>
          )
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
  button: { backgroundColor: C.accent, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 24, paddingBottom: 12 },
  headerTitle: { color: C.text, fontSize: 24, fontWeight: "700" },
  headerSub: { color: C.dim, fontSize: 12.5, marginTop: 2 },
  signOut: { color: C.dim, fontSize: 13 },
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
  emptyBody: { color: C.dim, fontSize: 12.5, textAlign: "center", maxWidth: 280, lineHeight: 18 },
});
