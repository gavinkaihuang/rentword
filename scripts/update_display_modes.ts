
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating WordBook display modes...');

    // 1. High School Words -> Mode 1
    const highSchool = await prisma.wordBook.findFirst({
        where: { name: 'High School Words' }
    });
    if (highSchool) {
        await prisma.wordBook.update({
            where: { id: highSchool.id },
            data: { displayMode: 1 }
        });
        console.log('Set "High School Words" to Mode 1 (Standard).');
    } else {
        console.log('"High School Words" not found.');
    }

    // 2. GPT-8000 Words -> Mode 2
    const gpt8000 = await prisma.wordBook.findFirst({
        where: { name: 'GPT-8000 Words' }
    });
    if (gpt8000) {
        await prisma.wordBook.update({
            where: { id: gpt8000.id },
            data: { displayMode: 2 }
        });
        console.log('Set "GPT-8000 Words" to Mode 2 (Enhanced).');
    } else {
        console.log('"GPT-8000 Words" not found.');
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
