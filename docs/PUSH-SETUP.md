# Push Setup (FCM, D76 / MOB-3)

Push approval dari lock screen. Pipeline lengkap sudah ada (portal + host
studio + app); yang dibutuhkan hanya project Firebase. Tanpa setup ini app
tetap berfungsi penuh lewat relay (approval live + replay pending saat join).

## 1. Firebase project (satu kali)

1. https://console.firebase.google.com → buat project (mis. `yuika`).
2. Project settings → Service accounts → Generate new private key → JSON.
   Simpan tiga nilai untuk env portal (langkah 3).
3. Android app → tambahkan aplikasi dengan package name persis:
   `com.zamizzudin.yuika.mobile` → download `google-services.json`.

## 2. Mobile repo (repo ini)

Letakkan `google-services.json` di root repo (JANGAN di-commit; sudah
tercakup pattern `.gitignore` bila belum, tambahkan). `npx expo prebuild`
mendeteksi file ini otomatis dan mengaktifkan Firebase init. Tanpa file ini
registrasi token dilewati diam-diam (`src/push.ts` catch).

Build release Codemagic: commit file terenkripsi atau set sebagai environment
variable/file environment `GOOGLE_SERVICES_JSON` lalu tulis di script step
sebelum prebuild.

## 3. Portal

Set di service `portal-web` (Dokploy → Environment):

```
YUI_FCM_PROJECT_ID=<project-id>
YUI_FCM_CLIENT_EMAIL=<client_email dari JSON service account>
YUI_FCM_PRIVATE_KEY=<private_key dari JSON, satu baris dengan \n>
```

Redeploy portal. Verifikasi: `POST /api/push/notify` dari host tetap 200;
sebelum ada token terdaftar balasannya `skipped:"no-push-targets"`.

## 4. Alur uji (gerbang G-BETA < 10 detik)

1. Install APK di device, sign in portal (registrasi token otomatis setelah
   izin notifikasi diberikan).
2. Dari host studio, minta persona menjalankan perintah berisiko (mis.
   `run_command`) sampai muncul approval.
3. Notifikasi muncul di lock screen → tap → app membuka host terkait →
   approval tampil (live broadcast atau replay pending) → Approve.
4. Ukur: tap → approve < 10 detik.
