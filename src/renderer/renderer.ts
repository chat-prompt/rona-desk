// renderer — 발견된 스킬 리스트 + 선택 스킬 상세(진행 뷰) ⇄ 설정 뷰 토글.
// 진행 뷰는 main 의 pet:update 로 갱신, 설정 뷰는 getConfig 스냅샷으로 갱신.
import { renderPanel } from "./panel/panel";
import { renderSettings } from "./panel/settings";
import type { ConfigSnapshot, PetUpdate, RonaApi, ThemeMode } from "../shared/types";

declare global {
  interface Window {
    rona: RonaApi;
  }
}

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

root.innerHTML = `<div class="panel" id="panel"></div>`;
const panelEl = document.getElementById("panel") as HTMLElement;

let last: PetUpdate | null = null;
let selectedToken: string | null = null;
let view: "progress" | "settings" = "progress";
let cfg: ConfigSnapshot | null = null;
let skillMenuOpen = false; // 헤더 ▾ 스킬 전환 드롭다운 열림 여부

function paint(): void {
  if (view === "settings") {
    panelEl.innerHTML = cfg
      ? renderSettings(cfg)
      : `<div class="panel-card"><p class="empty-msg">불러오는 중…</p></div>`;
    return;
  }
  if (selectedToken && last && !last.all.some((s) => s.token === selectedToken)) selectedToken = null;
  panelEl.innerHTML = last ? renderPanel(last, selectedToken, skillMenuOpen) : "";
}

function onPetUpdate(u: PetUpdate): void {
  last = u;
  if (view === "progress") paint(); // 설정 화면을 보고 있으면 진행 갱신이 화면을 덮지 않음
}

async function openSettings(): Promise<void> {
  cfg = await window.rona.getConfig();
  view = "settings";
  paint();
}

function closeSettings(): void {
  view = "progress";
  paint();
}

async function refreshConfig(): Promise<void> {
  cfg = await window.rona.getConfig();
  paint(); // 설정 뷰를 보고 있으면 최신 스냅샷으로 갱신
}

/** 버튼을 즉시 로딩 상태로(스피너+비활성). 곧 도착할 재렌더가 통째 교체. */
function setButtonLoading(el: Element, label: string): void {
  el.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label}`;
  (el as HTMLButtonElement).disabled = true;
}

panelEl.addEventListener("click", (e) => {
  const target = e.target as Element;
  const act = target.closest("[data-action]");
  const action = act?.getAttribute("data-action");

  // data-action 이 없으면 드롭다운 메뉴의 스킬 행 선택으로 처리(선택 후 메뉴 닫힘).
  if (!action) {
    const row = target.closest("[data-skill-token]");
    if (row) {
      selectedToken = row.getAttribute("data-skill-token");
      skillMenuOpen = false;
      paint();
    }
    return;
  }

  const value = act?.getAttribute("data-value") ?? "";
  switch (action) {
    case "toggle-skill-menu":
      skillMenuOpen = !skillMenuOpen;
      paint();
      break;
    case "open-settings":
      void openSettings();
      break;
    case "close-settings":
      closeSettings();
      break;
    case "rescan":
      void window.rona.rescan();
      break;
    case "toggle-dnd": {
      const receivingNow = act?.getAttribute("aria-checked") === "true";
      void window.rona.setDnd(receivingNow).then(refreshConfig); // 받는 중→끔(dnd on)
      break;
    }
    case "set-theme": {
      const mode = act?.getAttribute("data-value") as ThemeMode | null;
      if (mode) void window.rona.setTheme(mode).then(refreshConfig);
      break;
    }
    case "dismiss-skill": {
      // 진행 뷰에서 선택 스킬 숨김 — poller.refresh 가 pet:update 로 리스트 재렌더.
      if (value) {
        selectedToken = null;
        if (act) setButtonLoading(act, "제거 중…");
        void window.rona.dismissSkill(value);
      }
      break;
    }
    case "restore-skill": {
      // 설정 뷰에서 복원 — 설정 목록 갱신 위해 refreshConfig.
      if (value) {
        if (act) setButtonLoading(act, "복원 중…");
        void window.rona.restoreSkill(value).then(refreshConfig);
      }
      break;
    }
    case "save-baseurl": {
      const input = document.getElementById("set-baseurl") as HTMLInputElement | null;
      const v = input?.value.trim();
      if (v) void window.rona.setBaseUrl(v).then(refreshConfig);
      break;
    }
  }
});

window.rona.onPetUpdate(onPetUpdate);

// 시작 시 설정 스냅샷을 미리 받아둔다(설정 뷰 첫 진입 지연 최소화).
void window.rona.getConfig().then((c) => {
  cfg = c;
  paint();
});
