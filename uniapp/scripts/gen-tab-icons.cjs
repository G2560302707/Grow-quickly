/**
 * TabBar 图标生成脚本：纯 Node（无第三方依赖）
 * - SDF 光栅化绘制线性图标，4x 超采样后盒式降采样得到平滑抗锯齿
 * - 输出 81x81 PNG 到 src/static/tab/
 * 运行：node scripts/gen-tab-icons.cjs
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 81; // 输出尺寸
const SS = 4; // 超采样倍数
const N = SIZE * SS; // 画布尺寸

// ---------- 颜色 ----------
const INACTIVE = [0x86, 0x8f, 0xa4]; // #868FA4
const ACTIVE = [0x3d, 0x52, 0xd5]; // #3D52D5

// ---------- 几何工具（归一化坐标 0..1） ----------
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : (apx * abx + apy * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = apx - abx * t, dy = apy - aby * t;
  return Math.hypot(dx, dy);
}

function cap(p, cx, cy, r) {
  // 圆头线帽
  return { x: cx, y: cy, r };
}

function strokeSegment(canvas, ax, ay, bx, by, w) {
  // w: 线宽（归一化），圆头帽
  const r = w / 2;
  const minX = Math.min(ax, bx) - r, maxX = Math.max(ax, bx) + r;
  const minY = Math.min(ay, by) - r, maxY = Math.max(ay, by) + r;
  for (let py = Math.floor(minY * N) - 1; py <= Math.ceil(maxY * N) + 1; py++) {
    for (let px = Math.floor(minX * N) - 1; px <= Math.ceil(maxX * N) + 1; px++) {
      if (px < 0 || py < 0 || px >= N || py >= N) continue;
      const d = distToSegment((px + 0.5) / N, (py + 0.5) / N, ax, ay, bx, by);
      if (d <= r) {
        const a = Math.min(1, (r - d) * N + 0.5); // coverage AA
        blend(canvas, px, py, a);
      }
    }
  }
}

function strokeRing(canvas, cx, cy, r, w, a0 = 0, a1 = Math.PI * 2) {
  const half = w / 2;
  for (let py = Math.floor((cy - r - half) * N) - 1; py <= Math.ceil((cy + r + half) * N) + 1; py++) {
    for (let px = Math.floor((cx - r - half) * N) - 1; px <= Math.ceil((cx + r + half) * N) + 1; px++) {
      if (px < 0 || py < 0 || px >= N || py >= N) continue;
      const x = (px + 0.5) / N, y = (py + 0.5) / N;
      const dist = Math.hypot(x - cx, y - cy);
      if (Math.abs(dist - r) > half) continue;
      if (a1 - a0 < Math.PI * 2) {
        let ang = Math.atan2(y - cy, x - cx);
        if (ang < 0) ang += Math.PI * 2;
        let s = a0 < 0 ? a0 + Math.PI * 2 : a0;
        let e = a1 < 0 ? a1 + Math.PI * 2 : a1;
        if (s > e) { if (ang < e) { /* ok */ } else if (ang >= s) { /* ok */ } else continue; }
        else if (ang < s || ang > e) continue;
      }
      const a = Math.min(1, (half - Math.abs(dist - r)) * N + 0.5);
      blend(canvas, px, py, a);
    }
  }
}

function strokeRoundedRect(canvas, cx, cy, hw, hh, r, w) {
  const half = w / 2;
  const minX = cx - hw - half, maxX = cx + hw + half;
  const minY = cy - hh - half, maxY = cy + hh + half;
  for (let py = Math.floor(minY * N) - 1; py <= Math.ceil(maxY * N) + 1; py++) {
    for (let px = Math.floor(minX * N) - 1; px <= Math.ceil(maxX * N) + 1; px++) {
      if (px < 0 || py < 0 || px >= N || py >= N) continue;
      const x = (px + 0.5) / N, y = (py + 0.5) / N;
      const qx = Math.abs(x - cx) - (hw - r);
      const qy = Math.abs(y - cy) - (hh - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const d = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      if (Math.abs(d) > half) continue;
      const a = Math.min(1, (half - Math.abs(d)) * N + 0.5);
      blend(canvas, px, py, a);
    }
  }
}

function blend(canvas, px, py, a) {
  const i = (py * N + px) * 4;
  const na = a + (canvas[i + 3] / 255) * (1 - a);
  if (na <= 0) return;
  // 用当前画笔颜色覆盖混色（单色绘制，简单源覆盖）
  canvas[i] = Math.round((COLOR[0] * a + canvas[i] * (canvas[i + 3] / 255) * (1 - a)) / na);
  canvas[i + 1] = Math.round((COLOR[1] * a + canvas[i + 1] * (canvas[i + 3] / 255) * (1 - a)) / na);
  canvas[i + 2] = Math.round((COLOR[2] * a + canvas[i + 2] * (canvas[i + 3] / 255) * (1 - a)) / na);
  canvas[i + 3] = Math.round(na * 255);
}

// ---------- 图标定义（线宽约 7/81） ----------
const W = 8 / 81; // 归一化线宽

function drawHome(c) {
  // 屋顶：人字线
  strokeSegment(c, 0.14, 0.46, 0.5, 0.17, W);
  strokeSegment(c, 0.5, 0.17, 0.86, 0.46, W);
  // 房身（圆角矩形）
  strokeRoundedRect(c, 0.5, 0.62, 0.3, 0.21, 0.07, W);
  // 门
  strokeSegment(c, 0.5, 0.83, 0.5, 0.68, W * 0.9);
}

function drawScan(c) {
  // 四角括号
  const m = 0.16, L = 0.17, r = 0.06;
  // 左上
  strokeSegment(c, m, m + L, m, m + r, W);
  strokeSegment(c, m, m, m + L, m, W);
  // 右上
  strokeSegment(c, 1 - m, m + L, 1 - m, m + r, W);
  strokeSegment(c, 1 - m, m, 1 - m - L, m, W);
  // 左下
  strokeSegment(c, m, 1 - m - L, m, 1 - m - r, W);
  strokeSegment(c, m, 1 - m, m + L, 1 - m, W);
  // 右下
  strokeSegment(c, 1 - m, 1 - m - L, 1 - m, 1 - m - r, W);
  strokeSegment(c, 1 - m, 1 - m, 1 - m - L, 1 - m, W);
  // 中线
  strokeSegment(c, 0.22, 0.5, 0.78, 0.5, W);
}

function drawMe(c) {
  // 头
  strokeRing(c, 0.5, 0.32, 0.15, W);
  // 肩（圆弧，约 180°）
  strokeRing(c, 0.5, 0.78, 0.24, W, Math.PI + 0.35, Math.PI * 2 - 0.35);
}

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 每行前加 filter 0
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 渲染 ----------
let COLOR = INACTIVE;

function render(drawFn, color) {
  COLOR = color;
  const c = new Uint8Array(N * N * 4); // 透明底
  drawFn(c);
  // 4x 盒式降采样
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * N + (x * SS + sx)) * 4;
          const al = c[i + 3] / 255;
          r += c[i] * al; g += c[i + 1] * al; b += c[i + 2] * al; a += al;
        }
      }
      const o = (y * SIZE + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return out;
}

const OUT_DIR = path.join(__dirname, "..", "src", "static", "tab");
fs.mkdirSync(OUT_DIR, { recursive: true });

const jobs = [
  ["home", drawHome],
  ["scan", drawScan],
  ["me", drawMe],
];

for (const [name, fn] of jobs) {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), encodePNG(render(fn, INACTIVE), SIZE, SIZE));
  fs.writeFileSync(path.join(OUT_DIR, `${name}-active.png`), encodePNG(render(fn, ACTIVE), SIZE, SIZE));
  console.log(`OK ${name}.png / ${name}-active.png`);
}
