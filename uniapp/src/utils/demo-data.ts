/**
 * 游客演示数据（本地静态，只读）：
 * 未登录时由 api 层短路返回，形状与后端接口对齐，让审核与体验用户
 * 可以完整浏览错题本/错题详情/统计等功能；写操作被 guestGuard 拦截。
 */
import type {
	AnnouncementItem,
	ErrorItem,
	FocusStats,
	Notebook,
	OverviewStats,
	PracticeQuestionItem,
	PracticeRecordItem,
	PracticeStats,
	PracticeSummary,
	TagTreeNode,
	WeaknessReport,
} from "../api";

// ---------- 错题本 ----------

export const demoNotebooks: Notebook[] = [
	{ id: "demo-nb-yanyu", name: "言语理解与表达", iconKey: "yanyu", _count: { errorItems: 3 } },
	{ id: "demo-nb-panduan", name: "判断推理", iconKey: "panduan", _count: { errorItems: 3 } },
	{ id: "demo-nb-shuliang", name: "数量关系", iconKey: "shuliang", _count: { errorItems: 2 } },
	{ id: "demo-nb-ziliao", name: "资料分析", iconKey: "ziliao", _count: { errorItems: 2 } },
	{ id: "demo-nb-changshi", name: "常识判断", iconKey: "changshi", _count: { errorItems: 2 } },
];

// ---------- 考点树 ----------

export const demoTagTree: TagTreeNode[] = [
	{
		id: "t-hangce",
		name: "行测",
		children: [
			{
				id: "t-yanyu",
				name: "言语理解",
				children: [
					{ id: "t-kp-zhuzhi", name: "主旨概括", children: [] },
					{ id: "t-kp-luojitiankong", name: "逻辑填空", children: [] },
					{ id: "t-kp-paixu", name: "语句排序", children: [] },
				],
			},
			{
				id: "t-panduan",
				name: "判断推理",
				children: [
					{ id: "t-kp-fanyi", name: "翻译推理", children: [] },
					{ id: "t-kp-dingyi", name: "定义判断", children: [] },
					{ id: "t-kp-leibi", name: "类比推理", children: [] },
				],
			},
			{
				id: "t-shuliang",
				name: "数量关系",
				children: [
					{ id: "t-kp-xingcheng", name: "行程问题", children: [] },
					{ id: "t-kp-gailv", name: "概率统计", children: [] },
				],
			},
			{
				id: "t-ziliao",
				name: "资料分析",
				children: [
					{ id: "t-kp-jiqi", name: "基期量计算", children: [] },
					{ id: "t-kp-bizhong", name: "比重变化", children: [] },
				],
			},
			{
				id: "t-changshi",
				name: "常识判断",
				children: [
					{ id: "t-kp-falv", name: "法律常识", children: [] },
					{ id: "t-kp-kexue", name: "科技常识", children: [] },
				],
			},
		],
	},
];

// ---------- 错题 ----------

function nbOf(id: string) {
	return { id, name: demoNotebooks.find((n) => n.id === id)?.name || "" };
}

const t = (id: string) => {
	for (const top of demoTagTree) {
		for (const mid of top.children || []) {
			for (const leaf of mid.children || []) {
				if (leaf.id === id) return [{ id: leaf.id, name: leaf.name }];
			}
		}
	}
	return [];
};

export const demoErrorItems: ErrorItem[] = [
	{
		id: "demo-item-1",
		questionText:
			"随着人工智能技术的快速发展，越来越多的岗位面临被自动化取代的风险。但历史经验表明，技术革命在消灭旧岗位的同时，也会催生大量新职业。**关键在于劳动者能否及时更新技能结构**，适应新的就业形态。\n\n这段文字意在说明：\n\nA. 人工智能将导致大规模失业\nB. 技术革命必然带来大量新职业\nC. 应对技术变革的关键在于劳动者提升自身技能\nD. 历史经验可以完全预测未来就业趋势",
		answerText: "C",
		analysis:
			"文段前两句铺垫背景并指出技术革命的双面性，尾句以「**关键在于**」提出对策——劳动者需及时更新技能结构。主旨概括题应优先围绕对策句，故选 **C**。\n\n- A 项：与文意相悖，文段强调机遇与挑战并存\n- B 项：只是背景铺垫内容，非文段落脚点\n- D 项：「完全预测」表述过于绝对",
		wrongAnswerText: "B",
		mistakeAnalysis:
			"将背景句误当主旨。看到「也会催生大量新职业」就选了 B，但这句话出现在转折词「但」之前，属于铺垫；真正的重点是「关键在于」引导的对策句。",
		userNotes: "对策词后面是重点：关键在于 / 应该 / 需要 / 前提是。",
		masteryLevel: 2,
		originalImageUrl: "",
		knowledgePoints: "主旨概括",
		explanationSource: "ai",
		createdAt: "2026-10-12T09:30:00.000Z",
		subject: nbOf("demo-nb-yanyu"),
		tags: t("t-kp-zhuzhi"),
	},
	{
		id: "demo-item-2",
		questionText:
			"科学研究不能急功近利，而要______。重大原始创新成果的产出往往需要十年甚至数十年的积累，急于求成反而容易______。\n\n依次填入画横线部分最恰当的一项是：\n\nA. 循序渐进　事倍功半\nB. 厚积薄发　拔苗助长\nC. 稳扎稳打　半途而废\nD. 精益求精　功亏一篑",
		answerText: "A",
		analysis:
			"第一空与「急功近利」构成反义对应，强调按步骤、慢慢来，「循序渐进」「稳扎稳打」均符合；第二空陈述「急于求成」的客观结果，「**事倍功半**」指费力大而收效小，与语境精确呼应，故选 **A**。\n\n- B 项「拔苗助长」是主动的愚蠢做法，与「反而容易」衔接不当\n- C 项「半途而废」强调中途放弃，文中无此意\n- D 项「精益求精」侧重追求更好，不与「急功近利」构成反义",
		wrongAnswerText: "B",
		mistakeAnalysis:
			"凭语感选了「厚积薄发」，忽略了第二空的语法衔接：句子主语是「急于求成（的做法）」，「拔苗助长」与之语义重复且搭配生硬。",
		userNotes: "",
		masteryLevel: 1,
		originalImageUrl: "",
		knowledgePoints: "逻辑填空",
		explanationSource: "ai",
		createdAt: "2026-10-14T14:10:00.000Z",
		subject: nbOf("demo-nb-yanyu"),
		tags: t("t-kp-luojitiankong"),
	},
	{
		id: "demo-item-3",
		questionText:
			"①然而，这种「数字记忆」并非牢不可破\n②智能手机和云端存储让我们可以随时调取照片、聊天记录\n③一旦账号被盗或服务停止，这些数据便可能永久消失\n④人们的生活因此被完整地数字化\n\n将以上句子重新排列，语序正确的一项是：\n\nA. ②④①③　B. ②①④③　C. ④②①③　D. ④①②③",
		answerText: "A",
		analysis:
			"②提出现象（云端存储让记录随时可取），④以「因此」承接其结果（生活数字化）；①「**然而**」转折引出隐忧，③具体展开风险内容。转折应发生在正面描述之后，故顺序为 ②④①③，选 **A**。",
		wrongAnswerText: "B",
		mistakeAnalysis:
			"忽略了「然而」不能紧跟现象句：①中「这种数字记忆」指代的正是②④共同描述的数字化结果，直接接在②后指代对象尚未成立。",
		userNotes: "",
		masteryLevel: 0,
		originalImageUrl: "",
		knowledgePoints: "语句排序",
		explanationSource: "ai",
		createdAt: "2026-10-16T20:45:00.000Z",
		subject: nbOf("demo-nb-yanyu"),
		tags: t("t-kp-paixu"),
	},
	{
		id: "demo-item-4",
		questionText:
			"某单位需从甲、乙、丙三人中选派**一人**参加业务培训。已知：\n\n（1）如果甲去，那么乙也去；\n（2）乙、丙两人至多去一人；\n（3）如果丙不去，那么甲去。\n\n由此可以推出，去参加培训的是：\n\nA. 甲　B. 乙　C. 丙　D. 无法确定",
		answerText: "C",
		analysis:
			"**翻译**：（1）甲→乙；（2）¬乙 ∨ ¬丙；（3）¬丙→甲。\n\n**推理**：假设甲去，由（1）乙也去，与「只去一人」矛盾，故甲不去；由（3）的逆否命题「甲不去→丙去」，得丙去；代入（2）验证：乙不去，条件全部满足。\n\n故选 **C**。",
		wrongAnswerText: "A",
		mistakeAnalysis:
			"没有先从矛盾最集中的条件（1）入手做假设排除，而是试图同时凑三个条件，越推越乱，最后凭直觉选了甲。",
		userNotes: "翻译推理先找「唯一性约束」（只去一人），假设排除最快。",
		masteryLevel: 0,
		originalImageUrl: "",
		knowledgePoints: "翻译推理",
		explanationSource: "ai",
		createdAt: "2026-10-15T11:20:00.000Z",
		subject: nbOf("demo-nb-panduan"),
		tags: t("t-kp-fanyi"),
	},
	{
		id: "demo-item-5",
		questionText:
			"绿色壁垒是指在国际贸易中，一国以保护生态环境、自然资源和人类健康为借口，通过制定严格的环保技术标准，对来自其他国家的产品设置限制措施。\n\n根据上述定义，下列属于绿色壁垒的是：\n\nA. 某国以环保为由，对进口电子产品的能耗提出远高于国际标准的强制准入要求\nB. 某国海关查获一批走私的濒危野生动物制品并依法销毁\nC. 某国对进口粮食实施关税配额管理\nD. 某国立法禁止本国高污染产业向境外转移",
		answerText: "A",
		analysis:
			"定义要件：①发生在**国际贸易**中；②借口保护生态/健康；③通过**严格的环保技术标准**；④对他国产品**设置限制**。\n\n- A 项四个要件全部满足，选 **A**\n- B 项：正常执法，未针对他国产品贸易\n- C 项：关税配额是贸易措施但与环保标准无关\n- D 项：约束对象是本国企业，方向相反",
		wrongAnswerText: "B",
		mistakeAnalysis:
			"只关注了「保护生态环境」这一表象，忽略了「以……为借口」「对他国产品设置限制」等核心要件，把正当执法误判为壁垒。",
		userNotes: "",
		masteryLevel: 1,
		originalImageUrl: "",
		knowledgePoints: "定义判断",
		explanationSource: "ai",
		createdAt: "2026-10-13T16:00:00.000Z",
		subject: nbOf("demo-nb-panduan"),
		tags: t("t-kp-dingyi"),
	},
	{
		id: "demo-item-6",
		questionText:
			"筷子：餐具\n\n与上述词语在内在逻辑关系上最为相似的一项是：\n\nA. 手表：饰品\nB. 火车：交通\nC. 台灯：照明\nD. 手机：通讯工具",
		answerText: "A",
		analysis:
			"题干为**种属关系**：筷子是餐具的一种。\n\n- A 项：手表是饰品的一种，种属关系一致，选 **A**\n- B 项：火车是「交通工具」，但「交通」是活动领域，非集合概念\n- C、D 项：台灯与照明、手机与通讯均为**功能对应**关系，不是种属",
		wrongAnswerText: "D",
		mistakeAnalysis:
			"把「功能对应」当成了「种属关系」：手机是通讯工具，看似同筷子—餐具结构相同，但「通讯工具」是功能类别描述，严格造句「手机是一种通讯工具」成立——此类题需警惕二级辨析：筷子、手表、手机都是人造物，但题干与 A 项均以「日常随身器物—大类」对应最工整。",
		userNotes: "类比推理先造句子：「A 是 B 的一种」，再横向比较二级属性。",
		masteryLevel: 2,
		originalImageUrl: "",
		knowledgePoints: "类比推理",
		explanationSource: "ai",
		createdAt: "2026-10-11T10:05:00.000Z",
		subject: nbOf("demo-nb-panduan"),
		tags: t("t-kp-leibi"),
	},
	{
		id: "demo-item-7",
		questionText:
			"甲、乙两地相距 240 千米，一辆汽车去时速度 60 千米/小时，按原路返回时速度 40 千米/小时，则往返全程的平均速度是（ ）千米/小时。\n\nA. 46　B. 48　C. 50　D. 52",
		answerText: "B",
		analysis:
			"平均速度 = 总路程 ÷ 总时间，**不是**速度的算术平均。\n\n去时 240 ÷ 60 = 4 小时；返回 240 ÷ 40 = 6 小时。\n总路程 480 千米，总时间 10 小时，平均速度 480 ÷ 10 = **48**，选 **B**。\n\n快捷公式：等距往返平均速度 = 2v₁v₂ ÷ (v₁+v₂) = 2×60×40 ÷ 100 = 48（调和平均，永远小于算术平均）。",
		wrongAnswerText: "C",
		mistakeAnalysis:
			"直接用 (60+40)÷2 = 50，把「平均速度」当成了「速度的平均数」。这是行程问题最经典的陷阱。",
		userNotes: "等距往返：v̄ = 2v₁v₂/(v₁+v₂)，永远不要算术平均！",
		masteryLevel: 2,
		originalImageUrl: "",
		knowledgePoints: "行程问题",
		explanationSource: "ai",
		createdAt: "2026-10-10T09:00:00.000Z",
		subject: nbOf("demo-nb-shuliang"),
		tags: t("t-kp-xingcheng"),
	},
	{
		id: "demo-item-8",
		questionText:
			"从 1 到 10 这十个整数中随机取出两个不同的数，两数之和为偶数的概率是（ ）。\n\nA. 4/9　B. 5/9　C. 2/5　D. 1/2",
		answerText: "A",
		analysis:
			"和为偶数 ⇔ 两数**同奇或同偶**。\n\n1–10 中有 5 个奇数、5 个偶数：\nC(5,2) + C(5,2) = 10 + 10 = 20 种；\n总取法 C(10,2) = 45 种。\n\n概率 = 20/45 = **4/9**，选 **A**。",
		wrongAnswerText: "D",
		mistakeAnalysis:
			"默认「奇偶相加=偶」想当然选了 1/2，漏掉了「同奇、同偶」两条路径都要计数，属于样本空间划分不完整。",
		userNotes: "",
		masteryLevel: 0,
		originalImageUrl: "",
		knowledgePoints: "概率统计",
		explanationSource: "ai",
		createdAt: "2026-10-17T15:30:00.000Z",
		subject: nbOf("demo-nb-shuliang"),
		tags: t("t-kp-gailv"),
	},
	{
		id: "demo-item-9",
		questionText:
			"2023 年某省社会消费品零售总额为 4800 亿元，同比增长 6.2%。问：2022 年该省社会消费品零售总额约为（ ）亿元。\n\nA. 4236　B. 4520　C. 4708　D. 5100",
		answerText: "B",
		analysis:
			"基期量 = 现期量 ÷ (1 + 增长率)\n\n4800 ÷ 1.062 ≈ **4520** 亿元，选 **B**。\n\n速算技巧：选项首位不同，可直接估 4800 ÷ 1.062，略小于 4800 且除以大于 1 的数，排除 D；4800 − 4800×0.062 ≈ 4502，最接近 B。",
		wrongAnswerText: "A",
		mistakeAnalysis:
			"把「同比增长 6.2%」错算成 4800 × (1 − 6.2%) ≈ 4502，基期量公式用反了方向。",
		userNotes: "基期 = 现期 ÷ (1+r)。看到「同比」先想除法，不要习惯性做减法。",
		masteryLevel: 1,
		originalImageUrl: "",
		knowledgePoints: "基期量计算",
		explanationSource: "ai",
		createdAt: "2026-10-14T19:20:00.000Z",
		subject: nbOf("demo-nb-ziliao"),
		tags: t("t-kp-jiqi"),
	},
	{
		id: "demo-item-10",
		questionText:
			"2023 年某省社会消费品零售总额为 4800 亿元，同比增长 6.2%；其中网上零售额 960 亿元，同比增长 18.5%。\n\n问：2023 年网上零售额占社会消费品零售总额的比重比上年同期（ ）。\n\nA. 上升约 2.1 个百分点　B. 下降约 2.1 个百分点\nC. 上升约 4.5 个百分点　D. 下降约 4.5 个百分点",
		answerText: "A",
		analysis:
			"两期比重差 = (A/B) × (a−b)/(1+a)，其中 a=18.5%（部分增速），b=6.2%（整体增速）。\n\na > b → 比重**上升**；差值 = 20% × 12.3/118.5 ≈ 20% × 0.104 ≈ **2.1 个百分点**，选 **A**。\n\n验证：2023 年比重 960/4800 = 20%；2022 年 (960/1.185)÷(4800/1.062) ≈ 17.9%，上升 2.1 个百分点。",
		wrongAnswerText: "C",
		mistakeAnalysis:
			"直接用增速差 18.5% − 6.2% = 12.3 个百分点然后目测选了 C，忘记两期比重差要乘现期比重并除以 (1+a)，数值必然远小于增速差。",
		userNotes: "",
		masteryLevel: 0,
		originalImageUrl: "",
		knowledgePoints: "比重变化",
		explanationSource: "ai",
		createdAt: "2026-10-17T19:40:00.000Z",
		subject: nbOf("demo-nb-ziliao"),
		tags: t("t-kp-bizhong"),
	},
	{
		id: "demo-item-11",
		questionText:
			"根据《中华人民共和国民法典》，自然人的民事权利能力始于（ ）。\n\nA. 年满八周岁　B. 年满十八周岁\nC. 出生　D. 能够独立实施民事法律行为",
		answerText: "C",
		analysis:
			"《民法典》第十三条：自然人从**出生时**起到死亡时止，具有民事权利能力，依法享有民事权利，承担民事义务。选 **C**。\n\n注意区分：民事**权利能力**始于出生（人人平等）；民事**行为能力**才分档（八周岁、十八周岁等节点）。",
		wrongAnswerText: "B",
		mistakeAnalysis:
			"混淆了「民事权利能力」与「民事行为能力」：行为能力才与年龄挂钩，权利能力自出生即有。",
		userNotes: "权利能力：出生就有；行为能力：分档（8/16/18 周岁）。",
		masteryLevel: 2,
		originalImageUrl: "",
		knowledgePoints: "法律常识",
		explanationSource: "ai",
		createdAt: "2026-10-09T08:50:00.000Z",
		subject: nbOf("demo-nb-changshi"),
		tags: t("t-kp-falv"),
	},
	{
		id: "demo-item-12",
		questionText:
			"下列现象与科学原理对应**错误**的是：\n\nA. 水中倒影——光的反射\nB. 雨后彩虹——光的折射\nC. 立竿见影——光的直线传播\nD. 海市蜃楼——光的直线传播",
		answerText: "D",
		analysis:
			"海市蜃楼是光在密度不均匀的空气中传播时发生**折射**（及全反射）形成的虚像，对应「光的直线传播」错误，选 **D**。\n\n- A 项：倒影是平面镜成像，属反射\n- B 项：彩虹是光在水滴中折射+反射色散\n- C 项：影子由光沿直线传播被遮挡形成",
		wrongAnswerText: "C",
		mistakeAnalysis:
			"审题不细，题目要求选「错误」项，扫读时按「正确」项做了排除，误留 D 选 C。",
		userNotes: "",
		masteryLevel: 1,
		originalImageUrl: "",
		knowledgePoints: "科技常识",
		explanationSource: "ai",
		createdAt: "2026-10-16T12:15:00.000Z",
		subject: nbOf("demo-nb-changshi"),
		tags: t("t-kp-kexue"),
	},
];

// ---------- 统计 ----------

export const demoOverviewStats: OverviewStats = {
	totalItems: 12,
	unmastered: 4,
	reviewing: 4,
	mastered: 4,
	masteryRate: 33,
	notebookCount: demoNotebooks.length,
	weekAdded: 3,
};

export const demoPracticeSummary: PracticeSummary = { total: 86, correct: 61, rate: 71 };

/** 近 7 天（以今天为终点）的 yyyy-MM-dd */
function recentDates(n: number): string[] {
	const out: string[] = [];
	const pad = (v: number) => String(v).padStart(2, "0");
	for (let i = n - 1; i >= 0; i--) {
		const d = new Date(Date.now() - i * 86400000);
		out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
	}
	return out;
}

export const demoPracticeStats: PracticeStats = {
	subjectStats: [
		{ name: "言语理解", value: 24 },
		{ name: "判断推理", value: 21 },
		{ name: "数量关系", value: 18 },
		{ name: "资料分析", value: 15 },
		{ name: "常识判断", value: 8 },
	],
	activityStats: [3, 8, 5, 12, 9, 6, 11].map((total, i) => ({
		date: recentDates(7)[i],
		total,
		correct: Math.round(total * [0.6, 0.75, 0.6, 0.83, 0.67, 0.67, 0.73][i]),
	})),
	difficultyStats: [
		{ name: "简单", value: 20 },
		{ name: "中等", value: 34 },
		{ name: "困难", value: 21 },
		{ name: "压轴", value: 11 },
	],
	overallStats: { total: 86, correct: 61, rate: 71 },
	channelStats: {
		free: { total: 30, correct: 20, rate: 67 },
		reinforced: { total: 56, correct: 41, rate: 73 },
	},
};

export const demoWeaknessReport: WeaknessReport = {
	generatedAt: new Date().toISOString(),
	totalErrorItems: 12,
	readyKpCount: 3,
	kps: [
		{
			tagId: "t-kp-gailv",
			name: "概率统计",
			chapterId: "t-shuliang",
			chapterName: "数量关系",
			errorCount: 2,
			unmasteredShare: 0.5,
			recurrence: 2,
			practiceAttempts: 8,
			practiceAccuracy: 0.5,
			score: 86,
			confidence: 0.72,
			trend: "worsening",
			evidenceErrorItemIds: ["demo-item-8"],
			ready: true,
		},
		{
			tagId: "t-kp-bizhong",
			name: "比重变化",
			chapterId: "t-ziliao",
			chapterName: "资料分析",
			errorCount: 2,
			unmasteredShare: 0.5,
			recurrence: 1,
			practiceAttempts: 5,
			practiceAccuracy: 0.6,
			score: 74,
			confidence: 0.65,
			trend: "flat",
			evidenceErrorItemIds: ["demo-item-10"],
			ready: true,
		},
		{
			tagId: "t-kp-fanyi",
			name: "翻译推理",
			chapterId: "t-panduan",
			chapterName: "判断推理",
			errorCount: 1,
			unmasteredShare: 1,
			recurrence: 1,
			practiceAttempts: 4,
			practiceAccuracy: 0.75,
			score: 61,
			confidence: 0.58,
			trend: "improving",
			evidenceErrorItemIds: ["demo-item-4"],
			ready: true,
		},
	],
	chapters: [
		{ tagId: "t-shuliang", name: "数量关系", kpCount: 2, errorCount: 3, score: 80 },
		{ tagId: "t-ziliao", name: "资料分析", kpCount: 2, errorCount: 2, score: 74 },
		{ tagId: "t-panduan", name: "判断推理", kpCount: 3, errorCount: 2, score: 61 },
	],
	topKps: [],
};
demoWeaknessReport.topKps = demoWeaknessReport.kps;

// ---------- 专注 ----------

export const demoFocusStats: FocusStats = {
	todaySeconds: 1500,
	weekSeconds: 8460,
	streakDays: 3,
	totalSessions: 42,
	totalSeconds: 57600,
	last7Days: [1500, 2100, 0, 1800, 900, 1200, 960].map((seconds, i) => ({
		date: recentDates(7)[i],
		seconds,
	})),
	dailyGoalMin: 60,
	byMode: {
		pomodoro: { seconds: 42600, sessions: 34, completed: 30 },
		mock: { seconds: 13200, sessions: 6, completed: 5 },
		custom: { seconds: 1800, sessions: 2, completed: 2 },
	},
};

// ---------- 公告 ----------

export const demoAnnouncements: AnnouncementItem[] = [
	{
		id: "demo-notice-1",
		title: "游客浏览模式",
		content:
			"当前未登录，页面展示的是内置演示数据，仅供体验浏览。登录后即可同步你的真实错题本、练习记录与学习统计。",
		createdAt: "2026-10-01T00:00:00.000Z",
		read: false,
	},
];

// ---------- 练习题库 / 练习记录 ----------

export const demoPracticeQuestions: PracticeQuestionItem[] = [
	{
		id: "demo-pq-1",
		channel: "similar",
		difficulty: "medium",
		subject: "言语理解与表达",
		questionText:
			"当前，数据要素已成为驱动经济发展的关键引擎。但数据流通不畅、权属界定模糊等问题，仍制约着数据价值的充分释放。**破题之道在于完善制度供给，让数据「可用不可见」**。\n\n这段文字意在说明：\n\nA. 数据要素是经济高质量发展的核心动力\nB. 数据流通不畅制约了数据价值释放\nC. 释放数据价值需要以完善制度供给为抓手\nD. 「可用不可见」是数据技术发展的新方向",
		answerText: "C",
		eloRating: 1180,
		status: "pending",
		isCorrect: null,
		answeredAt: null,
		createdAt: "2026-10-15T10:00:00.000Z",
		tag: { name: "主旨概括" },
		errorItem: { id: "demo-item-1", questionText: "随着人工智能技术的快速发展……" },
	},
	{
		id: "demo-pq-2",
		channel: "smart",
		difficulty: "medium",
		subject: "数量关系",
		questionText:
			"一辆汽车以 80 千米/小时的速度从 A 城开往 B 城，返回时因修路速度降为 60 千米/小时。若往返共用时 7 小时，则 A、B 两城相距（ ）千米。\n\nA. 210　B. 220　C. 240　D. 260",
		answerText: "C",
		eloRating: 1210,
		status: "pending",
		isCorrect: null,
		answeredAt: null,
		createdAt: "2026-10-16T10:00:00.000Z",
		tag: { name: "行程问题" },
		errorItem: { id: "demo-item-7", questionText: "甲、乙两地相距 240 千米……" },
	},
	{
		id: "demo-pq-3",
		channel: "similar",
		difficulty: "easy",
		subject: "资料分析",
		questionText:
			"2023 年某市高新技术产业产值为 1250 亿元，同比增长 25%。则 2022 年该市高新技术产业产值约为（ ）亿元。\n\nA. 937　B. 1000　C. 1030　D. 1100",
		answerText: "B",
		eloRating: 1050,
		status: "pending",
		isCorrect: null,
		answeredAt: null,
		createdAt: "2026-10-17T10:00:00.000Z",
		tag: { name: "基期量计算" },
		errorItem: { id: "demo-item-9", questionText: "2023 年某省社会消费品零售总额……" },
	},
];

export const demoPracticeRecords: PracticeRecordItem[] = [
	{
		id: "demo-pr-1",
		subject: "言语理解与表达",
		difficulty: "medium",
		isCorrect: true,
		questionText:
			"传统村落是农耕文明的珍贵遗产，但仅靠情怀难以支撑其保护成本。**让村民成为保护的受益者，古村落才能真正「活」下去**。\n\n这段文字意在说明传统村落保护的：\n\nA. 资金困境　B. 关键路径　C. 历史价值　D. 政策空白",
		answerText: "B",
		analysis: "尾句对策「让村民成为受益者」是文段主旨，强调保护的关键路径。",
		channel: "similar",
		createdAt: "2026-10-17T21:30:00.000Z",
	},
	{
		id: "demo-pr-2",
		subject: "数量关系",
		difficulty: "hard",
		isCorrect: false,
		questionText:
			"从 1 到 10 中随机取出两个不同的数，两数之和为偶数的概率是（ ）。\n\nA. 4/9　B. 5/9　C. 2/5　D. 1/2",
		answerText: "A",
		analysis: "同奇或同偶：C(5,2)+C(5,2)=20，C(10,2)=45，概率 4/9。",
		channel: "smart",
		createdAt: "2026-10-17T20:10:00.000Z",
	},
	{
		id: "demo-pr-3",
		subject: "判断推理",
		difficulty: "medium",
		isCorrect: true,
		questionText:
			"只有通过资格考试，才能获得执业证书；小李获得了执业证书。由此可推出：\n\nA. 小李通过了资格考试　B. 小李未通过资格考试　C. 无法确定小李是否通过考试",
		answerText: "A",
		analysis: "「只有 A 才 B」翻译为 B→A，肯定后件即可肯定前件。",
		channel: "free",
		createdAt: "2026-10-16T18:40:00.000Z",
	},
];

// ---------- 便捷查询 ----------

export function findDemoItem(id: string): ErrorItem | undefined {
	return demoErrorItems.find((i) => i.id === id);
}

/** 按 listErrorItems 的参数语义做本地过滤 + 分页 */
export function filterDemoItems(params: {
	subjectId?: string;
	query?: string;
	mastery?: "0" | "1";
	sourceType?: "manual" | "practice";
	tagId?: string;
	page?: number;
	pageSize?: number;
}): { items: ErrorItem[]; total: number; totalPages: number } {
	const tagLeafIds = new Set<string>();
	if (params.tagId) {
		const walk = (nodes: TagTreeNode[]) => {
			for (const n of nodes) {
				if (n.id === params.tagId) {
					const collect = (x: TagTreeNode) => {
						tagLeafIds.add(x.id);
						(x.children || []).forEach(collect);
					};
					collect(n);
					break;
				}
				if (n.children?.length) walk(n.children);
			}
		};
		walk(demoTagTree);
	}

	let list = demoErrorItems.filter((i) => {
		if (params.subjectId && i.subject?.id !== params.subjectId) return false;
		if (params.mastery === "0" && i.masteryLevel !== 0) return false;
		if (params.mastery === "1" && i.masteryLevel !== 1) return false;
		if (params.sourceType && (i.sourceType || "manual") !== params.sourceType) return false;
		if (tagLeafIds.size && !i.tags?.some((tg) => tagLeafIds.has(tg.id))) return false;
		if (params.query) {
			const q = params.query.toLowerCase();
			const hay = [i.questionText, i.analysis, i.knowledgePoints, i.userNotes]
				.filter(Boolean)
				.join("\n")
				.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		return true;
	});

	list = [...list].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
	const page = params.page || 1;
	const pageSize = params.pageSize || 20;
	const total = list.length;
	return {
		items: list.slice((page - 1) * pageSize, page * pageSize),
		total,
		totalPages: Math.max(1, Math.ceil(total / pageSize)),
	};
}
