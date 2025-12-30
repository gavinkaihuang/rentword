import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        const cookieStore = await cookies();
        const activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        // Fetch random words
        const words = await prisma.$queryRaw<Array<{ id: number, spelling: string, meaning: string, orderIndex: number }>>`
      SELECT * FROM "Word"
      WHERE wordBookId = ${activeWordBookId}
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;

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
                word: formatWordForTask(word),
                options: shuffledOptions.map(o => ({ meaning: o.value, isCorrect: o.isCorrect }))
            };
        }));

        return NextResponse.json({ questions });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
