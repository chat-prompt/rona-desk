// 의존성 0 PNG 생성기 (zlib + 직접 PNG 인코딩). sharp/resvg 불필요.
// 코코(Coco) 트레이 글리프 3위상(seed/sprout/bloom) × {16,32}px + 앱 아이콘 512.
// 패널 안의 코코는 라이브 인라인 SVG 라 래스터화 안 함 — 여기는 메뉴바 글리프 전용.
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CORAL = [242, 100, 92]; // Warm Coral #F2645C
const CORAL_DARK = [199, 70, 63];
const LEAF = [122, 178, 110]; // 새싹 녹색 (성장 글리프 강조)

function disc(rgba, size, cx, cy, r, color, a = 255) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) {
        const i = (y * size + x) * 4;
        rgba[i] = color[0];
        rgba[i + 1] = color[1];
        rgba[i + 2] = color[2];
        rgba[i + 3] = a;
      }
    }
  }
}

// 코코: 둥근 씨앗 본체(코랄) + 위상별 성장 글리프. 단색 + 살짝 어두운 윤곽.
function drawCoco(size, phase) {
  const rgba = Buffer.alloc(size * size * 4); // 투명
  const cx = size / 2;
  const cy = size * 0.62;
  const r = size * 0.3;
  disc(rgba, size, cx, cy, r + Math.max(1, size * 0.04), CORAL_DARK); // 윤곽
  disc(rgba, size, cx, cy, r, CORAL); // 본체
  // 눈 2개 (작은 투명 점) — bloom 에서만 명확, 작은 사이즈는 생략
  if (size >= 32) {
    disc(rgba, size, cx - r * 0.35, cy - r * 0.15, size * 0.04, [255, 255, 255]);
    disc(rgba, size, cx + r * 0.35, cy - r * 0.15, size * 0.04, [255, 255, 255]);
  }
  // 성장 글리프
  if (phase === "sprout") {
    disc(rgba, size, cx, size * 0.28, size * 0.09, LEAF);
  } else if (phase === "bloom") {
    disc(rgba, size, cx, size * 0.24, size * 0.13, LEAF);
    disc(rgba, size, cx, size * 0.14, size * 0.07, CORAL); // 꽃 한 점
  }
  return rgba;
}

mkdirSync("dist/icons", { recursive: true });
mkdirSync("build", { recursive: true });

for (const phase of ["seed", "sprout", "bloom"]) {
  for (const size of [16, 32]) {
    writeFileSync(`dist/icons/coco-${phase}-${size}.png`, encodePng(size, drawCoco(size, phase)));
  }
}
writeFileSync("build/icon.png", encodePng(512, drawCoco(512, "bloom")));

console.log("tray icons (seed/sprout/bloom @16,32) + app icon 512 generated");
