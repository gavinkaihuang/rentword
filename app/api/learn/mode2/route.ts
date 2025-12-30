import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';

export async function GET(request: Request) {
    try {
        // Mode 2: Words that are due or low proficiency?
        // User request: "针对模式1中产生的不熟练的单词，随机帮我进行复习和巩固... 重点抽查这些之前答错的单词"
        // So priority: nextReviewDate <= now OR proficiency == 0 (if valid?)
        // Actually SRS handles "nextReviewDate". If wrong, it's due immediately.

        const cookieStore = await cookies();
        const activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');
        const now = new Date();

        const progressItems = await prisma.userProgress.findMany({
            where: {
                nextReviewDate: {
                    lte: now
                },
                word: {
                    wordBookId: activeWordBookId
                }
            },
            orderBy: {
                nextReviewDate: 'asc', // Most overdue first
            },
            take: 20,
            include: {
                word: true
            }
        });

        // If needed, we can also fetch random words if few are due? User said "Review and consolidate".
        // If no words due, return empty?

        const words = progressItems.map(p => p.word);

        if (words.length === 0) {
            return NextResponse.json({ questions: [], message: "No words due for review!" });
        }

        // Generate questions (same logic as Mode 1)
        // Refactor this into a helper? Yes, but for speed, I'll duplicate mostly.

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
