
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    const userIdHeader = request.headers.get('x-user-id');
    if (!userIdHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = parseInt(userIdHeader);

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date'); // YYYY-MM-DD

    if (!dateStr) {
        return NextResponse.json({ error: 'Missing date' }, { status: 400 });
    }

    try {
        const startOfDay = new Date(dateStr);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(dateStr);
        endOfDay.setHours(23, 59, 59, 999);

        const logs = await prisma.reviewLog.findMany({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                userId // Filter by user
            },
            include: {
                word: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Group by word to show unique reviews + latest status
        // Or just list all events? "Recitation Calendar" usually means "What did I learn today?"
        // Listing unique words seems better.

        const uniqueWords = new Map();

        logs.forEach((log: any) => {
            if (!uniqueWords.has(log.wordId)) {
                uniqueWords.set(log.wordId, {
                    word: log.word,
                    attempts: 0,
                    correct: 0
                });
            }
            const entry = uniqueWords.get(log.wordId);
            entry.attempts += 1;
            if (log.isCorrect) entry.correct += 1;
        });

        // Fetch Time Stats for the day
        const daySessions = await prisma.studySession.findMany({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                userId // Filter by user
            }
        });

        const timeStats = {
            learnSeconds: 0,
            reviewSeconds: 0
        };

        daySessions.forEach(s => {
            if (s.type === 'LEARN') timeStats.learnSeconds += s.duration;
            else if (s.type === 'EXERCISE') timeStats.reviewSeconds += s.duration;
        });

        // Check for mistakes (Mistake Book Status)
        // Check for mistakes (Mistake Book Status)
        const wordIds = Array.from(uniqueWords.keys());

        // Fetch progress for ALL words to get 'isUnfamiliar' (and mistake status)
        const progressList = await prisma.userProgress.findMany({
            where: {
                wordId: { in: wordIds },
                userId // Filter by user
            }
        });
        const progressMap = new Map();
        progressList.forEach(p => progressMap.set(p.wordId, p));

        // Get mistake logs to identify if it WAS a mistake
        const mistakeLogs = await prisma.reviewLog.findMany({
            where: {
                wordId: { in: wordIds },
                isCorrect: false,
                userId // Filter by user
            },
            select: { wordId: true },
            distinct: ['wordId']
        });

        const mistakeIds = new Set(mistakeLogs.map(l => l.wordId));

        const result = Array.from(uniqueWords.values()).map((entry: any) => {
            const id = entry.word.id;
            let mistakeStatus: 'resolved' | 'unresolved' | null = null;
            const progress = progressMap.get(id);
            const isUnfamiliar = progress?.isUnfamiliar || false;

            if (mistakeIds.has(id)) {
                const consecutive = progress?.consecutiveCorrect || 0;
                mistakeStatus = consecutive > 0 ? 'resolved' : 'unresolved';
            }

            return {
                ...entry,
                mistakeStatus,
                isUnfamiliar
            };
        });


        return NextResponse.json({ date: dateStr, words: result, timeStats });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
