// esbuild 기반 빌드: main/preload(CJS, node) + renderer(IIFE, browser) 번들.
// electron / electron-updater 만 external — electron-store/glob(ESM-only) 은 번들로 인라인해
// CJS main 의 ESM require 충돌을 회피한다.
import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

const common = { bundle: true, sourcemap: true, logLevel: "info" };
const external = ["electron", "electron-updater"];

await mkdir("dist/renderer", { recursive: true });

await build({
  ...common,
  entryPoints: ["src/main/index.ts"],
  outfile: "dist/main/index.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  external,
});

await build({
  ...common,
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload/index.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["electron"],
});

await build({
  ...common,
  entryPoints: ["src/renderer/renderer.ts"],
  outfile: "dist/renderer/renderer.js",
  platform: "browser",
  format: "iife",
  target: "chrome120",
});

await cp("src/renderer/index.html", "dist/renderer/index.html");

console.log("build complete");
