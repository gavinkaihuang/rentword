import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    // Default to looking for 'processed_words.xlsx' or 'processed_words.csv' or argument
    const args = process.argv.slice(2);
    let filePath = args[0];

    if (!filePath) {
        // Try default locations
        const candidates = ['processed_words.xlsx', 'processed_words.csv', 'words_new.xlsx', 'words_new.csv'];
        for (const c of candidates) {
            const p = path.join(process.cwd(), c);
            if (fs.existsSync(p)) {
                filePath = p;
                break;
            }
        }
    }

    if (!filePath || !fs.existsSync(filePath)) {
        console.error('Please provide a file path as an argument, or place processed_words.xlsx/csv in the root.');
        process.exit(1);
    }

    console.log(`Reading file from ${filePath}`);

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Parse with headers because we expect new columns
    // Expect headers: spelling (or word), meaning, phonetic, grammar, example
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} rows.`);

    if (data.length === 0) {
        console.log("No data found.");
        return;
    }

    // Normalize keys to lowercase for easier matching
    const normalizedData = data.map(row => {
        const newRow: any = {};
        for (const key in row) {
            newRow[key.toLowerCase().trim()] = row[key];
        }
        return newRow;
    });

    // Check for required fields
    const firstRow = normalizedData[0];
    console.log('Detected headers:', Object.keys(firstRow));

    // Clear existing? Or Upsert?
    // User said "Update my word database", usually implies replacing or updating.
    // Given the previous script cleared everything, maybe we should clear too?
    // But let's ask or just update. For safety, let's clear if it's a "full update".
    // But user might want to keep progress?
    // The previous script `restore_words` deletes all.
    // Let's assume a full replace is acceptable if they are providing a full list, but preserving IDs would be nice if we could.
    // However, SQLite IDs are auto-increment.
    // If we delete all, UserProgress might be lost if it references Word ID.
    // Wait, `UserProgress` references `Word` by `wordId`.
    // If we delete words, we break or delete progress (cascade?).
    // Schema doesn't specify cascade delete on UserProgress relation.
    // Let's check relation in schema again.
    // `userProgress UserProgress[]` in Word.
    // `word Word @relation(fields: [wordId], references: [id])` in UserProgress.
    // If we delete Words, it might fail or orphan UserProgress.
    // Better strategy: UPSERT by spelling.

    console.log('Starting import (Upsert by spelling)...');

    let updatedCount = 0;
    let createdCount = 0;

    for (const row of normalizedData) {
        const spelling = row['word'] || row['spelling'] || row['单词'];
        const meaning = row['meaning'] || row['definition'] || row['释义'];
        const phonetic = row['phonetic'] || row['pronunciation'] || row['发音'] || row['音标'];
        const grammar = row['grammar'] || row['常用语法'] || row['语法'];
        const example = row['example'] || row['简单例句'] || row['例句'];

        if (!spelling || !meaning) {
            console.warn('Skipping row missing spelling or meaning:', row);
            continue;
        }

        const existing = await prisma.word.findFirst({
            where: { spelling: spelling }
        });

        if (existing) {
            await prisma.word.update({
                where: { id: existing.id },
                data: {
                    meaning,
                    phonetic,
                    grammar,
                    example
                }
            });
            updatedCount++;
        } else {
            // New word
            // We need an orderIndex. Let's append to the end.
            // Or just use a large number if we don't track max.
            // But let's try to be nice.
            // For now, let's just use 0 or existing logic?
            // Schema says orderIndex Int.
            await prisma.word.create({
                data: {
                    spelling,
                    meaning,
                    phonetic,
                    grammar,
                    example,
                    orderIndex: 0 // Placeholder, maybe we should fix this if order matters
                }
            });
            createdCount++;
        }

        if ((updatedCount + createdCount) % 100 === 0) {
            process.stdout.write(`\rProcessed ${updatedCount + createdCount} records...`);
        }
    }

    console.log(`\nImport complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Created: ${createdCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
