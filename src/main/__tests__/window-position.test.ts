import { describe, it, expect } from "vitest";
import { isPositionVisible, type Rect } from "../window-position";

const primary: Rect = { x: 0, y: 25, width: 1440, height: 875 }; // 메뉴바 제외 work area
const external: Rect = { x: 1440, y: 0, width: 1920, height: 1080 }; // 오른쪽 외장 모니터

describe("isPositionVisible", () => {
  it("주 디스플레이 안 좌표는 가시", () => {
    expect(isPositionVisible({ x: 100, y: 100 }, [primary])).toBe(true);
  });

  it("외장으로 옮긴 좌표는 외장 연결 시 가시", () => {
    expect(isPositionVisible({ x: 1600, y: 200 }, [primary, external])).toBe(true);
  });

  it("외장 분리 시 그 좌표는 비가시 → 트레이 fallback 유도", () => {
    expect(isPositionVisible({ x: 1600, y: 200 }, [primary])).toBe(false);
  });

  it("오른쪽 끝에 너무 붙어 가시 여유(80px) 부족하면 비가시", () => {
    expect(isPositionVisible({ x: 1400, y: 100 }, [primary])).toBe(false); // 1400+80 > 1440
  });

  it("work area 위(메뉴바 영역)로 올라가면 비가시", () => {
    expect(isPositionVisible({ x: 100, y: 0 }, [primary])).toBe(false); // y=0 < 25
  });

  it("인접 두 디스플레이 경계(seam)에 걸쳐도 union 으로 덮이면 가시", () => {
    // x=1410: 그랩박스 1410~1490 이 primary(~1440)+external(1440~) 두 화면에 걸침. 단일 포함은 실패하나 union 은 덮음.
    expect(isPositionVisible({ x: 1410, y: 200 }, [primary, external])).toBe(true);
  });

  it("실제 갭(인접 아님)에 걸치면 비가시 → 트레이 fallback", () => {
    const far: Rect = { x: 2000, y: 0, width: 1920, height: 1080 }; // primary 와 1440~2000 갭
    expect(isPositionVisible({ x: 1410, y: 200 }, [primary, far])).toBe(false); // 1490 은 어느 화면에도 없음
  });
});
