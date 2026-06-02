// 코코(Coco) — 인라인 SVG 마스코트. 코랄 씨앗/불씨. 외부 에셋 0.
// phase(성장=진행도) × mood(표정=반응) 파라메트릭. 색은 CSS 변수 → light/dark 자동.
// 디자인: 달걀형 실루엣 + radial gradient 볼륨 + 글로스 하이라이트 + 큰 눈/캐치라이트/볼터치.
import type { PetPhase, PetMood } from "../../shared/types";

const EYE = "#3a2b2a"; // 눈동자(불가피한 하드코딩 — 코랄 위 대비)

function defs(): string {
  // CSS 변수는 style 속성으로 주입해야 그라데이션 stop 에서 안정적으로 해석됨.
  return `<defs>
    <radialGradient id="cocoBody" cx="40%" cy="30%" r="82%">
      <stop offset="0%" style="stop-color:var(--coral)"/>
      <stop offset="60%" style="stop-color:var(--coral)"/>
      <stop offset="100%" style="stop-color:var(--coral-dark)"/>
    </radialGradient>
    <radialGradient id="cocoLeaf" cx="35%" cy="25%" r="90%">
      <stop offset="0%" style="stop-color:var(--leaf)"/>
      <stop offset="100%" style="stop-color:var(--leaf);stop-opacity:0.78"/>
    </radialGradient>
  </defs>`;
}

// 달걀/씨앗 실루엣(완전 원 회피 — 캐릭터성). 16px 축소에도 강한 단일 덩어리.
const BODY_PATH = "M60 30 C 77 30 93 47 94 70 C 95 95 80 111 60 111 C 40 111 25 95 26 70 C 27 47 43 30 60 30 Z";

function eyes(mood: PetMood): string {
  const cat = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.1" fill="#fff"/>`;
  const open = (rx: number, ry: number, gaze = 0) => `
    <ellipse cx="47" cy="71" rx="${rx}" ry="${ry}" fill="${EYE}"/>
    <ellipse cx="73" cy="71" rx="${rx}" ry="${ry}" fill="${EYE}"/>
    ${cat(49 + gaze, 68.4)}${cat(75 + gaze, 68.4)}`;
  switch (mood) {
    case "nod":
    case "proud":
    case "celebrate":
      // 행복한 감은 눈 ^ ^
      return `
        <path d="M40 73 Q47 64 54 73" fill="none" stroke="${EYE}" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M66 73 Q73 64 80 73" fill="none" stroke="${EYE}" stroke-width="3.6" stroke-linecap="round"/>`;
    case "napping":
      return `
        <path d="M40 71 Q47 75 54 71" fill="none" stroke="${EYE}" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M66 71 Q73 75 80 71" fill="none" stroke="${EYE}" stroke-width="3.2" stroke-linecap="round"/>
        <text x="86" y="40" font-size="13" fill="${EYE}" opacity="0.5" font-family="sans-serif">z</text>`;
    case "wake":
    case "listen":
      return open(6.4, 7.6); // 크게 뜬 눈
    case "observe":
      return open(5.6, 6.4, 2.2); // 옆을 보는 눈(캐치라이트 우측)
    default:
      return open(5.8, 6.8); // idle / align / empty
  }
}

function mouth(mood: PetMood): string {
  switch (mood) {
    case "celebrate":
      return `<path d="M52 86 Q60 97 68 86 Z" fill="${EYE}"/>`;
    case "proud":
    case "nod":
      return `<path d="M53 87 Q60 93 67 87" fill="none" stroke="${EYE}" stroke-width="3" stroke-linecap="round"/>`;
    case "listen":
      return `<circle cx="60" cy="88" r="2.6" fill="${EYE}"/>`;
    case "napping":
      return ``;
    default:
      return `<path d="M54 87 Q60 91 66 87" fill="none" stroke="${EYE}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
}

function cheeks(mood: PetMood): string {
  if (mood === "napping") return ``;
  return `
    <ellipse cx="38" cy="84" rx="5.4" ry="3.4" fill="var(--coral-dark)" opacity="0.3"/>
    <ellipse cx="82" cy="84" rx="5.4" ry="3.4" fill="var(--coral-dark)" opacity="0.3"/>`;
}

function growth(phase: PetPhase): string {
  if (phase === "seed") {
    // 막 트는 새싹 눈 한 점.
    return `<path d="M60 31 q-1 -7 4 -10 q1 6 -4 10 Z" fill="url(#cocoLeaf)"/>`;
  }
  if (phase === "sprout") {
    return `
      <path d="M60 34 V20" stroke="var(--leaf)" stroke-width="3" stroke-linecap="round"/>
      <path d="M60 27 Q49 24 45 14 Q57 15 60 25 Z" fill="url(#cocoLeaf)"/>
      <path d="M60 31 Q70 29 74 21 Q63 21 60 29 Z" fill="url(#cocoLeaf)"/>`;
  }
  // bloom — 줄기 + 잎 + 코랄 꽃 한 송이(페탈 5 + 중심).
  return `
    <path d="M60 36 V20" stroke="var(--leaf)" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 32 Q50 29 46 21 Q57 22 60 30 Z" fill="url(#cocoLeaf)"/>
    <g transform="translate(60 13)">
      <ellipse cx="0" cy="-6.5" rx="3.8" ry="5" fill="var(--coral)"/>
      <ellipse cx="6.2" cy="-2" rx="3.8" ry="5" fill="var(--coral)" transform="rotate(72)"/>
      <ellipse cx="3.8" cy="5.5" rx="3.8" ry="5" fill="var(--coral)" transform="rotate(144)"/>
      <ellipse cx="-3.8" cy="5.5" rx="3.8" ry="5" fill="var(--coral)" transform="rotate(216)"/>
      <ellipse cx="-6.2" cy="-2" rx="3.8" ry="5" fill="var(--coral)" transform="rotate(288)"/>
      <circle cx="0" cy="0" r="3.6" fill="#ffd98a"/>
    </g>`;
}

function sparkle(mood: PetMood): string {
  if (mood !== "celebrate") return ``;
  // 절제된 축하 — 작은 점 3개(반짝이 아이콘 남발 금지).
  return `
    <circle cx="20" cy="46" r="2.4" fill="var(--coral)" opacity="0.8"/>
    <circle cx="100" cy="52" r="2.4" fill="var(--leaf)" opacity="0.8"/>
    <circle cx="95" cy="30" r="1.8" fill="var(--coral)" opacity="0.8"/>`;
}

export function cocoSvg(phase: PetPhase, mood: PetMood): string {
  return `<svg viewBox="0 0 120 120" width="100%" height="100%" role="img" aria-hidden="true">
    ${defs()}
    ${sparkle(mood)}
    <ellipse cx="60" cy="114" rx="30" ry="5" fill="var(--coral-dark)" opacity="0.12"/>
    ${growth(phase)}
    <path d="${BODY_PATH}" fill="url(#cocoBody)"/>
    <ellipse cx="47" cy="56" rx="17" ry="13" fill="#fff" opacity="0.22" transform="rotate(-18 47 56)"/>
    ${cheeks(mood)}
    ${eyes(mood)}
    ${mouth(mood)}
  </svg>`;
}
