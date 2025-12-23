import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        // 1. Find all words that have error logs
        // We use groupBy to aggregate error stats
        const errorStats = await prisma.reviewLog.groupBy({
            by: ['wordId'],
            where: {
                isCorrect: false
            },
            _count: {
                _all: true
            },
            _max: {
                createdAt: true
            },
            orderBy: {
                _max: {
                    createdAt: 'desc'
                }
            },
            skip: skip,
            take: limit,
        });

        // Get total count for pagination
        const totalCountRaw = await prisma.reviewLog.groupBy({
            by: ['wordId'],
            where: {
                isCorrect: false
            },
        });
        const total = totalCountRaw.length;

        // 2. Fetch word details
        const wordIds = errorStats.map(stat => stat.wordId);
        const words = await prisma.word.findMany({
            where: {
                id: {
                    in: wordIds
                }
            }
        });

        // 3. Combine data
        const result = errorStats.map(stat => {
            const word = words.find(w => w.id === stat.wordId);
            return {
                wordId: stat.wordId,
                spelling: word?.spelling || 'Unknown',
                meaning: word?.meaning || 'Unknown',
                errorCount: stat._count._all,
                lastErrorDate: stat._max.createdAt,
            };
        });

        return NextResponse.json({
            mistakes: result,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error in mistakes API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
