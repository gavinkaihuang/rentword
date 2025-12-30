import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateNextReview } from '@/lib/srs';

export async function POST(request: Request) {
    try {
        const userIdHeader = request.headers.get('x-user-id');
        if (!userIdHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = parseInt(userIdHeader);

        const body = await request.json();
        const { wordId, isCorrect } = body;

        if (!wordId || typeof isCorrect !== 'boolean') {
            return NextResponse.json({ error: 'Missing wordId or isCorrect' }, { status: 400 });
        }

        // 1. Get current progress
        let progress = await prisma.userProgress.findUnique({
            where: {
                userId_wordId: { userId, wordId }
            },
        });

        // Default values if not found
        const currentProficiency = progress?.proficiency ?? 0;
        const currentConsecutive = progress?.consecutiveCorrect ?? 0;

        // 2. Calculate SRS
        const result = calculateNextReview(currentProficiency, currentConsecutive, isCorrect);

        // 3. Update or Create
        const [updated] = await prisma.$transaction([
            prisma.userProgress.upsert({
                where: {
                    userId_wordId: { userId, wordId }
                },
                update: {
                    proficiency: result.proficiency,
                    nextReviewDate: result.nextReviewDate,
                    consecutiveCorrect: result.consecutiveCorrect,
                    lastReviewed: new Date(),
                    // userId is safely invariant, no update needed
                },
                create: {
                    wordId,
                    userId,
                    proficiency: result.proficiency,
                    nextReviewDate: result.nextReviewDate,
                    consecutiveCorrect: result.consecutiveCorrect,
                    lastReviewed: new Date(),
                },
            }),
            prisma.reviewLog.create({
                data: {
                    wordId,
                    userId,
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
