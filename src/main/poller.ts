// rona.so GET /skill/api/progress/[token] 폴링. main process(Node fetch=CORS 무관).
// 고정 60s(adaptive 는 v2). 이전 lastEvent 와 diff 해 신규 이벤트 감지.
import type { ProgressData, SkillEventType, SkillStatus } from "../shared/types";

const POLL_INTERVAL_MS = 20_000;

async function fetchProgress(baseUrl: string, token: string): Promise<ProgressData | null> {
  const res = await fetch(`${baseUrl}/skill/api/progress/${token}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null; // 404(미배포/삭제) 등 → null
  const json = (await res.json()) as { data?: ProgressData };
  return json.data ?? null;
}

export type PollResult = {
  statuses: SkillStatus[];
  /** 이번 tick 에서 새로 도착한 이벤트 (token → 신규 lastEvent type). 순간 반응 트리거용. */
  newEvents: Map<string, SkillEventType>;
};

export class Poller {
  private timer: NodeJS.Timeout | null = null;
  private statuses = new Map<string, SkillStatus>();

  constructor(
    private getBaseUrl: () => string,
    private getTokens: () => string[],
    private onResult: (result: PollResult) => void,
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 토큰 목록 변경(스캔/수동추가) 시 즉시 재폴링. */
  refresh(): void {
    void this.tick();
  }

  async tick(): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const tokens = this.getTokens();
    const newEvents = new Map<string, SkillEventType>();

    await Promise.all(
      tokens.map(async (token) => {
        const prev = this.statuses.get(token);
        const data = await fetchProgress(baseUrl, token).catch(() => null);

        if (data) {
          const curLast = data.progress.lastEvent;
          // 신규 이벤트 = "이미 데이터 베이스라인을 본 토큰"에서 lastEvent 가 바뀐 경우만.
          // 첫 데이터(실행 직후·신규 토큰·offline 복구)는 과거 기록이므로 창을 띄우지 않는다.
          if (prev?.data && curLast && curLast.occurredAt !== prev.data.progress.lastEvent?.occurredAt) {
            newEvents.set(token, curLast.eventType);
          }
          this.statuses.set(token, {
            token,
            data,
            lastSyncedAt: Date.now(),
            offline: false,
          });
        } else {
          // 실패 → 마지막 캐시 유지 + offline 표시 (펫 napping). 앱은 죽지 않음.
          this.statuses.set(token, {
            token,
            data: prev?.data ?? null,
            lastSyncedAt: prev?.lastSyncedAt ?? null,
            offline: true,
          });
        }
      }),
    );

    // 폴링 목록에서 빠진 토큰 제거
    for (const token of [...this.statuses.keys()]) {
      if (!tokens.includes(token)) this.statuses.delete(token);
    }

    this.onResult({ statuses: [...this.statuses.values()], newEvents });
  }
}
