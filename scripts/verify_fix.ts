
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const wordBookId = 1;

    console.log("Simulating Sequential Learning: 'learn' -> 'live'");
    const startSpelling = 'learn';
    const endSpelling = 'live';

    // 1. Simulate Validate Logic (Count)
    console.log("--- Validate Logic ---");
    const count = await prisma.word.count({
        where: {
            wordBookId: wordBookId,
            spelling: {
                gte: startSpelling,
                lte: endSpelling
            }
        }
    });
    console.log(`Count between '${startSpelling}' and '${endSpelling}': ${count}`);

    // 2. Simulate Task Creation Logic (Fetch Words)
    console.log("--- Task Creation Logic ---");
    const words = await prisma.word.findMany({
        where: {
            wordBookId: wordBookId,
            spelling: {
                gte: startSpelling,
                lte: endSpelling
            }
        },
        orderBy: { spelling: 'asc' },
        take: 20 // Simulate limit
    });

    console.log(`Fetched ${words.length} words.`);
    if (words.length > 0) {
        console.log("First word:", words[0].spelling);
        console.log("Last word:", words[words.length - 1].spelling);
        console.log("Sample:", words.map(w => w.spelling).join(', '));
    }

    if (count > 3000) {
        console.error("FAIL: Count is still too high!");
    } else {
        console.log("SUCCESS: Count looks reasonable for alphabetical range.");
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
