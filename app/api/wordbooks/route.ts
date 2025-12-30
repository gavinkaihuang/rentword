
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const wordBooks = await prisma.wordBook.findMany({
            orderBy: { id: 'asc' }
        });
        return NextResponse.json({ wordBooks });
    } catch (error) {
        console.error('Error fetching wordbooks:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
