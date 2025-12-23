import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateNextReview } from '@/lib/srs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { wordId, isCorrect } = body;

        if (!wordId || typeof isCorrect !== 'boolean') {
            return NextResponse.json({ error: 'Missing wordId or isCorrect' }, { status: 400 });
        }

        // 1. Get current progress (upsert logic basically, but we need current val)
        // We can findUnique first
        let progress = await prisma.userProgress.findUnique({
            where: { wordId },
        });

        // Default values if not found
        const currentProficiency = progress?.proficiency ?? 0;
        const currentConsecutive = progress?.consecutiveCorrect ?? 0;

        // 2. Calculate SRS
        const result = calculateNextReview(currentProficiency, currentConsecutive, isCorrect);

        // 3. Update or Create
        // 3. Update or Create
        const [updated] = await prisma.$transaction([
            prisma.userProgress.upsert({
                where: { wordId },
                update: {
                    proficiency: result.proficiency,
                    nextReviewDate: result.nextReviewDate,
                    consecutiveCorrect: result.consecutiveCorrect,
                    lastReviewed: new Date(),
                },
                create: {
                    wordId,
                    proficiency: result.proficiency,
                    nextReviewDate: result.nextReviewDate,
                    consecutiveCorrect: result.consecutiveCorrect,
                    lastReviewed: new Date(),
                },
            }),
            prisma.reviewLog.create({
                data: {
                    wordId,
                    isCorrect
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            wordId,
            newProficiency: updated.proficiency,
            isCorrect
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
