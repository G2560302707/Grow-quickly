/**
 * 公务员考试（行测）考点标签树
 * subject = 'gongkao'，根节点为行测五大模块，下挂一级考点（含可选的常用二级考点）。
 * 供三处使用：系统标签 seed（scripts/seed-gongkao-tags.ts）、题库导入 AI 分类标签池、
 * 错题识别（analyze）的行测考点清单注入。
 */

export const GONGKAO_SUBJECT_KEY = 'gongkao';

export interface GongkaoPoint {
    point: string;
    /** 常用二级考点；缺省时该一级考点本身即叶子 */
    children?: string[];
}

export interface GongkaoModule {
    module: string;
    points: GongkaoPoint[];
}

export const GONGKAO_CURRICULUM: GongkaoModule[] = [
    {
        module: '言语理解',
        points: [
            { point: '逻辑填空', children: ['实词辨析', '成语辨析', '关联关系', '语境分析'] },
            { point: '片段阅读', children: ['主旨概括', '意图判断', '细节理解', '词句理解', '态度观点', '标题选择'] },
            { point: '语句表达', children: ['语句排序', '语句填空', '接语选择'] },
            { point: '篇章阅读' },
        ],
    },
    {
        module: '判断推理',
        points: [
            { point: '图形推理', children: ['位置规律', '样式规律', '属性规律', '数量规律', '空间重构'] },
            { point: '定义判断', children: ['单定义判断', '多定义判断'] },
            { point: '类比推理', children: ['语义关系', '逻辑关系', '语法关系'] },
            { point: '逻辑判断', children: ['翻译推理', '削弱加强', '前提假设', '解释评价', '归纳推理', '分析推理', '真假推理'] },
        ],
    },
    {
        module: '数量关系',
        points: [
            { point: '基础应用题', children: ['和差倍比', '年龄问题', '日期问题', '周期问题'] },
            { point: '典型应用题', children: ['行程问题', '工程问题', '经济利润', '浓度问题', '牛吃草', '植树方阵'] },
            { point: '数与式', children: ['排列组合', '概率问题', '几何问题', '容斥原理', '最值问题'] },
            { point: '数字推理' },
        ],
    },
    {
        module: '资料分析',
        points: [
            { point: '增长问题', children: ['增长率', '增长量', '隔年增长', '年均增长'] },
            { point: '比例问题', children: ['比重', '平均数', '倍数'] },
            { point: '综合分析', children: ['综合分析判断', '常考陷阱'] },
            { point: '速算技巧' },
        ],
    },
    {
        module: '常识判断',
        points: [
            { point: '政治常识', children: ['马克思主义原理', '中国特色社会主义理论', '党史国史'] },
            { point: '法律常识', children: ['宪法', '民法', '刑法', '行政法', '其他法律'] },
            { point: '经济常识' },
            { point: '历史文化' },
            { point: '地理环境' },
            { point: '科技生活' },
            { point: '时事政治' },
            { point: '管理与公文' },
        ],
    },
];

/** 行测模块名集合（与 GONGKAO_CURRICULUM 根节点一致） */
export const GONGKAO_MODULES = GONGKAO_CURRICULUM.map(m => m.module);

/**
 * 展开为「叶子考点 → 所属模块」清单（题库导入 AI 分类用）。
 * 有二级考点时二级为叶子，否则一级考点本身为叶子。
 */
export function gongkaoLeafTags(): Array<{ module: string; point: string; leaf: string }> {
    const out: Array<{ module: string; point: string; leaf: string }> = [];
    for (const mod of GONGKAO_CURRICULUM) {
        for (const p of mod.points) {
            if (p.children?.length) {
                for (const leaf of p.children) out.push({ module: mod.module, point: p.point, leaf });
            } else {
                out.push({ module: mod.module, point: p.point, leaf: p.point });
            }
        }
    }
    return out;
}
