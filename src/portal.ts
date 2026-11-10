/**
 * Login via portal (OAuth code + PKCE, mirror alur studio web D51b/CP-3):
 * 1. app generate verifier/challenge S256 + device keys lokal
 * 2. WebBrowser → halaman /authorize portal (client yuika-mobile, redirect
 *    custom scheme yuika://auth/callback)
 * 3. exchange code → {accountId, email, deviceToken(kind mobile)}
 * 4. claim device (kunci stabil: re-login pakai kunci tersimpan → idempotent;
 *    slot mobile 1 per akun, device lain = 409 → minta unlink di portal)
 */
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { bytesToB64, generateDeviceKeys, signChallenge, type DeviceKeys } from "./crypto";

export const REDIRECT_URI = "yuika://auth/callback";
export const DEFAULT_PORTAL = "https://yuika.notu.dev";

WebBrowser.maybeCompleteAuthSession();

function b64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(Crypto.getRandomBytes(48));
  const digestHex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
  return { verifier, challenge: b64url(hexToBytes(String(digestHex))) };
}

async function postJson(url: string, body: unknown, timeoutMs = 10_000): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

export interface LoginResult {
  accountId: string;
  email: string;
  device: DeviceKeys;
  relayUrl: string;
}

export class PortalError extends Error {}

/**
 * Melepaskan device ini dari akun portal (sign-out symmetry): sig =
 * Ed25519(deviceId|nonce) diverifikasi portal terhadap sign_pub tersimpan.
 * Slot mobile = 1 per akun — tanpa ini, sign-out membiarkan slot terisi dan
 * device mobile lain ditolak 409 sampai pemilik unlink manual di portal.
 * Best-effort: error ditelan pemanggil (sign-out lokal tetap jalan).
 */
export async function unlinkSelf(portalUrl: string, device: DeviceKeys): Promise<void> {
  const nonce = bytesToB64(Crypto.getRandomBytes(16));
  const sig = signChallenge(device.signPriv, device.deviceId, nonce);
  await postJson(
    `${portalUrl.replace(/\/$/, "")}/api/devices/unlink-self`,
    { deviceId: device.deviceId, nonce, sig },
    6_000,
  );
}

export async function loginWithPortal(portalUrl: string, existingKeys?: DeviceKeys): Promise<LoginResult> {
  const portal = portalUrl.replace(/\/+$/, "");
  const { verifier, challenge } = await pkce();
  const state = bytesToB64(Crypto.getRandomBytes(16));
  const authUrl =
    `${portal}/authorize?client=yuika-mobile` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&code_challenge=${challenge}&code_challenge_method=S256` +
    `&state=${encodeURIComponent(state)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
  if (result.type !== "success") throw new PortalError("sign-in canceled");
  const back = new URL(result.url);
  if (back.searchParams.get("state") !== state) throw new PortalError("state mismatch, try again");
  const error = back.searchParams.get("error");
  if (error) throw new PortalError(`portal rejected sign-in (${error})`);
  const code = back.searchParams.get("code");
  if (!code) throw new PortalError("no code in callback");

  // 3) exchange → identitas + deviceToken kind mobile
  const ex = await postJson(`${portal}/api/oauth/token`, {
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
  });
  if (!ex.ok || typeof ex.data.accountId !== "string" || typeof ex.data.email !== "string" || typeof ex.data.deviceToken !== "string") {
    throw new PortalError(String(ex.data.error ?? `token exchange failed (HTTP ${ex.status})`));
  }

  // 4) claim device (kunci stabil bila sudah ada → deviceId idempotent)
  const keys = existingKeys ?? generateDeviceKeys();
  const claim = await postJson(`${portal}/api/devices/claim`, {
    token: ex.data.deviceToken,
    kind: "mobile",
    name: "Yuika mobile",
    signPub: keys.signPub,
    dhPub: keys.dhPub,
  });
  if (!claim.ok || typeof claim.data.deviceId !== "string") {
    const err = String(claim.data.error ?? `claim failed (HTTP ${claim.status})`);
    if (claim.status === 409) {
      throw new PortalError("another mobile device is already linked to this account, unlink it on the portal Devices page first");
    }
    throw new PortalError(err);
  }
  keys.deviceId = claim.data.deviceId;

  // relay discovery (operator portal men-set PORTAL_RELAY_URL)
  const relay = await fetch(`${portal}/api/relay-info`).then((r) => r.json() as Promise<{ relayUrl?: string }>).catch(() => ({}) as { relayUrl?: string });
  if (!relay.relayUrl) throw new PortalError("portal has no relay configured (PORTAL_RELAY_URL)");

  return { accountId: ex.data.accountId, email: ex.data.email, device: keys, relayUrl: relay.relayUrl };
}
