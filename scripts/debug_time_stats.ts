import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    const userId = users[0]?.id || 1;
    console.log(`Checking StudySession for User ID: ${userId}`);

    const totalSessions = await prisma.studySession.count({ where: { userId } });
    console.log(`Total sessions count: ${totalSessions}`);

    const lastSessions = await prisma.studySession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    console.log(`Last 10 sessions:`);
    lastSessions.forEach(s => {
        console.log(`[${s.id}] ${s.createdAt.toISOString()} - ${s.type}: ${s.duration}s`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
