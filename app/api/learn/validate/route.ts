import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fromInput = searchParams.get('from') || '';
        const toInput = searchParams.get('to') || '';
        const wordBookParam = searchParams.get('wordBookId');

        const cookieStore = await cookies();
        let activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        if (wordBookParam) {
            const parsedId = parseInt(wordBookParam);
            if (!isNaN(parsedId)) {
                activeWordBookId = parsedId;
            }
        }

        if (!fromInput) {
            return NextResponse.json({ error: 'Missing start input' }, { status: 400 });
        }

        // 1. Resolve Start Word
        let startWord;
        if (fromInput.length === 1 && /^[a-zA-Z]$/.test(fromInput)) {
            // Find first word starting with this letter
            startWord = await prisma.word.findFirst({
                where: {
                    spelling: {
                        startsWith: fromInput
                    },
                    wordBookId: activeWordBookId
                },
                orderBy: {
                    orderIndex: 'asc'
                }
            });
        } else {
            // Exact match attempt first
            startWord = await prisma.word.findFirst({
                where: { spelling: fromInput, wordBookId: activeWordBookId }
            });
            // If strict exact match fails, could try startsWith? 
            // Requirement says "Is this word as start". Usually implies exact or closest.
            // Let's assume exact match for full word input.
        }

        if (!startWord) {
            return NextResponse.json({ error: `Start word "${fromInput}" not found in current book.` }, { status: 404 });
        }

        // 2. Resolve End Word
        let endWord;
        let usedDefault = false;

        if (toInput) {
            endWord = await prisma.word.findFirst({
                where: { spelling: toInput, wordBookId: activeWordBookId }
            });
        }

        // 3. Fallback logic: "If end word not found (or empty), select 20"
        if (!endWord) {
            usedDefault = true;
            // Get the word at (startIndex + 19) -> total 20 words
            // Or just get the count directly if we just want to validate count?
            // User requirement: "If end word can't be found ... default select 20".
            // We need to return the effective 'to' word so the frontend can pass it to the actual Mode 1 API?
            // OR Mode 1 API is dumb and just takes 'from'/'to'.
            // Yes, standard Mode 1 API takes 'to'.
            // So we need to find the spelling of the 20th word.

            // Find word with orderIndex = startWord.orderIndex + 19
            // But order indices might not be contiguous if deletions happened (though unlikely here).
            // Better: findMany with skip/take.

            const words = await prisma.word.findMany({
                where: {
                    wordBookId: activeWordBookId,
                    orderIndex: {
                        gte: startWord.orderIndex
                    }
                },
                orderBy: { orderIndex: 'asc' },
                take: 50
            });

            if (words.length > 0) {
                endWord = words[words.length - 1]; // The last of the 20
            } else {
                endWord = startWord; // Should not happen given startWord exists
            }
        }

        // 4. Calculate Count
        // Now we have startWord and endWord (either user's or default).
        // Let's count properly.
        const count = await prisma.word.count({
            where: {
                wordBookId: activeWordBookId,
                orderIndex: {
                    gte: startWord.orderIndex,
                    lte: endWord.orderIndex
                }
            }
        });

        return NextResponse.json({
            count,
            startWord: startWord.spelling,
            endWord: endWord.spelling,
            usedDefault,
            warning: count > 20
        });

    } catch (error) {
        console.error('Validation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
