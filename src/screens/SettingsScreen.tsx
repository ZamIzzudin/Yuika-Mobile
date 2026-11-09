// Tab Settings: mission-control remote settings.
// Modes (safety/hardcore) · Budget · Provider swap · Model routes · Usage ·
// MCP · Danger (reset host, ketik RESET). TANPA sign-out host (host-only).
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Mascot } from "../components/Mascot";
import { SkeletonList } from "../components/Skeleton";
import { personaMeta } from "../personas";
import { useRemote } from "../remote/RemoteProvider";
import {
  RelayError,
  type McpServerLite,
  type SettingsState,
  type UsageMatrixRow,
  type UsageSummaryLite,
} from "../relay";
import { C } from "../theme";
import { Btn, Card, Chip, Field, SectionTitle } from "../ui";

function money(n: number, cur: string | null | undefined): string {
  if (cur === "IDR") return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
  return `$${n.toFixed(n < 10 ? 4 : 2)}`;
}

export function SettingsScreen() {
  const { rs } = useRemote();
  const [state, setState] = useState<SettingsState | null>(null);
  const [usage, setUsage] = useState<{ summary: UsageSummaryLite; matrix: UsageMatrixRow[] } | null>(null);
  const [mcp, setMcp] = useState<McpServerLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await rs.request<{ ev: "settings.state" } & SettingsState>("settings.get");
      setState(s);
      const u = await rs.request<{ ev: "settings.usage"; summary: UsageSummaryLite; matrix: UsageMatrixRow[] }>("settings.usage");
      setUsage({ summary: u.summary, matrix: u.matrix });
      const m = await rs.request<{ ev: "settings.mcp"; servers: McpServerLite[] }>("settings.mcp");
      setMcp(m.servers);
      setError(null);
    } catch (e) {
      setError(e instanceof RelayError ? e.message : "Failed to load settings");
    }
  }, [rs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.accent} />}
    >
      {error ? <ErrorBoxInline msg={error} /> : null}
      {!state ? <SkeletonList rows={3} /> : <ModesCard state={state} onChanged={() => void load()} />}
      {state ? <BudgetCard state={state} onChanged={() => void load()} /> : null}
      {state ? <ProviderCard state={state} onChanged={() => void load()} /> : null}
      {state ? <RoutesCard state={state} onChanged={() => void load()} /> : null}
      {usage ? <UsageCard data={usage} /> : null}
      {mcp ? <McpCard servers={mcp} onChanged={() => void load()} /> : null}
      {state ? <DangerCard resetPending={state.resetPending} /> : null}
    </ScrollView>
  );
}

function ErrorBoxInline({ msg }: { msg: string }) {
  return (
    <View style={{ backgroundColor: "#2a1a1a", borderColor: "#5c2a2a", borderWidth: 1, borderRadius: 10, padding: 10 }}>
      <Text style={{ color: C.danger, fontSize: 12.5 }}>{msg}</Text>
    </View>
  );
}

// ── Modes: safety vs hardcore ───────────────────────────────────────────

function ModesCard({ state, onChanged }: { state: SettingsState; onChanged: () => void }) {
  const { rs } = useRemote();
  const [busy, setBusy] = useState(false);
  const hardcore = state.approvalMode === "auto";

  async function set(mode: "ask" | "auto"): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await rs.request("settings.update", { approvalMode: mode });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Approval mode</SectionTitle>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Safety mode" outline={!hardcore ? false : true} tone="ok" disabled={busy || !hardcore} onPress={() => void set("ask")} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Hardcore mode" tone="danger" outline={!hardcore} disabled={busy || hardcore} onPress={() => void set("auto")} />
        </View>
      </View>
      <Text style={{ color: C.dim, fontSize: 12, marginTop: 10, lineHeight: 17 }}>
        {hardcore
          ? "Hardcore: risky tool calls are auto-approved. Fast, but nothing asks you first."
          : "Safety: risky tool calls pause and ask you here before running."}
      </Text>
    </Card>
  );
}

// ── Budget ──────────────────────────────────────────────────────────────

function BudgetCard({ state, onChanged }: { state: SettingsState; onChanged: () => void }) {
  const { rs } = useRemote();
  const b = state.budget;
  const [daily, setDaily] = useState(b.config.dailyLimit != null ? String(b.config.dailyLimit) : "");
  const [total, setTotal] = useState(b.config.totalLimit != null ? String(b.config.totalLimit) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const parse = (v: string): number | null => (v.trim() === "" ? null : Number(v));
      await rs.request("settings.update", {
        budget: { dailyLimit: parse(daily), totalLimit: parse(total) },
      });
      onChanged();
      setMsg("Saved");
    } catch (e) {
      setMsg(e instanceof RelayError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Budget</SectionTitle>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Stat label="Today" value={money(b.spentToday, b.currency)} warn={b.dailyLimitHit} />
        <Stat label="All time" value={money(b.spentTotal, b.currency)} warn={b.totalLimitHit} />
        <Stat label="Burn/hr" value={money(b.burnRatePerHour ?? 0, b.currency)} />
      </View>
      {b.coverage === "partial" ? (
        <Text style={{ color: C.warn, fontSize: 11.5, marginBottom: 8 }}>
          Some models have no price set — spend shown is a lower bound.
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Daily limit" value={daily} onChange={setDaily} placeholder="none" mono />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Total limit" value={total} onChange={setTotal} placeholder="none" mono />
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
        <Btn label={busy ? "Saving…" : "Save limits"} small onPress={() => void save()} disabled={busy} />
        {msg ? <Text style={{ color: C.dim, fontSize: 12 }}>{msg}</Text> : null}
      </View>
      <Text style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>Leave blank for no limit. Currency follows the price book.</Text>
    </Card>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.inset, borderRadius: 10, padding: 10 }}>
      <Text style={{ color: C.faint, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: warn ? C.warn : C.text, fontSize: 14, fontWeight: "700", marginTop: 3 }}>{value}</Text>
    </View>
  );
}

// ── Provider ────────────────────────────────────────────────────────────

function ProviderCard({ state, onChanged }: { state: SettingsState; onChanged: () => void }) {
  const { rs } = useRemote();
  const p = state.provider;
  const [baseUrl, setBaseUrl] = useState(p.baseUrl);
  const [model, setModel] = useState(p.model);
  const [fallback, setFallback] = useState(p.fallbackModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await rs.request("provider.update", {
        ...(baseUrl.trim() && baseUrl !== p.baseUrl ? { baseUrl: baseUrl.trim() } : {}),
        ...(model.trim() && model !== p.model ? { model: model.trim() } : {}),
        ...(fallback.trim() !== (p.fallbackModel ?? "") ? { fallbackModel: fallback.trim() || null } : {}),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setApiKey("");
      onChanged();
      setMsg("Saved — host applied the new provider");
    } catch (e) {
      setMsg(e instanceof RelayError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Provider</SectionTitle>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Chip label={p.kind} />
        <Chip label={p.hasApiKey ? "API key set" : "no API key"} tone={p.hasApiKey ? "ok" : "danger"} />
        {p.keyPreview ? <Chip label={p.keyPreview} /> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api…" mono />
        <Field label="Model" value={model} onChange={setModel} placeholder="model id" mono />
        <Field label="Fallback model" value={fallback} onChange={setFallback} placeholder="none" mono />
        <Field
          label="API key"
          value={apiKey}
          onChange={setApiKey}
          placeholder={p.hasApiKey ? "leave blank to keep current key" : "sk-…"}
          secure
          mono
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
        <Btn label={busy ? "Saving…" : "Save provider"} small onPress={() => void save()} disabled={busy} />
        {msg ? <Text style={{ color: C.dim, fontSize: 12, flex: 1 }}>{msg}</Text> : null}
      </View>
    </Card>
  );
}

// ── Model routes per persona ────────────────────────────────────────────

function RoutesCard({ state, onChanged }: { state: SettingsState; onChanged: () => void }) {
  const { rs } = useRemote();
  const routes = state.modelRoutes;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(personaId: string): Promise<void> {
    if (busy) return;
    setBusy(personaId);
    setMsg(null);
    try {
      await rs.request("model.route.update", { personaId, model: edits[personaId]?.trim() ?? "" });
      setEdits((e) => ({ ...e, [personaId]: "" }));
      onChanged();
      setMsg("Route saved");
    } catch (e) {
      setMsg(e instanceof RelayError ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <SectionTitle>Model routes</SectionTitle>
      <Text style={{ color: C.dim, fontSize: 12, marginBottom: 10 }}>
        Default: {routes.defaultModel}
        {routes.defaultFallback ? ` (fallback ${routes.defaultFallback})` : ""}
      </Text>
      {routes.personas.map((p) => {
        const cur = routes.overrides[p.id]?.model || null;
        const value = edits[p.id] ?? "";
        return (
          <View key={p.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Mascot personaId={p.id} size={26} />
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: "600", flex: 1 }}>{personaMeta(p.id).name}</Text>
              {cur ? <Chip label={cur} tone="accent" /> : <Chip label="default" />}
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <Field
                  value={value}
                  onChange={(v) => setEdits((e) => ({ ...e, [p.id]: v }))}
                  placeholder={cur ? "override model id" : "model id to override"}
                  mono
                />
              </View>
              <Btn
                label={busy === p.id ? "…" : "Save"}
                small
                outline
                disabled={busy !== null}
                onPress={() => void save(p.id)}
              />
            </View>
          </View>
        );
      })}
      {msg ? <Text style={{ color: C.dim, fontSize: 12 }}>{msg}</Text> : null}
      <Text style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>Clear the field and save to fall back to the default model.</Text>
    </Card>
  );
}

// ── Usage ───────────────────────────────────────────────────────────────

function UsageCard({ data }: { data: { summary: UsageSummaryLite; matrix: UsageMatrixRow[] } }) {
  const s = data.summary;
  return (
    <Card>
      <SectionTitle>Usage</SectionTitle>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Stat label="Calls" value={String(s.calls)} />
        <Stat label="Tokens" value={`${(s.promptTokens / 1000).toFixed(1)}k in`} />
        <Stat label="Out" value={`${(s.outputTokens / 1000).toFixed(1)}k`} />
      </View>
      {data.matrix.slice(0, 12).map((r, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }}>
          <Mascot personaId={r.personaId} size={20} />
          <Text style={{ color: C.text, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
            {personaMeta(r.personaId).name} · {r.model}
          </Text>
          <Text style={{ color: C.dim, fontSize: 12 }}>{r.calls}×</Text>
          <Text style={{ color: r.cost == null ? C.faint : C.text, fontSize: 12 }}>
            {r.cost == null ? "unpriced" : money(r.cost, r.currency)}
          </Text>
        </View>
      ))}
      {data.matrix.length === 0 ? <Text style={{ color: C.faint, fontSize: 12 }}>No recorded usage yet.</Text> : null}
    </Card>
  );
}

// ── MCP ─────────────────────────────────────────────────────────────────

function McpCard({ servers, onChanged }: { servers: McpServerLite[]; onChanged: () => void }) {
  const { rs } = useRemote();
  const [busy, setBusy] = useState<string | null>(null);

  async function retry(name: string): Promise<void> {
    setBusy(name);
    try {
      await rs.request("mcp.retry", { name });
      onChanged();
    } catch {
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function trust(s: McpServerLite): Promise<void> {
    if (busy) return;
    setBusy(s.name);
    try {
      await rs.request("mcp.trust", { server: s.name, trusted: !s.trusted });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <SectionTitle>MCP servers</SectionTitle>
      {servers.map((s) => (
        <View key={s.name} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: "600", flex: 1 }} numberOfLines={1}>
              {s.name}
            </Text>
            <Chip
              label={s.state}
              tone={s.connected ? "ok" : s.state === "error" ? "danger" : "dim"}
            />
          </View>
          <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 3 }}>
            {s.trusted ? "trusted" : "untrusted"} · {s.toolCount} tools
            {s.lastError ? ` · ${s.lastError}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            {!s.connected ? (
              <Btn label={busy === s.name ? "…" : "Retry"} small outline onPress={() => void retry(s.name)} disabled={busy !== null} />
            ) : null}
            <Btn
              label={s.trusted ? "Revoke trust" : "Trust"}
              small
              outline
              tone={s.trusted ? "danger" : "ok"}
              onPress={() => void trust(s)}
              disabled={busy !== null}
            />
          </View>
        </View>
      ))}
      {servers.length === 0 ? <Text style={{ color: C.faint, fontSize: 12 }}>No MCP servers configured on this host.</Text> : null}
    </Card>
  );
}

// ── Danger: reset host ──────────────────────────────────────────────────

function DangerCard({ resetPending }: { resetPending: boolean }) {
  const { rs } = useRemote();
  const [scope, setScope] = useState<"work" | "factory">("work");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(): Promise<void> {
    if (busy || confirmText !== "RESET") return;
    setBusy(true);
    try {
      await rs.request("reset.run", { scope, confirm: "RESET" }, 8_000);
      setConfirmText("");
    } catch {
      setBusy(false);
    }
  }

  return (
    <Card style={{ borderColor: "#5c2a2a" }}>
      <SectionTitle>Danger zone</SectionTitle>
      {resetPending ? (
        <Text style={{ color: C.warn, fontSize: 12.5, marginBottom: 8 }}>
          A reset is already pending on the host — it will complete on next engine start.
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Reset work data" outline={scope !== "work"} tone="danger" small onPress={() => setScope("work")} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Factory reset" outline={scope !== "factory"} tone="danger" small onPress={() => setScope("factory")} />
        </View>
      </View>
      <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
        {scope === "work"
          ? "Deletes projects, sessions, and workspace data. Keeps your account link and provider setup."
          : "Deletes everything including the portal link. The host restarts empty and must be set up again."}
        {"\n"}The host restarts right after you run this.
      </Text>
      <Field
        label='Type "RESET" to confirm'
        value={confirmText}
        onChange={setConfirmText}
        placeholder="RESET"
        mono
      />
      <View style={{ marginTop: 10 }}>
        <Btn
          label={busy ? "Resetting…" : "Run reset"}
          tone="danger"
          small
          disabled={confirmText !== "RESET" || busy}
          onPress={() => void run()}
        />
      </View>
    </Card>
  );
}
