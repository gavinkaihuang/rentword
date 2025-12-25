import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    const filePath = path.join(process.cwd(), 'words.csv');
    console.log(`Reading file from ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error('File not found!');
        process.exit(1);
    }

    // Read file
    // Using readFile to get buffer, then parsing
    const workbook = XLSX.readFile(filePath, { codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Parse as array of arrays, no header assumption (header: 1)
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Found ${data.length} rows.`);

    // Transform to objects
    const words = data.map((row, index) => {
        // Row should be [spelling, meaning]
        // Filter out empty rows or bad data
        if (!row || row.length < 2) return null;

        // Clean data
        const spelling = String(row[0]).trim();
        const meaning = String(row[1]).trim();

        if (!spelling || !meaning) return null;

        return {
            spelling,
            meaning,
            orderIndex: index + 1
        };
    }).filter((w): w is NonNullable<typeof w> => w !== null);

    console.log(`Parsed ${words.length} valid words.`);

    if (words.length === 0) {
        console.log("No words to insert.");
        return;
    }

    // Clear existing
    console.log('Clearing existing words...');
    await prisma.word.deleteMany({});

    // Reset sequence if possible (sqlite relies on sqlite_sequence)
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name='Word';`);
    } catch (e) { console.log('Sequence reset skipped or failed', e); }

    console.log('Inserting words...');

    // Batch insert? createMany is supported in SQLite with Prisma
    // But let's do chunks just in case of limits
    const BATCH_SIZE = 500;
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
        const batch = words.slice(i, i + BATCH_SIZE);
        await prisma.word.createMany({
            data: batch
        });
        console.log(`Inserted ${i + batch.length} / ${words.length}`);
    }

    console.log('Done!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
