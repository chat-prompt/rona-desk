// 코코(Coco) — 인라인 SVG 마스코트. 코랄 씨앗/불씨. 에셋 파일 0.
// phase(성장=진행도) × mood(표정=순간 반응) 조합으로 SVG 문자열 생성.
// 색은 CSS 변수(--coral 등, index.html 정의) 사용 → light/dark 자동 적응.
import type { PetPhase, PetMood } from "../../shared/types";

function eyes(mood: PetMood): string {
  // 좌/우 눈 중심: (47,68), (73,68)
  switch (mood) {
    case "nod":
    case "proud":
    case "celebrate":
      // 행복한 감은 눈 ^ ^
      return `
        <path d="M41 70 Q47 63 53 70" fill="none" stroke="#3a2b2a" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M67 70 Q73 63 79 70" fill="none" stroke="#3a2b2a" stroke-width="3.4" stroke-linecap="round"/>`;
    case "napping":
      // 잠든 눈 - -
      return `
        <path d="M41 69 H53" stroke="#3a2b2a" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M67 69 H79" stroke="#3a2b2a" stroke-width="3.2" stroke-linecap="round"/>`;
    case "listen":
    case "wake":
      // 크게 뜬 눈
      return `
        <circle cx="47" cy="68" r="5.4" fill="#3a2b2a"/>
        <circle cx="73" cy="68" r="5.4" fill="#3a2b2a"/>
        <circle cx="48.6" cy="66.4" r="1.7" fill="#fff"/>
        <circle cx="74.6" cy="66.4" r="1.7" fill="#fff"/>`;
    case "observe":
      // 옆을 보는 눈(동공 우측으로)
      return `
        <circle cx="47" cy="68" r="4.4" fill="#3a2b2a"/>
        <circle cx="73" cy="68" r="4.4" fill="#3a2b2a"/>
        <circle cx="49" cy="68" r="1.5" fill="#fff"/>
        <circle cx="75" cy="68" r="1.5" fill="#fff"/>`;
    default:
      // idle / align / empty — 평범한 눈
      return `
        <circle cx="47" cy="68" r="4.2" fill="#3a2b2a"/>
        <circle cx="73" cy="68" r="4.2" fill="#3a2b2a"/>
        <circle cx="48.3" cy="66.7" r="1.4" fill="#fff"/>
        <circle cx="74.3" cy="66.7" r="1.4" fill="#fff"/>`;
  }
}

function mouth(mood: PetMood): string {
  switch (mood) {
    case "celebrate":
      return `<path d="M52 84 Q60 95 68 84" fill="#3a2b2a" stroke="#3a2b2a" stroke-width="1"/>`;
    case "proud":
    case "nod":
      return `<path d="M54 85 Q60 90 66 85" fill="none" stroke="#3a2b2a" stroke-width="2.6" stroke-linecap="round"/>`;
    case "listen":
      return `<circle cx="60" cy="86" r="2.4" fill="#3a2b2a"/>`;
    case "napping":
      return ``;
    default:
      return `<path d="M55 85 Q60 88 65 85" fill="none" stroke="#3a2b2a" stroke-width="2.2" stroke-linecap="round"/>`;
  }
}

function growth(phase: PetPhase): string {
  // 본체 위(머리)에서 자라는 글리프. seed→없음, sprout→새싹, bloom→꽃.
  if (phase === "seed") return ``;
  if (phase === "sprout") {
    return `
      <path d="M60 38 V26" stroke="var(--leaf)" stroke-width="3" stroke-linecap="round"/>
      <path d="M60 30 Q52 25 49 18 Q58 19 60 28 Z" fill="var(--leaf)"/>`;
  }
  // bloom — 줄기 + 잎 + 코랄 꽃 한 송이
  return `
    <path d="M60 40 V24" stroke="var(--leaf)" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 33 Q51 29 47 22 Q57 23 60 31 Z" fill="var(--leaf)"/>
    <g transform="translate(60 16)">
      <circle cx="0" cy="-6" r="4.2" fill="var(--coral)"/>
      <circle cx="6" cy="-1" r="4.2" fill="var(--coral)"/>
      <circle cx="-6" cy="-1" r="4.2" fill="var(--coral)"/>
      <circle cx="4" cy="6" r="4.2" fill="var(--coral)"/>
      <circle cx="-4" cy="6" r="4.2" fill="var(--coral)"/>
      <circle cx="0" cy="0" r="3.4" fill="#ffd9a0"/>
    </g>`;
}

function sparkle(mood: PetMood): string {
  if (mood !== "celebrate") return ``;
  // 절제된 축하 — 작은 점 3개. sparkle 아이콘 남발 금지(slop 룰).
  return `
    <circle cx="22" cy="44" r="2.4" fill="var(--coral)"/>
    <circle cx="98" cy="50" r="2.4" fill="var(--leaf)"/>
    <circle cx="92" cy="30" r="1.8" fill="var(--coral)"/>`;
}

export function cocoSvg(phase: PetPhase, mood: PetMood): string {
  return `<svg viewBox="0 0 120 120" width="100%" height="100%" role="img" aria-hidden="true">
    ${sparkle(mood)}
    ${growth(phase)}
    <ellipse cx="60" cy="75" rx="41" ry="42" fill="var(--coral-dark)"/>
    <ellipse cx="60" cy="74" rx="38" ry="40" fill="var(--coral)"/>
    ${eyes(mood)}
    ${mouth(mood)}
  </svg>`;
}
