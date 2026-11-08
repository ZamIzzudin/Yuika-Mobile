/**
 * Kredensial tersimpan (SecureStore, terenkripsi OS): portal URL, identitas
 * akun, device keys, relay URL. Kunci TIDAK pernah keluar dari perangkat.
 */
import * as SecureStore from "expo-secure-store";
import type { DeviceKeys } from "./crypto";

export interface Session {
  portalUrl: string;
  relayUrl: string;
  accountId: string;
  email: string;
  device: DeviceKeys;
}

const KEY = "yuika.session.v1";

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(s: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(s));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
