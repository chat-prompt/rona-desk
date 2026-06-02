// 다운로드 배포용 ad-hoc 서명. identity:null 은 electron-builder 가 번들 서명을 *건너뛰어*
// 번들 seal(_CodeSignature/CodeResources)이 없어진다 → 내부 Electron 바이너리만 linker ad-hoc 서명돼
// 불일치 → Apple Silicon + 다운로드(quarantine) 시 "손상됨"으로 거부(codesign --verify 실패).
// 여기서 번들 전체를 --force --deep --sign - 로 ad-hoc 재서명해 일관된 seal 을 만든다.
// (공증/Developer ID 아님 — 다운로드 후 격리 제거나 우클릭-열기는 여전히 필요하지만 "손상" 은 해소)
const { execSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execSync(`codesign --force --deep --sign - ${JSON.stringify(appPath)}`, { stdio: "inherit" });
  console.log(`[afterPack] ad-hoc signed: ${appPath}`);
};
