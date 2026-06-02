// preload — contextIsolation 경계. renderer 는 window.rona 표면만 본다.
import { contextBridge, ipcRenderer } from "electron";
import type { PetUpdate, RonaApi } from "../shared/types";

const api: RonaApi = {
  onPetUpdate(cb) {
    const listener = (_e: unknown, u: PetUpdate): void => cb(u);
    ipcRenderer.on("pet:update", listener);
    return () => ipcRenderer.removeListener("pet:update", listener);
  },
  getConfig: () => ipcRenderer.invoke("config:get"),
  addScanRoot: () => ipcRenderer.invoke("config:addScanRoot"),
  removeScanRoot: (dir) => ipcRenderer.invoke("config:removeScanRoot", dir),
  addManualToken: (token) => ipcRenderer.invoke("config:addManualToken", token),
  removeManualToken: (token) => ipcRenderer.invoke("config:removeManualToken", token),
  setBaseUrl: (url) => ipcRenderer.invoke("config:setBaseUrl", url),
  setDnd: (on) => ipcRenderer.invoke("config:setDnd", on),
  setWindowPinned: (on) => ipcRenderer.invoke("config:setWindowPinned", on),
  setTheme: (mode) => ipcRenderer.invoke("config:setTheme", mode),
  dismissSkill: (token) => ipcRenderer.invoke("config:dismissSkill", token),
  restoreSkill: (token) => ipcRenderer.invoke("config:restoreSkill", token),
  rescan: () => ipcRenderer.invoke("rescan"),
};

contextBridge.exposeInMainWorld("rona", api);
