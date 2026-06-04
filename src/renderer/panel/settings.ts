// 설정 뷰 — 팝오버 내 토글(현황 ⇄ 설정). 숨긴 스킬 복원, 서버 주소, 알림, 테마, 버전.
// 발견은 ~/.rona/installed 자동 — 폴더/토큰 수동 등록 UI 없음.
import type { ConfigSnapshot } from "../../shared/types";
import { GRIP } from "./panel";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const BACK = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>`;

export function renderSettings(c: ConfigSnapshot): string {
  const notify = !c.dnd; // dnd=true → 알림 끔. 토글 ON = 알림 받음.

  return `<div class="panel-card">
    <div class="set-head" title="여기를 잡고 옮기세요">
      <button class="iconbtn" data-action="close-settings" aria-label="뒤로">${BACK}</button>
      <span class="set-title">설정</span>
      ${GRIP}
    </div>

    <div class="set-sec">
      <p class="set-hint">맞춤 스킬을 설치하면 학습 현황이 <strong>자동으로</strong> 나타나요. 따로 폴더나 토큰을 등록할 필요가 없어요.</p>
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
