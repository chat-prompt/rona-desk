// renderer — 코코 상태머신 + 진행 패널. main 의 pet:update 를 받아 펫/패널 갱신.
// 순간 반응(1.6s) 후 휴식 위상으로 복귀(동행은 관망이 기본).
import { cocoSvg } from "./pet/coco";
import { renderPanel } from "./panel/panel";
import type { PetMood, PetPhase, PetUpdate, RonaApi, SkillEventType } from "../shared/types";

declare global {
  interface Window {
    rona: RonaApi;
  }
}

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

root.innerHTML = `
  <div class="pet-area">
    <div class="bubble" id="bubble" role="status">같이 볼 준비가 됐어요</div>
    <div class="coco" id="coco" aria-label="Rona 동행 펫 코코">${cocoSvg("seed", "idle")}</div>
  </div>
  <div class="panel" id="panel"></div>
`;

const cocoEl = document.getElementById("coco") as HTMLElement;
const bubbleEl = document.getElementById("bubble") as HTMLElement;
const panelEl = document.getElementById("panel") as HTMLElement;

const MOMENTARY_MS = 1600;
let momentaryTimer: number | undefined;
let last: PetUpdate | null = null;

const BUBBLE: Partial<Record<SkillEventType, string>> = {
  skill_started: "같이 시작해요",
  checkpoint_saved: "여기까지 잘 왔어요",
  step_consent: "좋아요, 같이 가요",
  user_steer: "방향 바뀌었네요, 따라갈게요",
  direction_aligned: "방향 맞췄어요",
  user_note: "후기 고마워요",
  skill_completed: "완주했어요! 같이 해냈네요",
};

function restingMood(u: PetUpdate): PetMood {
  if (u.active?.offline) return "napping";
  if (!u.active?.data) return "empty";
  return "idle";
}

function restingBubble(u: PetUpdate): string {
  if (u.active?.offline) return "잠깐 쉬는 중";
  if (!u.active?.data) return "같이 볼 준비가 됐어요";
  if (u.active.data.progress.completed) return "끝까지 함께했어요";
  return "옆에서 보고 있어요";
}

function setCoco(phase: PetPhase, mood: PetMood, label: string): void {
  cocoEl.innerHTML = cocoSvg(phase, mood);
  cocoEl.setAttribute("aria-label", `Rona 동행 펫 코코 — ${label}`);
}

function setBubble(text: string, visible: boolean): void {
  bubbleEl.textContent = text;
  bubbleEl.style.visibility = visible ? "visible" : "hidden";
}

function rest(u: PetUpdate): void {
  const rb = restingBubble(u);
  setCoco(u.phase, restingMood(u), rb);
  setBubble(rb, true);
}

function apply(u: PetUpdate): void {
  last = u;
  panelEl.innerHTML = renderPanel(u);

  if (momentaryTimer) window.clearTimeout(momentaryTimer);

  if (u.newEvent) {
    const text = BUBBLE[u.newEvent];
    setCoco(u.phase, u.mood, text ?? "동행 중");
    setBubble(text ?? "", Boolean(text)); // tool_used 는 무음(eye-glance만)
    momentaryTimer = window.setTimeout(() => rest(u), MOMENTARY_MS);
  } else {
    rest(u);
  }
}

panelEl.addEventListener("click", (e) => {
  const el = (e.target as Element).closest("[data-action]");
  if (!el) return;
  const action = el.getAttribute("data-action");
  const token = last?.active?.token;
  switch (action) {
    case "open-progress":
      if (token) void window.rona.openProgressHtml(token);
      break;
    case "rescan":
      void window.rona.rescan();
      break;
    case "add-root":
      void window.rona.addScanRoot();
      break;
    case "add-token": {
      const input = document.getElementById("token-input") as HTMLInputElement | null;
      const v = input?.value.trim();
      if (v) void window.rona.addManualToken(v);
      break;
    }
  }
});

window.rona.onPetUpdate(apply);
