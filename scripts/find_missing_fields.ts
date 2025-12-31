
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Finding words with missing fields...');

    // Find WordBook
    const wordBook = await prisma.wordBook.findFirst({ where: { name: 'GPT-8000 Words' } });
    if (!wordBook) return;

    const missingWords = await prisma.word.findMany({
        where: {
            wordBookId: wordBook.id,
            OR: [
                { content: null },
                { example: null }
            ]
        },
        select: {
            spelling: true,
            content: true,
            example: true
        }
    });

    console.log(`Found ${missingWords.length} words with missing content or example.`);

    // Print first 20 for analysis
    for (const w of missingWords.slice(0, 20)) {
        console.log(`- ${w.spelling}: Content=${w.content ? 'OK' : 'NULL'}, Example=${w.example ? 'OK' : 'NULL'}`);
    }

    // Also print a list of just spelling for easy grep later
    console.log('--- Spelling List (First 50) ---');
    console.log(missingWords.slice(0, 50).map(w => w.spelling).join(' '));
}

main().finally(() => prisma.$disconnect());
