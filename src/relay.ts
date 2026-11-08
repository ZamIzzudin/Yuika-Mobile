/**
 * Klien relay minimal (SPEC-PROTOCOL v1, subset remote read-only fase B7):
 * connect → hello → auth (sign challenge Ed25519) → list_hosts → tutup.
 * Join + kanal data E2E (seal X25519) menyusul di fase B8 (remote control).
 */
import { signChallenge, type DeviceKeys } from "./crypto";

export interface HostEntry {
  deviceId: string;
  kind: "desktop" | "mobile" | "web";
  name: string;
  lastSeen: number;
}

export class RelayError extends Error {}

export async function listHosts(relayUrl: string, device: DeviceKeys, timeoutMs = 10_000): Promise<HostEntry[]> {
  return new Promise<HostEntry[]>((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new RelayError("relay timeout"));
    }, timeoutMs);
    const fail = (msg: string): void => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
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
          ws.send(JSON.stringify({ t: "auth", deviceId: device.deviceId, sig }));
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
