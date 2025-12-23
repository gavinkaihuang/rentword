
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
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
                }
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
                }
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

        const result = Array.from(uniqueWords.values());

        return NextResponse.json({ date: dateStr, words: result, timeStats });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
