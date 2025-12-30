
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const words = await prisma.word.findMany({
        where: { wordBookId: 3 },
        take: 5,
    });

    console.log('--- GPT-8000 Word Meanings Sample ---');
    words.forEach(w => {
        console.log(`Spelling: ${w.spelling}`);
        console.log(`Meaning:  ${w.meaning}`);
        console.log('---');
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
