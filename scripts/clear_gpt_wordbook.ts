
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Finding "GPT-8000 Words" wordbook...');
    const wordBook = await prisma.wordBook.findFirst({
        where: { name: 'GPT-8000 Words' }
    });

    if (!wordBook) {
        console.log('Wordbook not found.');
        return;
    }

    console.log(`Clearing words from wordbook: ${wordBook.name} (ID: ${wordBook.id})...`);

    const result = await prisma.word.deleteMany({
        where: { wordBookId: wordBook.id }
    });

    console.log(`Deleted ${result.count} words.`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
