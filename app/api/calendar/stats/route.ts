
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // SQLite specific: strftime to group by day
        // Return { [date: string]: { total: number, correct: number, incorrect: number } }

        const logs = await prisma.$queryRaw<Array<{ day: string, total: number, correct: number }>>`
            SELECT 
                strftime('%Y-%m-%d', createdAt / 1000, 'unixepoch') as day,
                COUNT(*) as total,
                SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) as correct
            FROM ReviewLog 
            GROUP BY day
            ORDER BY day DESC
            LIMIT 365
        `;

        // Note: Prisma returns BigInt for count/sum in some drivers, but sqlite + basic setup usually number.
        // However, standard prisma queryRaw often returns BigInt for count.
        // Let's safe convert.

        const stats: Record<string, any> = {};
        for (const row of logs) {
            if (row.day) {
                stats[row.day] = {
                    total: Number(row.total),
                    correct: Number(row.correct),
                    incorrect: Number(row.total) - Number(row.correct)
                };
            }
        }

        // Fallback: If queryRaw is tricky with timestamps (Prisma stores DateTime as numeric or ISO string depending on version/config in sqlite)
        // Prisma usually stores as milliseconds since epoch or ISO-8601 string.
        // Default introspection suggested DateTime, so it's likely ISO string or numeric.
        // Let's try the ISO string version query if the above returns empty or fails.
        // Actually, safer is to fetch all logs (lightweight enough for single user) or group by JS if data is small. 
        // But let's try strict SQL first. 
        // If Prisma stores as ISO string: strftime('%Y-%m-%d', createdAt) matches.

        const logsISO = await prisma.$queryRaw<Array<{ day: string, total: number, correct: number }>>`
            SELECT 
                strftime('%Y-%m-%d', createdAt / 1000, 'unixepoch') as day, 
                COUNT(*) as total,
                SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) as correct
            FROM ReviewLog
            WHERE typeof(createdAt) = 'integer' -- check if number
            GROUP BY day
            UNION ALL
            SELECT 
                strftime('%Y-%m-%d', createdAt) as day, 
                COUNT(*) as total,
                SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) as correct
            FROM ReviewLog
            WHERE typeof(createdAt) = 'text' -- check if string
            GROUP BY day
         `;

        const finalStats: Record<string, any> = {};
        logsISO.forEach(row => {
            if (row.day) {
                finalStats[row.day] = {
                    total: Number(row.total),
                    correct: Number(row.correct),
                    incorrect: Number(row.total) - Number(row.correct)
                };
            }
        });

        return NextResponse.json(finalStats);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
