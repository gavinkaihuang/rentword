
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const userId = 1; // Assuming admin
    let activeWordBookId = 1; // Simulate default '1' which is invalid now

    // Simulate API Fallback Logic
    if (activeWordBookId <= 1) {
        console.log("Simulating API Fallback...");
        const firstBook = await prisma.wordBook.findFirst({ orderBy: { id: 'asc' } });
        if (firstBook) {
            console.log(`Fallback found book: ${firstBook.name} (${firstBook.id})`);
            activeWordBookId = firstBook.id;
        }
    }
    const limit = 10;
    const now = new Date();

    console.log(`Debug SM-2 Batch for User ${userId}, Book ${activeWordBookId}`);

    // 1. Check if Book exists
    const book = await prisma.wordBook.findUnique({ where: { id: activeWordBookId } });
    console.log('Book:', book);

    // 2. Check total words in book
    const totalWords = await prisma.word.count({ where: { wordBookId: activeWordBookId } });
    console.log('Total Words in Book:', totalWords);

    // 3. Check Due Progress
    const dueProgress = await prisma.userProgress.findMany({
        where: {
            userId: userId,
            word: { wordBookId: activeWordBookId },
            nextReviewDate: { lte: now }
        }
    });
    console.log('Due Progress Count:', dueProgress.length);

    // 4. Check New Words Query
    const newWords = await prisma.word.findMany({
        where: {
            wordBookId: activeWordBookId,
            userProgress: {
                none: { userId: userId }
            }
        },
        take: limit,
        orderBy: { orderIndex: 'asc' }
    });
    console.log('New Words Found:', newWords.length);
    if (newWords.length > 0) {
        console.log('First New Word:', newWords[0].spelling);
    }

    // 5. Check if ANY user progress exists for this user/book (to see if "none" query is working)
    const anyProgress = await prisma.userProgress.count({
        where: { userId: userId, word: { wordBookId: activeWordBookId } }
    });
    console.log('Total Progress Records for User in Book:', anyProgress);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
