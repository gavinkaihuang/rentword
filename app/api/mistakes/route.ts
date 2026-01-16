import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const userIdHeader = request.headers.get('x-user-id');
        if (!userIdHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = parseInt(userIdHeader);

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status') || 'unmastered'; // unmastered | mastered | critical | spelling

        const cookieStore = await cookies();
        const activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        // 1. Determine IDs based on status
        let finalIds: number[] = [];

        if (status === 'critical') {
            // A. Get Unfamiliar words
            const unfamiliarProgress = await prisma.userProgress.findMany({
                where: {
                    userId: userId,
                    isUnfamiliar: true
                },
                select: { wordId: true }
            });
            const unfamiliarIds = unfamiliarProgress.map(p => p.wordId);

            // B. Get Mistake Candidates (History of error)
            const errorLogs = await prisma.reviewLog.findMany({
                where: {
                    isCorrect: false,
                    userId: userId
                },
                select: { wordId: true },
                distinct: ['wordId']
            });
            const mistakeCandidateIds = errorLogs.map(l => l.wordId);

            // Combine unique IDs
            const combinedIds = Array.from(new Set([...unfamiliarIds, ...mistakeCandidateIds]));

            if (combinedIds.length === 0) {
                return NextResponse.json({
                    mistakes: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }

            // Filter by WordBook
            const wordsInBook = await prisma.word.findMany({
                where: {
                    id: { in: combinedIds },
                    wordBookId: activeWordBookId
                },
                select: { id: true }
            });
            const validIds = wordsInBook.map(w => w.id);

            // Fetch progress to confirm "Unmastered Mistake" status for those who are NOT explicitly unfamiliar
            // (If isUnfamiliar is true, we include it regardless of mistake status)
            const progressList = await prisma.userProgress.findMany({
                where: {
                    wordId: { in: validIds },
                    userId: userId
                }
            });
            const progressMap = new Map();
            progressList.forEach(p => progressMap.set(p.wordId, p));

            finalIds = validIds.filter(id => {
                const p = progressMap.get(id);
                if (!p) return false; // Should not happen usually

                if (p.isUnfamiliar) return true; // Include if Unfamiliar

                // Else check if it is an unmastered mistake
                // Must have error history (which is true if it was in mistakeCandidateIds)
                // AND consecutiveCorrect must be 0
                const hasErrorHistory = mistakeCandidateIds.includes(id);
                if (hasErrorHistory && p.consecutiveCorrect === 0) return true;

                return false;
            });

        } else if (status === 'spelling') {
            // C. Get Spelling Mistakes
            const spellingLogs = await prisma.reviewLog.findMany({
                where: {
                    userId: userId,
                    isCorrect: false,
                    mistakeType: 'SPELLING'
                },
                select: { wordId: true },
                distinct: ['wordId']
            });
            const spellingIds = spellingLogs.map(l => l.wordId);

            if (spellingIds.length === 0) {
                return NextResponse.json({
                    mistakes: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }

            // Filter by WordBook
            const wordsInBook = await prisma.word.findMany({
                where: {
                    id: { in: spellingIds },
                    wordBookId: activeWordBookId
                },
                select: { id: true }
            });
            finalIds = wordsInBook.map(w => w.id);

        } else {
            // Existing Logic for 'unmastered' (default) and 'mastered'

            // 1. Find all words that have EVER had an error
            const errorLogs = await prisma.reviewLog.findMany({
                where: {
                    isCorrect: false,
                    userId: userId
                },
                select: { wordId: true, createdAt: true },
                distinct: ['wordId'],
                orderBy: { createdAt: 'desc' }
            });

            const allCandidateIds = errorLogs.map(l => l.wordId);

            if (allCandidateIds.length === 0) {
                return NextResponse.json({
                    mistakes: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }

            // Filter these IDs by WordBook
            const wordsInBook = await prisma.word.findMany({
                where: {
                    id: { in: allCandidateIds },
                    wordBookId: activeWordBookId
                },
                select: { id: true }
            });

            const candidateIds = wordsInBook.map(w => w.id);

            // Re-sort candidateIds based on errorLogs order (recency)
            const sortedCandidateIds = allCandidateIds.filter(id => candidateIds.includes(id));

            if (sortedCandidateIds.length === 0) {
                return NextResponse.json({
                    mistakes: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }

            // 2. Fetch Progress for these candidates to determine status
            const progressList = await prisma.userProgress.findMany({
                where: {
                    wordId: { in: sortedCandidateIds },
                    userId: userId
                }
            });

            const progressMap = new Map();
            progressList.forEach(p => progressMap.set(p.wordId, p));

            // 3. Filter candidates based on status
            finalIds = sortedCandidateIds.filter(id => {
                const p = progressMap.get(id);
                const consecutive = p?.consecutiveCorrect || 0;

                if (status === 'mastered') {
                    return consecutive > 0; // Has error history but currently correct streak > 0
                } else {
                    return consecutive === 0; // Has error history and currently failing/reset
                }
            });
        }

        // 4. Paginate IDs
        const total = finalIds.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const paginatedIds = finalIds.slice(startIndex, startIndex + limit);

        // 5. Fetch details for the page
        // Need error count for these specific words
        const stats = await prisma.reviewLog.groupBy({
            by: ['wordId'],
            where: {
                wordId: { in: paginatedIds },
                isCorrect: false,
                userId: userId
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
