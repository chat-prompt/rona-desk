// 창 좌상단 좌표가 어느 디스플레이 work area 안에 "충분히 보이게" 드는지 판정.
// electron 'screen' 무의존 순수 로직 — 단위 테스트 가능. (멀티 디스플레이 화면밖 복원 방지)
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 최소 가시 여유: 창 좌상단 기준 가로 80px·세로 24px 이 work area 안에 들어야 "잡을 수 있음".
export const MIN_VISIBLE_X = 80;
export const MIN_VISIBLE_Y = 24;

function pointInAny(px: number, py: number, workAreas: Rect[]): boolean {
  return workAreas.some((wa) => px >= wa.x && py >= wa.y && px <= wa.x + wa.width && py <= wa.y + wa.height);
}

/**
 * pos(창 좌상단)의 80×24 그랩 박스 4코너가 *각각* 어느 디스플레이엔가 들면 가시로 본다.
 * 단일 디스플레이 포함이 아닌 work area 합집합 기준 — 인접 디스플레이 경계(seam)에 걸친
 * 창을 비가시로 오판하지 않기 위함.
 */
export function isPositionVisible(pos: { x: number; y: number }, workAreas: Rect[]): boolean {
  const corners: Array<[number, number]> = [
    [pos.x, pos.y],
    [pos.x + MIN_VISIBLE_X, pos.y],
    [pos.x, pos.y + MIN_VISIBLE_Y],
    [pos.x + MIN_VISIBLE_X, pos.y + MIN_VISIBLE_Y],
  ];
  return corners.every(([px, py]) => pointInAny(px, py, workAreas));
}
