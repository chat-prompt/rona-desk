// Rona Desk — main process.
// 트레이 상주 + 프레임리스 투명 펫 창 + rona.so 폴링 + 로컬 마커 스캔 + IPC.
import {
  app,
  Tray,
  Menu,
  BrowserWindow,
  nativeImage,
  ipcMain,
  dialog,
  shell,
  Notification,
} from "electron";
import path from "node:path";
import { config } from "./config";
import { Poller, type PollResult } from "./poller";
import { scanMarkers, type DiscoveredSkill } from "./marker-scanner";
import { buildUpdate } from "./derive";
import { initUpdater } from "./updater";
import type { PetPhase, PetUpdate } from "../shared/types";

let tray: Tray | null = null;
let petWindow: BrowserWindow | null = null;
let poller: Poller | null = null;

/** 마지막 스캔에서 발견한 토큰 메타 (token → {title, markerPath}). */
const skillMeta = new Map<string, DiscoveredSkill>();
let scannedTokens: string[] = [];
let latestUpdate: PetUpdate | null = null;

const ICON_DIR = path.join(__dirname, "..", "icons");

function allTokens(): string[] {
  return [...new Set([...scannedTokens, ...config.manualTokens()])];
}

// ── 트레이 ───────────────────────────────────────────────────
function trayImage(phase: PetPhase): Electron.NativeImage {
  return nativeImage.createFromPath(path.join(ICON_DIR, `coco-${phase}-16.png`));
}

function contextMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: "Rona Desk — 학습 현황 동행", enabled: false },
    { type: "separator" },
    { label: "스킬 폴더 추가…", click: () => void addScanRoot() },
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
  petWindow = new BrowserWindow({
    width: 300,
    height: 420,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
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
  petWindow.on("blur", () => petWindow?.hide());
  petWindow.webContents.on("did-finish-load", () => {
    if (latestUpdate) petWindow?.webContents.send("pet:update", latestUpdate);
  });
}

function positionNearTray(): void {
  if (!tray || !petWindow) return;
  const tb = tray.getBounds();
  const wb = petWindow.getBounds();
  petWindow.setPosition(
    Math.round(tb.x + tb.width / 2 - wb.width / 2),
    Math.round(tb.y + tb.height + 4),
    false,
  );
}

function toggleWindow(): void {
  if (!petWindow) return;
  if (petWindow.isVisible()) petWindow.hide();
  else {
    positionNearTray();
    petWindow.show();
    petWindow.focus();
  }
}

// ── 폴링 결과 처리 ───────────────────────────────────────────
function onPollResult(result: PollResult): void {
  const update = buildUpdate(result);
  latestUpdate = update;
  petWindow?.webContents.send("pet:update", update);
  tray?.setImage(trayImage(update.phase));

  // 완주 알림 — skill_completed 신규 도착 시에만, DND 아니면 토스트 1회.
  if (!config.dndActive()) {
    for (const [token, ev] of result.newEvents) {
      if (ev === "skill_completed") {
        const meta = skillMeta.get(token);
        new Notification({
          title: "같이 해냈어요!",
          body: `${meta?.title ?? "스킬"} 완주 — 진행표에서 확인해요`,
        }).show();
      }
    }
  }
}

// ── 마커 스캔 ────────────────────────────────────────────────
async function rescan(): Promise<void> {
  const found = await scanMarkers(config.scanRoots());
  skillMeta.clear();
  for (const s of found) skillMeta.set(s.token, s);
  scannedTokens = found.map((s) => s.token);
  poller?.refresh();
}

async function addScanRoot(): Promise<void> {
  const r = await dialog.showOpenDialog({
    title: "스킬을 설치하는 작업 폴더를 선택하세요",
    properties: ["openDirectory"],
  });
  if (!r.canceled && r.filePaths[0]) {
    config.addScanRoot(r.filePaths[0]);
    await rescan();
  }
}

// ── IPC ──────────────────────────────────────────────────────
function registerIpc(): void {
  ipcMain.handle("config:get", () => ({
    baseUrl: config.baseUrl(),
    scanRoots: config.scanRoots(),
    manualTokens: config.manualTokens(),
    dnd: config.dndActive(),
  }));
  ipcMain.handle("config:addScanRoot", () => addScanRoot());
  ipcMain.handle("config:addManualToken", (_e, token: string) => {
    config.addManualToken(token.trim());
    return rescan();
  });
  ipcMain.handle("config:setBaseUrl", (_e, url: string) => {
    config.setBaseUrl(url);
    poller?.refresh();
  });
  ipcMain.handle("rescan", () => rescan());
  ipcMain.handle("openProgressHtml", (_e, token: string) => {
    const meta = skillMeta.get(token);
    if (!meta) return;
    void shell.openPath(path.join(path.dirname(meta.markerPath), "rona-progress.html"));
  });
}

// ── lifecycle ────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.hide();
  registerIpc();
  tray = new Tray(trayImage("seed"));
  tray.setToolTip("Rona 동행 펫 — 학습 현황");
  tray.on("click", () => toggleWindow());
  tray.on("right-click", () => tray?.popUpContextMenu(contextMenu()));
  createPetWindow();
  initUpdater();

  poller = new Poller(config.baseUrl, allTokens, onPollResult);
  await rescan();
  poller.start();
});

// 트레이 앱: 창을 닫아도 종료하지 않는다 (메뉴 '종료'로만 quit).
app.on("window-all-closed", () => {
  /* keep running in tray */
});
