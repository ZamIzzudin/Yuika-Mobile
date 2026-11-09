/**
 * Crypto device keys untuk Yuika mobile — byte-format SAMA dengan
 * @yuika/crypto (studio): Ed25519 (sign) + X25519 (DH) sebagai PKCS8/SPKI
 * PEM node-compatible, deviceId `dev_` + 8 byte hex. Relay memvalidasi
 * bentuk SPKI PEM persis ini sebelum device boleh terdaftar.
 *
 * Primitif pure-JS @noble/curves (jalan di Hermes tanpa polyfill).
 */
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { getRandomBytes } from "expo-crypto";

export interface DeviceKeys {
  deviceId: string;
  signPriv: string;
  signPub: string;
  dhPriv: string;
  dhPub: string;
}

// ── base64 (tanpa Buffer) ──────────────────────────────────────────────────

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToB64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2]!;
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]!;
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]!;
    out += b2 === undefined ? "=" : B64[b2 & 63]!;
  }
  return out;
}

export function b64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]!);
    const c1 = B64.indexOf(clean[i + 1] ?? "A");
    const c2 = B64.indexOf(clean[i + 2] ?? "A");
    const c3 = B64.indexOf(clean[i + 3] ?? "A");
    out[o++] = (c0 << 2) | (c1 >> 4);
    if (clean[i + 2] && clean[i + 2] !== "=")
      out[o++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (clean[i + 3] && clean[i + 3] !== "=") out[o++] = ((c2 & 3) << 6) | c3;
  }
  return out.subarray(0, o);
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── PEM PKCS8/SPKI (header DER standar, identik export node:crypto) ───────

const ED_PKCS8 = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04,
  0x22, 0x04, 0x20,
]);
const ED_SPKI = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
const X_PKCS8 = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04,
  0x22, 0x04, 0x20,
]);
const X_SPKI = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00,
]);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function pemEncode(
  der: Uint8Array,
  label: "PRIVATE KEY" | "PUBLIC KEY",
): string {
  const b64 = bytesToB64(der);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** Ekstrak raw 32-byte dari PKCS8 PEM (seed Ed25519 / scalar X25519). */
function pkcs8ToRaw(privPem: string): Uint8Array {
  const der = b64ToBytes(privPem.replace(/-----[A-Z ]+-----|\s/g, ""));
  return der.subarray(der.length - 32);
}

/** Generate keypair device baru (deviceId `dev_` + 8 byte hex, idem studio). */
export function generateDeviceKeys(): DeviceKeys {
  const signSeed = getRandomBytes(32);
  const dhScalar = getRandomBytes(32);
  const signPubBytes = ed25519.getPublicKey(signSeed);
  const dhPubBytes = x25519.getPublicKey(dhScalar);
  return {
    deviceId: `dev_${hex(getRandomBytes(8))}`,
    signPriv: pemEncode(concat(ED_PKCS8, signSeed), "PRIVATE KEY"),
    signPub: pemEncode(concat(ED_SPKI, signPubBytes), "PUBLIC KEY"),
    dhPriv: pemEncode(concat(X_PKCS8, dhScalar), "PRIVATE KEY"),
    dhPub: pemEncode(concat(X_SPKI, dhPubBytes), "PUBLIC KEY"),
  };
}

/** `sig = base64(Ed25519(seed, deviceId|nonce))` — auth relay SPEC §3. */
export function signChallenge(
  signPrivPem: string,
  deviceId: string,
  nonce: string,
): string {
  const seed = pkcs8ToRaw(signPrivPem);
  const msg = new TextEncoder().encode(`${deviceId}|${nonce}`);
  return bytesToB64(ed25519.sign(msg, seed));
}

/** Seal payload ke host (X25519 ECDH + HKDF + AES-GCM) — fase remote (B8). */
export function deriveSharedKey(
  dhPrivPem: string,
  dhPubPem: string,
): Uint8Array {
  const scalar = pkcs8ToRaw(dhPrivPem);
  const theirPub = b64ToBytes(
    dhPubPem.replace(/-----[A-Z ]+-----|\s/g, ""),
  ).subarray(12);
  return x25519.getSharedSecret(scalar, theirPub);
}

// ── Envelope E2E (SPEC-PROTOCOL §5; identik @yuika/crypto seal/open) ───────
// key = HKDF-SHA256(X25519(dhPriv, peerDhPub), salt=aad, info="", L=32);
// box = base64(iv[12] ‖ AES-256-GCM ct ‖ tag[16]), AAD = "from.deviceId|to.deviceId".

const IV_LEN = 12;
const KEY_LEN = 32;

function deriveBoxKey(
  dhPrivPem: string,
  peerDhPubPem: string,
  aad: string,
): Uint8Array {
  const secret = deriveSharedKey(dhPrivPem, peerDhPubPem);
  const salt = new TextEncoder().encode(aad);
  return hkdf(sha256, secret, salt, new Uint8Array(0), KEY_LEN);
}

/** Seal RemoteAction → base64 box. */
export function sealBox(
  from: { deviceId: string; dhPriv: string },
  to: { deviceId: string; dhPub: string },
  plaintext: string,
): string {
  const aad = `${from.deviceId}|${to.deviceId}`;
  const key = deriveBoxKey(from.dhPriv, to.dhPub, aad);
  const iv = getRandomBytes(IV_LEN);
  const aadBytes = new TextEncoder().encode(aad);
  const ct = gcm(key, iv, aadBytes).encrypt(
    new TextEncoder().encode(plaintext),
  );
  return bytesToB64(concat(iv, ct));
}

/** Buka box dari host → string JSON; throw bila kunci/AAD salah. */
export function openBox(
  to: { deviceId: string; dhPriv: string },
  from: { deviceId: string; dhPub: string },
  boxB64: string,
): string {
  const aad = `${from.deviceId}|${to.deviceId}`;
  const key = deriveBoxKey(to.dhPriv, from.dhPub, aad);
  const raw = b64ToBytes(boxB64);
  if (raw.length < IV_LEN + 16) throw new Error("box too short");
  const iv = raw.subarray(0, IV_LEN);
  const ct = raw.subarray(IV_LEN);
  const pt = gcm(key, iv, new TextEncoder().encode(aad)).decrypt(ct);
  return new TextDecoder().decode(pt);
}
