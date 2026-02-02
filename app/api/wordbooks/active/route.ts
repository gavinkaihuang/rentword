
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import prisma from '@/lib/prisma';

export async function GET() {
    const cookieStore = await cookies();
    const activeId = cookieStore.get('active_wordbook_id')?.value;

    let activeWordBookId = activeId ? parseInt(activeId) : 1;

    // Check validity logic similar to study route
    if (activeWordBookId <= 1) {
        // Try to find if book 1 actually exists, or get first available
        const bookCount = await prisma.wordBook.count({ where: { id: activeWordBookId } });
        if (bookCount === 0) {
            const firstBook = await prisma.wordBook.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
            if (firstBook) activeWordBookId = firstBook.id;
        }
    }

    return NextResponse.json({ activeWordBookId });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { wordBookId } = body;

        if (!wordBookId) {
            return NextResponse.json({ error: 'Missing wordBookId' }, { status: 400 });
        }

        const response = NextResponse.json({ success: true, activeWordBookId: wordBookId });

        response.cookies.set('active_wordbook_id', wordBookId.toString(), {
            httpOnly: true,
            path: '/',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 // 1 year
        });

        return response;

    } catch (error) {
        console.error('Error setting active wordbook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
