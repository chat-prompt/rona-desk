# 코코 자동 동행 설계 — install 하면 코코가 알아서 따라붙는다

작성일: 2026-06-04
상태: 설계 (구현 전 — 이 문서는 계획서다)
관련 코드: `src/main/index.ts`, `src/main/config.ts`, `src/main/marker-scanner.ts`, `src/main/poller.ts`

> **정체성 보정 (2026-06-04 후속):** 이 문서는 "동행 펫" 톤으로 쓰였으나, 이후 Rona 정체성이 **"AI 업무 도구"(실용·도구적)**로 확정됐다. 본문의 "동행/같이" 같은 정서적 표현은 톤일 뿐이고, **자동 등록 메커니즘(쪽지/inbox/fs.watch)·결정·실패 모드 처리는 그대로 유효**하다. 카피·정체성은 [[2026-06-04-coco-first-screen-and-voice]] 참조. 단 "첫 등장 인사(first-run)" 같은 정서적 확장 제안은 도구 톤에선 우선순위가 더 낮아진다.

---

## 1. 문제 — 코코는 "자동 동행"을 표방하지만, 실제로는 수동이다

README와 코드 주석이 그리는 비전은 *"고객이 터미널에서 Rona 실습을 하면 옆에서 코코가 함께 따라가는 동행 펫"* 이다. 그런데 현재 코드는 그렇게 동작하지 않는다. 세 군데가 끊겨 있다.

| 고리 | 지금 상태 | 근거 |
|---|---|---|
| 0) 설치 | 코코를 따로 .dmg 받아 수동 설치 (실습 설치와 무관) | `README.md` 설치 절차 |
| 1) 발견 | 사용자가 직접 "스킬 폴더 추가"로 작업 폴더를 등록해야 함 | `config.ts:26` `scanRoots: []` 기본 빈 배열 / `index.ts:245` `addScanRoot` |
| 2) 서피싱 | 진행 중 창은 자동으로 안 뜸 (의도된 침습 최소화) | `index.ts:3-4`, `index.ts:219` "창은 안 띄움" |

특히 고리 1이 치명적이다. 사용자가 폴더를 수동 등록하지 않으면 코코는 **아무것도 보고 있지 않다.** 첫 화면이 "스킬을 설치한 폴더를 알려주세요" 빈 상태다. 자동으로 동행하지 않으니 입문자는 코코의 존재 자체를 잊는다.

**이 설계의 목표: 고리 0(설치)과 고리 1(발견)을 메워, 사용자가 `install` 한 줄만 치면 그 뒤로 코코가 알아서 따라붙게 한다.** 고리 2(서피싱)는 의도된 설계이므로 유지한다.

전제: 실습 진입점은 **터미널 install CLI**다 (`npx rona install <실습>` 류). 이 CLI는 우리가 수정할 수 있다.

---

## 2. 핵심 메커니즘 — "쪽지(inbox)" 파일

CLI(터미널 프로세스)와 코코(Electron 앱)는 별개 프로세스라 서로 직접 통신하지 못한다. 그래서 **약속된 폴더(우편함)에 JSON 파일(쪽지)을 주고받는** 파일 기반 IPC로 잇는다.

```
CLI:  실습 설치하면서 → 약속된 우편함에 쪽지를 떨군다
코코: 그 우편함을 fs.watch 로 지켜보다가 → 새 쪽지 발견 → 그 실습을 자동 등록
```

이 방식을 고른 이유:
- **느슨한 결합** — CLI와 코코가 서로의 존재/실행 여부를 몰라도 된다.
- **꺼져 있어도 안 놓침** — 코코가 꺼진 동안 떨어진 쪽지는 폴더에 남는다. 코코가 나중에 켜지면서 회수한다. 이게 "코코를 나중에 설치해도 그동안의 실습을 따라잡는" 핵심이다.
- **즉시성** — `fs.watch`는 폴링이 아니라 OS 파일 이벤트라, 코코가 켜져 있으면 쪽지가 떨어지는 즉시 반응한다. (딥링크 URL scheme 없이도 즉시성 확보)

### 검토했으나 버린 대안

- **B) 딥링크 (`ronadesk://`)** — CLI가 `open "ronadesk://..."`로 코코를 즉시 깨우는 방식. 버린 이유: 유일한 추가 가치가 "폴링 지연 제거"인데, `fs.watch`가 이미 그걸 없앤다. 반면 비용은 크다 — Info.plist URL scheme 등록, `open-url` 핸들러 + 콜드 스타트 큐잉(버그 잦음), 단일 인스턴스 락, 경로 인코딩. 게다가 "창을 앞으로 띄움"은 침습 최소화 원칙(`index.ts:3`)과 충돌. → YAGNI. 코코 깨우기는 CLI의 `open -a "Rona Desk"`로 대체(아래).
- **마커 직접 감지** — CLI를 못 고칠 때의 폴백. 코코가 상위 폴더에서 `.rona-skill.json` 신규 출현을 감시. CLI 수정이 가능하므로 채택하지 않음. (CLI를 못 고치게 되면 이 방식으로 회귀)

---

## 3. 전체 흐름

```
┌─ 첫 사용자 (코코 없음) ──────────────────────────────────────┐
│  터미널:  npx rona install <실습>                             │
│     ├─ ① .rona-skill.json 마커 생성             (지금도 함)    │
│     ├─ ② ~/.rona/desk/inbox/<token>.json 쪽지   (추가)        │
│     │     { token, path, title, installedAt }                 │
│     └─ ③ 코코 설치 여부 확인                                   │
│            ├─ 있음 → open -a "Rona Desk"  (조용히 깨움)        │
│            └─ 없음 → "💡 옆에서 같이 보려면: rona.so/desk"     │
│                       (쪽지는 이미 써둠 → 나중에 회수)         │
└────────────────────────────────────────────────────────────────┘
                          │
          사용자가 코코 설치 (지금이든 나중이든)
                          │
                          ▼
┌─ 코코 (켜질 때 / 실행 중) ─────────────────────────────────────┐
│  inbox-watcher                                                 │
│     ├─ 켜질 때: inbox 폴더의 기존 쪽지 전부 회수               │
│     └─ 실행 중: fs.watch 로 새 쪽지 즉시 감지                  │
│              │                                                │
│              ▼                                                │
│     registerWatch(token, path, title)  ← 멱등 수렴점          │
│        ├─ dismissedTokens 에 있으면 → 무시 (제거 의사 존중)   │
│        ├─ 이미 scanRoots 에 path 있으면 → 무시 (멱등)         │
│        ├─ config.addScanRoot(path)                            │
│        ├─ poller.refresh()                                    │
│        ├─ 쪽지 파일 삭제 (처리 완료 = 우편함 비움)            │
│        └─ 창은 안 띄움 (침습 최소화 유지)                     │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
   기존 흐름 그대로: 폴링(poller) → 트레이 위상 변화 → 완주 토스트
```

**사용자 체감**
- 첫 사용자: install → 안내 보고 코코 설치 → 켜자마자 이미 실습을 따라가는 중 (쪽지 회수)
- 재방문 사용자: install → 코코가 알아서 깨어나 따라감. 손 하나 안 댐.
- → **"스킬 폴더 추가"라는 수동 고리가 사라진다.**

---

## 4. 쪽지(inbox) 스펙

### 위치
```
~/.rona/desk/inbox/<token>.json
```
- 파일명을 token으로 → 같은 실습 재설치 시 **덮어쓰기 = 멱등.**
- 우편함은 데이터 디렉터리 한 곳으로 고정. (CLI와 코코가 공유하는 유일한 약속)

### 스키마
```jsonc
{
  "token": "abc123",                      // install_token (마커의 practice_id/student_token 과 동일)
  "path": "/Users/handoff/projects/실습폴더", // 실습 작업 폴더 절대경로
  "title": "Rona 첫 실습",                 // 표시용 (선택)
  "installedAt": "2026-06-04T09:00:00Z",   // ISO8601 (선택)
  "v": 1                                   // 쪽지 포맷 버전 (향후 호환)
}
```
- `token`, `path` 가 필수. 나머지는 없으면 무시.
- 코코는 깨진 JSON / 필수 필드 누락 쪽지는 조용히 skip (마커 스캐너의 기존 관용 처리와 동일한 태도, `marker-scanner.ts:47` 참조).

### 타입 (코코 `src/shared/types.ts` 에 추가)
```ts
/** CLI가 inbox 에 떨구는 "쪽지" — install 시점에 코코에게 이 실습을 알린다. */
export interface InboxNote {
  v: 1;
  token: string;
  path: string;
  title?: string;
  installedAt?: string;
}
```

---

## 5. 코코 레포 — 만들 것

### 신규: `src/main/watch-registry.ts`
A(쪽지)와, 향후 다른 입구가 생겨도, **모두 여기로 수렴하는 멱등 등록 함수.**

```ts
// 입구가 둘 이상이어도 출구는 하나. 멱등.
export function registerWatch(note: { token: string; path: string; title?: string }): "registered" | "skipped" {
  if (config.dismissedTokens().includes(note.token)) return "skipped"; // 제거 의사 존중
  if (config.scanRoots().includes(note.path)) return "skipped";        // 이미 봄
  if (!fs.existsSync(note.path)) return "skipped";                     // [CEO 갭#1] 죽은 경로 거름
  config.addScanRoot(note.path);
  // poller.refresh() 는 호출부(index.ts)에서 — registry 는 electron 무의존 유지(테스트 용이)
  return "registered";
}
```
원칙: registry 자체는 electron/poller에 의존하지 않게 해서 순수 함수로 테스트 가능하게 둔다 (`derive.ts`가 electron 무의존인 것과 같은 패턴, `derive.ts:1`).

**[CEO 갭#1] 죽은 경로 방어:** 쪽지의 `path`가 가리키는 폴더가 이미 이동/삭제됐을 수 있다. 등록 전 `fs.existsSync(note.path)`로 존재를 확인하고, 없으면 skip. scanRoots에 죽은 경로가 쌓이는 것을 막는다.

### 신규: `src/main/inbox-watcher.ts`
```ts
// ~/.rona/desk/inbox 감시.
// - start(): 기존 쪽지 전부 회수(코코가 꺼졌던 동안 쌓인 것) → 각각 처리
// - fs.watch 로 신규 쪽지 감지 → 처리
// - fs.watch 가 못 뜨면 폴링 fallback 으로 전환 (silent failure 방지)
// 처리 = 쪽지 파싱 → registerWatch → 성공 시 쪽지 파일 삭제
export function startInboxWatcher(onRegister: (note: InboxNote) => void): () => void
```
- Node 내장 `fs.watch` 사용 (새 의존성 없음). `fs.watch`의 macOS 중복 이벤트는 처리 멱등성으로 흡수.
- 처리 성공 시 쪽지 삭제 (결정사항: 처리 후 삭제 → 우편함은 항상 깨끗). 삭제 실패해도 멱등이라 무해.
- 파싱 실패 쪽지는 삭제하지 않고 skip (사람이 볼 수 있게 남김).

**[CEO 갭#2] fs.watch 조용한 실패 방어 (silent failure 제거):**
fs.watch가 권한/플랫폼 이유로 못 뜨면 자동 동행 전체가 조용히 죽는다. 침습 최소화라 에러도 안 띄우니 사용자는 "왜 안 따라오지?"를 영영 모른다. 이게 이 설계의 유일한 silent-failure 위험이고, CEO 리뷰의 1순위 금기다. 두 겹으로 막는다:
1. **폴링 fallback** — `fs.watch` 등록이 throw 하거나 watch 핸들이 죽으면, inbox 폴더를 N초(예: 10s)마다 스캔하는 폴링 모드로 자동 전환. 즉시성은 잃지만 동행은 계속 작동.
2. **설정에 상태 표시** — 설정 화면에 "자동 감지: 켜짐 / 폴링 모드 / 꺼짐" 을 조용히 표시. 사용자가 "왜 느리지/왜 안 되지"를 스스로 확인하고 수동 새로고침으로 대응할 수 있게. 알림 토스트는 띄우지 않는다(침습 최소화) — 보이되 조용히.

### 수정: `src/main/index.ts`
- `app.whenReady` 안, poller 시작 부근에서 `startInboxWatcher` 기동.
- 콜백에서 `registerWatch` 호출 후 `"registered"` 면 `poller.refresh()`.
- **창은 띄우지 않는다** (침습 최소화). 트레이 아이콘 위상 변화로만 반영.

### 수정: `src/shared/types.ts`
- `InboxNote` 타입 추가 (위 4절).

### 테스트 (vitest, 기존 `__tests__` 패턴)
- `registerWatch`: dismissed skip / 중복 path skip / 정상 등록 — 멱등 검증.
- inbox 파싱: 정상 / 깨진 JSON / 필수 필드 누락.
- 회수(start): 폴더에 기존 쪽지 N개 → 전부 처리되고 삭제되는지.

### 손대지 않는 것
- 기존 `scanMarkers` / `scanRoots` 수동 추가 흐름은 **그대로 둔다.** 쪽지는 그 위에 얹는 자동 입구일 뿐, 수동 등록도 계속 가능(폴백).
- poller, derive, 렌더러 패널 — 변경 없음. 등록된 path가 scanRoots에 들어가면 나머지는 기존 파이프가 처리.

---

## 6. CLI 레포 — 만들 것 (별도 작업, 이 문서는 명세만)

마커를 생성하는 install route에 두 가지를 추가한다.

### 6.1 쪽지 쓰기
마커(`.rona-skill.json`) 생성 직후:
```
mkdir -p ~/.rona/desk/inbox
write ~/.rona/desk/inbox/<token>.json  ←  InboxNote 스키마(4절)
```
- `path` 는 실습 작업 폴더의 **절대경로** (`process.cwd()` 또는 설치 대상 폴더).
- `token` 은 마커에 쓴 것과 **동일** (practice_id/student_token).
- 쓰기 실패는 install 을 막지 않는다 (best-effort — 동행은 부가 기능).

### 6.2 코코 감지 + 깨우기/안내
```
코코 앱 설치 여부 확인  (macOS: /Applications/Rona Desk.app 존재 여부 등)
  ├─ 있음 → `open -a "Rona Desk"`  (이미 떠 있으면 무해, 꺼져 있으면 기동)
  │          → 코코가 켜지며 방금 쓴 쪽지를 즉시 회수
  └─ 없음 → 안내 한 줄 출력:
            "💡 학습 현황을 옆에서 같이 보려면 Rona Desk 설치: https://rona.so/desk"
            (쪽지는 이미 써뒀으므로, 나중에 설치해도 그때 회수됨)
```
- 자동 설치(brew 등)는 하지 않는다. 입문자에게 "명령이 내 컴퓨터에 뭘 깐다"는 공포를 주고, 미서명 앱이라 더 꼬인다. **안내까지만.**

---

## 7. 결정 사항 (이 설계에서 확정)

| 질문 | 결정 | 이유 |
|---|---|---|
| A냐 B냐 (쪽지 vs 딥링크) | **A(쪽지)만** | `fs.watch`가 즉시성 확보 → B의 유일 가치(지연 제거)가 무의미. B 비용은 큼. 침습 최소화와도 충돌 |
| 처리된 쪽지 | **삭제** | 우편함 항상 깨끗. 멱등이라 삭제해도 안전 |
| dismiss한 스킬에 쪽지 또 옴 | **무시 (dismiss 존중)** | 사용자가 의도적으로 숨긴 것 → 다시 안 띄움 |
| 등록 시 창 띄우기 | **안 띄움** | 침습 최소화 원칙(`index.ts:3`) 유지 |
| 코코 깨우기 | **CLI의 `open -a`** | 딥링크 없이 콜드 스타트 흡수 |
| 첫 설치(고리 0) | **CLI 안내 + 미리 쓴 쪽지** | 자동 설치는 공포 유발. 안내가 입문자 친화적. 쪽지가 늦은 설치를 따라잡음 |
| 이번 범위 | **계획만 (이 문서)** | 코코/CLI 양쪽 명세를 문서로. 구현은 후속 |

---

## 8. 함정 / 주의 (구현 시)

1. **경로에 한글·공백** — `~/내 프로젝트` 흔함. 쪽지 path는 JSON 문자열이라 인코딩 문제 없지만, CLI가 절대경로를 만들 때 `~` 확장과 심볼릭 링크 정규화 주의.
2. **`fs.watch` 중복/누락 이벤트** — macOS에서 한 번 쓰기에 여러 이벤트가 오거나 빠질 수 있음. → 처리 멱등성으로 흡수하고, start() 시 전체 스캔으로 누락 보강.
3. **권한** — `~/.rona/desk/inbox` 가 없을 수 있음. 코코·CLI 둘 다 `mkdir -p` 선행.
4. **두 token 같은 path** — 한 폴더에 여러 실습? 현재 scanRoots는 폴더 단위. path 중복 등록은 멱등으로 막히지만, 마커 스캐너가 폴더 안 여러 마커를 이미 처리하므로 영향 없음.

---

## 8-bis. 실패 모드 등록표 (CEO 리뷰 산출)

| 코드패스 | 실패 모드 | 처리됨? | 사용자가 보는 것 | 로깅 |
|---|---|---|---|---|
| inbox-watcher 파싱 | 쪽지 JSON 깨짐 | Y (skip, 파일 남김) | 아무 일 없음 | warn |
| registerWatch | token/path 누락 | Y (skip) | 아무 일 없음 | debug |
| registerWatch | path 폴더 이미 없음 | Y (existsSync skip) **[갭#1 보강]** | 아무 일 없음 | debug |
| registerWatch | 이미 등록된 token/path | Y (멱등 skip) | 아무 일 없음 | — |
| inbox-watcher 기동 | inbox 폴더 없음 | Y (mkdir -p 선행) | OK | — |
| inbox-watcher | 쪽지 삭제 실패(권한) | Y (멱등이라 무해) | OK | warn |
| **inbox-watcher** | **fs.watch 못 뜸/죽음** | **Y (폴링 fallback + 설정 표시) [갭#2 보강]** | **설정에 '폴링 모드' 표시** | **warn** |

→ RESCUED=N 이면서 USER SEES=Silent 인 행 = **0개** (CRITICAL GAP 없음). 갭#2가 유일한 silent-failure 위험이었고, 폴링 fallback + 설정 표시로 닫음.

## 8-ter. CEO 리뷰 결정 사항

리뷰 모드: **SELECTIVE EXPANSION** / 구현 접근법: **A (쪽지 + fs.watch)**

| # | 항목 | 결정 | 이유 |
|---|---|---|---|
| D1 | 구현 접근법 | A (쪽지+fs.watch) | 기존 addScanRoot/Poller 재사용, 느슨한 결합, explicit over clever |
| 확장 #1 | 첫 등장 인사(first-run 1회 showPet) | **TODOS 메모** | 좋은 아이디어지만 baseline 밖. 나중에 |
| 확장 #2 | 쪽지에 실습 요약 정보 동봉 | **TODOS 메모** | 빈 시간(폴링 20s)은 짧고, 정보 이원화 복잡도는 지금 안 산다 |
| 갭 #1 | 죽은 경로 등록 | **fix: existsSync 확인** | scanRoots 오염 방지, XS 비용 |
| 갭 #2 | fs.watch 조용한 실패 | **fix: 폴링 fallback + 설정 표시** | silent failure 제거 — CEO 1순위 금기 |

## 8-quater. TODOS (후속 — 이 설계 범위 밖, 기록만)

- **[TODO] 첫 등장 인사 (first-run moment)** — 최초 쪽지 등록 시 1회만 `showPet()`으로 코코가 인사하며 등장. config에 `firstRunGreeted` 플래그. 침습 최소화 원칙에 "첫 만남 1회" 예외. 효과: 첫인상이 "깔았더니 살아있네"가 됨. Effort: S(CC ~15분), P2. 의존: 자동 동행(이 설계)이 먼저 있어야 함.
- **[TODO] 쪽지에 실습 요약 동봉** — 쪽지 스키마에 `title/stepCount/estMinutes` 추가 + "쪽지=임시표시, 서버 데이터 오면 교체" 동기화 규칙. 효과: 등록 직후 ~20초 빈 화면 제거. Effort: S, P3. 리스크: 정보 출처 이원화(쪽지 vs 서버) — 동기화 규칙 필수.

## 9. 범위 밖 (후속 과제로 분리)

- 딥링크 URL scheme (`ronadesk://`) — 지금은 불필요. 향후 "웹에서 바로 코코 띄우기" 같은 요구 생기면 그때.
- 코코 자동 설치 (brew cask 등).
- 진행 중 자동 서피싱 (창 자동 띄움) — 침습 최소화 원칙상 의도적 제외.
- 사이드바 **내용/역할** 재정의 (무엇을 보여줄지) — 이번은 "진입 자동화"에 집중. 내용 개선은 별도 브레인스토밍.
