import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idsStr = searchParams.get('ids');

        if (!idsStr) {
            return NextResponse.json({ error: 'Missing word IDs' }, { status: 400 });
        }

        const ids = idsStr.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

        if (ids.length === 0) {
            return NextResponse.json({ questions: [] });
        }

        // Fetch words
        const words = await prisma.word.findMany({
            where: {
                id: {
                    in: ids
                }
            }
        });

        const cookieStore = await cookies();
        const activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        // Reuse logic for generating questions with distractors
        const questions = await Promise.all(words.map(async (word) => {
            const distractors = await prisma.$queryRaw<Array<{ meaning: String }>>`
                SELECT meaning FROM "Word" 
                WHERE id != ${word.id} AND wordBookId = ${activeWordBookId}
                ORDER BY RANDOM() 
                LIMIT 3
            `;

            const options = [
                { label: 'Correct', value: word.meaning, isCorrect: true },
                ...distractors.map(d => ({ label: 'Option', value: d.meaning, isCorrect: false }))
            ];

            const shuffledOptions = options.sort(() => Math.random() - 0.5);

            return {
                word: formatWordForTask(word),
                options: shuffledOptions.map(o => ({ meaning: o.value, isCorrect: o.isCorrect }))
            };
        }));

        return NextResponse.json({ questions });

    } catch (error) {
        console.error('Error in mode5 API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
