
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const wordBookName = 'GPT-8000 Words';
    console.log(`Looking for wordbook: "${wordBookName}"...`);

    // 1. Get WordBook
    const wordBook = await prisma.wordBook.findFirst({
        where: { name: wordBookName }
    });

    if (!wordBook) {
        console.error(`WordBook "${wordBookName}" not found.`);
        return;
    }

    console.log(`Found wordbook ID: ${wordBook.id}. Fetching words...`);

    // 2. GetAll words in this book
    const words = await prisma.word.findMany({
        where: { wordBookId: wordBook.id },
        select: { id: true, spelling: true },
        orderBy: { id: 'asc' } // Keep the oldest ID
    });

    console.log(`Total words in book: ${words.length}`);

    // 3. Find duplicates
    const seen = new Set<string>();
    const duplicates: number[] = [];
    const uniqueCount = 0;

    for (const word of words) {
        // Normalize? Let's check exact match first. 
        // If user wants case-insensitive, we can use word.spelling.toLowerCase()
        // Assuming strict for now as some words might be acronyms vs normal words.
        if (seen.has(word.spelling)) {
            duplicates.push(word.id);
        } else {
            seen.add(word.spelling);
        }
    }

    console.log(`Found ${duplicates.length} duplicate entries to delete.`);

    if (duplicates.length === 0) {
        console.log('No duplicates found.');
        return;
    }

    // 4. Delete duplicates
    // Delete in batches if too many? SQLite limitation? 
    // Prisma deleteMany with `in` should handle reasonable sizes, but let's batch just in case.
    const batchSize = 1000;
    let deletedCount = 0;

    for (let i = 0; i < duplicates.length; i += batchSize) {
        const batch = duplicates.slice(i, i + batchSize);
        const result = await prisma.word.deleteMany({
            where: {
                id: { in: batch }
            }
        });
        deletedCount += result.count;
        console.log(`Deleted batch ${i / batchSize + 1}: ${result.count} words.`);
    }

    console.log(`Orphan cleanup finished. Removed ${deletedCount} duplicates.`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
