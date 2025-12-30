
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const books = await prisma.wordBook.findMany({
        include: {
            _count: {
                select: { words: true }
            }
        }
    });

    console.log('WordBooks verification:');
    books.forEach(book => {
        console.log(`- ID: ${book.id}, Name: "${book.name}", Words Confirmed: ${book._count.words}`);
    });

    const orphans = await prisma.word.count({
        where: { wordBookId: null }
    });
    console.log(`Orphan words count: ${orphans} (Should be 0)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
