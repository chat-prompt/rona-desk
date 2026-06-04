// Rona Desk — main process.
// 트레이 상주 + 프레임리스 투명 진행 창 + rona.so 폴링 + 로컬 마커 스캔 + IPC.
// 창은 트레이 클릭 시에만 등장(자동 서피싱·always-on-top 없음 — 침습 최소화).
// 진행은 트레이 아이콘(위상 pip) + 완주 알림으로 알리고, 상세는 창을 열어 본다.
import {
  app,
  Tray,
  Menu,
  BrowserWindow,
  nativeImage,
  ipcMain,
  Notification,
  screen,
  nativeTheme,
} from "electron";
import path from "node:path";
import { config } from "./config";
import { Poller, type PollResult } from "./poller";
import { scanHomeRegistry, type DiscoveredSkill } from "./marker-scanner";
import { watchHomeRegistry } from "./registry-watcher";
import { buildUpdate } from "./derive";
import { isPositionVisible, type Rect } from "./window-position";
import { initUpdater } from "./updater";
import type { PetPhase, PetUpdate, SkillStatus, ThemeMode } from "../shared/types";

let tray: Tray | null = null;
let petWindow: BrowserWindow | null = null;
let poller: Poller | null = null;
let unwatchRegistry: (() => void) | null = null;

const skillMeta = new Map<string, DiscoveredSkill>();
let scannedTokens: string[] = [];
let latestUpdate: PetUpdate | null = null;

/** 드래그/리사이즈 후 저장 디바운스. */
let moveSaveTimer: NodeJS.Timeout | null = null;
let sizeSaveTimer: NodeJS.Timeout | null = null;
/** 프로그램적 bounds 변경(트레이 스냅/핀·크기 복원) 중 표시 — moved/resize 리스너가 그 값을 저장하지 않게. macOS 는 setPosition/setSize 도 이벤트를 발화. */
let programmaticBounds = false;

const DEFAULT_SIZE = { width: 380, height: 580 };
const MIN_SIZE = { width: 320, height: 420 };
const MAX_SIZE = { width: 640, height: 1000 };

function clampSize(s: { width: number; height: number }): { width: number; height: number } {
  return {
    width: Math.min(MAX_SIZE.width, Math.max(MIN_SIZE.width, Math.round(s.width))),
    height: Math.min(MAX_SIZE.height, Math.max(MIN_SIZE.height, Math.round(s.height))),
  };
}

const ICON_DIR = path.join(__dirname, "..", "icons");

function allTokens(): string[] {
  const dismissed = new Set(config.dismissedTokens());
  return scannedTokens.filter((t) => !dismissed.has(t));
}

// 마커 제목을 statuses 에 주입 — data 도착 전에도 리스트에 이름 표시.
function enrich(u: PetUpdate): PetUpdate {
  const decorate = (s: SkillStatus | null): SkillStatus | null => {
    if (!s) return s;
    const meta = skillMeta.get(s.token);
    return {
      ...s,
      title: s.data?.generation.title ?? meta?.title ?? s.title,
    };
  };
  return { ...u, active: decorate(u.active), all: u.all.map((s) => decorate(s) as SkillStatus) };
}

// ── 트레이 ───────────────────────────────────────────────────
function trayImage(phase: PetPhase): Electron.NativeImage {
  return nativeImage.createFromPath(path.join(ICON_DIR, `mark-${phase}-16.png`));
}

function contextMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: "Rona Desk — 학습 현황 동행", enabled: false },
    { type: "separator" },
    { label: "동기화 새로고침", click: () => void rescan() },
    {
      label: config.dndActive() ? "방해 금지 해제" : "방해 금지 (1시간)",
      click: () => config.setDnd(config.dndActive() ? null : Date.now() + 3_600_000),
    },
    { type: "separator" },
    { label: "종료", role: "quit" },
  ]);
}

// ── 펫 창 ────────────────────────────────────────────────────
function createPetWindow(): void {
  const initial = clampSize(config.windowSize() ?? DEFAULT_SIZE);
  petWindow = new BrowserWindow({
    width: initial.width,
    height: initial.height,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    maxWidth: MAX_SIZE.width,
    maxHeight: MAX_SIZE.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void petWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  petWindow.webContents.on("did-finish-load", () => {
    if (latestUpdate) petWindow?.webContents.send("pet:update", latestUpdate);
  });
  placeWindow(); // pin 저장 좌표 복원(없거나 화면밖이면 트레이). 크기는 생성자에서 복원됨.

  // 헤더 드래그로 옮기면 pin ON 일 때만 좌표 저장 — 프로그램적 setPosition 오염은 가드로 차단.
  petWindow.on("moved", () => {
    if (programmaticBounds) return; // 트레이 스냅/핀 복원의 setPosition 은 저장 안 함(핀 좌표 보존)
    if (!config.windowPinned() || !petWindow) return;
    if (moveSaveTimer) clearTimeout(moveSaveTimer);
    moveSaveTimer = setTimeout(() => {
      if (!petWindow) return;
      const b = petWindow.getBounds();
      config.setWindowPosition({ x: b.x, y: b.y });
    }, 400);
  });

  // 가장자리 리사이즈로 크기 변경 → 저장(pin 무관, 전역 선호). 다음 실행에 생성자가 복원.
  petWindow.on("resize", () => {
    if (programmaticBounds || !petWindow) return;
    if (sizeSaveTimer) clearTimeout(sizeSaveTimer);
    sizeSaveTimer = setTimeout(() => {
      if (!petWindow) return;
      const b = petWindow.getBounds();
      config.setWindowSize({ width: b.width, height: b.height });
    }, 400);
  });
  // blur 자동 숨김 없음 — 진행 중엔 앞에 머물러야 한다(자동 숨김은 idle 타이머가 담당).
}

/** setPosition 을 moved 저장에서 제외(프로그램적 이동 표시). 사용자 드래그(헤더)만 저장되도록. */
function moveWindowTo(x: number, y: number): void {
  if (!petWindow) return;
  programmaticBounds = true;
  petWindow.setPosition(x, y, false);
  setImmediate(() => {
    programmaticBounds = false;
  });
}

function positionNearTray(): void {
  if (!tray || !petWindow) return;
  const tb = tray.getBounds();
  const wb = petWindow.getBounds();
  moveWindowTo(Math.round(tb.x + tb.width / 2 - wb.width / 2), Math.round(tb.y + tb.height + 4));
}

function workAreas(): Rect[] {
  return screen.getAllDisplays().map((d) => d.workArea);
}

/** 현재 창 좌상단이 어느 디스플레이에 충분히 보이는가(드래그 중 점프 방지 판정용). */
function currentBoundsVisible(): boolean {
  if (!petWindow) return false;
  const b = petWindow.getBounds();
  return isPositionVisible({ x: b.x, y: b.y }, workAreas());
}

/** pin ON + 저장 좌표가 화면 안이면 그 좌표로 이동. 적용했으면 true. */
function applyPinnedPosition(): boolean {
  if (!petWindow || !config.windowPinned()) return false;
  const p = config.windowPosition();
  if (p && isPositionVisible(p, workAreas())) {
    moveWindowTo(p.x, p.y);
    return true;
  }
  return false;
}

/** 등장 위치 결정: pin OFF=트레이 스냅 / pin ON=저장 좌표(화면밖이면 트레이). 드래그 중엔 점프 안 함. */
function placeWindow(): void {
  if (!petWindow) return;
  // 보이는 창이 화면 안 유효 위치면(사용자가 헤더로 직접 둔 위치 포함) 자동 이벤트로 끌어당기지 않음.
  if (petWindow.isVisible() && currentBoundsVisible()) return;
  if (config.windowPinned() && applyPinnedPosition()) return; // pin: 저장 좌표 복원
  positionNearTray(); // pin OFF(숨김→재등장) 또는 저장 좌표 화면밖 → 트레이 fallback
}

/** auto=true → focus 안 뺏고 앞에 띄움(타이핑 방해 X). auto=false → 클릭으로 활성 표시. */
/** 트레이 클릭 시에만 등장. 앞으로 가져와 포커스. (자동 서피싱 없음 — 진행은 트레이 아이콘/알림으로) */
function showPet(): void {
  if (!petWindow) return;
  placeWindow();
  petWindow.show();
  petWindow.focus();
}

function toggleWindow(): void {
  if (!petWindow) return;
  if (petWindow.isVisible() && petWindow.isFocused()) {
    petWindow.hide(); // 이미 앞에서 보고 있을 때만 숨김
  } else {
    showPet(); // 숨김이거나 뒤에 있으면 앞으로
  }
}

// ── 폴링 결과 처리 ───────────────────────────────────────────
function onPollResult(result: PollResult): void {
  const update = enrich(buildUpdate(result));
  latestUpdate = update;
  petWindow?.webContents.send("pet:update", update); // 내용만 조용히 갱신(창은 안 띄움)
  tray?.setImage(trayImage(update.phase));

  // 완주 알림 — skill_completed 신규 도착 시에만, DND 아니면 토스트 1회.
  if (!config.dndActive()) {
    for (const [token, ev] of result.newEvents) {
      if (ev === "skill_completed") {
        const meta = skillMeta.get(token);
        new Notification({
          title: "같이 해냈어요!",
          body: `${meta?.title ?? "스킬"} 완주 — 함께 끝까지 왔어요`,
        }).show();
      }
    }
  }
}

// ── 마커 스캔 (홈 레지스트리 단일 소스) ──────────────────────
async function rescan(): Promise<void> {
  skillMeta.clear();
  for (const s of await scanHomeRegistry()) skillMeta.set(s.token, s);
  scannedTokens = [...skillMeta.keys()];
  poller?.refresh();
}

// ── IPC ──────────────────────────────────────────────────────
function registerIpc(): void {
  ipcMain.handle("config:get", () => ({
    baseUrl: config.baseUrl(),
    dnd: config.dndActive(),
    windowPinned: config.windowPinned(),
    theme: config.theme(),
    dismissed: config.dismissedTokens().map((t) => ({ token: t, title: skillMeta.get(t)?.title ?? t })),
    version: app.getVersion(),
  }));
  ipcMain.handle("config:setBaseUrl", (_e, url: string) => {
    config.setBaseUrl(url);
    poller?.refresh();
  });
  // 설정의 DND 토글은 지속형(켜면 끌 때까지). 트레이 메뉴의 1시간 mute 와 같은 dndUntil 을 공유.
  ipcMain.handle("config:setDnd", (_e, on: boolean) => {
    config.setDnd(on ? 8_640_000_000_000_000 : null); // on=최대 epoch(사실상 무기한), off=해제
  });
  // 위치 고정 토글: ON=현재 좌표 박아둠 / OFF=트레이로 즉시 복귀.
  ipcMain.handle("config:setWindowPinned", (_e, on: boolean) => {
    config.setWindowPinned(on);
    if (on && petWindow) {
      const b = petWindow.getBounds();
      config.setWindowPosition({ x: b.x, y: b.y });
    } else if (!on) {
      positionNearTray();
    }
  });
  // 테마: nativeTheme.themeSource 가 렌더러 prefers-color-scheme 를 강제(CSS 변경 0).
  ipcMain.handle("config:setTheme", (_e, mode: ThemeMode) => {
    config.setTheme(mode);
    nativeTheme.themeSource = mode;
  });
  // 스킬 숨김/복원: 마커 파일은 그대로, 추적 토큰에서만 제외/복원 후 재폴링.
  ipcMain.handle("config:dismissSkill", (_e, token: string) => {
    config.addDismissedToken(token);
    poller?.refresh();
  });
  ipcMain.handle("config:restoreSkill", (_e, token: string) => {
    config.removeDismissedToken(token);
    poller?.refresh();
  });
  ipcMain.handle("rescan", () => rescan());
}

// ── lifecycle ────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.hide();
  nativeTheme.themeSource = config.theme(); // 저장된 테마 적용(렌더러 prefers-color-scheme 강제)
  registerIpc();
  tray = new Tray(trayImage("seed"));
  tray.setToolTip("Rona — 학습 현황");
  tray.on("click", () => toggleWindow());
  tray.on("right-click", () => tray?.popUpContextMenu(contextMenu()));
  createPetWindow();
  initUpdater();

  poller = new Poller(config.baseUrl, allTokens, onPollResult);
  await rescan();
  poller.start();
  // 앱이 켜져 있는 동안 새 스킬이 설치되면(~/.rona/installed 변화) 자동 rescan — cold start 외 라이브 감지.
  unwatchRegistry = watchHomeRegistry(() => void rescan());
});

// 종료 직전 디바운스 대기 중인 크기/위치를 동기 flush (electron-store 동기 write).
// 리사이즈/이동 후 400ms 안에 종료하면 타이머가 못 터져 유실되던 것 방지.
app.on("before-quit", () => {
  unwatchRegistry?.();
  if (!petWindow || petWindow.isDestroyed()) return;
  if (moveSaveTimer) clearTimeout(moveSaveTimer);
  if (sizeSaveTimer) clearTimeout(sizeSaveTimer);
  const b = petWindow.getBounds();
  config.setWindowSize({ width: b.width, height: b.height });
  if (config.windowPinned()) config.setWindowPosition({ x: b.x, y: b.y });
});

// 트레이 앱: 창을 닫아도 종료하지 않는다 (메뉴 '종료'로만 quit).
app.on("window-all-closed", () => {
  /* keep running in tray */
});
