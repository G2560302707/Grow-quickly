
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { internalError, unauthorized, forbidden } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:admin:system-reset');

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    // Strictly enforce Admin role
    if ((session.user as any).role !== 'admin') {
        return forbidden("Admin access required for system reset");
    }
    // but typically this should be restricted.
    // The user said "include user data", but wiping SELF is tricky.
    // Let's implement safer "Factory Reset" logic:
    // 1. Delete all ErrorItems
    // 2. Delete all PracticeRecords
    // 3. Delete all Subjects (Notebooks) - optional, but user said "clean all data"
    // 4. Delete all Custom KnowledgeTags (isSystem = false)
    // 5. Delete all AI Usage Logs (if any)

    // We do NOT delete the current user, so they can still log in.
    // If "include user data" means other users, we could delete them too, 
    // but that invalidates their sessions immediately. 
    // Let's assume for a single-user or small-team app, 'user data' means 'data belonging to users'.

    try {
        logger.info({ email: session.user.email }, 'System reset initiated');

        await prisma.$transaction(async (tx) => {
            // 1. Delete Practice Records (dependent on nothing usually, or User/ErrorItem)
            await tx.practiceRecord.deleteMany({});

            // 2. Delete Error Items (cascade deletes tags? No, m-to-n. But we want to wipe items)
            await tx.errorItem.deleteMany({});

            // 3. Delete Subjects (Notebooks)
            // Default subjects? Maybe keep them? User said "standard tags set to default".
            // Usually subjects like 'Math' are created by users or system default?
            // If we delete all subjects, the app might break if it expects at least one.
            // The app creates default notebook on fetch if missing. So safe to delete.
            await tx.subject.deleteMany({});

            // 4. Delete Custom Tags (keep system tags)
            await tx.knowledgeTag.deleteMany({
                where: {
                    isSystem: false,
                }
            });

            // 5. Delete other users? 
            // "All data, including user data". 
            // If I delete other users, I am truly resetting the system.
            // Let's protect the CURRENT user.
            if (session.user?.email) {
                await tx.user.deleteMany({
                    where: {
                        email: {
                            not: session.user.email
                        }
                    }
                });
            }
        });

        logger.info('System reset completed successfully');
        return NextResponse.json({ success: true, message: "System reset complete" });
    } catch (error) {
        logger.error({ error }, 'System reset error');
        return internalError("Failed to reset system");
    }
}
