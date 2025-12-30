import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const userIdHeader = request.headers.get('x-user-id');
        if (!userIdHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = parseInt(userIdHeader);

        const { duration, type } = await request.json();

        if (!duration || !type) {
            return NextResponse.json({ error: 'Missing duration or type' }, { status: 400 });
        }

        const session = await prisma.studySession.create({
            data: {
                duration,
                type, // 'LEARN' or 'EXERCISE'
                userId
            },
        });

        return NextResponse.json(session);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
