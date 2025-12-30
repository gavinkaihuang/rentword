
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Find the target WordBook
    // We know it's "GPT-8000 Words", usually ID 3, but let's find by name to be safe
    const book = await prisma.wordBook.findFirst({
        where: { name: 'GPT-8000 Words' }
    });

    if (!book) {
        console.error("WordBook 'GPT-8000 Words' not found.");
        return;
    }

    const wordBookId = book.id;
    console.log(`Processing WordBook: ${book.name} (ID: ${wordBookId})`);

    // 2. Fetch all words in this book
    const words = await prisma.word.findMany({
        where: { wordBookId },
        select: { id: true, spelling: true }
    });

    console.log(`Total words in book: ${words.length}`);

    // 3. Find duplicates
    const spellingMap = new Map<string, number[]>();

    for (const w of words) {
        // Normalize? Usually exact match is desired, but let's do trim() just in case
        const spelling = w.spelling.trim();

        if (!spellingMap.has(spelling)) {
            spellingMap.set(spelling, []);
        }
        spellingMap.get(spelling)?.push(w.id);
    }

    let duplicatesFound = 0;
    let deletedCount = 0;
    const idsToDelete: number[] = [];

    for (const [spelling, ids] of spellingMap.entries()) {
        if (ids.length > 1) {
            duplicatesFound++;
            // Sort IDs to keep the first one (lowest ID usually)
            ids.sort((a, b) => a - b);

            // Keep ids[0], delete the rest
            const toDelete = ids.slice(1);
            idsToDelete.push(...toDelete);

            // console.log(`Duplicate found: "${spelling}" -> Keeping ID ${ids[0]}, Deleting IDs ${toDelete.join(', ')}`);
        }
    }

    console.log(`Found ${duplicatesFound} words with duplicates.`);
    console.log(`Total records to delete: ${idsToDelete.length}`);

    if (idsToDelete.length > 0) {
        // Batch delete
        // SQLite limit regarding host parameters? Prisma handles batching usually.
        // But for safety let's chunk it.
        const BATCH_SIZE = 500;
        for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
            const batch = idsToDelete.slice(i, i + BATCH_SIZE);
            await prisma.word.deleteMany({
                where: { id: { in: batch } }
            });
            deletedCount += batch.length;
            console.log(`Deleted batch ${i / BATCH_SIZE + 1}...`);
        }
    }

    console.log(`Cleanup complete. Deleted ${deletedCount} duplicate records.`);

    // Verify final count
    const finalCount = await prisma.word.count({ where: { wordBookId } });
    console.log(`Final word count: ${finalCount}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
