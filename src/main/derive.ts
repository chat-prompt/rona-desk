// 펫 위상/무드 파생 — 순수 로직 (electron 무의존, 단위 테스트 가능).
import type {
  PetMood,
  PetPhase,
  PetUpdate,
  ProgressData,
  SkillEventType,
  SkillStatus,
} from "../shared/types";
import type { PollResult } from "./poller";

export const MOOD_BY_EVENT: Record<SkillEventType, PetMood> = {
  skill_started: "wake",
  tool_used: "observe",
  checkpoint_saved: "nod",
  step_consent: "listen",
  user_steer: "listen",
  direction_aligned: "align",
  user_note: "proud",
  skill_completed: "celebrate",
};

/** 위상 = 진행도. completed 는 skill_completed 직접 판정(admin 착시 비복제). */
export function derivePhase(data: ProgressData | null): PetPhase {
  if (!data) return "seed";
  if (data.progress.completed) return "bloom";
  if (data.progress.totalEvents > 0) return "sprout";
  return "seed";
}

/** 가장 최근 활동(lastEvent 시각 최댓값) 스킬을 전면에. */
export function pickActive(statuses: SkillStatus[]): SkillStatus | null {
  const withData = statuses.filter((s) => s.data);
  if (withData.length === 0) return statuses[0] ?? null;
  return [...withData].sort((a, b) => {
    const ta = a.data?.progress.lastEvent?.occurredAt ?? "";
    const tb = b.data?.progress.lastEvent?.occurredAt ?? "";
    return tb.localeCompare(ta);
  })[0];
}

export function buildUpdate(result: PollResult): PetUpdate {
  const active = pickActive(result.statuses);
  const phase = derivePhase(active?.data ?? null);
  const newEvent = active ? (result.newEvents.get(active.token) ?? null) : null;

  let mood: PetMood;
  if (active?.offline) mood = "napping";
  else if (newEvent) mood = MOOD_BY_EVENT[newEvent];
  else if (!active?.data) mood = "empty";
  else mood = "idle";

  return { phase, mood, active, all: result.statuses, newEvent };
}
