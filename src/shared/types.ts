// main / preload / renderer 가 공유하는 계약 타입. (esbuild 가 엔트리별로 인라인 번들)

/** rona.so read 엔드포인트가 쓰는 8종 이벤트 (schema.ts skillEventTypeEnum 와 동일). */
export type SkillEventType =
  | "skill_started"
  | "tool_used"
  | "checkpoint_saved"
  | "skill_completed"
  | "user_note"
  | "direction_aligned"
  | "step_consent"
  | "user_steer";

export const SKILL_EVENT_TYPES: readonly SkillEventType[] = [
  "skill_started",
  "tool_used",
  "checkpoint_saved",
  "skill_completed",
  "user_note",
  "direction_aligned",
  "step_consent",
  "user_steer",
];

/** GET /skill/api/progress/[token] 응답의 data 부분. */
export interface ProgressData {
  generation: {
    installToken: string;
    title: string;
    taskPreview: string;
    targetPlatform: string;
    createdAt: string;
  };
  progress: {
    completed: boolean; // skill_completed 직접 판정 (admin 착시 비복제)
    lastEvent: { eventType: SkillEventType; occurredAt: string } | null;
    stepCounts: Record<SkillEventType, number>;
    totalEvents: number;
  };
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  eventType: SkillEventType;
  occurredAt: string;
  tool?: string;
  tool_name?: string;
  step?: string | number;
  label?: string;
}

/** 작업 폴더의 rona-progress.html(rona-progress-data JSON)이 담는 단계 서사. 서버 8-event 와 별개. */
export type StepState = "done" | "active" | "wait";

export interface RonaProgressStep {
  title: string;
  state: StepState;
  what?: string;
  detail?: string;
}

export interface RonaProgress {
  goal: { title?: string; oneLiner?: string; where?: string; what?: string; how?: string };
  steps: RonaProgressStep[];
  glossary: { term: string; desc: string }[];
}

/** 코코 성장 위상 = 진행도. */
export type PetPhase = "seed" | "sprout" | "bloom";

/** 코코 순간 반응/표정. idle 로 복귀하는 것이 기본(동행은 관망). */
export type PetMood =
  | "idle"
  | "wake"
  | "observe"
  | "nod"
  | "listen"
  | "align"
  | "proud"
  | "celebrate"
  | "napping"
  | "empty";

/** 한 스킬(install_token)의 동기화 상태. */
export interface SkillStatus {
  token: string;
  /** 마커에서 온 제목 (data 도착 전에도 리스트에 이름 표시용). */
  title?: string;
  data: ProgressData | null;
  /** 작업 폴더의 rona-progress.html 에서 읽은 로컬 단계 서사 (있으면 상세 뷰의 1순위). */
  localProgress?: RonaProgress | null;
  lastSyncedAt: number | null;
  offline: boolean;
}

/** main → renderer 로 보내는 펫 갱신 메시지. */
export interface PetUpdate {
  phase: PetPhase;
  mood: PetMood;
  active: SkillStatus | null; // 가장 최근 활동 스킬
  all: SkillStatus[];
  newEvent: SkillEventType | null; // 이번 폴링에서 새로 도착한 이벤트(순간 반응 트리거)
}

export type ThemeMode = "system" | "light" | "dark";

export interface ConfigSnapshot {
  baseUrl: string;
  scanRoots: string[];
  manualTokens: string[];
  dnd: boolean;
  windowPinned: boolean;
  theme: ThemeMode;
  /** 앱에서 숨긴 스킬(복원용). title 은 마커에서 알면 채워짐. */
  dismissed: { token: string; title: string }[];
  version: string;
}

/** preload 가 window.rona 로 노출하는 API 표면 (contextIsolation 경계). */
export interface RonaApi {
  onPetUpdate(cb: (u: PetUpdate) => void): () => void;
  getConfig(): Promise<ConfigSnapshot>;
  addScanRoot(): Promise<void>;
  removeScanRoot(dir: string): Promise<void>;
  addManualToken(token: string): Promise<void>;
  removeManualToken(token: string): Promise<void>;
  setBaseUrl(url: string): Promise<void>;
  setDnd(on: boolean): Promise<void>;
  setWindowPinned(on: boolean): Promise<void>;
  setTheme(mode: ThemeMode): Promise<void>;
  dismissSkill(token: string): Promise<void>;
  restoreSkill(token: string): Promise<void>;
  rescan(): Promise<void>;
}
