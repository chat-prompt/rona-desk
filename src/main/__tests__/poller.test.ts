import { describe, it, expect, vi, afterEach } from "vitest";
import { Poller } from "../poller";
import type { ProgressData } from "../../shared/types";

function progressWith(occurredAt: string): ProgressData {
  return {
    generation: { installToken: "tok", title: "s", taskPreview: "", targetPlatform: "claude_code", createdAt: "x" },
    progress: {
      completed: false,
      lastEvent: { eventType: "checkpoint_saved", occurredAt },
      stepCounts: {
        skill_started: 1,
        tool_used: 0,
        checkpoint_saved: 1,
        skill_completed: 0,
        user_note: 0,
        direction_aligned: 0,
        step_consent: 0,
        user_steer: 0,
      },
      totalEvents: 2,
    },
    timeline: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Poller diff", () => {
  it("lastEvent 변화 시에만 newEvents 발생", async () => {
    let occurredAt = "2026-06-01T01:00:00Z";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: progressWith(occurredAt) }) })),
    );

    const results: { newEvents: Map<string, string> }[] = [];
    const p = new Poller(
      () => "https://x",
      () => ["tok"],
      (r) => results.push(r),
    );

    await p.tick(); // 최초: null → event 도착 = 신규
    expect(results[0].newEvents.get("tok")).toBe("checkpoint_saved");

    await p.tick(); // 동일 occurredAt → 신규 없음
    expect(results[1].newEvents.has("tok")).toBe(false);

    occurredAt = "2026-06-01T02:00:00Z";
    await p.tick(); // 변화 → 신규
    expect(results[2].newEvents.get("tok")).toBe("checkpoint_saved");
  });

  it("fetch 실패 시 offline + 마지막 캐시 유지", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: progressWith("2026-06-01T01:00:00Z") }) })),
    );
    const results: { statuses: { offline: boolean; data: ProgressData | null }[] }[] = [];
    const p = new Poller(
      () => "https://x",
      () => ["tok"],
      (r) => results.push(r as never),
    );
    await p.tick();
    expect(results[0].statuses[0].offline).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await p.tick();
    expect(results[1].statuses[0].offline).toBe(true);
    expect(results[1].statuses[0].data).not.toBeNull(); // 캐시 유지
  });
});
