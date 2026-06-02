// 작업 폴더의 rona-progress.html 에서 스킬이 갱신한 단계 서사(rona-progress-data JSON)를 읽는다.
// HTML 진행표와 *동일한 데이터* 를 앱이 그대로 렌더하기 위함. 네트워크 0, 로컬 파일만.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RonaProgress, RonaProgressStep, StepState } from "../shared/types";

const DATA_RE = /<script id="rona-progress-data" type="application\/json">([\s\S]*?)<\/script>/;
const STATES: readonly StepState[] = ["done", "active", "wait"];

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function coerceStep(raw: unknown): RonaProgressStep | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = asString(r.title);
  if (!title) return null;
  const state = STATES.includes(r.state as StepState) ? (r.state as StepState) : "wait";
  return { title, state, what: asString(r.what), detail: asString(r.detail) };
}

/** markerPath(.rona-skill.json) 형제 rona-progress.html 의 단계 서사를 파싱. 없거나 깨지면 null. */
export function readLocalProgress(markerPath: string): RonaProgress | null {
  try {
    const htmlPath = path.join(path.dirname(markerPath), "rona-progress.html");
    const html = readFileSync(htmlPath, "utf8");
    const m = DATA_RE.exec(html);
    if (!m) return null;
    const parsed = JSON.parse(m[1]) as Record<string, unknown>;

    const goalRaw = (parsed.goal ?? {}) as Record<string, unknown>;
    const goal = {
      title: asString(goalRaw.title),
      oneLiner: asString(goalRaw.oneLiner),
      where: asString(goalRaw.where),
      what: asString(goalRaw.what),
      how: asString(goalRaw.how),
    };

    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.map(coerceStep).filter((s): s is RonaProgressStep => s !== null)
      : [];

    const glossary = Array.isArray(parsed.glossary)
      ? parsed.glossary
          .map((g) => {
            const r = (g ?? {}) as Record<string, unknown>;
            const term = asString(r.term);
            return term ? { term, desc: asString(r.desc) ?? "" } : null;
          })
          .filter((g): g is { term: string; desc: string } => g !== null)
      : [];

    if (steps.length === 0 && !goal.title) return null; // 의미 있는 데이터 없음
    return { goal, steps, glossary };
  } catch {
    return null; // 파일 없음/권한/깨진 JSON → 조용히 fallback
  }
}
