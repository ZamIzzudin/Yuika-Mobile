# Yuika Mobile

The mobile shell for [Yuika](https://github.com/ZamIzzudin/Yuika), a Studio
Persona for Agentic AI. Early scaffold: the goal is a thin client that
onboards into a studio instance and pairs with the central Yuika portal
(linked devices), so you can watch runs, approve risky actions, and steer
personas from your phone.

Status: placeholder screen only. The pairing flow depends on the portal
relay and will land together with linked-device support in the studio.

## Develop

Requires Node.js 22 or newer.

```bash
npm install
npm start
```

Then scan the Expo Go QR code, or press `a` (Android emulator) / `i`
(iOS simulator).

## Related repositories

- [ZamIzzudin/Yuika](https://github.com/ZamIzzudin/Yuika) - the studio:
  web app, API, personas, skills, self-hosting deployment
- [ZamIzzudin/Yuika-Desktop](https://github.com/ZamIzzudin/Yuika-Desktop) -
  the Tauri desktop shell
