
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const matchingWords = await prisma.word.findMany({
        where: { id: 7 },
        include: {
            userProgress: true,
            reviewLogs: true
        }
    });

    console.log(`Found ${matchingWords.length} words containing 'bout':`);
    matchingWords.forEach(w => {
        console.log(`ID: ${w.id}, Spelling: "${w.spelling}"`);
        console.log(` - Progress:`, JSON.stringify(w.userProgress, null, 2));
    });

    // Check recent logs
    const logs = await prisma.reviewLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { word: true }
    });
    console.log('\nRecent 10 logs:');
    logs.forEach(l => {
        console.log(`Log ID: ${l.id}, Word: "${l.word.spelling}" (ID: ${l.wordId}), User: ${l.userId}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
