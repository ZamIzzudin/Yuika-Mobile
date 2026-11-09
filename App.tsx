import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { DEFAULT_PORTAL, loginWithPortal, PortalError } from "./src/portal";
import { listHosts, RelayError, type HostEntry } from "./src/relay";
import { clearSession, loadSession, saveSession, type Session } from "./src/store";

// Tema Yuika dark (canvas #1a1a1a, surface #212121, aksen #007cf7).
const C = {
  canvas: "#1a1a1a",
  surface: "#212121",
  line: "#2e2e2e",
  text: "#f5f5f5",
  dim: "#9e9e9e",
  faint: "#616161",
  accent: "#007cf7",
  danger: "#ff5c5c",
};

type Screen = { name: "boot" } | { name: "login" } | { name: "hosts"; session: Session };

const KIND_ICON: Record<string, string> = { desktop: "🖥", web: "🌐", mobile: "📱" };

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
      const r = await loginWithPortal(portalUrl.trim() || DEFAULT_PORTAL, existing);
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
          <Pressable style={[styles.button, signingIn && styles.buttonDisabled]} disabled={signingIn} onPress={() => void signIn()}>
            {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue to portal</Text>}
          </Pressable>
        </View>
      </View>
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
      {hostsError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{hostsError}</Text>
        </View>
      )}
      <FlatList
        contentContainerStyle={styles.list}
        data={hosts ?? []}
        keyExtractor={(h) => h.deviceId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { if (session) void refresh(session); }} tintColor={C.accent} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowIcon}>{KIND_ICON[item.kind] ?? "🔌"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.kind} · seen {relative(item.lastSeen)}
              </Text>
            </View>
            <View style={styles.rowSoon}>
              <Text style={styles.rowSoonText}>soon</Text>
            </View>
          </View>
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
      <Text style={styles.footer}>Remote control lands in the next phase</Text>
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
  card: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 18, marginTop: 36, width: "100%", maxWidth: 360, gap: 10 },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: "600" },
  cardBody: { color: C.dim, fontSize: 12.5, lineHeight: 18 },
  label: { color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  input: { color: C.text, backgroundColor: C.canvas, borderColor: C.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  button: { backgroundColor: C.accent, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 24, paddingBottom: 12 },
  headerTitle: { color: C.text, fontSize: 24, fontWeight: "700" },
  headerSub: { color: C.dim, fontSize: 12.5, marginTop: 2 },
  signOut: { color: C.dim, fontSize: 13 },
  list: { paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  rowIcon: { fontSize: 22 },
  rowName: { color: C.text, fontSize: 14.5, fontWeight: "600" },
  rowMeta: { color: C.dim, fontSize: 12, marginTop: 2 },
  rowSoon: { backgroundColor: C.canvas, borderColor: C.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rowSoonText: { color: C.faint, fontSize: 11 },
  errorBox: { backgroundColor: "#2a1a1a", borderColor: "#5c2a2a", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  errorText: { color: C.danger, fontSize: 12.5 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 6 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: "600" },
  emptyBody: { color: C.dim, fontSize: 12.5, textAlign: "center", maxWidth: 280, lineHeight: 18 },
  footer: { color: C.faint, fontSize: 11.5, textAlign: "center", paddingBottom: 8 },
});
