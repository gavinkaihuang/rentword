import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        const userIdHeader = request.headers.get('x-user-id');
        const userId = userIdHeader ? parseInt(userIdHeader) : 0;

        const cookieStore = await cookies();
        const activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        // Fetch random words with priority for unfamiliar ones
        // Since we can't easily do weighted random in SQLite with Prisma efficiently in one go for 
        // a calculated field from a relation, we'll try a hybrid approach:
        // 1. Try to fetch some 'unfamiliar' words first.
        // 2. Fill the rest with random words.

        // Strategy: 50% chance to target unfamiliar words if any exist
        let words: any[] = [];
        const limitNum = parseInt(limit.toString());

        if (userId > 0) {
            const unfamiliarWords = await prisma.word.findMany({
                where: {
                    wordBookId: activeWordBookId,
                    userProgress: {
                        some: {
                            userId: userId,
                            isUnfamiliar: true
                        }
                    }
                },
                take: limitNum, // Take up to limit to possibly fill entirely
                orderBy: { id: 'asc' } // just deterministic order to then randomize in memory or sub-select
            });

            if (unfamiliarWords.length > 0) {
                // Shuffle in memory
                const shuffledUnfamiliar = unfamiliarWords.sort(() => Math.random() - 0.5);
                // Take a portion, e.g., up to 80% of the limit? Or all?
                // Let's take all we found, up to the limit.
                words = shuffledUnfamiliar.slice(0, limitNum);
            }
        }

        if (words.length < limitNum) {
            const needed = limitNum - words.length;
            // Fetch remaining random words
            // We want to exclude the ones we already picked? 
            // Ideally yes, but for simplicity/performance in SQLite 'NOT IN' with many IDs is okay but...
            // Let's just fetch random and dedup in memory if overlap is small (unlikely if corpus is large)

            const randomWords = await prisma.$queryRaw<Array<{ id: number, spelling: string, meaning: string, orderIndex: number }>>`
                SELECT * FROM "Word"
                WHERE wordBookId = ${activeWordBookId}
                AND id NOT IN (${words.length > 0 ? words.map(w => w.id).join(',') : '0'})
                ORDER BY RANDOM()
                LIMIT ${needed}
             `;
            words = [...words, ...randomWords];
        }

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
