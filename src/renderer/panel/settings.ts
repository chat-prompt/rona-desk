// 설정 뷰 — 팝오버 내 토글(현황 ⇄ 설정). 스캔 폴더/수동 토큰 관리, 서버 주소, 알림, 버전.
import type { ConfigSnapshot, RootDiagnostic } from "../../shared/types";
import { GRIP } from "./panel";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const BACK = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>`;
const X = `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;

function removableRow(label: string, action: string, value: string): string {
  return `<div class="set-row">
    <span class="set-val" title="${escapeHtml(value)}">${escapeHtml(label)}</span>
    <button class="iconbtn iconbtn--sm" data-action="${action}" data-value="${escapeHtml(value)}" aria-label="제거">${X}</button>
  </div>`;
}

/** 스캔 루트 행 + 진단 배지("N개 발견"/"권한 거부"/"폴더 없음"). 진단 없으면 일반 행. */
function rootRow(root: string, diag: RootDiagnostic | undefined): string {
  let badge = "";
  if (diag) {
    if (diag.status === "denied") badge = `<span class="root-badge root-badge--warn">권한 거부</span>`;
    else if (diag.status === "missing") badge = `<span class="root-badge root-badge--warn">폴더 없음</span>`;
    else badge = `<span class="root-badge${diag.matchCount === 0 ? " root-badge--warn" : ""}">${diag.matchCount}개 발견</span>`;
  }
  return `<div class="set-row">
    <span class="set-val" title="${escapeHtml(root)}">${escapeHtml(root)}</span>
    ${badge}
    <button class="iconbtn iconbtn--sm" data-action="remove-root" data-value="${escapeHtml(root)}" aria-label="제거">${X}</button>
  </div>`;
}

export function renderSettings(c: ConfigSnapshot): string {
  const diagByRoot = new Map((c.scanDiagnostics ?? []).map((d) => [d.root, d]));
  const roots =
    c.scanRoots.length === 0
      ? `<p class="set-empty">추가된 폴더가 없어요.</p>`
      : c.scanRoots.map((r) => rootRow(r, diagByRoot.get(r))).join("");

  const tokens =
    c.manualTokens.length === 0
      ? `<p class="set-empty">없음 — 폴더 스캔으로 자동 발견돼요.</p>`
      : c.manualTokens.map((t) => removableRow(t, "remove-token", t)).join("");

  const notify = !c.dnd; // dnd=true → 알림 끔. 토글 ON = 알림 받음.

  return `<div class="panel-card">
    <div class="set-head" title="여기를 잡고 옮기세요">
      <button class="iconbtn" data-action="close-settings" aria-label="뒤로">${BACK}</button>
      <span class="set-title">설정</span>
      ${GRIP}
    </div>

    <div class="set-sec">
      <div class="set-label">스킬 폴더</div>
      <p class="set-hint">이 폴더 안의 <code>.rona-skill.json</code> 을 찾아 추적해요.</p>
      ${roots}
      <button class="btn btn--sm" data-action="add-root">+ 폴더 추가</button>
    </div>

    <div class="set-sec">
      <div class="set-label">수동 토큰</div>
      ${tokens}
      <div class="token-row">
        <input id="set-token-input" class="token-input" placeholder="설치 토큰 직접 입력" />
        <button class="btn btn--sm" data-action="add-token-set">추가</button>
      </div>
    </div>

    ${
      c.dismissed.length > 0
        ? `<div class="set-sec">
      <div class="set-label">숨긴 스킬</div>
      ${c.dismissed
        .map(
          (d) => `<div class="set-row">
        <span class="set-val" title="${escapeHtml(d.token)}">${escapeHtml(d.title)}</span>
        <button class="btn btn--sm" data-action="restore-skill" data-value="${escapeHtml(d.token)}">복원</button>
      </div>`,
        )
        .join("")}
    </div>`
        : ""
    }

    <div class="set-sec">
      <div class="set-label">서버 주소</div>
      <div class="token-row">
        <input id="set-baseurl" class="token-input" value="${escapeHtml(c.baseUrl)}" spellcheck="false" />
        <button class="btn btn--sm" data-action="save-baseurl">저장</button>
      </div>
    </div>

    <div class="set-sec">
      <div class="set-row" style="justify-content:space-between;padding-top:0">
        <span class="set-label" style="margin:0">창 위치 고정</span>
        <button class="toggle${c.windowPinned ? " toggle--on" : ""}" data-action="toggle-pin" role="switch" aria-checked="${c.windowPinned}" aria-label="창 위치 고정">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <p class="set-hint" style="margin-top:6px">제목 부분을 잡고 다른 디스플레이로 옮겨요. 켜면 그 자리에 고정, 끄면 트레이 아래로 따라와요.</p>
    </div>

    <div class="set-row set-row--toggle">
      <span class="set-label" style="margin:0">완주 알림 받기</span>
      <button class="toggle${notify ? " toggle--on" : ""}" data-action="toggle-dnd" role="switch" aria-checked="${notify}" aria-label="완주 알림 받기">
        <span class="toggle-knob"></span>
      </button>
    </div>

    <div class="set-sec" style="margin-top:14px">
      <div class="set-label">테마</div>
      <div class="seg" role="group" aria-label="테마">
        <button class="seg-btn${c.theme === "system" ? " seg-btn--on" : ""}" data-action="set-theme" data-value="system">시스템</button>
        <button class="seg-btn${c.theme === "light" ? " seg-btn--on" : ""}" data-action="set-theme" data-value="light">라이트</button>
        <button class="seg-btn${c.theme === "dark" ? " seg-btn--on" : ""}" data-action="set-theme" data-value="dark">다크</button>
      </div>
    </div>

    <div class="set-foot">Rona Desk v${escapeHtml(c.version)}</div>
  </div>`;
}
