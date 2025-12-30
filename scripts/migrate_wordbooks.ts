
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting WordBook migration...');

    // 1. Create or ensure "High School Words" exists
    const highSchoolBook = await prisma.wordBook.upsert({
        where: { id: 1 }, // Assuming we want ID 1 for this, but 'where' needs unique field. 
        // Usually name isn't unique in schema yet, but let's check schema again. 
        // Schema was: model WordBook { id Int @id, name String ... }
        // 'name' is NOT unique. We should probably findFirst by name.
        update: {},
        create: {
            name: 'High School Words',
        },
    });

    // Correction: access by findFirst if name is not unique.
    // However, for purpose of migration, let's just create if not exists.
}

// Rewriting logical main due to schema constraint awareness
async function run() {
    try {
        // 1. High School Words
        let highSchoolBook = await prisma.wordBook.findFirst({
            where: { name: 'High School Words' }
        });

        if (!highSchoolBook) {
            console.log('Creating "High School Words" book...');
            highSchoolBook = await prisma.wordBook.create({
                data: { name: 'High School Words' }
            });
        } else {
            console.log('"High School Words" book already exists.');
        }

        // 2. GTP8000 Words
        let gtpBook = await prisma.wordBook.findFirst({
            where: { name: 'GTP8000 Words' }
        });

        if (!gtpBook) {
            console.log('Creating "GTP8000 Words" book...');
            gtpBook = await prisma.wordBook.create({
                data: { name: 'GTP8000 Words' }
            });
        } else {
            console.log('"GTP8000 Words" book already exists.');
        }

        // 3. Migrate words
        console.log('Migrating orphan words to "High School Words"...');
        const result = await prisma.word.updateMany({
            where: {
                wordBookId: null
            },
            data: {
                wordBookId: highSchoolBook.id
            }
        });

        console.log(`Migrated ${result.count} words.`);

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

run();
