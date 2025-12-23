import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // 1. Get total count per starting letter
        // Since sqlite doesn't support sophisticated string functions in groupBy easily in prisma raw, 
        // we might fetch all valid spelling prefixes or use raw query.
        // Prisma doesn't support grouping by substring.
        // Let's use raw query for efficiency.

        const totalCounts = await prisma.$queryRaw<Array<{ letter: string, count: number }>>`
            SELECT 
                LOWER(SUBSTR(spelling, 1, 1)) as letter, 
                COUNT(*) as count 
            FROM "Word" 
            WHERE spelling REGEXP '^[a-zA-Z]' 
            GROUP BY LOWER(SUBSTR(spelling, 1, 1))
        `;
        // Note: REGEXP might not be available in default sqlite build, usually GLOB or LIKE is safer.
        // But for single char prefix, `SUBSTR(spelling, 1, 1)` is fine.
        // Let's try standard SQLite compatible way.

        // Actually, prisma usually handles raw queries well. But local sqlite might vary.
        // Let's stick to a simpler approach if uncertain about regex: 
        // Iterate A-Z and count? No, that's 26 queries.
        // Fetch all spellings? 3800 words is small enough to fetch 'id' and 'spelling' into memory and aggregate.
        // This is safe and robust across DBs for this dataset size.

        const allWords = await prisma.word.findMany({
            select: { id: true, spelling: true }
        });

        const letterStats: Record<string, { total: number, learned: number }> = {};
        const aCode = 'a'.charCodeAt(0);
        for (let i = 0; i < 26; i++) {
            letterStats[String.fromCharCode(aCode + i)] = { total: 0, learned: 0 };
        }

        const wordIdToLetter = new Map<number, string>();

        allWords.forEach(w => {
            const firstChar = w.spelling.charAt(0).toLowerCase();
            if (firstChar >= 'a' && firstChar <= 'z') {
                letterStats[firstChar].total++;
                wordIdToLetter.set(w.id, firstChar);
            }
        });

        // 2. Get learned status
        // A word is "learned" if proficiency > 0 or has userProgress?
        // Let's assume UserProgress existing implies some interaction. 
        // Or strictly `proficiency > 0`.

        const userProgress = await prisma.userProgress.findMany({
            where: {
                proficiency: { gt: 0 }
            },
            select: { wordId: true }
        });

        userProgress.forEach(p => {
            const letter = wordIdToLetter.get(p.wordId);
            if (letter) {
                letterStats[letter].learned++;
            }
        });

        const result = Object.entries(letterStats).map(([letter, stats]) => ({
            letter: letter.toUpperCase(),
            total: stats.total,
            learned: stats.learned,
            percentage: stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0
        })).sort((a, b) => a.letter.localeCompare(b.letter));

        return NextResponse.json({ stats: result });

    } catch (error) {
        console.error('Error in stats/letters API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
