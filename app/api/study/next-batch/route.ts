
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Default user ID for now, should be from session
    const userId = 1;

    const cookieStore = await cookies();
    let activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '0');

    // Fallback: If no cookie or ID is 0/1 (potentially invalid if books rebuilt), find first available
    if (activeWordBookId <= 1) {
        const firstBook = await prisma.wordBook.findFirst({ orderBy: { id: 'asc' } });
        if (firstBook) activeWordBookId = firstBook.id;
    }

    try {
        const now = new Date();

        // 1. Fetch Due Reviews
        // Words that have progress and nextReviewDate <= now
        const dueProgress = await prisma.userProgress.findMany({
            where: {
                userId: userId,
                word: { wordBookId: activeWordBookId },
                nextReviewDate: { lte: now }
            },
            take: limit,
            include: { word: true },
            orderBy: { nextReviewDate: 'asc' }
        });

        const dueWords = dueProgress.map(p => ({
            ...formatWordForTask(p.word),
            _progress: {
                interval: p.interval,
                easinessFactor: p.easinessFactor,
                nextReviewDate: p.nextReviewDate
            },
            _isNew: false
        }));

        // 2. Fetch New Words if limit not reached
        let newWords: any[] = [];
        if (dueWords.length < limit) {
            const needed = limit - dueWords.length;

            // Find words without progress for this user in this book
            // This can be heavy if many words. 
            // Better strategy: Find words where ID is NOT in userProgress.wordId
            // Or just use `where: { userProgress: { none: { userId } } }`

            const fetchedNewWords = await prisma.word.findMany({
                where: {
                    wordBookId: activeWordBookId,
                    userProgress: {
                        none: { userId: userId }
                    }
                },
                take: needed,
                orderBy: { orderIndex: 'asc' }
            });

            newWords = fetchedNewWords.map(w => ({
                ...formatWordForTask(w),
                _isNew: true
            }));
        }

        // Combine
        const queue = [...dueWords, ...newWords];

        return NextResponse.json({
            queue,
            stats: {
                dueCount: await prisma.userProgress.count({
                    where: { userId, word: { wordBookId: activeWordBookId }, nextReviewDate: { lte: now } }
                }),
                newCount: newWords.length // Approximation or fetch actual count if needed
            }
        });

    } catch (error) {
        console.error('Error fetching study batch:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
