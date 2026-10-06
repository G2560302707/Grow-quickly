"use client";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LatexTestPage() {
    const testCases = [
        {
            title: "单个$符号(行内公式)",
            content: "(1) $a = -12$, $b = 8$, $c = 16$ (2) $t = 12$ (3) $M = \\frac{72}{11}$"
        },
        {
            title: "双$符号(独立公式)",
            content: "答案:\n\n$$M = \\frac{72}{11}$$"
        },
        {
            title: "混合格式",
            content: "解:\n\n(1) $a = -12, b = 8, c = 16$\n\n(2) 当 $t = 12$ 时\n\n(3) $M = \\frac{72}{11}$"
        },
        {
            title: "复杂公式",
            content: "二次函数: $y = ax^2 + bx + c$\n\n求根公式: $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$"
        },
        {
            title: "您的实际答案格式",
            content: "(1) $a = -12$, $b = 8$, $c = 16$ (2) $@t = 12$ (3) $M = \\frac{72}{11}$"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="text-sm text-muted-foreground">验证 Markdown / LaTeX 渲染效果与 AI 输出格式。</div>

            <div className="space-y-6">
                {testCases.map((test, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <CardTitle className="text-lg">{test.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-2">原始文本:</h4>
                                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                                    {test.content}
                                </pre>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-2">渲染结果:</h4>
                                <div className="border rounded p-4 bg-background">
                                    <MarkdownRenderer content={test.content} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="mt-8 border-yellow-500/50 bg-yellow-50/50">
                <CardHeader>
                    <CardTitle className="text-yellow-700">💡 LaTeX 公式格式说明</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <p>• <strong>行内公式</strong>: 使用单个 <code>$</code> 包裹,如 <code>$x^2$</code></p>
                    <p>• <strong>独立公式</strong>: 使用双 <code>$$</code> 包裹,如 <code>$$\\frac{"{a}"}{"{b}"}$$</code></p>
                    <p>• <strong>分数</strong>: <code>\\frac{"{分子}"}{"{分母}"}</code></p>
                    <p>• <strong>根号</strong>: <code>\\sqrt{"{内容}"}</code></p>
                    <p>• <strong>上标</strong>: <code>x^2</code> 或 <code>x^{"{2n}"}</code></p>
                    <p>• <strong>下标</strong>: <code>x_1</code> 或 <code>x_{"{n+1}"}</code></p>
                </CardContent>
            </Card>
        </div>
    );
}
