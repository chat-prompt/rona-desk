// 영속 설정 (electron-store). 기본 API base = https://rona.so.
import Store from "electron-store";

interface ConfigShape {
  baseUrl: string;
  /** 사용자가 지정한 스킬 설치 작업 폴더 루트(들). 마커 스캔 대상. */
  scanRoots: string[];
  /** 마커를 못 찾을 때 수동 입력한 install_token(들). (fallback) */
  manualTokens: string[];
  /** DND 해제 시각(epoch ms). null=꺼짐. */
  dndUntil: number | null;
}

const store = new Store<ConfigShape>({
  defaults: {
    baseUrl: "https://rona.so",
    scanRoots: [],
    manualTokens: [],
    dndUntil: null,
  },
});

export const config = {
  baseUrl: (): string => store.get("baseUrl"),
  setBaseUrl: (url: string): void => store.set("baseUrl", url.replace(/\/+$/, "")),

  scanRoots: (): string[] => store.get("scanRoots"),
  addScanRoot: (dir: string): void => {
    const roots = new Set(store.get("scanRoots"));
    roots.add(dir);
    store.set("scanRoots", [...roots]);
  },
  removeScanRoot: (dir: string): void => {
    store.set(
      "scanRoots",
      store.get("scanRoots").filter((d) => d !== dir),
    );
  },

  manualTokens: (): string[] => store.get("manualTokens"),
  addManualToken: (token: string): void => {
    const t = new Set(store.get("manualTokens"));
    t.add(token);
    store.set("manualTokens", [...t]);
  },

  dndActive: (): boolean => {
    const until = store.get("dndUntil");
    return until !== null && until > Date.now();
  },
  setDnd: (until: number | null): void => store.set("dndUntil", until),
};
