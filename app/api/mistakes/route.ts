import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status') || 'unmastered'; // unmastered | mastered

        // 1. Find all words that have EVER had an error (Mistake Book Candidate)
        const errorLogs = await prisma.reviewLog.findMany({
            where: { isCorrect: false },
            select: { wordId: true, createdAt: true },
            distinct: ['wordId'],
            orderBy: { createdAt: 'desc' }
        });

        const candidateIds = errorLogs.map(l => l.wordId);

        if (candidateIds.length === 0) {
            return NextResponse.json({
                mistakes: [],
                pagination: { page, limit, total: 0, totalPages: 0 }
            });
        }

        // 2. Fetch Progress for these candidates to determine status
        const progressList = await prisma.userProgress.findMany({
            where: { wordId: { in: candidateIds } }
        });

        const progressMap = new Map();
        progressList.forEach(p => progressMap.set(p.wordId, p));

        // 3. Filter candidates based on status
        const filteredIds = candidateIds.filter(id => {
            const p = progressMap.get(id);
            const consecutive = p?.consecutiveCorrect || 0;

            if (status === 'mastered') {
                return consecutive > 0; // Has error history but currently correct streak > 0
            } else {
                return consecutive === 0; // Has error history and currently failing/reset
            }
        });

        // 4. Paginate IDs
        const total = filteredIds.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const paginatedIds = filteredIds.slice(startIndex, startIndex + limit);

        // 5. Fetch details for the page
        // Need error count for these specific words
        const stats = await prisma.reviewLog.groupBy({
            by: ['wordId'],
            where: {
                wordId: { in: paginatedIds },
                isCorrect: false
            },
            _count: { _all: true },
            _max: { createdAt: true }
        });

        const words = await prisma.word.findMany({
            where: { id: { in: paginatedIds } }
        });

        const result = paginatedIds.map(id => {
            const word = words.find(w => w.id === id);
            const stat = stats.find(s => s.wordId === id);
            return {
                wordId: id,
                spelling: word?.spelling || 'Unknown',
                meaning: word?.meaning || 'Unknown',
                errorCount: stat?._count._all || 0,
                lastErrorDate: stat?._max.createdAt || new Date().toISOString(),
            };
        });

        return NextResponse.json({
            mistakes: result,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });

    } catch (error) {
        console.error('Error in mistakes API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
