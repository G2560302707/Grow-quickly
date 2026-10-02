/**
 * uniapp H5 UI 走查脚本（开发辅助工具）
 * - 静态托管 dist/build/h5
 * - Playwright 拦截 /api/** 返回 mock 数据（无需启动后端）
 * - 对全部 7 个页面截图到 uniapp/.ui-shots/
 * 运行：node scripts/ui-preview.cjs [--out=目录]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "dist", "build", "h5");
const OUT = path.join(__dirname, "..", ".ui-shots");
const PORT = 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function serve(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(ROOT, urlPath);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, "index.html"); // SPA fallback
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

// ---------- mock 数据 ----------
const imgSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e9ebf2"/><text x="300" y="205" font-size="28" fill="#9aa3b8" text-anchor="middle">题目截图</text></svg>`
).toString("base64");
const IMG = `data:image/svg+xml;base64,${imgSvg}`;

const NOTEBOOKS = [
  { id: "nb1", name: "言语理解", _count: { errorItems: 32 } },
  { id: "nb2", name: "判断推理", _count: { errorItems: 28 } },
  { id: "nb3", name: "数量关系", _count: { errorItems: 24 } },
  { id: "nb4", name: "资料分析", _count: { errorItems: 26 } },
  { id: "nb5", name: "常识判断", _count: { errorItems: 18 } },
];

const OVERVIEW = {
  totalItems: 128, unmastered: 42, reviewing: 31, mastered: 55,
  masteryRate: 43, notebookCount: 5, weekAdded: 12,
};

const LIST_ITEMS = Array.from({ length: 15 }, (_, i) => ({
  id: `ei${i + 1}`,
  questionText: `${i % 3 === 0 ? "这段文字意在说明" : i % 3 === 1 ? "下列关于行政处罚的说法正确的是" : "甲、乙两车同时从A地出发"}，第${i + 1}题的题干内容示例：行政法的基本原则包括合法行政、合理行政、程序正当与高效便民。`,
  answerText: "B",
  wrongAnswerText: i % 2 === 0 ? "C" : "",
  analysis: "## 解析\n- 合法行政是首要原则\n- 合理行政要求公平公正\n本题考查行政法基本原则的理解与运用。",
  mistakeAnalysis: "对基本原则的适用范围理解不牢，易混淆合理行政与程序正当。",
  mistakeStatus: "wrong_attempt",
  masteryLevel: i % 3,
  userNotes: i === 0 ? "注意区分原则的适用情形。" : "",
  originalImageUrl: IMG,
  knowledgePoints: JSON.stringify(["行政法基本原则", "合法行政"]),
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  subject: { id: "nb1", name: "言语理解" },
  tags: [{ id: `t${i}`, name: "行政法" }],
}));

const DETAIL = {
  ...LIST_ITEMS[0],
  analysis: "## 解析\n- 合法行政是行政法的首要原则，要求行政机关必须依照法律授权行使职权\n- 合理行政要求行政行为应当公平、公正、适度\n- 程序正当要求行政机关作出影响相对人权益的决定前应当听取其意见",
};

const PRACTICE_Q = {
  questionText: "（练习）某行政机关在未听取当事人陈述申辩的情况下作出罚款决定，违反了下列哪项原则？",
  answerText: "C. 程序正当",
  analysis: "## 解析\n- 未听取陈述申辩直接违反程序正当原则\n- 该决定同时存在合法性问题",
  knowledgePoints: ["程序正当"],
};

function mockRoute(json) {
  return {
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(json),
  };
}

async function main() {
  const outDir = process.argv.find(a => a.startsWith("--out="))?.slice(6) || OUT;
  fs.mkdirSync(outDir, { recursive: true });

  const server = http.createServer(serve).listen(PORT);
  const browser = await chromium.launch({
    // 本地已装版本与 playwright 期望的 revision 不一致时，回退到已存在的可执行文件
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  // 注意：Playwright 按注册的倒序匹配路由，兜底路由必须最先注册
  await page.route("**/api/**", r => r.fulfill(mockRoute({})));
  await page.route("**/api/auth/session", r => r.fulfill(mockRoute({ user: { name: "张同学", email: "zhangxuesheng@example.com" }, expires: "2026-12-31" })));
  await page.route("**/api/notebooks", r => r.fulfill(mockRoute(NOTEBOOKS)));
  await page.route("**/api/error-items/overview*", r => r.fulfill(mockRoute(OVERVIEW)));
  await page.route("**/api/stats/practice*", r => r.fulfill(mockRoute({ overallStats: { total: 86, correct: 61, rate: "70.9" } })));
  await page.route("**/api/error-items/list*", r => r.fulfill(mockRoute({ items: LIST_ITEMS, total: 128, page: 1, pageSize: 15, totalPages: 9 })));
  await page.route("**/api/error-items/ei*", r => r.fulfill(mockRoute(DETAIL)));
  await page.route("**/api/practice/generate*", r => r.fulfill(mockRoute(PRACTICE_Q)));

  const shots = [
    ["login", "http://127.0.0.1:" + PORT + "/#/pages/login/login", 600],
    ["index", "http://127.0.0.1:" + PORT + "/#/pages/index/index", 1400],
    ["items", "http://127.0.0.1:" + PORT + "/#/pages/items/items?subjectId=nb1&name=%E8%A8%80%E8%AF%AD%E7%90%86%E8%A7%A3", 1400],
    ["detail", "http://127.0.0.1:" + PORT + "/#/pages/detail/detail?id=ei1", 1400],
    ["analyze", "http://127.0.0.1:" + PORT + "/#/pages/analyze/analyze", 900],
    ["practice", "http://127.0.0.1:" + PORT + "/#/pages/practice/practice?errorItemId=ei1&subject=%E8%A8%80%E8%AF%AD%E7%90%86%E8%A7%A3", 1400],
    ["profile", "http://127.0.0.1:" + PORT + "/#/pages/profile/profile", 1200],
  ];

  for (const [name, url, wait] of shots) {
    await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
    console.log("SHOT", name);
  }

  // 额外：index 全页截图（看列表完整度）
  await page.goto("http://127.0.0.1:" + PORT + "/#/pages/index/index", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "index-full.png"), fullPage: true });
  console.log("SHOT index-full");

  await browser.close();
  server.close();
  console.log("DONE ->", outDir);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
