// 설정 뷰 — 팝오버 내 토글(현황 ⇄ 설정). 숨긴 스킬 복원, 완주 알림, 버전.
// 발견은 ~/.rona/installed 자동(폴더/토큰 수동 등록 UI 없음). 서버 주소는 dev 전용이라
// UI 제거(config.json override 가능). 테마는 헤더 아이콘으로 이동.
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

    <div class="set-row set-row--toggle">
      <span class="set-label" style="margin:0">완주 알림 받기</span>
      <button class="toggle${notify ? " toggle--on" : ""}" data-action="toggle-dnd" role="switch" aria-checked="${notify}" aria-label="완주 알림 받기">
        <span class="toggle-knob"></span>
      </button>
    </div>

    <div class="set-foot">Rona Desk v${escapeHtml(c.version)}</div>
  </div>`;
}
