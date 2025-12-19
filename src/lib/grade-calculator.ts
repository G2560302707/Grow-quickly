export function calculateGrade(
    educationStage: string,
    enrollmentYear: number,
    currentDate: Date = new Date(),
    language: 'zh' | 'en' = 'en'
): string {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12

    let gradeLevel = currentYear - enrollmentYear;
    let semesterKey = "2nd"; // 1st or 2nd

    if (currentMonth >= 9) {
        gradeLevel += 1;
        semesterKey = "1st";
    } else if (currentMonth < 2) {
        semesterKey = "1st";
    } else {
        semesterKey = "2nd";
    }

    const isZh = language === 'zh';

    const semesterName = isZh
        ? (semesterKey === "1st" ? "上期" : "下期")
        : (semesterKey === "1st" ? "1st Semester" : "2nd Semester");

    const stageMapZh: Record<string, string[]> = {
        primary: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"],
        junior_high: ["初一", "初二", "初三"],
        senior_high: ["高一", "高二", "高三"],
        university: ["大一", "大二", "大三", "大四"],
    };

    const stageMapEn: Record<string, string[]> = {
        primary: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"],
        junior_high: ["Grade 7", "Grade 8", "Grade 9"], // Or Junior High Grade 1... let's use Grade 7-9 for simplicity or keep previous logic
        senior_high: ["Grade 10", "Grade 11", "Grade 12"],
        university: ["Freshman", "Sophomore", "Junior", "Senior"],
    };

    // Override English mapping to match previous logic if preferred, or standard international
    // Previous logic was "Grade 1" for Junior High. Let's stick to that for consistency if user wants "Junior High Grade 1"
    // But "Grade 7" is more common internationally. 
    // However, user request specifically asked for "初一" (Junior High Grade 1).
    // Let's use the previous style for English but localized for Chinese.
    const stageMapEnLegacy: Record<string, string[]> = {
        primary: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"],
        junior_high: ["Junior High Grade 1", "Junior High Grade 2", "Junior High Grade 3"],
        senior_high: ["Senior High Grade 1", "Senior High Grade 2", "Senior High Grade 3"],
        university: ["Freshman", "Sophomore", "Junior", "Senior"],
    };

    const stageMap = isZh ? stageMapZh : stageMapEnLegacy;

    const grades = stageMap[educationStage] || [];

    // Handle out of bounds
    let gradeStr = `${gradeLevel}`;
    if (gradeLevel > 0 && gradeLevel <= grades.length) {
        gradeStr = grades[gradeLevel - 1];
    } else if (gradeLevel > grades.length) {
        gradeStr = isZh ? "已毕业" : "Graduated";
    } else {
        gradeStr = isZh ? "学前" : "Pre-school";
    }

    if (isZh) {
        // Match UI tag format: "高一上", "初一下" instead of "高一，上期"
        // Semester suffix: "上" or "下"
        const suffix = semesterKey === "1st" ? "上" : "下";
        return `${gradeStr}${suffix}`;
    } else {
        return `${gradeStr}, ${semesterName}`;
    }
}
