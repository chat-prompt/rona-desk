import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { watchHomeRegistry } from "../registry-watcher";

let base: string;
const cleanups: Array<() => void> = [];

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "rona-reg-watch-"));
});
afterEach(async () => {
  while (cleanups.length) cleanups.pop()!();
  await rm(base, { recursive: true, force: true });
});

/** count 가 목표 이상이 될 때까지 폴링 (실 fs.watch 타이밍 흡수). */
async function waitUntil(pred: () => boolean, timeout = 2000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return pred();
}

describe("watchHomeRegistry", () => {
  it("디렉토리 변화 시 debounce 후 onChange 호출", async () => {
    const regDir = path.join(base, "installed");
    await mkdir(regDir, { recursive: true });
    let calls = 0;
    const stop = watchHomeRegistry(() => calls++, regDir, { debounceMs: 40 });
    cleanups.push(stop);

    await writeFile(path.join(regDir, "rona-aaaaaaaa.json"), '{"practice_id":"x"}');
    // 전체 스위트 동시 실행 시 FSEvents 지연 경합 흡수를 위해 넉넉한 타임아웃.
    const ok = await waitUntil(() => calls >= 1, 5000);
    expect(ok).toBe(true);
  });

  it("정리 함수 호출 후에는 더 호출하지 않음", async () => {
    const regDir = path.join(base, "installed");
    await mkdir(regDir, { recursive: true });
    let calls = 0;
    const stop = watchHomeRegistry(() => calls++, regDir, { debounceMs: 40 });
    stop();
    await writeFile(path.join(regDir, "rona-bbbbbbbb.json"), '{"practice_id":"y"}');
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toBe(0);
  });

  it("디렉토리가 나중에 생기면 watch 시작 + onChange", async () => {
    const regDir = path.join(base, "installed"); // 아직 없음
    let calls = 0;
    const stop = watchHomeRegistry(() => calls++, regDir, { debounceMs: 40, retryMs: 80 });
    cleanups.push(stop);

    await new Promise((r) => setTimeout(r, 50)); // 첫 start 가 ENOENT 로 재시도 예약된 뒤
    await mkdir(regDir, { recursive: true });
    await writeFile(path.join(regDir, "rona-cccccccc.json"), '{"practice_id":"z"}');
    const ok = await waitUntil(() => calls >= 1, 2500);
    expect(ok).toBe(true);
  });
});
