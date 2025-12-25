import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // 1. Fetch all basic data
        const allWords = await prisma.word.findMany({
            select: { id: true, spelling: true }
        });

        const userProgress = await prisma.userProgress.findMany({
            where: { proficiency: { gt: 0 } },
            select: {
                wordId: true,
                lastReviewed: true,
                proficiency: true // Optional: could track mastery
            }
        });

        // 2. Fetch Review Log Stats (Aggregated)
        // SQLite stores boolean as 0/1. 
        // We want total reviews and simple incorrect count (isCorrect = 0).
        const logStats = await prisma.$queryRaw<Array<{ wordId: number, total: number, incorrect: number }>>`
            SELECT 
                wordId, 
                COUNT(*) as total, 
                SUM(CASE WHEN isCorrect = 0 THEN 1 ELSE 0 END) as incorrect
            FROM ReviewLog 
            GROUP BY wordId
        `;

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
