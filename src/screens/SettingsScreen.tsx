// Tab Settings (mockup 2025-11): landing menu 4 row (Limit & Usage, Provider
// & Model, MCP, Actions) -> sub-screen dengan back chevron + FAB nav 4 item.
// Modes (safety/hardcore) · Budget · Provider swap · Model routes · Usage ·
// MCP · Danger (reset host, ketik RESET). TANPA sign-out host (host-only).
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { FabNav, type FabNavItem } from "../components/FabNav";
import { Icon } from "../components/Icon";
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
import { Btn, Card, Chip, Field, SectionTitle, Txt, useToast } from "../ui";

type SubKey = "usage" | "provider" | "mcp" | "actions";
type Sub = SubKey | null;

const MENUS: Array<{ key: SubKey; label: string; desc: string; icon: "activity" | "wrench" | "plug" | "shield" }> = [
  { key: "usage", label: "Limit & Usage", desc: "Caps, burn rate, spend by persona", icon: "activity" },
  { key: "provider", label: "Provider & Model", desc: "Base URL, API key, routes per persona", icon: "wrench" },
  { key: "mcp", label: "MCP", desc: "Trusted servers, tools, retry", icon: "plug" },
  { key: "actions", label: "Actions", desc: "Approval mode, resets", icon: "shield" },
];

const NAV_ITEMS: FabNavItem[] = MENUS.map((m) => ({ key: m.key, label: m.label, icon: m.icon }));

const SUB_TITLES: Record<SubKey, string> = {
  usage: "Limit & Usage",
  provider: "Provider & Model",
  mcp: "MCP",
  actions: "Actions",
};

function money(n: number, cur: string | null | undefined): string {
  if (cur === "IDR") return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
  return `$${n.toFixed(n < 10 ? 4 : 2)}`;
}

// ── data (fetch sekali di root, dipakai semua sub-page) ─────────────────

interface SettingsData {
  state: SettingsState | null;
  usage: { summary: UsageSummaryLite; matrix: UsageMatrixRow[] } | null;
  mcp: McpServerLite[] | null;
  loading: boolean;
  reload: () => Promise<void>;
}

function useSettingsData(): SettingsData {
  const { rs } = useRemote();
  const toast = useToast();
  const [state, setState] = useState<SettingsState | null>(null);
  const [usage, setUsage] = useState<{ summary: UsageSummaryLite; matrix: UsageMatrixRow[] } | null>(null);
  const [mcp, setMcp] = useState<McpServerLite[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await rs.request<{ ev: "settings.state" } & SettingsState>("settings.get");
      setState(s);
      const u = await rs.request<{ ev: "settings.usage"; summary: UsageSummaryLite; matrix: UsageMatrixRow[] }>("settings.usage");
      setUsage({ summary: u.summary, matrix: u.matrix });
      const m = await rs.request<{ ev: "settings.mcp"; servers: McpServerLite[] }>("settings.mcp");
      setMcp(m.servers);
    } catch (e) {
      toast(e instanceof RelayError ? e.message : "Failed to load settings", "danger");
    } finally {
      setLoading(false);
    }
  }, [rs, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, usage, mcp, loading: loading && state === null, reload: load };
}

export function SettingsScreen() {
  const [page, setPage] = useState<Sub>(null);
  const data = useSettingsData();
  return (
    <View style={{ flex: 1 }}>
      {page === null ? (
        <Landing loading={data.loading} onOpen={(p) => setPage(p)} />
      ) : (
        <SubPage page={page} data={data} onBack={() => setPage(null)} />
      )}
      <FabNav items={NAV_ITEMS} active={page} onPick={(k) => setPage(k as SubKey)} />
    </View>
  );
}

// ── Landing: menu 4 row ─────────────────────────────────────────────────

function Landing({ loading, onOpen }: { loading: boolean; onOpen: (p: SubKey) => void }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}>
      {loading ? <SkeletonList rows={3} /> : null}
      <Card style={{ padding: 0 }}>
        {MENUS.map((m, i) => (
          <Pressable
            key={m.key}
            onPress={() => onOpen(m.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 13,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: C.line,
            }}
          >
            <Icon name={m.icon} size={20} color={C.text} />
            <View style={{ flex: 1 }}>
              <Txt style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }}>{m.label}</Txt>
              <Txt style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>{m.desc}</Txt>
            </View>
            <Icon name="chev-r" size={16} color={C.faint} />
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

// ── Sub-screen shell: back chevron + konten ─────────────────────────────

function SubPage({ page, data, onBack }: { page: SubKey; data: SettingsData; onBack: () => void }) {
  const [refreshing, setRefreshing] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Pressable
          onPress={onBack}
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
          <Icon name="chev-l" size={18} color={C.text} />
        </Pressable>
        <Txt style={{ color: C.text, fontSize: 17, fontWeight: "700", flex: 1 }}>{SUB_TITLES[page]}</Txt>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 160 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void data.reload().finally(() => setRefreshing(false));
            }}
            tintColor={C.accent}
          />
        }
      >
        {data.loading ? (
          <SkeletonList rows={3} />
        ) : (
          <>
            {page === "usage" ? (
              <>
                {data.state ? <BudgetCard state={data.state} onChanged={() => void data.reload()} /> : null}
                {data.usage ? <UsageCard data={data.usage} /> : null}
              </>
            ) : null}
            {page === "provider" ? (
              <>
                {data.state ? <ProviderCard state={data.state} onChanged={() => void data.reload()} /> : null}
                {data.state ? <RoutesCard state={data.state} onChanged={() => void data.reload()} /> : null}
              </>
            ) : null}
            {page === "mcp" ? (data.mcp ? <McpCard servers={data.mcp} onChanged={() => void data.reload()} /> : null) : null}
            {page === "actions" ? (
              <>
                {data.state ? <ModesCard state={data.state} onChanged={() => void data.reload()} /> : null}
                {data.state ? <DangerCard resetPending={data.state.resetPending} /> : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Modes: safety vs hardcore (Actions) ─────────────────────────────────

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
      <Txt style={{ color: C.dim, fontSize: 12, marginTop: 10, lineHeight: 17 }}>
        {hardcore
          ? "Hardcore: risky tool calls are auto-approved. Fast, but nothing asks you first."
          : "Safety: risky tool calls pause and ask you here before running."}
      </Txt>
    </Card>
  );
}

// ── Budget (Limit & Usage) ──────────────────────────────────────────────

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
        <Txt style={{ color: C.warn, fontSize: 11.5, marginBottom: 8 }}>
          Some models have no price set — spend shown is a lower bound.
        </Txt>
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
        {msg ? <Txt style={{ color: C.dim, fontSize: 12 }}>{msg}</Txt> : null}
      </View>
      <Txt style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>Leave blank for no limit. Currency follows the price book.</Txt>
    </Card>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.inset, borderRadius: 10, padding: 10 }}>
      <Txt style={{ color: C.faint, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</Txt>
      <Txt style={{ color: warn ? C.warn : C.text, fontSize: 14, fontWeight: "700", marginTop: 3 }}>{value}</Txt>
    </View>
  );
}

// ── Provider (Provider & Model) ─────────────────────────────────────────

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
        {msg ? <Txt style={{ color: C.dim, fontSize: 12, flex: 1 }}>{msg}</Txt> : null}
      </View>
    </Card>
  );
}

// ── Model routes per persona (Provider & Model) ─────────────────────────

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
      <Txt style={{ color: C.dim, fontSize: 12, marginBottom: 10 }}>
        Default: {routes.defaultModel}
        {routes.defaultFallback ? ` (fallback ${routes.defaultFallback})` : ""}
      </Txt>
      {routes.personas.map((p) => {
        const cur = routes.overrides[p.id]?.model || null;
        const value = edits[p.id] ?? "";
        return (
          <View key={p.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Mascot personaId={p.id} size={26} />
              <Txt style={{ color: C.text, fontSize: 13.5, fontWeight: "600", flex: 1 }}>{personaMeta(p.id).name}</Txt>
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
      {msg ? <Txt style={{ color: C.dim, fontSize: 12 }}>{msg}</Txt> : null}
      <Txt style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>Clear the field and save to fall back to the default model.</Txt>
    </Card>
  );
}

// ── Usage (Limit & Usage) ───────────────────────────────────────────────

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
          <Txt style={{ color: C.text, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
            {personaMeta(r.personaId).name} · {r.model}
          </Txt>
          <Txt style={{ color: C.dim, fontSize: 12 }}>{r.calls}×</Txt>
          <Txt style={{ color: r.cost == null ? C.faint : C.text, fontSize: 12 }}>
            {r.cost == null ? "unpriced" : money(r.cost, r.currency)}
          </Txt>
        </View>
      ))}
      {data.matrix.length === 0 ? <Txt style={{ color: C.faint, fontSize: 12 }}>No recorded usage yet.</Txt> : null}
    </Card>
  );
}

// ── MCP ─────────────────────────────────────────────────────────────────

function McpCard({ servers, onChanged }: { servers: McpServerLite[]; onChanged: () => void }) {
  const { rs } = useRemote();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function retry(name: string): Promise<void> {
    setBusy(name);
    try {
      await rs.request("mcp.retry", { name });
      onChanged();
    } catch (e) {
      toast(e instanceof RelayError ? e.message : "Retry failed", "danger");
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
            <Txt style={{ color: C.text, fontSize: 13.5, fontWeight: "600", flex: 1 }} numberOfLines={1}>
              {s.name}
            </Txt>
            <Chip
              label={s.state}
              tone={s.connected ? "ok" : s.state === "error" ? "danger" : "dim"}
            />
          </View>
          <Txt style={{ color: C.dim, fontSize: 11.5, marginTop: 3 }}>
            {s.trusted ? "trusted" : "untrusted"} · {s.toolCount} tools
            {s.lastError ? ` · ${s.lastError}` : ""}
          </Txt>
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
      {servers.length === 0 ? <Txt style={{ color: C.faint, fontSize: 12 }}>No MCP servers configured on this host.</Txt> : null}
    </Card>
  );
}

// ── Danger: reset host (Actions) ────────────────────────────────────────

function DangerCard({ resetPending }: { resetPending: boolean }) {
  const { rs } = useRemote();
  const toast = useToast();
  const [scope, setScope] = useState<"work" | "factory">("work");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(): Promise<void> {
    if (busy || confirmText !== "RESET") return;
    setBusy(true);
    try {
      await rs.request("reset.run", { scope, confirm: "RESET" }, 8_000);
      setConfirmText("");
    } catch (e) {
      setBusy(false);
      toast(e instanceof RelayError ? e.message : "Reset failed", "danger");
    }
  }

  return (
    <Card style={{ borderColor: "#5c2a2a" }}>
      <SectionTitle>Danger zone</SectionTitle>
      {resetPending ? (
        <Txt style={{ color: C.warn, fontSize: 12.5, marginBottom: 8 }}>
          A reset is already pending on the host — it will complete on next engine start.
        </Txt>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Reset work data" outline={scope !== "work"} tone="danger" small onPress={() => setScope("work")} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Factory reset" outline={scope !== "factory"} tone="danger" small onPress={() => setScope("factory")} />
        </View>
      </View>
      <Txt style={{ color: C.dim, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
        {scope === "work"
          ? "Deletes projects, sessions, and workspace data. Keeps your account link and provider setup."
          : "Deletes everything including the portal link. The host restarts empty and must be set up again."}
        {"\n"}The host restarts right after you run this.
      </Txt>
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
