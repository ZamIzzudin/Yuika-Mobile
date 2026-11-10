/**
 * Push notification (MOB-3, D76): daftarkan FCM token device ini ke portal
 * (POST /api/devices/push-token, sig auth sama dengan unlink-self) dan
 * sediakan handler tap notifikasi (data {hostId} → buka host terkait).
 *
 * Degrade halus: tanpa google-services.json (Firebase belum di-setup) atau
 * izin ditolak → registrasi dilewati diam-diam; aplikasi tetap berfungsi
 * penuh via relay (approval live + replay pending saat join, D76 studio).
 */
import { useEffect, useRef } from "react";
import { getRandomBytes } from "expo-crypto";
import * as Notifications from "expo-notifications";

import { bytesToB64, signChallenge, type DeviceKeys } from "./crypto";

export interface PushTapInfo {
  hostId?: string;
  kind?: string;
  approvalId?: string;
}

function readData(r: Notifications.NotificationResponse | null): PushTapInfo | null {
  const d = r?.notification.request.content.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return null;
  const info: PushTapInfo = {};
  if (typeof d.hostId === "string") info.hostId = d.hostId;
  if (typeof d.kind === "string") info.kind = d.kind;
  if (typeof d.approvalId === "string") info.approvalId = d.approvalId;
  return Object.keys(info).length > 0 ? info : null;
}

/** Best-effort register token FCM ke portal. Semua kegagalan ditelan. */
export async function registerPushToken(portalUrl: string, device: DeviceKeys): Promise<void> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;
    // Tanpa google-services.json panggilan ini throw (Firebase belum init) —
    // diamkan: admin portal belum setup FCM untuk build ini.
    const token = (await Notifications.getDevicePushTokenAsync()).data as string;
    if (typeof token !== "string" || token.length < 20) return;
    const nonce = bytesToB64(getRandomBytes(16));
    const sig = signChallenge(device.signPriv, device.deviceId, nonce);
    await fetch(`${portalUrl.replace(/\/$/, "")}/api/devices/push-token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: device.deviceId, nonce, sig, provider: "fcm", token }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    /* push opsional */
  }
}

/**
 * Tap notifikasi (termasuk cold-start via getLastNotificationResponseAsync).
 * Handler dipanggil sekali per response; berikan konsumsi idempotent.
 */
export function usePushTap(handler: (info: PushTapInfo) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    let last = "";
    const deliver = (r: Notifications.NotificationResponse | null): void => {
      const info = readData(r);
      if (!info) return;
      const key = `${info.hostId ?? ""}|${info.approvalId ?? ""}|${r?.notification.date ?? 0}`;
      if (key === last) return;
      last = key;
      ref.current(info);
    };
    void Notifications.getLastNotificationResponseAsync().then(deliver);
    const sub = Notifications.addNotificationResponseReceivedListener(deliver);
    return () => sub.remove();
  }, []);
}
