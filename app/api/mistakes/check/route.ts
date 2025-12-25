import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { wordIds } = body;

        if (!Array.isArray(wordIds)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // 1. Identify words with ANY error history
        const mistakes = await prisma.reviewLog.findMany({
            where: {
                wordId: { in: wordIds },
                isCorrect: false
            },
            select: { wordId: true },
            distinct: ['wordId']
        });

        if (mistakes.length === 0) {
            return NextResponse.json({ mistakeStatus: {} });
        }

        const paramIds = mistakes.map(m => m.wordId);

        // 2. Check their current status (Resolved vs Unresolved)
        const progressList = await prisma.userProgress.findMany({
            where: { wordId: { in: paramIds } }
        });

        const progressMap = new Map();
        progressList.forEach(p => progressMap.set(p.wordId, p));

        const mistakeStatus: Record<number, 'resolved' | 'unresolved'> = {};

        paramIds.forEach(id => {
            const p = progressMap.get(id);
            // If it has error history (which it does), check consecutiveCorrect
            const consecutive = p?.consecutiveCorrect || 0;
            if (consecutive > 0) {
                mistakeStatus[id] = 'resolved';
            } else {
                mistakeStatus[id] = 'unresolved';
            }
        });

        return NextResponse.json({ mistakeStatus });
    } catch (error) {
        console.error('Error checking mistakes:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
