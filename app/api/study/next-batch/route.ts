
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';
import { getActiveWordBookId } from '@/lib/active-wordbook';

type ProgressCompat = {
    word: unknown;
    nextReviewDate: Date | null;
    interval?: number;
    easinessFactor?: number;
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const userIdHeader = request.headers.get('x-user-id');
    if (!userIdHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = parseInt(userIdHeader);
    if (Number.isNaN(userId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const activeWordBookId = await getActiveWordBookId(cookieStore);

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

        const dueWords = dueProgress.map(p => {
            // Keep compatibility with environments where Prisma Client types
            // don't yet include SM-2 fields.
            const progress = p as unknown as ProgressCompat;

            return {
                ...formatWordForTask(progress.word),
                _progress: {
                    interval: typeof progress.interval === 'number' ? progress.interval : 0,
                    easinessFactor: typeof progress.easinessFactor === 'number' ? progress.easinessFactor : 2.5,
                    nextReviewDate: progress.nextReviewDate
                },
                _isNew: false
            };
        });

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
