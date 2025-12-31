import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const letter = searchParams.get('letter');

        const userIdHeader = request.headers.get('x-user-id');
        const userId = userIdHeader ? parseInt(userIdHeader) : 0; // Default to 0 if not logged in (e.g. strict mode handled by middleware)

        const cookieStore = await cookies();
        const activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        if (!letter || letter.length !== 1) {
            return NextResponse.json({ error: 'Invalid letter parameter' }, { status: 400 });
        }

        const words = await prisma.word.findMany({
            where: {
                spelling: {
                    startsWith: letter
                },
                wordBookId: activeWordBookId
            },
            select: {
                id: true,
                spelling: true,
                userProgress: {
                    where: { userId: userId },
                    select: { isUnfamiliar: true }
                }
            },
            orderBy: {
                spelling: 'asc'
            }
        });

        const formattedWords = words.map(w => ({
            id: w.id,
            spelling: w.spelling,
            isUnfamiliar: w.userProgress[0]?.isUnfamiliar || false
        }));

        return NextResponse.json({ words: formattedWords });

    } catch (error) {
        console.error('Error in words API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userIdHeader = request.headers.get('x-user-id');
        if (!userIdHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = parseInt(userIdHeader);

        const { wordId, isUnfamiliar } = await request.json();

        if (!wordId) {
            return NextResponse.json({ error: 'Missing wordId' }, { status: 400 });
        }

        const progress = await prisma.userProgress.upsert({
            where: {
                userId_wordId: {
                    userId: userId,
                    wordId: wordId
                }
            },
            create: {
                userId: userId,
                wordId: wordId,
                isUnfamiliar: isUnfamiliar,
                proficiency: 0
            },
            update: {
                isUnfamiliar: isUnfamiliar
            }
        });

        return NextResponse.json({ progress });
    } catch (e) {
        console.error('Failed to update unfamiliar status', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
