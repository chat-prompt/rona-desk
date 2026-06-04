// 진행 패널 — 발견된 스킬 *리스트*(선택 가능) + 선택한 스킬 상세.
// 발견은 ~/.rona/installed 단일 소스. 상세는 서버 ProgressData 로 네이티브 렌더(Warm Coral).
// 3축 독립(단계 진행 / 완주 배지 / 후기 칩)으로 admin "실행중 박제" 착시 차단.
import type {
  PetPhase,
  PetUpdate,
  RonaProgress,
  RonaProgressStep,
  SkillEventType,
  SkillStatus,
  StepState,
  TimelineEntry,
} from "../../shared/types";
import { derivePhase } from "../../main/derive";

const EVENT_LABEL: Record<SkillEventType, string> = {
  skill_started: "함께 시작",
  tool_used: "도구 사용",
  checkpoint_saved: "단계 저장",
  skill_completed: "완주",
  user_note: "후기 작성",
  direction_aligned: "방향 합의",
  step_consent: "단계 동의",
  user_steer: "방향 조정",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const m = Math.floor((Date.now() - then) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function skillTitle(s: SkillStatus): string {
  return s.data?.generation.title ?? s.title ?? "rona-skill";
}

function stepStateLabel(state: StepState): string {
  return state === "done" ? "완료" : state === "active" ? "진행 중" : "대기";
}

function stepCounts(p: RonaProgress): { done: number; total: number } {
  return { done: p.steps.filter((s) => s.state === "done").length, total: p.steps.length };
}

/** 리스트 행의 한 줄 상태 요약. */
function miniStatus(s: SkillStatus): string {
  if (s.data?.progress.completed) return "완주";
  if (s.offline && !s.data) return "오프라인";
  if (!s.data) return "불러오는 중";
  const cp = s.data.progress.stepCounts.checkpoint_saved;
  return s.data.progress.totalEvents === 0 ? "대기" : `${cp}단계`;
}

function skillRow(s: SkillStatus, selected: boolean): string {
  const phase: PetPhase = derivePhase(s.data ?? null);
  return `<button class="skill-row${selected ? " skill-row--sel" : ""}" data-skill-token="${s.token}">
    <span class="phase-dot phase-${phase}" aria-hidden="true"></span>
    <span class="skill-name">${escapeHtml(skillTitle(s))}</span>
    <span class="skill-mini">${miniStatus(s)}</span>
  </button>`;
}

function completionBadge(completed: boolean): string {
  if (!completed) return "";
  return `<span class="badge badge--done">
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    완주</span>`;
}

/** 진행 내역 섹션 — 이벤트가 없으면 빈 상태 안내를 보여준다(통째 생략 금지). */
function timelineSection(timeline: TimelineEntry[]): string {
  const head = `<div class="tl-head">진행 내역</div>`;
  if (timeline.length === 0) {
    return `${head}<p class="tl-empty">아직 진행 기록이 없어요. 스킬을 실행하면 단계가 여기 쌓여요.</p>`;
  }
  const items = timeline
    .slice(-8)
    .reverse()
    .map((e) => {
      const label = EVENT_LABEL[e.eventType] ?? e.eventType;
      const detail = e.tool ?? e.tool_name ?? e.label ?? "";
      const done = e.eventType === "skill_completed";
      return `<li class="tl-item${done ? " tl-item--done" : ""}">
        <span class="tl-dot" aria-hidden="true"></span>
        <span class="tl-label">${escapeHtml(label)}${detail ? ` <em>${escapeHtml(String(detail))}</em>` : ""}</span>
        <span class="tl-time">${relTime(e.occurredAt)}</span>
      </li>`;
    })
    .join("");
  return `${head}<ul class="timeline" aria-label="최근 진행">${items}</ul>`;
}

const TICK = `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// 설정(슬라이더) 아이콘 — 이모지 금지, SVG 프리미티브.
const GEAR = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="11" x2="13.5" y2="11"/><circle cx="6" cy="5" r="1.9" fill="var(--card-bg)"/><circle cx="10" cy="11" r="1.9" fill="var(--card-bg)"/></svg>`;

// 드래그 손잡이(grip dots) — 제목 바가 잡아서 옮기는 곳임을 시각화.
export const GRIP = `<svg class="grip" viewBox="0 0 8 14" width="8" height="14" aria-hidden="true"><circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/><circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/><circle cx="2" cy="12" r="1"/><circle cx="6" cy="12" r="1"/></svg>`;

function panelHead(): string {
  return `<div class="panel-head" title="여기를 잡고 옮기세요">
    ${GRIP}
    <span class="panel-title">Rona 학습 현황</span>
    <button class="iconbtn" data-action="open-settings" aria-label="설정">${GEAR}</button>
  </div>`;
}

/** 상세 하단 액션 — 새로고침 + 목록에서 제거(앱에서 숨김, 복원 가능). */
function detailActions(token: string): string {
  return `<div class="action-bar">
    <button class="btn btn--ghost" data-action="rescan">새로고침</button>
    <button class="btn btn--ghost btn--muted" data-action="dismiss-skill" data-value="${token}">목록에서 제거</button>
  </div>`;
}

function progressMeter(p: RonaProgress): string {
  const { done, total } = stepCounts(p);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `<div class="meter">
    <div class="meter-head"><span class="meter-label">전체 진행도</span><span class="meter-count"><b>${done}</b> / ${total} 단계</span></div>
    <div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div>
  </div>`;
}

function wayBlock(p: RonaProgress): string {
  const rows: Array<[string, string | undefined]> = [
    ["어디까지", p.goal.where],
    ["무엇을", p.goal.what],
    ["어떻게", p.goal.how],
  ];
  const items = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="way-item"><span class="way-k">${k}</span><span class="way-v">${escapeHtml(String(v))}</span></div>`)
    .join("");
  return items ? `<div class="way">${items}</div>` : "";
}

function stepCard(st: RonaProgressStep, idx: number): string {
  const marker = st.state === "done" ? TICK : String(idx + 1);
  const detailKey = st.state === "done" ? "결과" : "다음 액션";
  return `<div class="step step--${st.state}">
    <div class="step-top">
      <span class="step-n">${marker}</span>
      <span class="step-title">${escapeHtml(st.title)}</span>
      <span class="step-pill step-pill--${st.state}">${stepStateLabel(st.state)}</span>
    </div>
    ${st.what ? `<div class="step-row"><span class="step-k">무엇을</span><span class="step-v">${escapeHtml(st.what)}</span></div>` : ""}
    ${st.detail ? `<div class="step-row"><span class="step-k">${detailKey}</span><span class="step-v">${escapeHtml(st.detail)}</span></div>` : ""}
  </div>`;
}

function glossaryBlock(p: RonaProgress): string {
  if (p.glossary.length === 0) return "";
  const items = p.glossary
    .map((g) => `<div class="gloss-item"><span class="gloss-term">${escapeHtml(g.term)}</span><span class="gloss-desc">${escapeHtml(g.desc)}</span></div>`)
    .join("");
  return `<div class="tl-head">용어</div><div class="gloss">${items}</div>`;
}

/** 서버 스냅샷의 단계 서사를 HTML 진행표와 동형으로 렌더(있으면 상세 뷰의 1순위). */
function richDetail(s: SkillStatus, snapshot: RonaProgress): string {
  const title = snapshot.goal.title ?? skillTitle(s);
  const allDone = snapshot.steps.length > 0 && stepCounts(snapshot).done >= snapshot.steps.length;
  return `<div class="detail">
    <div class="goal-head">
      <div class="card-head">
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="card-status">${allDone ? "완주했어요" : s.offline ? "잠깐 쉬는 중" : "같이 보는 중"}</div>
      </div>
      ${snapshot.goal.oneLiner ? `<p class="goal-one">${escapeHtml(snapshot.goal.oneLiner)}</p>` : ""}
    </div>
    ${progressMeter(snapshot)}
    ${wayBlock(snapshot)}
    <div class="tl-head">단계 상세</div>
    <div class="steps">${snapshot.steps.length > 0 ? snapshot.steps.map((st, i) => stepCard(st, i)).join("") : `<p class="tl-empty">아직 단계가 없어요.</p>`}</div>
    ${glossaryBlock(snapshot)}
    ${detailActions(s.token)}
  </div>`;
}

function detailCard(s: SkillStatus): string {
  if (s.data?.snapshot) return richDetail(s, s.data.snapshot);
  if (!s.data) {
    if (s.offline) {
      return `<div class="detail"><p class="empty-msg">현황을 못 불러왔어요. 잠깐 뒤 다시 볼게요.</p>
        ${detailActions(s.token)}</div>`;
    }
    return `<div class="detail"><p class="empty-msg">아직 시작 전이에요. 스킬을 쓰기 시작하면 여기서 같이 따라갈게요.</p>
      ${detailActions(s.token)}</div>`;
  }
  const d = s.data;
  const sc = d.progress.stepCounts;
  const status = d.progress.completed ? "완주했어요" : s.offline ? "잠깐 쉬는 중" : "같이 보는 중";
  const synced = s.lastSyncedAt ? `마지막 확인 ${relTime(new Date(s.lastSyncedAt).toISOString())}` : "";
  return `<div class="detail">
    <div class="card-head">
      <div class="card-title">${escapeHtml(d.generation.title)}</div>
      <div class="card-status">${status}</div>
    </div>
    <p class="card-task">${d.generation.taskPreview ? escapeHtml(d.generation.taskPreview) : "이 스킬의 설명이 아직 등록되지 않았어요."}</p>
    <div class="badge-row">
      ${completionBadge(d.progress.completed)}
      ${sc.user_note > 0 ? `<span class="chip">후기 보냄</span>` : ""}
    </div>
    <div class="counts">
      <span><b>${sc.checkpoint_saved}</b> 단계</span>
      <span><b>${sc.tool_used}</b> 도구</span>
      ${sc.direction_aligned + sc.step_consent > 0 ? `<span><b>${sc.direction_aligned + sc.step_consent}</b> 합의</span>` : ""}
    </div>
    ${timelineSection(d.timeline)}
    ${detailActions(s.token)}
    ${synced ? `<div class="synced">${synced}</div>` : ""}
  </div>`;
}

export function renderPanel(update: PetUpdate, selectedToken: string | null): string {
  const skills = update.all;
  if (skills.length === 0) {
    return `<div class="panel-card empty">
      ${panelHead()}
      <p class="empty-msg">아직 따라갈 스킬이 없어요. 맞춤 스킬을 설치하면 여기에 자동으로 나타나요.</p>
    </div>`;
  }

  const selected = skills.find((s) => s.token === selectedToken) ?? update.active ?? skills[0];
  const list = skills.map((s) => skillRow(s, s.token === selected.token)).join("");

  return `<div class="panel-card">
    ${panelHead()}
    <div class="list-head">스킬 ${skills.length}개</div>
    <div class="skill-list">${list}</div>
    ${detailCard(selected)}
  </div>`;
}
