import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUser() {
    const email = "admin@localhost";
    console.log(`Updating user ${email}...`);

    // Set to Junior High (初中) and enrolled in 2024 (so Grade 7 in 2025)
    // Assuming current date is late 2025 or early 2025?
    // If today is Dec 2025, Grade 7 started in Sept 2025 -> Enrollment 2025.
    // If today is Dec 2025, and they are Grade 7...
    // Wait, let's check calculateGrade logic.

    // calculateGrade(stage, enrollmentYear)
    // const currentYear = new Date().getFullYear();
    // const currentMonth = new Date().getMonth() + 1;
    // let grade = currentYear - enrollmentYear + (currentMonth >= 9 ? 1 : 0);

    // If today is Dec 2025.
    // If Enrollment = 2025.
    // Grade = 2025 - 2025 + 1 = 1 (Grade 7).

    // If Enrollment = 2024.
    // Grade = 2025 - 2024 + 1 = 2 (Grade 8).

    // I'll set it to 2025 for Grade 7.

    await prisma.user.update({
        where: { email },
        data: {
            educationStage: "Junior High",
            enrollmentYear: 2025
        }
    });

    console.log("User updated.");
    await prisma.$disconnect();
}

updateUser();
