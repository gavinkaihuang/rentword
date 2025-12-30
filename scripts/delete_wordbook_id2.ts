
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const idToDelete = 2; // "GTP8000 Words" (0 words)

    const book = await prisma.wordBook.findUnique({
        where: { id: idToDelete },
        include: { _count: { select: { words: true } } }
    });

    if (!book) {
        console.log(`WordBook ID ${idToDelete} not found.`);
        return;
    }

    console.log(`Found WordBook: "${book.name}". Word count: ${book._count.words}`);

    if (book._count.words > 0) {
        console.error("ABORTING: WordBook is not empty!");
        return;
    }

    console.log("Deleting...");
    await prisma.wordBook.delete({
        where: { id: idToDelete }
    });
    console.log(`Successfully deleted WordBook ID ${idToDelete}.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
