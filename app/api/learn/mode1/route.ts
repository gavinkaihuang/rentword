import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fromWord = searchParams.get('from');
    const toWord = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!fromWord || !toWord) {
        return NextResponse.json({ error: 'Missing from/to parameters' }, { status: 400 });
    }

    try {
        // 1. Find indices
        const startWordObj = await prisma.word.findFirst({
            where: { spelling: fromWord },
            select: { orderIndex: true },
        });

        const endWordObj = await prisma.word.findFirst({
            where: { spelling: toWord },
            select: { orderIndex: true },
        });

        if (!startWordObj || !endWordObj) {
            return NextResponse.json({ error: 'Start or End word not found' }, { status: 404 });
        }

        const startIdx = Math.min(startWordObj.orderIndex, endWordObj.orderIndex);
        const endIdx = Math.max(startWordObj.orderIndex, endWordObj.orderIndex);

        // 2. Fetch words in range
        const words = await prisma.word.findMany({
            where: {
                orderIndex: {
                    gte: startIdx,
                    lte: endIdx,
                },
            },
            take: limit, // Pagination or batching
        });

        // 3. Generate distractors for each word
        // We need random meanings. Efficient way: get random IDs or fetch a random sample.
        // For simplicity with 3800 words, we can fetch all IDs and pick random ones, OR fetch a random batch.

        // Let's count total words first
        const totalWords = await prisma.word.count();

        const questions = await Promise.all(words.map(async (word) => {
            // Fetch 3 random distractors
            // Using raw query for random usually, or just picking random IDs in JS helper
            // SQLite RANDOM(): `SELECT * FROM Word WHERE id != word.id ORDER BY RANDOM() LIMIT 3`

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

            // Shuffle options
            const shuffledOptions = options.sort(() => Math.random() - 0.5);
            // Map to A, B, C, D locally in frontend logic, but backend provides the array.

            return {
                word: {
                    id: word.id,
                    spelling: word.spelling,
                    orderIndex: word.orderIndex
                },
                options: shuffledOptions.map(o => ({ meaning: o.value, isCorrect: o.isCorrect }))
            };
        }));

        return NextResponse.json({ questions, nextBatchStart: words[words.length - 1]?.orderIndex + 1 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
