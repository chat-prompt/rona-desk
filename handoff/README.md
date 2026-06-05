# handoff

Rona 첫 화면 디자인·설계의 개발자 핸드오프 패키지. 이 폴더만 받으면 바로 작업 가능.

## 무엇부터 보나

1. **구현 가이드** — [ideas/2026-06-05-implementation-handoff.md](ideas/2026-06-05-implementation-handoff.md)
   어느 파일·함수를 어떻게 고치는지, 목업 데이터가 실제 어디서 오는지 매핑. **개발자는 여기부터.**
2. **디자인 목업** — [mockups/rona-final-design.html](mockups/rona-final-design.html)
   브라우저로 열면 빈 상태 + 진행 중 최종 화면. 픽셀·색·여백 기준.
3. **검증 데이터** — [mockups/sample-skill/](mockups/sample-skill/)
   실제 Rona 스킬의 진짜 단계로 만든 진행표 + 마커. 코코 scanRoots에 넣으면 목업과 같은 화면이 떠야 함(수용 기준).

## 설계 배경

- [ideas/2026-06-04-coco-first-screen-and-voice.md](ideas/2026-06-04-coco-first-screen-and-voice.md) — 정체성(AI 업무 도구), 카피 가이드(판단 금지·관찰만), UI 결정.
- [ideas/2026-06-04-coco-auto-companion-design.md](ideas/2026-06-04-coco-auto-companion-design.md) — 자동 동행(쪽지/inbox/fs.watch). 이 화면 PR과는 별개 작업.

## 구조

```
handoff/
├── ideas/      # 설계·구현 문서 (.md)
└── mockups/    # 디자인 목업 HTML + 검증용 sample-skill
```
