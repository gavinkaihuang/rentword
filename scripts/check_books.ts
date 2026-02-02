
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

    console.log('--- WordBooks ---');
    books.forEach(b => {
        console.log(`ID: ${b.id} | Name: ${b.name} | Count: ${b._count.words} | Mode: ${b.displayMode}`);
    });

    // Also check first few words to see their book ID
    const sampleWords = await prisma.word.findMany({ take: 5 });
    console.log('\n--- Sample Words ---');
    sampleWords.forEach(w => {
        console.log(`ID: ${w.id} | Spelling: ${w.spelling} | BookID: ${w.wordBookId}`);
    });
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
