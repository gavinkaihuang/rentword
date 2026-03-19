
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import prisma from '@/lib/prisma';

export async function GET() {
    const cookieStore = await cookies();
    const activeId = cookieStore.get('active_wordbook_id')?.value;

    let activeWordBookId = activeId ? parseInt(activeId, 10) : NaN;
    let needsSetCookie = false;

    if (Number.isNaN(activeWordBookId) || activeWordBookId <= 0) {
        const firstBook = await prisma.wordBook.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
        activeWordBookId = firstBook?.id ?? 1;
        needsSetCookie = true;
    } else {
        const existingBook = await prisma.wordBook.findUnique({
            where: { id: activeWordBookId },
            select: { id: true }
        });

        if (!existingBook) {
            const firstBook = await prisma.wordBook.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
            activeWordBookId = firstBook?.id ?? 1;
            needsSetCookie = true;
        }
    }

    const response = NextResponse.json({ activeWordBookId });

    if (needsSetCookie) {
        response.cookies.set('active_wordbook_id', activeWordBookId.toString(), {
            httpOnly: true,
            path: '/',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365
        });
    }

    return response;
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
