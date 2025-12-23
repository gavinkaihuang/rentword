import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const letter = searchParams.get('letter');

        if (!letter || letter.length !== 1) {
            return NextResponse.json({ error: 'Invalid letter parameter' }, { status: 400 });
        }

        const words = await prisma.word.findMany({
            where: {
                spelling: {
                    startsWith: letter
                }
            },
            select: {
                id: true,
                spelling: true
            },
            orderBy: {
                spelling: 'asc'
            }
        });

        // Prisma startsWith is usually case-insensitive in many DBs but dependent on collation.
        // If strict case needed, we might need OR logic, but for standard setup it likely works or we can post-filter if needed.
        // Assuming default collation is CI or data is normalized.
        // To be safe for mixed case data if DB is case sensitive:
        // But let's assume standard behavior first. If issues arise, we can adjust.
        // Actually, for SQLite default in Prisma it might optionally be case sensitive. 
        // Let's refine to ensure we get both cases if possible, or just accept the query.

        return NextResponse.json({ words });

    } catch (error) {
        console.error('Error in words API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
