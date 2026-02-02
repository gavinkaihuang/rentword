
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const bookName = 'High School Words';
    console.log(`--- Syncing "${bookName}" ---`);

    // 1. Ensure WordBook exists
    let wordBook = await prisma.wordBook.findFirst({
        where: { name: bookName }
    });

    if (!wordBook) {
        console.log(`WordBook "${bookName}" not found. Creating...`);
        wordBook = await prisma.wordBook.create({
            data: {
                name: bookName,
                displayMode: 2 // Rich Mode
            }
        });
    } else {
        console.log(`Found WordBook: ${wordBook.name} (ID: ${wordBook.id})`);
    }

    const bookId = wordBook.id;

    // 2. Read JSON
    const filePath = path.join(process.cwd(), 'docs', 'high_school_words_enriched.json');
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const wordsJson = JSON.parse(rawData);
    console.log(`Loaded ${wordsJson.length} words from JSON.`);

    let createdCount = 0;
    let updatedCount = 0;

    // 3. Sync Words
    // Optimization: Load all existing spellings for this book to minimize queries?
    // Or just iterate. With 4000 words, iteration is okay for a migration script.
    // Let's do iteration to be safe and simple.

    for (const [index, item] of wordsJson.entries()) {
        const spelling = item.spelling;

        // Find existing word in THIS book
        const existingWord = await prisma.word.findFirst({
            where: {
                wordBookId: bookId,
                spelling: spelling
            }
        });

        const wordData = {
            meaning: item.meaning,
            phonetic: item.phonetic || '',
            grammar: item.grammar || null,
            example: item.example || null,
            // Content: Update only if JSON has it, matching previous logic
            content: item.content || (existingWord ? undefined : null),

            roots: item.roots ? JSON.stringify(item.roots) : null,
            affixes: item.affixes ? JSON.stringify(item.affixes) : null,
            history: item.history || null,
            variations: item.variations || null,
            mnemonic: item.mnemonic || null,
            story: item.story || null,

            antonym: item.antonym || null,
            clusterTag: item.clusterTag || null,
            synonymGroup: item.synonymGroup || null,
            usageDomain: item.usageDomain || null,
            confusables: item.confusables ? JSON.stringify(item.confusables) : null,

            orderIndex: item.orderIndex !== undefined ? item.orderIndex : index
        };

        if (existingWord) {
            await prisma.word.update({
                where: { id: existingWord.id },
                data: wordData
            });
            updatedCount++;
        } else {
            await prisma.word.create({
                data: {
                    ...wordData,
                    spelling: spelling,
                    wordBookId: bookId
                }
            });
            createdCount++;
        }

        if ((index + 1) % 200 === 0) {
            process.stdout.write(`\rProcessed ${index + 1}/${wordsJson.length}...`);
        }
    }

    console.log(`\n\nSync Complete!`);
    console.log(`Created: ${createdCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Total active in book: ${updatedCount + createdCount}`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
