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
  addManualToken: (token) => ipcRenderer.invoke("config:addManualToken", token),
  setBaseUrl: (url) => ipcRenderer.invoke("config:setBaseUrl", url),
  rescan: () => ipcRenderer.invoke("rescan"),
  openProgressHtml: (token) => ipcRenderer.invoke("openProgressHtml", token),
};

contextBridge.exposeInMainWorld("rona", api);
