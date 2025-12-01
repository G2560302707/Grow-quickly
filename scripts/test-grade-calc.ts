/**
 * 年级计算功能测试脚本
 * 
 * 功能：
 * 1. 测试 calculateGrade 函数的各种场景
 * 2. 验证不同教育阶段(小学、初中)的年级计算
 * 3. 验证不同时间点的学期计算
 * 4. 输出测试结果统计
 * 
 * 用途：用于确保年级和学期计算逻辑的正确性
 */
import { calculateGrade } from "../src/lib/grade-calculator";

const testCases = [
    {
        stage: "junior_high",
        enrolled: 2024,
        date: new Date("2024-09-01"),
        expected: "Junior High Grade 1, 1st Semester"
    },
    {
        stage: "junior_high",
        enrolled: 2024,
        date: new Date("2025-01-15"),
        expected: "Junior High Grade 1, 1st Semester"
    },
    {
        stage: "junior_high",
        enrolled: 2024,
        date: new Date("2025-03-01"),
        expected: "Junior High Grade 1, 2nd Semester"
    },
    {
        stage: "junior_high",
        enrolled: 2024,
        date: new Date("2025-09-01"),
        expected: "Junior High Grade 2, 1st Semester"
    },
    {
        stage: "primary",
        enrolled: 2020,
        date: new Date("2025-11-30"),
        // 2025 - 2020 = 5. Month 11 >= 9. Grade 5+1 = 6.
        expected: "Primary School Grade 6, 1st Semester"
    }
];

console.log("Running Grade Calculation Tests...");
let passed = 0;
testCases.forEach((tc, i) => {
    const result = calculateGrade(tc.stage, tc.enrolled, tc.date);
    if (result === tc.expected) {
        console.log(`Test Case ${i + 1}: PASS`);
        passed++;
    } else {
        console.error(`Test Case ${i + 1}: FAIL`);
        console.error(`  Expected: ${tc.expected}`);
        console.error(`  Got:      ${result}`);
    }
});

console.log(`\nPassed ${passed}/${testCases.length} tests.`);
if (passed === testCases.length) {
    process.exit(0);
} else {
    process.exit(1);
}
