import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';
import { getActiveWordBookId } from '@/lib/active-wordbook';

function pickRandomDistinct<T>(items: T[], count: number): T[] {
    if (items.length <= count) return [...items];

    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy.slice(0, count);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fromWord = searchParams.get('from');
    const toWord = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '10');

    const cookieStore = await cookies();
    const activeWordBookId = await getActiveWordBookId(cookieStore);

    if (!fromWord || !toWord) {
        return NextResponse.json({ error: 'Missing from/to parameters' }, { status: 400 });
    }

    try {
        // 1. Find indices within the active book
        const startWordObj = await prisma.word.findFirst({
            where: {
                spelling: fromWord,
                wordBookId: activeWordBookId
            },
            select: { orderIndex: true },
        });

        const endWordObj = await prisma.word.findFirst({
            where: {
                spelling: toWord,
                wordBookId: activeWordBookId
            },
            select: { orderIndex: true },
        });

        if (!startWordObj || !endWordObj) {
            return NextResponse.json({ error: 'Start or End word not found in this book' }, { status: 404 });
        }

        const startIdx = Math.min(startWordObj.orderIndex, endWordObj.orderIndex);
        const endIdx = Math.max(startWordObj.orderIndex, endWordObj.orderIndex);

        // 2. Fetch words in range
        const words = await prisma.word.findMany({
            where: {
                wordBookId: activeWordBookId, // Filter by book
                orderIndex: {
                    gte: startIdx,
                    lte: endIdx,
                },
            },
            take: limit, // Pagination or batching
        });

        // 3. Build one distractor pool to avoid per-question DB round-trips
        const distractorPool = await prisma.word.findMany({
            select: { id: true, meaning: true }
        });

        const questions = words.map((word) => {
            const candidates = distractorPool.filter(item => item.id !== word.id);
            const distractors = pickRandomDistinct(candidates, 3);

            const options = [
                { label: 'Correct', value: word.meaning, isCorrect: true },
                ...distractors.map(d => ({ label: 'Option', value: d.meaning, isCorrect: false }))
            ];

            // Shuffle options
            const shuffledOptions = options.sort(() => Math.random() - 0.5);
            // Map to A, B, C, D locally in frontend logic, but backend provides the array.

            return {
                word: formatWordForTask(word),
                options: shuffledOptions.map(o => ({ meaning: o.value, isCorrect: o.isCorrect }))
            };
        });

        return NextResponse.json({ questions, nextBatchStart: words[words.length - 1]?.orderIndex + 1 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
