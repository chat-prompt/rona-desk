// 진행 패널 — 서버 ProgressData 로부터 네이티브 렌더(Warm Coral 디자인 언어 재사용).
// rona-progress.html 파일을 webview 임베드하지 않는다: 그 HTML 은 스킬이 로컬에서 채우는
// '로컬 미러'고, 우리 데이터 소스는 서버(execution_logs)다 → 서버 JSON 으로 직접 그린다.
// 3축 독립 표기(단계 진행 / 완주 배지 / 후기 칩)로 admin "실행중 박제" 착시 차단.
import type {
  PetUpdate,
  SkillEventType,
  SkillStatus,
  TimelineEntry,
} from "../../shared/types";

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
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function completionBadge(completed: boolean): string {
  if (!completed) return "";
  return `<span class="badge badge--done">
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    완주</span>`;
}

function noteChip(userNoteCount: number): string {
  if (userNoteCount <= 0) return "";
  return `<span class="chip">후기 보냄</span>`;
}

function timelineList(timeline: TimelineEntry[]): string {
  if (timeline.length === 0) return "";
  const recent = timeline.slice(-6).reverse();
  const items = recent
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
  return `<ul class="timeline" aria-label="최근 진행">${items}</ul>`;
}

function emptyState(message: string): string {
  return `<div class="panel-card empty">
    <p class="empty-msg">${escapeHtml(message)}</p>
    <div class="empty-actions">
      <button class="btn btn--primary" data-action="add-root">스킬 폴더 추가</button>
      <div class="token-row">
        <input id="token-input" class="token-input" placeholder="설치 토큰 직접 입력" />
        <button class="btn" data-action="add-token">추가</button>
      </div>
    </div>
  </div>`;
}

export function renderPanel(u: PetUpdate): string {
  const active: SkillStatus | null = u.active;

  if (!active) {
    return emptyState("아직 따라갈 스킬을 못 찾았어요. 스킬을 설치한 폴더를 알려주세요.");
  }
  if (!active.data) {
    if (active.offline) {
      return `<div class="panel-card"><p class="empty-msg">현황을 못 불러왔어요. 잠깐 뒤 다시 볼게요.</p>
        <button class="btn" data-action="rescan">다시 시도</button></div>`;
    }
    return emptyState("아직 시작 전이에요. 스킬을 쓰기 시작하면 여기서 같이 따라갈게요.");
  }

  const d = active.data;
  const sc = d.progress.stepCounts;
  const status = d.progress.completed ? "완주했어요" : active.offline ? "잠깐 쉬는 중" : "같이 보는 중";
  const synced = active.lastSyncedAt ? `마지막 확인 ${relTime(new Date(active.lastSyncedAt).toISOString())}` : "";

  return `<div class="panel-card">
    <div class="card-head">
      <div class="card-title">${escapeHtml(d.generation.title)}</div>
      <div class="card-status">${status}</div>
    </div>
    ${d.generation.taskPreview ? `<p class="card-task">${escapeHtml(d.generation.taskPreview)}</p>` : ""}
    <div class="badge-row">
      ${completionBadge(d.progress.completed)}
      ${noteChip(sc.user_note)}
    </div>
    <div class="counts">
      <span><b>${sc.checkpoint_saved}</b> 단계</span>
      <span><b>${sc.tool_used}</b> 도구</span>
      ${sc.direction_aligned + sc.step_consent > 0 ? `<span><b>${sc.direction_aligned + sc.step_consent}</b> 합의</span>` : ""}
    </div>
    ${timelineList(d.timeline)}
    <div class="action-bar">
      <button class="btn" data-action="open-progress">진행표 열기</button>
      <button class="btn btn--ghost" data-action="rescan">새로고침</button>
    </div>
    ${synced ? `<div class="synced">${synced}</div>` : ""}
  </div>`;
}
