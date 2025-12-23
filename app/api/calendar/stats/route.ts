import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // 1. Fetch Daily Review Stats (ReviewLog)
        // Group by day is hard in Prisma+SQLite without raw query.
        // Let's fetch all logs for the month and aggregate in JS. lightweight.
        const logs = await prisma.reviewLog.findMany({
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            select: {
                createdAt: true,
                isCorrect: true
            }
        });

        // Aggregate logs by day
        const dailyStats: Record<string, any> = {};
        logs.forEach(log => {
            const day = log.createdAt.toISOString().split('T')[0];
            if (!dailyStats[day]) dailyStats[day] = { total: 0, correct: 0, incorrect: 0 };
            dailyStats[day].total++;
            if (log.isCorrect) dailyStats[day].correct++;
            else dailyStats[day].incorrect++;
        });

        // 2. Fetch Time Stats (StudySession)
        const sessions = await prisma.studySession.findMany({
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            }
        });

        let totalLearnSeconds = 0;
        let totalReviewSeconds = 0;

        sessions.forEach(session => {
            if (session.type === 'LEARN') totalLearnSeconds += session.duration;
            else if (session.type === 'EXERCISE') totalReviewSeconds += session.duration;
        });

        return NextResponse.json({
            dailyStats,
            totalLearnSeconds,
            totalReviewSeconds,
            learnedCount: logs.filter(l => l.isCorrect).length // Simple count for header if needed
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
