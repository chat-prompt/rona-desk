# Rona Desk — 코코(Coco)

Rona 맞춤 스킬의 **학습 현황을 메뉴바에서 같이 보는 데스크탑 동행 펫**. 터미널이 낯선 입문자 옆에서 진행을 따라가고 완주를 축하한다. (DEV-3857)

- 데이터: rona.so `GET /skill/api/progress/[token]` 폴링 (무인증 토큰)
- 토큰 발견: 작업 폴더의 `.rona-skill.json` 마커 스캔 + 수동 입력
- 마스코트: 진행도에 따라 씨앗→새싹→꽃으로 자라는 코랄 불씨

## 개발

```bash
npm install
npm start        # 아이콘 생성 + 빌드 + electron 실행
npm run typecheck
npm run dist      # .dmg + .zip (electron-builder)
```

## 설치 (v1)

v1 .dmg 는 ad-hoc 서명이라 macOS Gatekeeper 가 "확인되지 않은 개발자"로 막을 수 있다. 처음 한 번:

```bash
xattr -dr com.apple.quarantine "/Applications/Rona Desk.app"
```

또는 Finder 에서 앱 우클릭 → 열기.

> 넓은 입문자 배포 시에는 Apple Developer ID 서명 + notarization 권장 (현재 v1 보류, DEV-3857 E1).

## 구조

```
src/main/      # Electron main: 트레이, 폴링, 마커 스캔
src/preload/   # contextBridge (contextIsolation)
src/renderer/  # 코코 펫 + 진행 패널
scripts/       # build(esbuild), gen-tray-icons(zlib PNG)
```
