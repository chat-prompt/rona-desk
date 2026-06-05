# Rona 첫 화면 구현 가이드 (개발자 핸드오프)

작성일: 2026-06-05
대상: 코코(rona-desk) 렌더러를 고칠 개발자
목적: 디자인 목업을 실제 코드에 반영. **이 문서만 보고 바로 작업 가능하게** 파일·함수·데이터 매핑을 담음.

## 0. 먼저 볼 것

- **디자인 목업(최종):** `handoff/mockups/rona-final-design.html` — 브라우저로 열면 빈 상태 + 진행 중 두 화면. 픽셀·색·여백·애니메이션의 기준.
- **설계 배경:** `handoff/ideas/2026-06-04-coco-first-screen-and-voice.md` (정체성·카피 가이드·UI 결정), `handoff/ideas/2026-06-04-coco-auto-companion-design.md` (자동 동행).
- **검증 데이터:** `handoff/mockups/sample-skill/` — 실제 Rona 스킬의 진짜 단계로 만든 진행표 + 마커. 이 폴더를 코코 scanRoots에 넣으면 목업과 같은 화면이 실제로 떠야 함(=수용 기준).

목업의 CSS 클래스명은 실제 코드와 다르다(목업은 독립 HTML). **클래스명을 그대로 복붙하지 말 것.** 아래 매핑을 따라 실제 파일에 맞춰 옮긴다.

---

## 1. 고칠 파일

| 파일 | 무엇을 |
|---|---|
| `src/renderer/panel/panel.ts` | 진행 뷰 렌더 로직 — `richDetail`을 새 구성으로 교체, 헬퍼 추가, 빈 상태 카피 교체 |
| `src/renderer/index.html` (`<style>`) | CSS — 궤도 오브, 펄스 점, 그라데이션 진행바, 3칸 위계(opacity), 한 줄 용어, 서브카피 |
| `src/renderer/renderer.ts` | (변경 거의 없음. 용어집 항상 펼침이면 토글 불필요) |

데이터 타입·폴링은 손대지 않는다. 화면만 바꾼다.

---

## 2. 목업 요소 → 실제 데이터 매핑

진행 뷰는 `renderPanel` → `detailCard(selected)` → 로컬 진행표 있으면 `richDetail(s, s.localProgress)`로 그려진다(`panel.ts`). 각 목업 요소의 데이터 출처:

| 목업에서 보이는 것 | 실제 데이터 | 코드 위치 |
|---|---|---|
| 헤더 실습명 "스터디 마케팅 자료 정리" | `p.goal.title` (없으면 `skillTitle(s)`) | `panel.ts` `skillTitle()` |
| 서브카피 "흩어진 자료를…" | `p.goal.oneLiner` | `RonaProgress.goal.oneLiner` (`types.ts`) |
| 진행바 채움 / "2 / 5 완료" | `stepCounts(p)` → `{done, total}`, `done`=state==="done" 개수 | `panel.ts:52` `stepCounts` |
| 단계 제목 (✓완료 / 현재 / 다음) | `p.steps[].title`, `p.steps[].state`("done"/"active"/"wait") | `RonaProgressStep` |
| 현재 단계 = 코랄 강조 | `state==="active"` 인 step | — |
| 단계 칩 "완료 / 진행 중" | `stepStateLabel(state)` (이미 있음: 완료/진행 중/대기) | `panel.ts:48` |
| "🤖 AI 용어 check!" 목록 | `p.glossary[]` → `{term, desc}` | `RonaProgress.glossary` |
| 상태 "● 실습 진행 중" | active step 존재 + offline 아님. (offline이면 "잠깐 쉬는 중") | `s.offline` |

**핵심 주의 (진행도 계산):** `stepCounts`는 `done`만 센다. active는 안 셈. 그래서 "2번째가 active(진행 중)"여도 진행바는 **완료 1개 기준이 아니라 done 개수**로 뜬다. 목업의 "2/5"는 done=2 가정. 카피·숫자 혼동 주의. (`panel.ts:53`)

**빈 상태**(추적 중인 실습 없음): `renderPanel`에서 `skills.length === 0`일 때. 현재 "스킬 폴더 추가" 버튼 → **"AI로 오늘의 업무를 해결해볼까요?" + 자동 대기 안내 + 작은 폴더추가 링크 + 궤도 오브**로 교체. (자동 동행 설계와 일관 — 큰 수동 버튼 제거)

---

## 3. `richDetail` 새 구성 (교체)

현재 `richDetail`(panel.ts:199 부근)은 목표블록(`wayBlock`) + 전체 단계 카드(`stepCard` 전부) + 용어 + 진행도미터를 다 펼친다. 이를 아래 구성으로 교체:

```
[헤더]      goal.title  (+ 톱니)
[서브카피]   goal.oneLiner  (있을 때만)
[상태]      ● 실습 진행 중  (offline이면 "잠깐 쉬는 중", 완주면 "완주했어요")
[진행바]    그라데이션 + done/total
[3칸 단계]  직전(done 마지막 1) · 현재(active) · 다음(wait 첫 1)
[용어]      glossary 한 줄씩 (항상 펼침)
```

### 3칸 단계 규칙 (신규 헬퍼)
전체 steps 중 **3개 창**만 렌더. active 인덱스를 가운데:
- active 인덱스 `i` 찾기 (`steps.findIndex(s => s.state==="active")`. 없으면 첫 non-done, 그것도 없으면 마지막).
- 보통: `steps[i-1]`(done, 흐림) + `steps[i]`(active, 코랄 카드) + `steps[i+1]`(wait, 흐림, "다음" 라벨)
- 첫 단계(i=0): 현재 + 다음 2개
- 마지막 단계(i=last): 직전 2개 + 현재(칩 "마지막!" + 완주 예고)
- 위계: done `opacity:.42` / active 또렷+코랄 테두리+배경 / 다음 `opacity:.6` / 그 외 렌더 안 함
- 현재 단계 카드만 `st.detail`("다음 액션")을 펼침 옵션으로 둘 수 있으나, 기본은 제목만(글 폭탄 방지).

### 제거/보존
- `wayBlock`(어디까지/무엇을/어떻게) → **진행 뷰에서 제거** (서브카피 oneLiner로 대체). 함수는 남겨도 무방하나 호출 안 함.
- `timelineSection` → 진행 뷰 기본에서 **제외**(이번 범위 밖).
- `stepCard` 전체 나열 → 3칸 창으로 대체.
- `progressMeter` → 그라데이션 진행바 + "done / total 완료"로 스타일·카피만 변경("전체 진행도" → 라벨 없이 숫자).

---

## 4. CSS (index.html `<style>`에 추가/수정)

목업 `handoff/mockups/rona-final-design.html`의 `<style>`을 참조해 아래를 실제 변수 체계(`--coral` 등 이미 있음)에 맞춰 옮긴다. 핵심만:

- **궤도 오브**(빈 상태): `.orb` 46px, 얇은 링 + `@keyframes spin`(4s linear)으로 도는 코랄 점 + 중심 점. 목업 `.orb/.orb-ring/.orb-orbit/.orb-core` 참조.
- **펄스 점**(상태): 6px 코랄 + `@keyframes`로 ripple(scale 1→3, opacity 0.5→0, 1.8s). 목업 `.pulse::after`.
- **그라데이션 진행바**: `background:linear-gradient(90deg,#ffb07a,#f0635a)`. (목업엔 shine 애니메이션도 있으나 선택)
- **3칸 위계**: done 행 `opacity:.42`, 다음 행 `opacity:.6`. active는 `.current` 코랄 카드(`--coral-soft` 배경 + 코랄 테두리).
- **한 줄 용어**: `.g1` `term — desc` 한 줄. `b`는 진한색, 나머지 muted.
- **서브카피**: `.subcopy` 11.5px muted, 실습명 밑, 로고 점 들여쓰기(18px) 정렬.
- **색 원칙**: 중성 회색 베이스 + 코랄은 포인트(현재 단계·진행바·펄스·로고 점)만. 헤더 핑크 배경박스 없음. 마스코트 없음.

목업의 색 토큰(참고): `--coral:#f0635a`, `--coral-soft:#fdeeec`, `--ink:#1c1c1f`, `--ink2:#6b6b72`, `--ink3:#9c9ca3`, `--line:#ededf0`. 실제 코드의 기존 `--coral`(#f2645c)과 미세 차이 있음 — 디자인 기준(목업 값)으로 통일 권장.

---

## 5. 카피 (그대로 사용 — 변경 금지 영역)

카피 가이드(`...first-screen-and-voice.md` §2): **판단 금지, 관찰만.**
- 상태: "실습 진행 중" (O) / "해결 중"·"잘 가고 있어요" (X — 막히면 거짓)
- 진행: "2 / 5 완료"
- 칩: "완료 / 진행 중" (active), "다음" 라벨
- 마지막 단계: "마지막!" + "이것만 끝내면 완주예요"
- 용어 섹션: "🤖 AI 용어 check!"
- 빈 상태: "AI로 오늘의 업무를 해결해볼까요?" / "터미널에서 Rona 실습을 시작하면 이 창에 자동으로 나타나요" / "실습을 기다리는 중" / 작게 "안 보이나요? 폴더 직접 추가 →"

새 문구가 필요하면 카피 가이드 4원칙(도구 톤 / 판단 아닌 관찰 / 입문자 눈높이 / 짧게)을 따른다.

---

## 6. 수용 기준 (이걸로 "됐다" 판정)

1. `handoff/mockups/sample-skill/` 폴더를 코코 scanRoots에 추가 → 진행 뷰가 목업과 **같은 구조**로 뜬다(헤더·서브카피·진행바·3칸 단계·용어).
2. 추적 중인 실습 0개 → 빈 상태가 궤도 오브 + 자동 대기 카피로 뜬다(큰 "폴더 추가" 버튼 없음).
3. 단계가 5개여도 화면엔 **3칸만** 보인다. active가 가운데, 위계(흐림/또렷) 적용.
4. 다크모드(prefers-color-scheme: dark)에서 깨지지 않는다. (기존 CSS 변수 체계 활용)
5. 메뉴바 실제 크기(~340px 폭)에서 글 폭탄 없이 읽힌다.
6. `npm run typecheck` 통과.

## 7. 범위 밖 (이번 PR 아님)
- 완주 전용 화면, 오프라인 화면, 진행표 없는 실습("발자국") 폴백 — 후속.
- 타임라인/다음액션 펼침 — 후속(기본은 제외).
- 자동 동행(쪽지/inbox) — 별도 설계 문서(`...auto-companion-design.md`). 이 PR은 화면만.
