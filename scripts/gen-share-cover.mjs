/**
 * 生成小程序分享卡封面（5:4，500x400）
 *
 * 用途：微信 onShareAppMessage / onShareTimeline 的 imageUrl 默认图。
 * 用法：node scripts/gen-share-cover.mjs
 * 产物：uniapp/src/static/share/share-cover.png
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("uniapp/src/static/share");
const OUT_FILE = path.join(OUT_DIR, "share-cover.png");

const svg = `
<svg width="500" height="400" viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#17224b"/>
      <stop offset="55%" stop-color="#101a3c"/>
      <stop offset="100%" stop-color="#233172"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c9973f"/>
      <stop offset="100%" stop-color="#f4ead3"/>
    </linearGradient>
  </defs>

  <rect width="500" height="400" fill="url(#bg)"/>

  <!-- 右上装饰环 -->
  <circle cx="430" cy="40" r="150" fill="none" stroke="#5568e8" stroke-opacity="0.28" stroke-width="1.5"/>
  <circle cx="430" cy="40" r="108" fill="none" stroke="#5568e8" stroke-opacity="0.18" stroke-width="1.5"/>
  <circle cx="430" cy="40" r="66" fill="#5568e8" fill-opacity="0.10"/>
  <circle cx="368" cy="126" r="5" fill="#c9973f" fill-opacity="0.85"/>

  <!-- 左下光晕 -->
  <circle cx="60" cy="392" r="130" fill="#3d52d5" fill-opacity="0.16"/>

  <!-- 文案 -->
  <text x="46" y="108" fill="#c9973f" font-family="Microsoft YaHei, PingFang SC, sans-serif"
        font-size="17" letter-spacing="3">错题整理 · 考前复习</text>

  <text x="44" y="182" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif"
        font-size="54" font-weight="bold" letter-spacing="2">智能错题本</text>

  <rect x="46" y="205" width="56" height="4" rx="2" fill="url(#gold)"/>

  <text x="46" y="248" fill="#ffffff" fill-opacity="0.72"
        font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="22" letter-spacing="1">
    拍照 3 秒录入，AI 自动整理考点
  </text>
  <text x="46" y="284" fill="#ffffff" fill-opacity="0.52"
        font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="22" letter-spacing="1">
    考前只看自己不会的
  </text>

  <!-- 底部胶囊标签 -->
  <g>
    <rect x="46" y="316" width="92" height="34" rx="17" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.14"/>
    <text x="92" y="338" fill="#ffffff" fill-opacity="0.82" text-anchor="middle"
          font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="16">拍照识题</text>

    <rect x="148" y="316" width="92" height="34" rx="17" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.14"/>
    <text x="194" y="338" fill="#ffffff" fill-opacity="0.82" text-anchor="middle"
          font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="16">考点标注</text>

    <rect x="250" y="316" width="92" height="34" rx="17" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.14"/>
    <text x="296" y="338" fill="#ffffff" fill-opacity="0.82" text-anchor="middle"
          font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="16">举一反三</text>
  </g>
</svg>
`;

await mkdir(OUT_DIR, { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUT_FILE);
console.log(`share cover generated: ${OUT_FILE}`);
