import { describe, it, expect } from "vitest";
import { derivePhase, pickActive, buildUpdate } from "../derive";
import type { PollResult } from "../poller";
import type { ProgressData, SkillEventType, SkillStatus } from "../../shared/types";

function pd(opts: {
  completed?: boolean;
  total?: number;
  lastEvent?: SkillEventType | null;
  occurredAt?: string;
  userNote?: number;
}): ProgressData {
  const { completed = false, total = 0, lastEvent = null, occurredAt = "2026-06-01T01:00:00Z", userNote = 0 } = opts;
  return {
    generation: {
      installToken: "t",
      title: "s",
      taskPreview: "",
      targetPlatform: "claude_code",
      createdAt: "2026-06-01T00:00:00Z",
    },
    progress: {
      completed,
      lastEvent: lastEvent ? { eventType: lastEvent, occurredAt } : null,
      stepCounts: {
        skill_started: 0,
        tool_used: 0,
        checkpoint_saved: 0,
        skill_completed: completed ? 1 : 0,
        user_note: userNote,
        direction_aligned: 0,
        step_consent: 0,
        user_steer: 0,
      },
      totalEvents: total,
    },
    timeline: [],
  };
}

function status(token: string, data: ProgressData | null, offline = false): SkillStatus {
  return { token, data, lastSyncedAt: data ? 1 : null, offline };
}

function result(statuses: SkillStatus[], newEvents: [string, SkillEventType][] = []): PollResult {
  return { statuses, newEvents: new Map(newEvents) };
}

describe("derivePhase", () => {
  it("seed when no data / no events", () => {
    expect(derivePhase(null)).toBe("seed");
    expect(derivePhase(pd({ total: 0 }))).toBe("seed");
  });
  it("sprout when events exist but not completed", () => {
    expect(derivePhase(pd({ total: 3 }))).toBe("sprout");
  });
  it("bloom when completed", () => {
    expect(derivePhase(pd({ completed: true, total: 5 }))).toBe("bloom");
  });
});

describe("buildUpdate — admin 착시 비복제", () => {
  it("completed → bloom EVEN IF user_note 0 (후기 없어도 완주는 완주)", () => {
    const u = buildUpdate(result([status("t", pd({ completed: true, total: 5, userNote: 0 }))]));
    expect(u.phase).toBe("bloom");
  });
  it("offline → napping mood, 캐시 위상 유지", () => {
    const u = buildUpdate(result([status("t", pd({ total: 2 }), true)]));
    expect(u.mood).toBe("napping");
    expect(u.phase).toBe("sprout");
  });
  it("new checkpoint event → nod mood", () => {
    const u = buildUpdate(result([status("t", pd({ total: 2, lastEvent: "checkpoint_saved" }))], [["t", "checkpoint_saved"]]));
    expect(u.mood).toBe("nod");
  });
  it("no active data → empty mood", () => {
    const u = buildUpdate(result([status("t", null)]));
    expect(u.mood).toBe("empty");
  });
});

describe("pickActive", () => {
  it("가장 최근 lastEvent 시각의 스킬을 고른다", () => {
    const older = status("old", pd({ total: 1, lastEvent: "tool_used", occurredAt: "2026-06-01T01:00:00Z" }));
    const newer = status("new", pd({ total: 1, lastEvent: "checkpoint_saved", occurredAt: "2026-06-01T05:00:00Z" }));
    expect(pickActive([older, newer])?.token).toBe("new");
  });
});
