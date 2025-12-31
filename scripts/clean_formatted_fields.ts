
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning formatting artifacts in GPT-8000 Words...');

    // Find WordBook
    const wordBook = await prisma.wordBook.findFirst({ where: { name: 'GPT-8000 Words' } });
    if (!wordBook) return;

    let skip = 0;
    const batchSize = 500;

    while (true) {
        const words = await prisma.word.findMany({
            where: { wordBookId: wordBook.id },
            take: batchSize,
            skip: skip,
            orderBy: { id: 'asc' }
        });

        if (words.length === 0) break;

        const updates: any[] = [];

        for (const word of words) {
            const clean = (text: string | null) => {
                if (!text) return null;
                // Remove leading **, :, ：, whitespace
                return text.replace(/^[\s\*：:]+/, '').trim();
            };

            const newData = {
                content: clean(word.content),
                example: clean(word.example),
                roots: clean(word.roots),
                affixes: clean(word.affixes),
                history: clean(word.history),
                variations: clean(word.variations),
                mnemonic: clean(word.mnemonic),
                story: clean(word.story),
                // Fix meaning too if it starts with garbage
                meaning: clean(word.meaning) || 'See details'
            };

            // Only update if changed (simplistic check)
            if (newData.content !== word.content ||
                newData.example !== word.example ||
                newData.meaning !== word.meaning) { // Check a few key ones
                updates.push(prisma.word.update({
                    where: { id: word.id },
                    data: newData
                }));
            }
        }

        if (updates.length > 0) {
            await prisma.$transaction(updates);
            console.log(`Cleaned batch starting at ${skip}, updated ${updates.length} words.`);
        } else {
            console.log(`Batch at ${skip} needed no changes.`);
        }

        skip += batchSize;
    }

    console.log('Cleaning complete.');
}

main().finally(() => prisma.$disconnect());
