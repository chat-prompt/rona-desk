import { describe, it, expect } from "vitest";
import { stepList } from "../panel";
import type { RonaProgressStep } from "../../../shared/types";

const done = (title: string): RonaProgressStep => ({ title, state: "done" });
const active = (title: string): RonaProgressStep => ({ title, state: "active" });
const wait = (title: string): RonaProgressStep => ({ title, state: "wait" });

describe("stepList", () => {
  // 회귀: 전부 done(active 0개)일 때, 헤더는 "완주했어요"인데 마지막 단계를
  // "마지막!/이것만 끝내면 완주예요" 미완 카드로 또 그리던 자기모순 버그.
  it("all-done(active 0개)이면 current 카드를 그리지 않는다", () => {
    const html = stepList(["환경", "설치", "서버", "열기", "이벤트", "정리"].map(done));
    expect(html).not.toContain('class="current"');
    expect(html).not.toContain("마지막!");
    expect(html).not.toContain("이것만 끝내면 완주예요");
    // 모든 단계가 done 행으로 렌더된다(upcoming "다음" 라벨/next 행 없음).
    expect(html).not.toContain("nextlabel");
    expect(html).not.toContain('srow next');
    expect((html.match(/srow done/g) ?? []).length).toBe(6);
  });

  it("마지막 단계만 active면 정당하게 '마지막!' current 카드를 그린다", () => {
    const steps = [...["환경", "설치", "서버", "열기", "이벤트"].map(done), active("정리")];
    const html = stepList(steps);
    expect(html).toContain('class="current"');
    expect(html).toContain("마지막!");
    expect(html).toContain("이것만 끝내면 완주예요");
  });

  it("중간 단계가 active면 '진행 중' current + 남은 단계 '다음' 라벨", () => {
    const steps = [done("환경"), done("설치"), active("서버"), wait("열기"), wait("이벤트")];
    const html = stepList(steps);
    expect(html).toContain('class="current"');
    expect(html).toContain("진행 중");
    expect(html).not.toContain("마지막!");
    expect(html).toContain("nextlabel"); // 남은 단계 앞 "다음" 라벨
  });

  it("what이 있으면 완료·현재·예정 모든 단계에 설명을 렌더한다", () => {
    const steps: RonaProgressStep[] = [
      { title: "환경", state: "done", what: "Node/npm 점검" },
      { title: "설치", state: "active", what: "전역 설치 확인" },
      { title: "서버", state: "wait", what: "서버 기동" },
    ];
    const html = stepList(steps);
    expect(html).toContain("Node/npm 점검"); // 완료 행 설명
    expect(html).toContain("전역 설치 확인"); // 현재 카드 설명
    expect(html).toContain("서버 기동"); // 예정 행 설명
    expect(html).toContain('class="sdesc"'); // 완료/예정 행은 sdesc
    expect(html).toContain('class="scol"');
  });

  it("what이 없으면 설명 줄을 그리지 않는다(빈 sdesc 금지)", () => {
    const html = stepList([done("환경"), active("설치"), wait("서버")]);
    expect(html).not.toContain('class="sdesc"');
    expect(html).not.toContain("<span class=\"sdesc\"></span>");
  });

  it("빈 단계 배열은 안내 문구를 반환한다", () => {
    expect(stepList([])).toContain("아직 단계가 없어요");
  });
});
