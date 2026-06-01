// 자동 업데이트 (electron-updater + GitHub releases, clawd-on-desk 동형).
// 주의(E1/v1): mac ad-hoc 미서명 빌드는 Squirrel.Mac 적용이 안 되므로 실질 no-op.
// 서명+notarization(v2) 후 활성화된다. 배선만 갖춰 두고 dev/미서명에선 조용히 skip.
import { app } from "electron";

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function initUpdater(): void {
  if (!app.isPackaged) return; // dev 빌드 skip
  void (async () => {
    try {
      const { autoUpdater } = await import("electron-updater");
      autoUpdater.autoDownload = true;
      await autoUpdater.checkForUpdatesAndNotify();
      setInterval(() => void autoUpdater.checkForUpdatesAndNotify(), SIX_HOURS);
    } catch {
      // 미서명/릴리스 없음 → 조용히 무시 (앱 동작엔 영향 없음)
    }
  })();
}
