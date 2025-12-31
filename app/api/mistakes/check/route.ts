import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { wordIds } = body;

        if (!Array.isArray(wordIds)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const userIdHeader = request.headers.get('x-user-id');
        const userId = userIdHeader ? parseInt(userIdHeader) : 0;

        // Fetch progress for ALL requested words to determine unfamiliar status
        const allProgress = await prisma.userProgress.findMany({
            where: {
                wordId: { in: wordIds },
                userId: userId
            }
        });

        const progressMap = new Map();
        allProgress.forEach(p => progressMap.set(p.wordId, p));

        const unfamiliarStatus: Record<number, boolean> = {};
        const mistakeStatus: Record<number, 'resolved' | 'unresolved'> = {};

        // Identify actual mistakes from logs to distinction 'resolved' vs 'unresolved'
        // If it's not in error history, it's neither.
        const errorHistory = await prisma.reviewLog.findMany({
            where: {
                wordId: { in: wordIds },
                isCorrect: false,
                userId: userId
            },
            select: { wordId: true },
            distinct: ['wordId']
        });
        const errorWordIds = new Set(errorHistory.map(e => e.wordId));

        wordIds.forEach((id: number) => {
            const p = progressMap.get(id);

            // 1. Unfamiliar Status (Independent of mistakes)
            unfamiliarStatus[id] = p?.isUnfamiliar || false;

            // 2. Mistake Status
            if (errorWordIds.has(id)) {
                const consecutive = p?.consecutiveCorrect || 0;
                if (consecutive > 0) {
                    mistakeStatus[id] = 'resolved';
                } else {
                    mistakeStatus[id] = 'unresolved';
                }
            }
        });

        return NextResponse.json({ mistakeStatus, unfamiliarStatus });
    } catch (error) {
        console.error('Error checking mistakes:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
