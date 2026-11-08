# Yuika Mobile

Remote client for Yuika hosts (deployed studios and desktop hosts), signed in
through the central [Yuika Portal](https://github.com/ZamIzzudin/Yuika-Portal).

## Phase status

- **B7 (current): sign-in + host list.** The app signs in with the portal
  (OAuth code + PKCE, redirect via the `yuika://` scheme), claims its mobile
  device with locally generated keys, and lists every host registered with
  the account over the relay WebSocket (auth = Ed25519 challenge).
- **B8 (next): remote control.** Join a host and drive it over the
  end-to-end encrypted data channel (X25519 sealed frames).

## How it works

1. The app generates an Ed25519 signing key and an X25519 DH key on device
   (byte-compatible with `@yuika/crypto`; the private keys never leave the
   phone, storage is `expo-secure-store`).
2. `yuika://auth/callback` carries the OAuth code back from the portal
   consent screen; the code exchanges for identity plus a one-time
   `deviceToken` (kind `mobile`).
3. `POST /api/devices/claim` registers the device. Keys are stable across
   re-logins (idempotent by public key); the account has a single mobile
   slot, so unlink an old phone on the portal Devices page first.
4. The relay URL is discovered via `GET /api/relay-info` on the portal.

## Run

```bash
npm install
npx expo start
```

> The `yuika://` callback requires a development build or standalone app
> (`npx expo run:android` / EAS); inside Expo Go the custom scheme may not
> round-trip.

## Portal operator checklist

- `PORTAL_RELAY_URL` must be set on the portal web service (public relay WS
  URL, e.g. `wss://yuika-relay.notu.dev/ws`) for host discovery to work.
