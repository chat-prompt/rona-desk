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

/** 그라데이션 진행바 + "done / total 완료"(라벨 없이 숫자). 진행도는 done 개수 기준. */
function progressBar(p: RonaProgress): string {
  const { done, total } = stepCounts(p);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `<div class="bar"><div class="bar-f" style="width:${pct}%"></div></div>
    <div class="bar-meta"><b>${done}</b>&nbsp;/ ${total} 완료</div>`;
}

/** 진행 상태 한 줄 — 판단 아닌 관찰(도구 톤). 막혀도 거짓이 안 되는 사실만. */
function statusLine(s: SkillStatus, p: RonaProgress): string {
  const allDone = p.steps.length > 0 && stepCounts(p).done >= p.steps.length;
  if (allDone) return `<div class="status status--done">완주했어요</div>`;
  if (s.offline) return `<div class="status status--idle"><span class="dot-idle" aria-hidden="true"></span>잠깐 쉬는 중</div>`;
  return `<div class="status"><span class="pulse" aria-hidden="true"></span>실습 진행 중</div>`;
}

/**
 * 단계 목록 — 완료(흐림 ✓) · 현재(코랄 카드) · 남은 단계 전부(흐림, "다음" 라벨 뒤). active 기준 역할 결정.
 * 남은 스텝을 한눈에 보이도록 *전체* 순회한다(직전 3칸 창 폐기). 전체 진척은 진행바 숫자로도 표시.
 * 긴 목록은 창 스크롤(.panel overflow-y)로 흡수.
 */
function stepList(steps: RonaProgressStep[]): string {
  if (steps.length === 0) return `<p class="tl-empty">아직 단계가 없어요.</p>`;
  let i = steps.findIndex((s) => s.state === "active");
  if (i < 0) i = steps.findIndex((s) => s.state !== "done");
  if (i < 0) i = steps.length - 1;
  const last = steps.length - 1;

  let nextLabelDrawn = false;
  return steps
    .map((st, idx) => {
      if (idx === i) {
        const pill = idx === last ? "마지막!" : "진행 중";
        const tail = idx === last ? `<div class="current-sub">이것만 끝내면 완주예요</div>` : "";
        return `<div class="current"><div class="current-top">
          <span class="smark">${idx + 1}</span>
          <span class="current-t">${escapeHtml(st.title)}</span>
          <span class="current-pill">${pill}</span>
        </div>${tail}</div>`;
      }
      const upcoming = idx > i;
      const label = !nextLabelDrawn && upcoming ? ((nextLabelDrawn = true), `<div class="nextlabel">다음</div>`) : "";
      const mark = upcoming ? String(idx + 1) : TICK;
      return `${label}<div class="srow ${upcoming ? "next" : "done"}"><span class="smark">${mark}</span><span class="stext">${escapeHtml(st.title)}</span></div>`;
    })
    .join("");
}

/** 용어집 — 한 줄 압축("용어 — 뜻"), 항상 펼침. */
function glossaryLines(p: RonaProgress): string {
  if (p.glossary.length === 0) return "";
  const items = p.glossary
    .map((g) => `<div class="g1"><b>${escapeHtml(g.term)}</b> — ${escapeHtml(g.desc)}</div>`)
    .join("");
  return `<div class="gloss"><div class="gloss-h">🤖 AI 용어 check!</div>${items}</div>`;
}

/** 서버 스냅샷 기반 진행 상세 — 서브카피 + 상태 + 진행바 + 단계 목록(현재+남은 전체) + 용어(도구 톤). */
function progressDetail(s: SkillStatus, p: RonaProgress): string {
  return `<div class="detail">
    ${p.goal.oneLiner ? `<div class="subcopy">${escapeHtml(p.goal.oneLiner)}</div>` : ""}
    ${statusLine(s, p)}
    ${progressBar(p)}
    <div class="steps">${stepList(p.steps)}</div>
    ${glossaryLines(p)}
    ${detailActions(s.token)}
  </div>`;
}

/** 스냅샷 없는 스킬(구버전 생성분 등) 폴백 — 단계 서사 대신 이벤트 카운트 + 진행 내역. */
function fallbackDetail(s: SkillStatus): string {
  if (!s.data) {
    const msg = s.offline
      ? "현황을 못 불러왔어요. 잠깐 뒤 다시 볼게요."
      : "아직 시작 전이에요. 실습을 시작하면 여기에 단계가 나타나요.";
    return `<div class="detail"><p class="empty-msg">${msg}</p>${detailActions(s.token)}</div>`;
  }
  const d = s.data;
  const sc = d.progress.stepCounts;
  const status = d.progress.completed
    ? `<div class="status status--done">완주했어요</div>`
    : s.offline
      ? `<div class="status status--idle"><span class="dot-idle" aria-hidden="true"></span>잠깐 쉬는 중</div>`
      : `<div class="status"><span class="pulse" aria-hidden="true"></span>실습 진행 중</div>`;
  return `<div class="detail">
    ${d.generation.taskPreview ? `<div class="subcopy">${escapeHtml(d.generation.taskPreview)}</div>` : ""}
    ${status}
    <div class="counts">
      <span><b>${sc.checkpoint_saved}</b> 단계</span>
      <span><b>${sc.tool_used}</b> 도구</span>
      ${sc.user_note > 0 ? `<span class="chip">후기 보냄</span>` : ""}
    </div>
    ${timelineSection(d.timeline)}
    ${detailActions(s.token)}
  </div>`;
}

function detailBody(s: SkillStatus): string {
  return s.data?.snapshot ? progressDetail(s, s.data.snapshot) : fallbackDetail(s);
}

// 헤더 로고 — 핑크 배경박스 대신 작은 코랄 점(도구 톤).
const DOT_LOGO = `<span class="dot-logo" aria-hidden="true"></span>`;

/** 실습 1개 / 빈 상태용 헤더 — 코랄 점 + 제목 + 톱니. (제목 바가 창 드래그 핸들) */
function bareHead(title: string): string {
  return `<div class="panel-head panel-head--bare" title="여기를 잡고 옮기세요">
    ${GRIP}
    ${DOT_LOGO}
    <span class="hd-title">${escapeHtml(title)}</span>
    <button class="iconbtn" data-action="open-settings" aria-label="설정">${GEAR}</button>
  </div>`;
}

/** 빈 상태 — 궤도 오브 + 자동 대기 안내(큰 수동 버튼 없음). 폴백은 설정 링크. */
function emptyCard(): string {
  return `<div class="panel-card empty">
    ${bareHead("Rona")}
    <div class="stage"><div class="orb"><div class="orb-ring"></div><div class="orb-orbit"></div><div class="orb-core"></div></div></div>
    <div class="eh">AI로 오늘의 업무를<br>해결해볼까요?</div>
    <div class="esub">터미널에서 Rona 실습을 시작하면<br>이 창에 자동으로 나타나요</div>
    <div class="ewrap"><span class="ewait"><span class="pulse" aria-hidden="true"></span>실습을 기다리는 중</span></div>
    <div class="emanual">안 보이나요? <a data-action="open-settings" role="button" tabindex="0">설정에서 확인 →</a></div>
  </div>`;
}

export function renderPanel(update: PetUpdate, selectedToken: string | null): string {
  const skills = update.all;
  if (skills.length === 0) return emptyCard();

  const selected = skills.find((s) => s.token === selectedToken) ?? update.active ?? skills[0];

  // 실습 1개 → 리스트 숨김(개념적 1:1). 헤더에 실습명 직접.
  if (skills.length === 1) {
    return `<div class="panel-card">
      ${bareHead(skillTitle(selected))}
      ${detailBody(selected)}
    </div>`;
  }

  // 여럿 → "Rona 학습 현황" 헤더 + 전환 리스트 + 선택 실습 상세.
  const list = skills.map((s) => skillRow(s, s.token === selected.token)).join("");
  return `<div class="panel-card">
    ${panelHead()}
    <div class="list-head">스킬 ${skills.length}개</div>
    <div class="skill-list">${list}</div>
    <div class="detail-titled">${DOT_LOGO}<span class="hd-title">${escapeHtml(skillTitle(selected))}</span></div>
    ${detailBody(selected)}
  </div>`;
}
