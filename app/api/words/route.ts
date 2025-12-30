import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const letter = searchParams.get('letter');

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
                spelling: true
            },
            orderBy: {
                spelling: 'asc'
            }
        });

        return NextResponse.json({ words });

    } catch (error) {
        console.error('Error in words API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
