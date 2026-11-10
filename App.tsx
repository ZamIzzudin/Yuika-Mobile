// Yuika mobile — remote mission control untuk host studio/desktop.
// Boot → login portal → daftar host → RemoteProvider (Projects/Screens/
// Settings, lihat src/remote/RemoteProvider.tsx). Mockup 2025-11: Nunito,
// icon SVG Lucide, toast floating (error), semua konten dalam SafeArea.
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";

import { Icon, type IconName } from "./src/components/Icon";
import { RemoteProvider } from "./src/remote/RemoteProvider";
import { DEFAULT_PORTAL, loginWithPortal, PortalError } from "./src/portal";
import { listHosts, RelayError, type HostEntry } from "./src/relay";
import { clearSession, loadSession, saveSession, type Session } from "./src/store";
import { C } from "./src/theme";
import { EmptyState, ToastProvider, Txt, useToast } from "./src/ui";

const KIND_ICON: Record<string, IconName> = {
  desktop: "monitor",
  web: "globe",
  mobile: "monitor",
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
  const [fontsLoaded] = useFonts({
    "Nunito-Regular": require("./assets/fonts/Nunito-Regular.ttf"),
    "Nunito-SemiBold": require("./assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("./assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("./assets/fonts/Nunito-ExtraBold.ttf"),
  });
  const [screen, setScreen] = useState<Screen>({ name: "boot" });
  const [signingIn, setSigningIn] = useState(false);
  const [hosts, setHosts] = useState<HostEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const toast = useToast();

  useEffect(() => {
    void (async () => {
      const s = await loadSession();
      setScreen(s ? { name: "hosts", session: s } : { name: "login" });
    })();
  }, []);

  const refresh = useCallback(async (session: Session) => {
    setRefreshing(true);
    try {
      setHosts(await listHosts(session.relayUrl, session.device));
    } catch (e) {
      toast(e instanceof RelayError ? e.message : "relay error", "danger");
    } finally {
      setRefreshing(false);
    }
  }, [toast]);

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
      toast(e instanceof PortalError ? e.message : "sign-in failed", "danger");
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut(): Promise<void> {
    await clearSession();
    setHosts(null);
    setScreen({ name: "login" });
  }

  if (!fontsLoaded || screen.name === "boot") {
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
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="light" />
        <Image source={require("./assets/logo.png")} style={styles.logoLogin} resizeMode="contain" />
        <Txt style={styles.tagline}>Studio Persona for Agentic AI</Txt>
        <View style={styles.card}>
          <Txt style={styles.cardTitle}>Sign in with the Yuika portal</Txt>
          <Txt style={styles.cardBody}>Manage your host studio and make sure everything fine from here.</Txt>
          <Pressable style={[styles.button, signingIn && styles.buttonDisabled]} disabled={signingIn} onPress={() => void signIn()}>
            {signingIn ? <ActivityIndicator color="#fff" /> : <Txt style={styles.buttonText}>Sign in</Txt>}
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
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Image source={require("./assets/logo.png")} style={styles.logoHeader} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Txt style={styles.headerTitle}>Hosts</Txt>
          <Txt style={styles.headerSub} numberOfLines={1}>
            {session?.email}
          </Txt>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Txt style={styles.signOut}>Sign out</Txt>
        </Pressable>
      </View>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}
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
            <Icon name={KIND_ICON[item.kind] ?? "monitor"} size={20} color={C.dim} />
            <View style={{ flex: 1 }}>
              <Txt style={styles.rowName}>{item.name}</Txt>
              <Txt style={styles.rowMeta}>
                {item.kind} · seen {relative(item.lastSeen)}
              </Txt>
            </View>
            <Txt style={styles.rowOpen}>Open</Txt>
          </Pressable>
        )}
        ListEmptyComponent={
          refreshing ? undefined : (
            <EmptyState
              title="No hosts online"
              body="Sign in to a Yuika studio or desktop host with this account and it will appear here."
            />
          )
        }
      />
    </View>
  );
}

export function AppRoot() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = {
  root: { flex: 1, backgroundColor: C.canvas, paddingHorizontal: 20 },
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
  } as object,
  cardTitle: { color: C.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  cardBody: { color: C.dim, fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  button: { backgroundColor: C.accent, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  buttonDisabled: { opacity: 0.6 } as object,
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 24, paddingBottom: 12 },
  headerTitle: { color: C.text, fontSize: 24, fontWeight: "700" },
  headerSub: { color: C.dim, fontSize: 12.5, marginTop: 2 },
  signOut: { color: C.dim, fontSize: 13 },
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
  } as object,
  rowName: { color: C.text, fontSize: 14.5, fontWeight: "600" },
  rowMeta: { color: C.dim, fontSize: 12, marginTop: 2 },
  rowOpen: { color: C.accent, fontSize: 13, fontWeight: "600" },
} as const;

// registerRootComponent mengganti export default — pastikan AppRoot dipakai.
