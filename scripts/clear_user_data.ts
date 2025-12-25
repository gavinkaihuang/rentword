
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting to clear user data...');

    try {
        // 1. Clear Review Logs (History of answers)
        const deletedReviews = await prisma.reviewLog.deleteMany({});
        console.log(`Deleted ${deletedReviews.count} review logs.`);

        // 2. Clear User Progress (Mastery status)
        const deletedProgress = await prisma.userProgress.deleteMany({});
        console.log(`Deleted ${deletedProgress.count} progress records.`);

        // 3. Clear Study Sessions (Time tracking)
        const deletedSessions = await prisma.studySession.deleteMany({});
        console.log(`Deleted ${deletedSessions.count} study sessions.`);

        // 4. Clear Tasks (Active/Completed learning batches)
        const deletedTasks = await prisma.task.deleteMany({});
        console.log(`Deleted ${deletedTasks.count} tasks.`);

        console.log('✅ User usage data cleared successfully.');

    } catch (error) {
        console.error('❌ Error clearing data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
