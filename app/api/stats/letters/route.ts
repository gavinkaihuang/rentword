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
        const requestedBookId = searchParams.get('wordBookId');

        const cookieStore = await cookies();
        const cookieBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        const activeWordBookId = requestedBookId ? parseInt(requestedBookId) : cookieBookId;

        // 1. Fetch all basic data (Scoped to Book)
        const allWords = await prisma.word.findMany({
            where: { wordBookId: activeWordBookId },
            select: { id: true, spelling: true }
        });

        const wordIds = allWords.map(w => w.id);

        if (wordIds.length === 0) {
            // Return empty stats if book is empty
        }

        const userProgress = await prisma.userProgress.findMany({
            where: {
                wordId: { in: wordIds },
                proficiency: { gt: 0 },
                userId: userId
            },
            select: {
                wordId: true,
                lastReviewed: true,
                proficiency: true // Optional: could track mastery
            }
        });

        // 2. Fetch Review Log Stats (Aggregated)
        // SQLite stores boolean as 0/1. 
        // We want total reviews and simple incorrect count (isCorrect = 0).
        // Only for relevant words

        let logStats: Array<{ wordId: number, total: number, incorrect: number }> = [];

        if (wordIds.length > 0) {
            /* 
               Use prisma raw query with IN clause is tricky for arrays. 
               Easier to just fetch relevant logs? Or fetch all stats?
               Given we are aggregating, fetching stats for JUST the words in book is better.
               But `IN` clause with raw query needs manual parameter expansion or join.
               
               Simpler: Join with Word table in raw query?
               SELECT ... FROM ReviewLog JOIN Word ON ReviewLog.wordId = Word.id WHERE Word.wordBookId = ...
            */
            logStats = await prisma.$queryRaw<Array<{ wordId: number, total: number, incorrect: number }>>`
                SELECT 
                    ReviewLog.wordId, 
                    COUNT(*) as total, 
                    SUM(CASE WHEN ReviewLog.isCorrect = 0 THEN 1 ELSE 0 END) as incorrect
                FROM ReviewLog
                JOIN Word ON ReviewLog.wordId = Word.id
                WHERE Word.wordBookId = ${activeWordBookId} 
                  AND ReviewLog.userId = ${userId}
                GROUP BY ReviewLog.wordId
            `;
        }

        // 3. Initialize Stats Map
        const letterStats: Record<string, {
            total: number,
            learned: number,
            lastReviewed: number | null, // timestamp
            reviewTotal: number,
            reviewIncorrect: number
        }> = {};

        const aCode = 'a'.charCodeAt(0);
        for (let i = 0; i < 26; i++) {
            letterStats[String.fromCharCode(aCode + i)] = {
                total: 0,
                learned: 0,
                lastReviewed: null,
                reviewTotal: 0,
                reviewIncorrect: 0
            };
        }

        // 4. Create Maps for lookup
        const wordIdToLetter = new Map<number, string>(); // WordID -> Letter
        const wordIdToProgress = new Map<number, any>(); // WordID -> Progress
        const wordIdToLog = new Map<number, { total: number, incorrect: number }>();

        logStats.forEach((l: any) => {
            // raw query usually returns BigInt for count in some prisma adapters, handle number conversion just in case
            const t = Number(l.total);
            const i = Number(l.incorrect); // "incorrect" is the name
            wordIdToLog.set(l.wordId, { total: t, incorrect: i });
        });

        userProgress.forEach(p => wordIdToProgress.set(p.wordId, p));

        // 5. Aggregate
        allWords.forEach(w => {
            const firstChar = w.spelling.charAt(0).toLowerCase();
            if (firstChar >= 'a' && firstChar <= 'z') {
                const stat = letterStats[firstChar];
                if (stat) { // Check existence just in case
                    stat.total++;
                    wordIdToLetter.set(w.id, firstChar);

                    // Progress
                    const prog = wordIdToProgress.get(w.id);
                    if (prog) {
                        stat.learned++;
                        if (prog.lastReviewed) {
                            const t = new Date(prog.lastReviewed).getTime();
                            if (!stat.lastReviewed || t > stat.lastReviewed) {
                                stat.lastReviewed = t;
                            }
                        }
                    }

                    // Logs
                    const logs = wordIdToLog.get(w.id);
                    if (logs) {
                        stat.reviewTotal += logs.total;
                        stat.reviewIncorrect += logs.incorrect;
                    }
                }
            }
        });

        // 6. Format Result
        const result = Object.entries(letterStats).map(([letter, stats]) => {
            const errorRate = stats.reviewTotal > 0
                ? Math.round((stats.reviewIncorrect / stats.reviewTotal) * 1000) / 10 // 1 decimal place
                : 0;

            return {
                letter: letter.toUpperCase(),
                total: stats.total,
                learned: stats.learned,
                percentage: stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0,
                lastStudied: stats.lastReviewed ? new Date(stats.lastReviewed).toISOString() : null,
                errorRate
            };
        }).sort((a, b) => a.letter.localeCompare(b.letter));

        return NextResponse.json({ stats: result });

    } catch (error) {
        console.error('Error in stats/letters API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
