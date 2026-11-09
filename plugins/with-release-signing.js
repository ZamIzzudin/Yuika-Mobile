/**
 * Config plugin: signing release dari keys/keystore.properties + keystore.
 * Dipasang via app.json → plugins. Patch android/app/build.gradle saat
 * prebuild, jadi CI cukup `expo prebuild` + `gradlew assembleRelease`.
 *
 * Template gradle RN/Expo modern sudah punya signingConfigs{release,debug}
 * (release bawaan = debug keystore) — plugin ini mengganti isi blok release
 * dan mengarahkan buildTypes.release ke signingConfig release.
 */
const { withAppBuildGradle, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PROPS_LOADER = [
  "def yuikaReleaseProps = new Properties()",
  'def yuikaPropsFile = rootProject.file("../keys/keystore.properties")',
  "if (yuikaPropsFile.exists()) {",
  "    yuikaReleaseProps.load(new FileInputStream(yuikaPropsFile))",
  "}",
].join("\n");

const SIGNING_CONFIGS = [
  "signingConfigs {",
  "        release {",
  "            if (yuikaPropsFile.exists()) {",
  '                storeFile rootProject.file(yuikaReleaseProps["storeFile"])',
  '                keyAlias yuikaReleaseProps["keyAlias"]',
  '                storePassword yuikaReleaseProps["storePassword"]',
  '                keyPassword yuikaReleaseProps["keyPassword"]',
  "            }",
  "        }",
  "        debug {",
  "            storeFile file('debug.keystore')",
  "            storePassword 'android'",
  "            keyAlias 'androiddebugkey'",
  "            keyPassword 'android'",
  "        }",
  "    }",
].join("\n");

function patchBuildGradle(src) {
  if (src.includes("yuikaReleaseProps")) return src; // idempotent
  let out = src;

  // 1. loader properties di dalam blok android { }
  out = out.replace("android {", `android {\n    ${PROPS_LOADER}\n`);

  // 2. ganti seluruh blok signingConfigs { ... } (muncul sebelum buildTypes)
  const replaced = out.replace(/signingConfigs \{[\s\S]*?\n    \}/, SIGNING_CONFIGS);
  if (replaced === out) {
    // template tanpa signingConfigs: sisipkan sebelum buildTypes
    out = out.replace("buildTypes {", `${SIGNING_CONFIGS}\n    buildTypes {`);
  } else {
    out = replaced;
  }

  // 3. buildTypes.release → pakai signingConfig release (bukan debug)
  out = out.replace(/buildTypes \{[\s\S]*?\n    \}/, (block) =>
    block.replace(
      /(release \{[\s\S]*?signingConfig )signingConfigs\.debug/,
      "$1signingConfigs.release",
    ),
  );

  return out;
}

module.exports = function withReleaseSigning(config) {
  // wrapper: timeout download distribusi gradle default 10 dtk terlalu pendek
  // utk runner CI yang flaky — naikkan ke 120 dtk (ditulis manual via
  // dangerous mod: withGradleWrapperProperties tidak tersedia di versi ini).
  const withWrapperTimeout = (cfg) =>
    withDangerousMod(cfg, [
      "android",
      (c) => {
        const fsx = require("fs");
        const pathx = require("path");
        const p = pathx.join(c.modRequest.platformProjectRoot, "gradle", "wrapper", "gradle-wrapper.properties");
        if (fsx.existsSync(p)) {
          const out = fsx
            .readFileSync(p, "utf8")
            .split("\n")
            .filter((l) => !l.startsWith("networkTimeout="))
            .concat("networkTimeout=120000")
            .join("\n");
          fsx.writeFileSync(p, out);
        }
        return c;
      },
    ]);

  return withDangerousMod(
    withWrapperTimeout(
      withAppBuildGradle(config, (cfg) => {
        cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
        return cfg;
      })
    ),
    [
      "android",
      (cfg) => {
        const k = path.join(cfg.modRequest.projectRoot, "keys", "yuika-release.keystore");
        if (!fs.existsSync(k)) {
          throw new Error("keys/yuika-release.keystore tidak ditemukan — build release butuh keystore.");
        }
        return cfg;
      },
    ],
  );
};
