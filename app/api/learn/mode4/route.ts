import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date');

        if (!dateStr) {
            return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
        }

        const startOfDay = new Date(dateStr);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(dateStr);
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Find words reviewed on that date
        const logs = await prisma.reviewLog.findMany({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            select: {
                wordId: true
            },
            distinct: ['wordId']
        });

        if (logs.length === 0) {
            return NextResponse.json({ questions: [] });
        }

        const wordIds = logs.map(log => log.wordId);

        // 2. Fetch word details
        const words = await prisma.word.findMany({
            where: {
                id: {
                    in: wordIds
                }
            }
        });

        // 3. Generate questions with distractors
        const questions = await Promise.all(words.map(async (word) => {
            const distractors = await prisma.$queryRaw<Array<{ meaning: String }>>`
                SELECT meaning FROM "Word" 
                WHERE id != ${word.id} 
                ORDER BY RANDOM() 
                LIMIT 3
            `;

            const options = [
                { label: 'Correct', value: word.meaning, isCorrect: true },
                ...distractors.map(d => ({ label: 'Option', value: d.meaning, isCorrect: false }))
            ];

            const shuffledOptions = options.sort(() => Math.random() - 0.5);

            return {
                word: {
                    id: word.id,
                    spelling: word.spelling,
                    orderIndex: (word as any).orderIndex, // Type assertion if needed, though prisma types should handle it
                    phonetic: (word as any).phonetic,
                    grammar: (word as any).grammar,
                    example: (word as any).example
                },
                options: shuffledOptions.map(o => ({ meaning: o.value, isCorrect: o.isCorrect }))
            };
        }));

        return NextResponse.json({ questions });

    } catch (error) {
        console.error('Error in mode4 API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
