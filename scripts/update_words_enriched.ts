
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join(process.cwd(), 'docs', 'high_school_words_enriched.json');
    console.log(`Reading file from ${filePath}...`);

    if (!fs.existsSync(filePath)) {
        console.error('File not found!');
        process.exit(1);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const words = JSON.parse(rawData);

    console.log(`Found ${words.length} words in JSON. Starting update...`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const item of words) {
        try {
            // Strategy: Try to find by ID first.
            let word = await prisma.word.findUnique({
                where: { id: item.id }
            });

            // If not found by ID, try finding by spelling
            if (!word) {
                // Note: Spelling is not unique index in schema, so findFirst
                word = await prisma.word.findFirst({
                    where: { spelling: item.spelling }
                });
            }

            if (!word) {
                console.warn(`Word not found in DB: ${item.spelling} (ID: ${item.id})`);
                notFoundCount++;
                continue;
            }

            // Prepare update data
            const updateData: any = {
                // Core fields - update if present and different? 
                // User said "update the added content". 
                // We will overwrite these fields to match the enriched JSON.
                meaning: item.meaning,
                phonetic: item.phonetic,
                grammar: item.grammar,
                example: item.example,
                // content: item.content, // Provide content if null in DB? JSON has null content in sample. 
                // If JSON content is null, don't overwrite non-null DB content?
                // Sample JSON content is null. Word model content is Rich Text.
                // I'll skip content if it's null in JSON.

                // New/Enriched fields
                roots: item.roots ? JSON.stringify(item.roots) : null,
                affixes: item.affixes, // JSON 'affixes' is null in sample, but if present update.
                history: item.history,
                variations: item.variations,
                mnemonic: item.mnemonic,
                story: item.story,

                antonym: item.antonym,
                clusterTag: item.clusterTag,
                synonymGroup: item.synonymGroup,
                usageDomain: item.usageDomain,

                // Newly added field
                confusables: item.confusables ? JSON.stringify(item.confusables) : null,

                // orderIndex: item.orderIndex // Do update order? Maybe.
            };

            // Only update content if JSON has it
            if (item.content !== null) {
                updateData.content = item.content;
            }

            await prisma.word.update({
                where: { id: word.id },
                data: updateData
            });

            updatedCount++;

            if (updatedCount % 100 === 0) {
                console.log(`Updated ${updatedCount} words...`);
            }

        } catch (error) {
            console.error(`Error updating word ${item.spelling}:`, error);
            errorCount++;
        }
    }

    console.log('------------------------------------------------');
    console.log(`Update Complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Not Found: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
