// Rona Desk — main process.
// Dock 정식 앱: 프레임리스 투명 진행 창이 실행 시 떠서 상시 유지된다(트레이/팝오버 없음).
// rona.so 폴링 + 홈 레지스트리(~/.rona/installed) 단일 발견 + 라이브 watch + IPC.
// 진행은 창 내용 갱신 + 완주 알림으로 알린다. 위치/크기는 자동 저장·복원(화면 안으로 clamp).
import {
  app,
  BrowserWindow,
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
import type { PetUpdate, SkillStatus, ThemeMode } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let poller: Poller | null = null;
let unwatchRegistry: (() => void) | null = null;
let isQuitting = false;

const skillMeta = new Map<string, DiscoveredSkill>();
let scannedTokens: string[] = [];
let latestUpdate: PetUpdate | null = null;

/** 드래그/리사이즈 후 저장 디바운스. */
let moveSaveTimer: NodeJS.Timeout | null = null;
let sizeSaveTimer: NodeJS.Timeout | null = null;

const DEFAULT_SIZE = { width: 380, height: 580 };
const MIN_SIZE = { width: 320, height: 420 };
const MAX_SIZE = { width: 640, height: 1000 };

function clampSize(s: { width: number; height: number }): { width: number; height: number } {
  return {
    width: Math.min(MAX_SIZE.width, Math.max(MIN_SIZE.width, Math.round(s.width))),
    height: Math.min(MAX_SIZE.height, Math.max(MIN_SIZE.height, Math.round(s.height))),
  };
}

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

function workAreas(): Rect[] {
  return screen.getAllDisplays().map((d) => d.workArea);
}

// ── 창 ───────────────────────────────────────────────────────
function createWindow(): void {
  const size = clampSize(config.windowSize() ?? DEFAULT_SIZE);
  const saved = config.windowPosition();
  // 저장 좌표가 현재 디스플레이 안에 보일 때만 복원 — 화면 밖이면 생략해 OS 가 중앙 배치(off-screen 방지).
  const useSaved = saved !== null && isPositionVisible(saved, workAreas());

  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    ...(useSaved ? { x: saved!.x, y: saved!.y } : {}),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    maxWidth: MAX_SIZE.width,
    maxHeight: MAX_SIZE.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (!useSaved) mainWindow.center();

  void mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.on("did-finish-load", () => {
    if (latestUpdate) mainWindow?.webContents.send("pet:update", latestUpdate);
  });

  // 사용자가 옮긴/조절한 위치·크기는 항상 저장 → 다음 실행에 복원(화면 안일 때).
  mainWindow.on("moved", () => {
    if (!mainWindow) return;
    if (moveSaveTimer) clearTimeout(moveSaveTimer);
    moveSaveTimer = setTimeout(() => {
      if (!mainWindow) return;
      const b = mainWindow.getBounds();
      config.setWindowPosition({ x: b.x, y: b.y });
    }, 400);
  });
  mainWindow.on("resize", () => {
    if (!mainWindow) return;
    if (sizeSaveTimer) clearTimeout(sizeSaveTimer);
    sizeSaveTimer = setTimeout(() => {
      if (!mainWindow) return;
      const b = mainWindow.getBounds();
      config.setWindowSize({ width: b.width, height: b.height });
    }, 400);
  });

  // 닫기(cmd-W)는 종료가 아니라 숨김 — Dock 아이콘 클릭으로 다시 띄운다. 종료는 cmd-Q.
  mainWindow.on("close", (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWindow?.hide();
  });
}

function showWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

// ── 폴링 결과 처리 ───────────────────────────────────────────
function onPollResult(result: PollResult): void {
  const update = enrich(buildUpdate(result));
  latestUpdate = update;
  mainWindow?.webContents.send("pet:update", update);

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
    theme: config.theme(),
    dismissed: config.dismissedTokens().map((t) => ({ token: t, title: skillMeta.get(t)?.title ?? t })),
    version: app.getVersion(),
  }));
  ipcMain.handle("config:setBaseUrl", (_e, url: string) => {
    config.setBaseUrl(url);
    poller?.refresh();
  });
  // DND 토글(지속형): 켜면 끌 때까지. 완주 알림 on/off.
  ipcMain.handle("config:setDnd", (_e, on: boolean) => {
    config.setDnd(on ? 8_640_000_000_000_000 : null); // on=최대 epoch(사실상 무기한), off=해제
  });
  // 테마: nativeTheme.themeSource 가 렌더러 prefers-color-scheme 를 강제(CSS 변경 0).
  ipcMain.handle("config:setTheme", (_e, mode: ThemeMode) => {
    config.setTheme(mode);
    nativeTheme.themeSource = mode;
  });
  // 스킬 숨김/복원: 추적 토큰에서만 제외/복원 후 재폴링.
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
  nativeTheme.themeSource = config.theme(); // 저장된 테마 적용(렌더러 prefers-color-scheme 강제)
  registerIpc();
  createWindow();
  initUpdater();

  poller = new Poller(config.baseUrl, allTokens, onPollResult);
  await rescan();
  poller.start();
  // 앱이 켜져 있는 동안 새 스킬이 설치되면(~/.rona/installed 변화) 자동 rescan — cold start 외 라이브 감지.
  unwatchRegistry = watchHomeRegistry(() => void rescan());
});

// Dock 아이콘 클릭 시 창을 다시 띄운다(숨겨져 있거나 닫혀 있으면).
app.on("activate", () => showWindow());

// 종료 직전 디바운스 대기 중인 위치/크기를 동기 flush + close 가 종료로 진행되게.
app.on("before-quit", () => {
  isQuitting = true;
  unwatchRegistry?.();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (moveSaveTimer) clearTimeout(moveSaveTimer);
  if (sizeSaveTimer) clearTimeout(sizeSaveTimer);
  const b = mainWindow.getBounds();
  config.setWindowSize({ width: b.width, height: b.height });
  config.setWindowPosition({ x: b.x, y: b.y });
});

// 창을 닫아도(숨김) 종료하지 않는다 — Dock 아이콘으로 다시 띄운다. 종료는 cmd-Q.
app.on("window-all-closed", () => {
  /* keep running — Dock 앱 */
});
