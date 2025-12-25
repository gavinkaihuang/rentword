
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const word = await prisma.word.findFirst({
        where: { spelling: 'abandon' }
    });

    if (!word) {
        console.log('Word "abandon" not found.');
        return;
    }

    console.log('Word found:', word);
    if (word.grammar && word.example) {
        console.log('Verification SUCCESS: Grammar and Example are present.');
    } else {
        console.log('Verification FAILED: Grammar or Example missing.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
