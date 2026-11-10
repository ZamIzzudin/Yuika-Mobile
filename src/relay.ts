/**
 * Klien relay (SPEC-PROTOCOL v1) fase B8: sesi persisten remote control.
 * - listHosts: one-shot (dipakai screen hosts).
 * - RemoteSession: connect → auth → join host → kanal data E2E (seal X25519,
 *   crypto.ts) dengan reconnect + antrian + keepalive ping_host.
 * Payload RemoteAction/RemoteEvent = CONTRACTS-REMOTE v1 (subset typed;
 * event/aksi tak dikenal diabaikan — forward-compat §1).
 */
import { sealBox, openBox, signChallenge, type DeviceKeys } from "./crypto";

export interface HostEntry {
  deviceId: string;
  kind: "desktop" | "mobile" | "web";
  name: string;
  lastSeen: number;
}

export class RelayError extends Error {}

export async function listHosts(
  relayUrl: string,
  device: DeviceKeys,
  timeoutMs = 10_000,
): Promise<HostEntry[]> {
  return new Promise<HostEntry[]>((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new RelayError("relay timeout"));
    }, timeoutMs);
    const fail = (msg: string): void => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* already closed */
      }
      reject(new RelayError(msg));
    };

    ws.onopen = () => {
      // menunggu hello nonce dari server
    };
    ws.onerror = () => fail("cannot reach relay");
    ws.onclose = () => {
      clearTimeout(timer);
    };
    ws.onmessage = (ev: WebSocketMessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
      } catch {
        fail("bad relay message");
        return;
      }
      switch (msg.t) {
        case "hello": {
          const nonce = String(msg.nonce ?? "");
          const sig = signChallenge(device.signPriv, device.deviceId, nonce);
          ws.send(
            JSON.stringify({ t: "auth", deviceId: device.deviceId, sig }),
          );
          break;
        }
        case "auth_ok":
          ws.send(JSON.stringify({ t: "list_hosts" }));
          break;
        case "hosts": {
          clearTimeout(timer);
          const hosts = (msg.hosts ?? []) as HostEntry[];
          ws.close();
          resolve(hosts);
          break;
        }
        case "bye":
          fail(String(msg.error ?? `relay closed (${msg.code ?? "?"})`));
          break;
        case "err":
          fail(String(msg.error ?? `relay error ${msg.code ?? ""}`));
          break;
        default:
          break; // field tak dikenal diabaikan (forward-compat §2)
      }
    };
  });
}

// ── CONTRACTS-REMOTE v1 (subset yang dipakai UI mobile) ─────────────────────

export interface SessionInfo {
  sessionId: string;
  title: string;
  personaId: string;
  updatedAt: number;
}

export interface TranscriptMsg {
  role: "user" | "assistant" | "tool";
  personaId?: string;
  text: string;
  at: number;
}

// ── v1.2: mission-control data shapes ──────────────────────────────────────

export interface ProjectLite {
  id: string;
  name: string;
  description: string | null;
  status: string;
  kind: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskStats {
  todo: number;
  doing: number;
  review: number;
  done: number;
}

export interface ProjectSummary {
  project: ProjectLite;
  taskStats: TaskStats;
  activeDelegations: number;
  sessions: SessionInfo[];
}

export interface TaskNode {
  id: string;
  parent: string | null;
  title: string;
  status: string;
  assignee: string | null;
  description?: string | null;
  children: TaskNode[];
}

export interface FileNode {
  name: string;
  relPath: string;
  dir: boolean;
  size: number;
  children?: FileNode[];
}

export interface RosterEntry {
  personaId: string;
  role: string;
}

export interface DelegationJob {
  id: number;
  parentSessionId: string;
  childSessionId: string;
  personaId: string;
  goal: string;
  status: "running" | "done" | "error" | "interrupted";
  summary: string | null;
  error: string | null;
  createdAt: number;
}

export interface ActivityEntry {
  at: number;
  sessionId: string | null;
  personaId: string | null;
  kind: string;
  label: string;
  isError?: boolean;
}

export interface PersonaLite {
  id: string;
  name: string;
  model: string | null;
}

export interface BudgetLite {
  config: Record<string, unknown>;
  spentToday: number;
  spentTotal: number;
  burnRatePerHour?: number;
  coverage?: string;
  currency?: string | null;
  dailyLimitHit?: boolean;
  totalLimitHit?: boolean;
}

export interface ProviderLite {
  kind: string;
  baseUrl: string;
  model: string;
  fallbackModel: string | null;
  auxModel: string | null;
  hasApiKey: boolean;
  keyPreview?: string | null;
}

export interface ModelRouteState {
  defaultModel: string;
  defaultFallback: string | null;
  overrides: Record<string, { model: string; fallback: string }>;
  personas: Array<{ id: string; name: string }>;
}

export interface SettingsState {
  approvalMode: "ask" | "auto";
  budget: BudgetLite;
  provider: ProviderLite;
  modelRoutes: ModelRouteState;
  resetPending: boolean;
}

export interface UsageSummaryLite {
  calls: number;
  promptTokens: number;
  outputTokens: number;
  byPersona: Array<{ personaId: string; calls: number }>;
  byModel: Array<{ model: string; calls: number }>;
}

export interface UsageMatrixRow {
  personaId: string;
  model: string;
  calls: number;
  promptTokens: number;
  outputTokens: number;
  cost: number;
  currency: string | null;
}

export interface McpServerLite {
  name: string;
  declared?: boolean;
  trusted: boolean;
  denyTools?: string[];
  connected: boolean;
  toolCount: number;
  state: string;
  lastError: string | null;
}

export interface TerminalInfoLite {
  id: string;
  backend: string;
  workspacePath: string;
  createdAt: number;
  lastActivity: number;
  exited: boolean;
}

export interface ScreenInfo {
  key: string;
  personaId: string | null;
  url: string | null;
  title: string | null;
  status: string;
  viewers: number;
  watchers: number;
}

export type RemoteEvent =
  | { proto: 1; ev: "host.state"; sessions: SessionInfo[]; screens?: unknown[] }
  | { proto: 1; ev: "session.list"; rid: string; sessions: SessionInfo[] }
  | {
      proto: 1;
      ev: "session.snapshot";
      rid?: string;
      sessionId: string;
      messages: TranscriptMsg[];
      latestSeq: number;
    }
  | {
      proto: 1;
      ev: "message.delta";
      sessionId: string;
      seq: number;
      delta: string;
    }
  | {
      proto: 1;
      ev: "message.done";
      sessionId: string;
      seq: number;
      finish: "stop" | "error" | "cancelled";
    }
  | {
      proto: 1;
      ev: "approval.request";
      sessionId?: string;
      approvalId: string;
      title: string;
      summary: string;
      risk: "low" | "medium" | "high";
    }
  | {
      proto: 1;
      ev: "approval.resolved";
      approvalId: string;
      resolution: "approved" | "rejected" | "timeout";
    }
  | {
      proto: 1;
      ev: "delegation.update";
      sessionId?: string;
      jobId: string;
      state: "started" | "progress" | "done" | "paused";
      detail?: string;
    }
  | { proto: 1; ev: "projects.list"; rid: string; projects: ProjectSummary[] }
  | { proto: 1; ev: "project.detail"; rid: string; project: ProjectLite; taskStats: TaskStats; activeDelegations: number }
  | { proto: 1; ev: "project.tasks"; rid: string; projectId: string; tree: TaskNode[] }
  | { proto: 1; ev: "project.files"; rid: string; projectId: string; tree: FileNode[] }
  | { proto: 1; ev: "project.file"; rid: string; projectId: string; relPath: string; content: string; truncated: boolean }
  | { proto: 1; ev: "project.team"; rid: string; projectId: string; roster: RosterEntry[]; delegations: DelegationJob[] }
  | { proto: 1; ev: "project.activity"; rid: string; projectId: string; entries: ActivityEntry[] }
  | { proto: 1; ev: "project.sessions"; rid: string; projectId: string; sessions: SessionInfo[] }
  | { proto: 1; ev: "personas.list"; rid: string; personas: PersonaLite[] }
  | { proto: 1; ev: "settings.state"; rid?: string } & SettingsState
  | { proto: 1; ev: "settings.usage"; rid: string; summary: UsageSummaryLite; matrix: UsageMatrixRow[] }
  | { proto: 1; ev: "settings.mcp"; rid: string; servers: McpServerLite[] }
  | { proto: 1; ev: "reset.acked"; rid: string; scope: string }
  | { proto: 1; ev: "terminal.list"; rid: string; sessions: TerminalInfoLite[] }
  | { proto: 1; ev: "terminal.state"; rid?: string; id: string; info: TerminalInfoLite; replay: string }
  | { proto: 1; ev: "terminal.output"; id: string; data: string }
  | { proto: 1; ev: "screens.list"; rid: string; screens: ScreenInfo[] }
  | { proto: 1; ev: "screen.state"; rid?: string; key: string; status: string; title: string | null; url: string | null }
  | { proto: 1; ev: "screen.frame"; key: string; data: string }
  | { proto: 1; ev: "error"; rid?: string; code: string; message: string }
  | { proto: 1; ev: "pong_host"; rid: string };

export interface RemoteAction {
  proto: 1;
  act: string;
  rid?: string;
  [k: string]: unknown;
}

// ── Sesi remote control ─────────────────────────────────────────────────────

export type RemoteConnState =
  | "connecting"
  | "joined"
  | "host-offline"
  | "reconnecting"
  | "gone"
  /** bye 4001: device di-unlink dari akun — terminal, user harus login ulang. */
  | "logged-out";

export interface RemoteSessionOpts {
  relayUrl: string;
  device: DeviceKeys;
  hostId: string;
  onEvent: (ev: RemoteEvent) => void;
  onState: (state: RemoteConnState, detail?: string) => void;
}

let ridCounter = 0;
function nextRid(): string {
  ridCounter += 1;
  return `m-${Date.now().toString(36)}-${ridCounter}`;
}

export class RemoteSession {
  private ws: WebSocket | null = null;
  private hostDhPub = "";
  private state: RemoteConnState = "connecting";
  private queue: RemoteAction[] = [];
  private closedByUser = false;
  private joinDeadline = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private backoff = 500;
  /** v1.2: rid → promise pending untuk request/response (RPC ringan). */
  private pending = new Map<string, { resolve: (e: RemoteEvent) => void; reject: (err: RelayError) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(private readonly opts: RemoteSessionOpts) {}

  /**
   * v1.2: request RPC — kirim action ber-rid, resolve pada event balasan
   * ber-rid sama; reject pada error atau timeout (default 12 dtk).
   */
  request<T = RemoteEvent>(act: string, extra: Record<string, unknown> = {}, timeoutMs = 12_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.state === "gone" || this.state === "logged-out") {
        reject(new RelayError("remote session closed"));
        return;
      }
      const rid = nextRid();
      const timer = setTimeout(() => {
        this.pending.delete(rid);
        reject(new RelayError("host response timeout"));
      }, timeoutMs);
      this.pending.set(rid, {
        resolve: (e) => {
          clearTimeout(timer);
          this.pending.delete(rid);
          resolve(e as T);
        },
        reject: (err) => {
          clearTimeout(timer);
          this.pending.delete(rid);
          reject(err);
        },
        timer,
      });
      void this.sendAction({ proto: 1, act, rid, ...extra });
    });
  }

  private settleRid(ev: RemoteEvent): void {
    const rid = (ev as { rid?: string }).rid;
    if (!rid) return;
    const p = this.pending.get(rid);
    if (!p) return;
    if (ev.ev === "error") p.reject(new RelayError(ev.message || ev.code));
    else p.resolve(ev);
  }

  get connState(): RemoteConnState {
    return this.state;
  }

  connect(): void {
    this.closedByUser = false;
    this.joinDeadline = Date.now() + 30_000;
    this.open();
  }

  private setState(s: RemoteConnState, detail?: string): void {
    if (this.state === s && s !== "reconnecting") return;
    this.state = s;
    this.opts.onState(s, detail);
  }

  private open(): void {
    this.setState(this.opts.hostId ? "connecting" : "connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.relayUrl);
    } catch {
      this.scheduleReconnect("cannot reach relay");
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 500; // sukses connect → reset backoff
    };
    ws.onerror = () => {
      /* close handler yang memutuskan */
    };
    ws.onclose = () => {
      this.stopPing();
      if (this.closedByUser) return;
      this.scheduleReconnect("connection closed");
    };
    ws.onmessage = (ev: WebSocketMessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
      } catch {
        return; // frame aneh diabaikan
      }
      this.handleServer(msg);
    };
  }

  private handleServer(msg: Record<string, unknown>): void {
    switch (msg.t) {
      case "hello": {
        const nonce = String(msg.nonce ?? "");
        const sig = signChallenge(
          this.opts.device.signPriv,
          this.opts.device.deviceId,
          nonce,
        );
        this.send({ t: "auth", deviceId: this.opts.device.deviceId, sig });
        break;
      }
      case "auth_ok":
        // (re)connect sukses → join ulang (idempotent, SPEC §4.3/§10).
        this.send({
          t: "join",
          hostId: this.opts.hostId,
          dhPub: this.opts.device.dhPub,
        });
        break;
      case "joined": {
        this.hostDhPub = String(msg.hostDhPub ?? "");
        this.setState("joined");
        this.startPing();
        this.flush();
        break;
      }
      case "data": {
        const payload = String(msg.payload ?? "");
        if (!this.hostDhPub) return;
        try {
          const pt = openBox(
            {
              deviceId: this.opts.device.deviceId,
              dhPriv: this.opts.device.dhPriv,
            },
            { deviceId: this.opts.hostId, dhPub: this.hostDhPub },
            payload,
          );
          const parsed = JSON.parse(pt) as Record<string, unknown>;
          // Validasi longgar: proto + discriminant string; unknown diabaikan.
          if (parsed.proto !== 1 || typeof parsed.ev !== "string") return;
          const re = parsed as unknown as RemoteEvent;
          this.settleRid(re); // v1.2: RPC reply/error by rid
          this.opts.onEvent(re);
        } catch {
          // box rusak/kunci salah: diam (bisa di-log host), jangan putus sesi.
        }
        break;
      }
      case "host_offline":
        this.setState("host-offline");
        this.stopPing();
        break;
      case "host_back":
        this.setState("joined");
        this.startPing();
        this.flush();
        break;
      case "err":
        // kondisi transien (v1: 4104 host offline saat join) → tetap hidup.
        break;
      case "bye": {
        const code = Number(msg.code ?? 0);
        const error = String(msg.error ?? `bye ${code}`);
        this.teardown();
        if (code === 4001) {
          this.setState("logged-out", error);
          return; // terminal: jangan reconnect
        }
        if (code === 4104 && Date.now() < this.joinDeadline) {
          this.setState("reconnecting", error);
          this.scheduleReconnect(error, 800);
          return;
        }
        this.setState("gone", error);
        break;
      }
      default:
        break; // forward-compat
    }
  }

  private scheduleReconnect(reason: string, delayOverride?: number): void {
    if (this.closedByUser) return;
    this.teardown();
    if (Date.now() > this.joinDeadline && this.state !== "joined") {
      this.setState("gone", reason);
      return;
    }
    this.setState("reconnecting", reason);
    const delay = delayOverride ?? Math.min(this.backoff, 4_000);
    this.backoff = Math.min(this.backoff * 2, 4_000);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      void this.sendAction({ proto: 1, act: "ping_host", rid: nextRid() });
    }, 20_000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /** Kirim RemoteAction ke host (seal E2E; antrian bila belum joined). */
  async sendAction(action: RemoteAction): Promise<void> {
    if (this.state !== "joined" || !this.hostDhPub || !this.ws) {
      this.queue.push(action);
      return;
    }
    const box = sealBox(
      { deviceId: this.opts.device.deviceId, dhPriv: this.opts.device.dhPriv },
      { deviceId: this.opts.hostId, dhPub: this.hostDhPub },
      JSON.stringify(action),
    );
    this.send({ t: "data", payload: box });
  }

  private flush(): void {
    const q = this.queue.splice(0);
    for (const a of q) void this.sendAction(a);
  }

  private send(obj: Record<string, unknown>): void {
    try {
      this.ws?.send(JSON.stringify(obj));
    } catch {
      /* onclose yang menyusul akan reconnect */
    }
  }

  private teardown(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {
      /* already closed */
    }
  }

  close(): void {
    this.closedByUser = true;
    this.queue.length = 0;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new RelayError("remote session closed"));
    }
    this.pending.clear();
    this.teardown();
  }
}

export { nextRid };
