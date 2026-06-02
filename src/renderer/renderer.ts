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

function paint(): void {
  if (view === "settings") {
    panelEl.innerHTML = cfg
      ? renderSettings(cfg)
      : `<div class="panel-card"><p class="empty-msg">불러오는 중…</p></div>`;
    return;
  }
  if (selectedToken && last && !last.all.some((s) => s.token === selectedToken)) selectedToken = null;
  panelEl.innerHTML = last ? renderPanel(last, selectedToken, cfg?.windowPinned ?? false) : "";
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
  paint(); // 진행 뷰 헤더의 pin 상태도 즉시 반영
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

  // data-action 이 없으면 진행 뷰의 스킬 행 선택으로 처리.
  if (!action) {
    const row = target.closest("[data-skill-token]");
    if (row) {
      selectedToken = row.getAttribute("data-skill-token");
      paint();
    }
    return;
  }

  const value = act?.getAttribute("data-value") ?? "";
  switch (action) {
    case "open-settings":
      void openSettings();
      break;
    case "close-settings":
      closeSettings();
      break;
    case "rescan":
      void window.rona.rescan();
      break;
    case "add-root":
      void window.rona.addScanRoot().then(refreshConfig);
      break;
    case "remove-root":
      void window.rona.removeScanRoot(value).then(refreshConfig);
      break;
    case "remove-token":
      void window.rona.removeManualToken(value).then(refreshConfig);
      break;
    case "toggle-dnd": {
      const receivingNow = act?.getAttribute("aria-checked") === "true";
      void window.rona.setDnd(receivingNow).then(refreshConfig); // 받는 중→끔(dnd on)
      break;
    }
    case "toggle-pin": {
      // 헤더 아이콘·설정 토글 공용. 현재 cfg 상태 기준으로 반전.
      void window.rona.setWindowPinned(!(cfg?.windowPinned ?? false)).then(refreshConfig);
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
    case "add-token": {
      // 진행 뷰 빈 상태의 토큰 추가
      const input = document.getElementById("token-input") as HTMLInputElement | null;
      const v = input?.value.trim();
      if (v) void window.rona.addManualToken(v);
      break;
    }
    case "add-token-set": {
      // 설정 뷰의 토큰 추가
      const input = document.getElementById("set-token-input") as HTMLInputElement | null;
      const v = input?.value.trim();
      if (v) void window.rona.addManualToken(v).then(refreshConfig);
      break;
    }
  }
});

window.rona.onPetUpdate(onPetUpdate);

// 시작 시 설정을 받아 헤더 pin 상태를 반영.
void window.rona.getConfig().then((c) => {
  cfg = c;
  paint();
});
