
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const wordBookId = 1; // Assuming default book, check all just in case

    console.log("Searching for 'learn'...");
    const learnWords = await prisma.word.findMany({
        where: { spelling: 'learn' },
        select: { id: true, spelling: true, orderIndex: true, wordBookId: true }
    });
    console.table(learnWords);

    console.log("Searching for 'live'...");
    const liveWords = await prisma.word.findMany({
        where: { spelling: 'live' },
        select: { id: true, spelling: true, orderIndex: true, wordBookId: true }
    });
    console.table(liveWords);

    if (learnWords.length > 0 && liveWords.length > 0) {
        // Assume simplified case: User uses first match or active book
        // Let's check the count between them for the same book
        const bookIds = new Set([...learnWords.map(w => w.wordBookId), ...liveWords.map(w => w.wordBookId)]);

        for (const bid of bookIds) {
            const start = learnWords.find(w => w.wordBookId === bid);
            const end = liveWords.find(w => w.wordBookId === bid);

            if (start && end) {
                const count = await prisma.word.count({
                    where: {
                        wordBookId: bid,
                        orderIndex: {
                            gte: start.orderIndex,
                            lte: end.orderIndex
                        }
                    }
                });
                console.log(`Book ${bid}: 'learn' (${start.orderIndex}) -> 'live' (${end.orderIndex}) = ${count} words`);

                // Sample some words in between to see what's there
                if (count > 20) {
                    const sample = await prisma.word.findMany({
                        where: {
                            wordBookId: bid,
                            orderIndex: {
                                gte: start.orderIndex,
                                lte: end.orderIndex
                            }
                        },
                        take: 10,
                        select: { spelling: true, orderIndex: true }
                    });
                    console.log("Sample words in between:", sample);
                }
            } else {
                console.log(`Book ${bid}: Incomplete pair`);
            }
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
