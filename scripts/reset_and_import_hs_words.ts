
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Resetting Database for High School Words ---');

    console.log('Deleting existing data...');
    // Delete in order to avoid foreign key constraints
    await prisma.reviewLog.deleteMany({});
    await prisma.userProgress.deleteMany({});
    await prisma.word.deleteMany({});
    await prisma.wordBook.deleteMany({});

    // Note: Not deleting Users or Tasks for now unless requested, 
    // but WordBook deletion might cascade if not careful. 
    // Schema says WordBook has words. Words have progress. 
    // We deleted dependent data first.

    console.log('Creating "High School Words" book...');
    const wordBook = await prisma.wordBook.create({
        data: {
            name: 'High School Words',
            displayMode: 2 // Rich mode
        }
    });

    const filePath = path.join(process.cwd(), 'docs', 'high_school_words_enriched.json');
    console.log(`Reading ${filePath}...`);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const words = JSON.parse(rawData);

    console.log(`Found ${words.length} words to import.`);

    const wordsToInsert = words.map((item: any) => ({
        id: item.id, // Preserve ID from JSON
        spelling: item.spelling,
        meaning: item.meaning,
        phonetic: item.phonetic || '',
        grammar: item.grammar || null,
        example: item.example || null,
        content: item.content || null,

        roots: item.roots ? JSON.stringify(item.roots) : null,
        affixes: item.affixes ? JSON.stringify(item.affixes) : null, // Ensure string if object
        history: item.history || null,
        variations: item.variations || null,
        mnemonic: item.mnemonic || null,
        story: item.story || null,

        antonym: item.antonym || null,
        clusterTag: item.clusterTag || null,
        synonymGroup: item.synonymGroup || null,
        usageDomain: item.usageDomain || null,
        confusables: item.confusables ? JSON.stringify(item.confusables) : null,

        orderIndex: item.orderIndex || 0,
        wordBookId: wordBook.id
    }));

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < wordsToInsert.length; i += batchSize) {
        const batch = wordsToInsert.slice(i, i + batchSize);
        await prisma.word.createMany({
            data: batch
        });
        process.stdout.write(`\rImported ${Math.min(i + batchSize, wordsToInsert.length)} / ${wordsToInsert.length}`);
    }

    console.log('\nImport Complete!');
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
