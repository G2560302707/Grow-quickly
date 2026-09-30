/**
 * 生成 tabBar 图标 PNG（81x81，灰/橙两态）
 * 运行: node scripts/gen-icons.mjs
 * 产物: src/static/tab/{home,scan,me}.png + *-active.png
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const SIZE = 81;
const OUT_DIR = path.resolve(process.cwd(), "src/static/tab");
fs.mkdirSync(OUT_DIR, { recursive: true });

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

function encodePng(pixels) {
    // pixels: Uint8Array RGBA，行长 SIZE*4，已含 filter 字节由调用方处理
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(SIZE, 0);
    ihdr.writeUInt32BE(SIZE, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
    for (let y = 0; y < SIZE; y++) {
        raw[y * (SIZE * 4 + 1)] = 0; // filter: none
        for (let x = 0; x < SIZE * 4; x++) {
            raw[y * (SIZE * 4 + 1) + 1 + x] = pixels[y * SIZE * 4 + x];
        }
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

// ---------- 画布与形状 ----------
function createCanvas() {
    return new Uint8Array(SIZE * SIZE * 4); // 默认全透明
}

function putPx(canvas, x, y, [r, g, b, a]) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    // 简单 alpha 混合（覆盖式即可，我们的绘制不叠加）
    canvas[i] = r;
    canvas[i + 1] = g;
    canvas[i + 2] = b;
    canvas[i + 3] = a;
}

function fillRect(cv, x0, y0, w, h, color) {
    for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) putPx(cv, x, y, color);
}

function fillRoundRect(cv, x0, y0, w, h, r, color) {
    for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) {
            // 圆角判定
            const dx = x < x0 + r ? x0 + r - x : x > x0 + w - 1 - r ? x - (x0 + w - 1 - r) : 0;
            const dy = y < y0 + r ? y0 + r - y : y > y0 + h - 1 - r ? y - (y0 + h - 1 - r) : 0;
            if (dx * dx + dy * dy <= r * r) putPx(cv, x, y, color);
        }
}

function fillCircle(cv, cx, cy, r, color) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r * r) putPx(cv, x, y, color);
        }
}

function eraseRect(cv, x0, y0, w, h) {
    fillRect(cv, x0, y0, w, h, [0, 0, 0, 0]);
}

function eraseCircle(cv, cx, cy, r) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r * r) putPx(cv, x, y, [0, 0, 0, 0]);
        }
}

// ---------- 图标绘制 ----------
const GRAY = [153, 153, 153, 255];
const ORANGE = [249, 115, 22, 255];

function drawHome(color) {
    const cv = createCanvas();
    // 屋顶（三角）
    for (let row = 0; row < 22; row++) {
        const half = 4 + row * 1.55;
        for (let x = Math.round(40.5 - half); x <= Math.round(40.5 + half); x++) {
            putPx(cv, x, 14 + row, color);
        }
    }
    // 房身
    fillRect(cv, 20, 38, 41, 30, color);
    fillRoundRect(cv, 20, 60, 41, 8, 4, color);
    // 门（镂空）
    eraseRect(cv, 35, 48, 11, 20);
    return cv;
}

function drawScan(color) {
    const cv = createCanvas();
    // 相机机身
    fillRoundRect(cv, 12, 26, 57, 40, 8, color);
    // 顶部取景凸起
    fillRoundRect(cv, 30, 18, 21, 12, 4, color);
    // 镜头：外环镂空 + 内实心
    eraseCircle(cv, 40.5, 46, 13);
    fillCircle(cv, 40.5, 46, 9, color);
    // 高光点
    putPx(cv, 60, 34, [0, 0, 0, 0]);
    eraseRect(cv, 58, 32, 4, 4);
    return cv;
}

function drawMe(color) {
    const cv = createCanvas();
    // 头
    fillCircle(cv, 40.5, 27, 12, color);
    // 肩（胶囊）
    fillRoundRect(cv, 16, 46, 49, 20, 10, color);
    return cv;
}

function save(name, canvas) {
    fs.writeFileSync(path.join(OUT_DIR, name), encodePng(canvas));
    console.log("✓", name);
}

for (const [name, drawer] of [
    ["home", drawHome],
    ["scan", drawScan],
    ["me", drawMe],
]) {
    save(`${name}.png`, drawer(GRAY));
    save(`${name}-active.png`, drawer(ORANGE));
}
console.log("图标生成完毕 →", OUT_DIR);
