// 홈 레지스트리(~/.rona/installed) 라이브 감시.
// 앱이 *켜져 있는 동안* 새 맞춤 스킬이 설치되면(install 명령이 마커를 여기 떨굼) 자동 rescan.
// 디렉토리가 아직 없으면 생길 때까지 재시도 후 watch. fsevents 다중 발화 + 부분 write 안정화는 debounce 로 흡수.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_REG_DIR = path.join(os.homedir(), ".rona", "installed");
const DEBOUNCE_MS = 600;
const RETRY_MS = 5000;

/**
 * regDir 를 감시해 변화가 있으면 onChange 를 debounce 호출.
 * - 디렉토리 없음(ENOENT) → RETRY_MS 마다 재시도. 생긴 직후 1회 onChange (그때 들어온 마커 회수).
 * - 시작 시 디렉토리가 이미 있으면 onChange 호출 안 함 (startup rescan 이 이미 처리).
 * 반환: 정리 함수(앱 종료 시 호출).
 */
export function watchHomeRegistry(
  onChange: () => void,
  regDir: string = DEFAULT_REG_DIR,
  { debounceMs = DEBOUNCE_MS, retryMs = RETRY_MS }: { debounceMs?: number; retryMs?: number } = {},
): () => void {
  let watcher: fs.FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let stopped = false;

  const fire = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onChange, debounceMs);
  };

  const scheduleRetry = (): void => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!watcher) start(true); // 디렉토리가 이제 생겼으면 watch 시작 + 새로 들어온 마커 회수
    }, retryMs);
  };

  const start = (fireNow: boolean): void => {
    if (stopped) return;
    try {
      watcher = fs.watch(regDir, () => fire());
      watcher.on("error", () => {
        watcher?.close();
        watcher = null;
        scheduleRetry();
      });
      if (fireNow) fire();
    } catch {
      watcher = null;
      scheduleRetry(); // 대개 ENOENT — 디렉토리 생길 때까지 대기
    }
  };

  start(false);

  return () => {
    stopped = true;
    if (watcher) watcher.close();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (retryTimer) clearTimeout(retryTimer);
  };
}
