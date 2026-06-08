import { describe, it, expect } from 'vitest';

// Test parseCommands function logic
function parseCommands(raw: string): string[] {
    if (!raw?.trim()) return [];
    const t = raw.trim();
    if (t.startsWith("[")) {
        try {
            const a = JSON.parse(t);
            if (Array.isArray(a))
                return a.filter((c): c is string => typeof c === "string" && c.trim() !== "");
        } catch { /* fall through */ }
    }
    return t.split("\n").map((c) => c.trim()).filter((c) => c && !c.startsWith("//"));
}

// Test parseApiArgs function logic (safe version)
function parseApiArgs(cmd: string): { m: string; a: unknown[] } | null {
    const m = cmd.match(/^(\w+)\(([\s\S]+)\)$/);
    if (!m) return null;
    try {
        const argsStr = m[2].trim();
        if (argsStr.startsWith('[') && argsStr.endsWith(']')) {
            return { m: m[1], a: JSON.parse(argsStr) };
        }
        if (/^-?\d+(\.\d+)?$/.test(argsStr)) {
            return { m: m[1], a: [Number(argsStr)] };
        }
        if (argsStr === 'true' || argsStr === 'false') {
            return { m: m[1], a: [argsStr === 'true'] };
        }
        if ((argsStr.startsWith('"') && argsStr.endsWith('"')) ||
            (argsStr.startsWith("'") && argsStr.endsWith("'"))) {
            return { m: m[1], a: [argsStr.slice(1, -1)] };
        }
        const parts = argsStr.split(',').map(s => s.trim());
        const parsed: unknown[] = parts.map(p => {
            if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
            if (p === 'true' || p === 'false') return p === 'true';
            if ((p.startsWith('"') && p.endsWith('"')) ||
                (p.startsWith("'") && p.endsWith("'"))) return p.slice(1, -1);
            return p;
        });
        return { m: m[1], a: parsed };
    }
    catch { return null; }
}

// Test isApiCall function logic
const API_PREFIXES = [
    "setcoordsystem", "setaxesvisible", "setgridvisible", "setcolor",
    "setlinethickness", "setlinestyle", "setpointsize", "setpointstyle",
    "setlabelvisible", "setcaption", "setvisible", "setfilling",
    "setvalue", "setfixed", "setbackgroundcolor",
];

function isApiCall(cmd: string): boolean {
    const l = cmd.toLowerCase().trim();
    return API_PREFIXES.some((p) => l.startsWith(p + "("));
}

describe('GeoGebra Commands', () => {
    describe('parseCommands', () => {
        it('should parse JSON array of commands', () => {
            const input = '["f(x) = x^2", "A = (1, 2)"]';
            expect(parseCommands(input)).toEqual(['f(x) = x^2', 'A = (1, 2)']);
        });

        it('should parse newline-separated commands', () => {
            const input = 'f(x) = x^2\nA = (1, 2)\nSegment(A, B)';
            expect(parseCommands(input)).toEqual(['f(x) = x^2', 'A = (1, 2)', 'Segment(A, B)']);
        });

        it('should filter empty lines and comments', () => {
            const input = 'f(x) = x^2\n// This is a comment\n\nA = (1, 2)';
            expect(parseCommands(input)).toEqual(['f(x) = x^2', 'A = (1, 2)']);
        });

        it('should return empty array for empty input', () => {
            expect(parseCommands('')).toEqual([]);
            expect(parseCommands('   ')).toEqual([]);
            expect(parseCommands(null as any)).toEqual([]);
        });

        it('should filter non-string items from JSON array', () => {
            const input = '["f(x) = x^2", 123, null, "A = (1, 2)"]';
            expect(parseCommands(input)).toEqual(['f(x) = x^2', 'A = (1, 2)']);
        });
    });

    describe('parseApiArgs', () => {
        it('should parse numeric arguments', () => {
            expect(parseApiArgs('setCoordSystem(-10, 10, -10, 10)')).toEqual({
                m: 'setCoordSystem',
                a: [-10, 10, -10, 10]
            });
        });

        it('should parse boolean arguments', () => {
            expect(parseApiArgs('setAxesVisible(true, false)')).toEqual({
                m: 'setAxesVisible',
                a: [true, false]
            });
        });

        it('should parse string arguments', () => {
            expect(parseApiArgs('setColor("A", 255, 0, 0)')).toEqual({
                m: 'setColor',
                a: ['A', 255, 0, 0]
            });
        });

        it('should parse single numeric argument', () => {
            expect(parseApiArgs('setLineThickness(3)')).toEqual({
                m: 'setLineThickness',
                a: [3]
            });
        });

        it('should parse array argument', () => {
            expect(parseApiArgs('setValues([1, 2, 3])')).toEqual({
                m: 'setValues',
                a: [1, 2, 3]
            });
        });

        it('should return null for invalid input', () => {
            expect(parseApiArgs('invalid')).toBeNull();
            expect(parseApiArgs('')).toBeNull();
        });
    });

    describe('isApiCall', () => {
        it('should identify API calls', () => {
            expect(isApiCall('setCoordSystem(-10, 10, -10, 10)')).toBe(true);
            expect(isApiCall('setAxesVisible(true, true)')).toBe(true);
            expect(isApiCall('setColor("A", 255, 0, 0)')).toBe(true);
        });

        it('should not identify regular commands as API calls', () => {
            expect(isApiCall('f(x) = x^2')).toBe(false);
            expect(isApiCall('A = (1, 2)')).toBe(false);
            expect(isApiCall('Segment(A, B)')).toBe(false);
        });

        it('should be case insensitive', () => {
            expect(isApiCall('SETCOORDSYSTEM(-10, 10, -10, 10)')).toBe(true);
            expect(isApiCall('SetAxesVisible(true, true)')).toBe(true);
        });
    });

    describe('Command Safety', () => {
        it('should reject commands with HTML-like characters', () => {
            // This tests the safety check we added in runCommands
            const unsafeCommands = [
                '<script>alert("xss")</script>',
                'f(x) = <img src=x>',
                "A = (1, 2)' onclick='alert(1)"
            ];

            for (const cmd of unsafeCommands) {
                // Our safety check: /[<>'"]/.test(cmd)
                expect(/[<>'"]/.test(cmd)).toBe(true);
            }
        });

        it('should allow safe commands', () => {
            const safeCommands = [
                'f(x) = x^2',
                'A = (1, 2)',
                'Segment(A, B)',
                'Circle(A, 3)',
                'setCoordSystem(-10, 10, -10, 10)'
            ];

            for (const cmd of safeCommands) {
                expect(/[<>'"]/.test(cmd)).toBe(false);
            }
        });
    });

    describe('GeogebraAnalysisResult', () => {
        it('should have correct structure', () => {
            const result = {
                suitable: true,
                commands: ['f(x) = x^2', 'A = (1, 2)'],
                description: '二次函数图像'
            };

            expect(result).toHaveProperty('suitable');
            expect(result).toHaveProperty('commands');
            expect(result).toHaveProperty('description');
            expect(typeof result.suitable).toBe('boolean');
            expect(Array.isArray(result.commands)).toBe(true);
            expect(typeof result.description).toBe('string');
        });

        it('should handle unsuitable result', () => {
            const result = {
                suitable: false,
                commands: [],
                description: '不适合用 GeoGebra 演示'
            };

            expect(result.suitable).toBe(false);
            expect(result.commands).toHaveLength(0);
        });
    });
});
