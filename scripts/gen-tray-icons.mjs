// 의존성 0 PNG 생성기 (zlib + 직접 PNG 인코딩). sharp/resvg 불필요.
// 중립 진행 마크 3위상(seed/sprout/bloom) × {16,32}px + 앱 아이콘 512.
// 캐릭터성 없는 메뉴바 진행 pip 전용 (빈 링→링+점→꽉 찬 원).
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
const MUTED = [150, 150, 158]; // 대기(미시작) 링

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

// 가운데를 투명으로 비워 도넛(링)을 만든다.
function ring(rgba, size, cx, cy, rOuter, rInner, color) {
  disc(rgba, size, cx, cy, rOuter, color);
  disc(rgba, size, cx, cy, rInner, color, 0); // a=0 → 가운데 투명
}

// 중립 진행 pip — 캐릭터성 없음. 위상별 진행도만 표현(빈 링→링+점→꽉 찬 원).
// 16px 메뉴바에서 강한 실루엣, light/dark 무관하게 코랄/회색으로 읽힘.
function drawMark(size, phase) {
  const rgba = Buffer.alloc(size * size * 4); // 투명
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.4;
  if (phase === "bloom") {
    disc(rgba, size, cx, cy, R, CORAL); // 꽉 찬 원 = 완주
  } else if (phase === "sprout") {
    ring(rgba, size, cx, cy, R, R * 0.52, CORAL); // 코랄 링
    disc(rgba, size, cx, cy, R * 0.3, CORAL); // + 중심 점 = 진행 중
  } else {
    ring(rgba, size, cx, cy, R, R * 0.55, MUTED); // 빈 회색 링 = 대기
  }
  return rgba;
}

mkdirSync("dist/icons", { recursive: true });
mkdirSync("build", { recursive: true });

for (const phase of ["seed", "sprout", "bloom"]) {
  for (const size of [16, 32]) {
    writeFileSync(`dist/icons/mark-${phase}-${size}.png`, encodePng(size, drawMark(size, phase)));
  }
}
writeFileSync("build/icon.png", encodePng(512, drawMark(512, "bloom")));

console.log("tray marks (seed/sprout/bloom @16,32) + app icon 512 generated");
