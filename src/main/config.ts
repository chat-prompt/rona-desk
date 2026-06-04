// 영속 설정 (electron-store). 기본 API base = https://rona.so.
import Store from "electron-store";
import type { ThemeMode } from "../shared/types";

interface ConfigShape {
  baseUrl: string;
  /** 앱에서 숨긴 스킬 token(들). 추적/표시에서만 제외. */
  dismissedTokens: string[];
  /** DND 해제 시각(epoch ms). null=꺼짐. */
  dndUntil: number | null;
  /** 마지막 창 좌상단 좌표(DIP). null=없음(중앙 배치). 화면 안일 때만 복원. */
  windowPosition: { x: number; y: number } | null;
  /** 사용자가 조절한 창 크기(DIP). null=기본 크기. */
  windowSize: { width: number; height: number } | null;
  /** 테마: system=OS 따름, light/dark=강제. */
  theme: ThemeMode;
}

const store = new Store<ConfigShape>({
  defaults: {
    baseUrl: "https://rona.so",
    dismissedTokens: [],
    dndUntil: null,
    windowPosition: null,
    windowSize: null,
    theme: "system",
  },
});

export const config = {
  baseUrl: (): string => store.get("baseUrl"),
  setBaseUrl: (url: string): void => store.set("baseUrl", url.replace(/\/+$/, "")),

  dismissedTokens: (): string[] => store.get("dismissedTokens"),
  addDismissedToken: (token: string): void => {
    const t = new Set(store.get("dismissedTokens"));
    t.add(token);
    store.set("dismissedTokens", [...t]);
  },
  removeDismissedToken: (token: string): void => {
    store.set(
      "dismissedTokens",
      store.get("dismissedTokens").filter((t) => t !== token),
    );
  },

  dndActive: (): boolean => {
    const until = store.get("dndUntil");
    return until !== null && until > Date.now();
  },
  setDnd: (until: number | null): void => store.set("dndUntil", until),

  windowPosition: (): { x: number; y: number } | null => store.get("windowPosition"),
  setWindowPosition: (pos: { x: number; y: number }): void => store.set("windowPosition", pos),

  windowSize: (): { width: number; height: number } | null => store.get("windowSize"),
  setWindowSize: (size: { width: number; height: number }): void => store.set("windowSize", size),

  theme: (): ThemeMode => store.get("theme"),
  setTheme: (mode: ThemeMode): void => store.set("theme", mode),
};
