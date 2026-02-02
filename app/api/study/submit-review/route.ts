
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

// SM-2 Constants
const MIN_EF = 1.3;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { wordId, quality } = body;
        // Quality: 0 (complete blackout) to 5 (perfect response)

        if (!wordId || quality === undefined) {
            return NextResponse.json({ error: 'Missing wordId or quality' }, { status: 400 });
        }

        const userId = 1; // Default user
        const now = new Date();

        // 1. Get current progress
        let progress = await prisma.userProgress.findUnique({
            where: {
                userId_wordId: { userId, wordId }
            }
        });

        // Initialize if new
        if (!progress) {
            progress = await prisma.userProgress.create({
                data: {
                    userId,
                    wordId,
                    interval: 0,
                    easinessFactor: 2.5,
                    consecutiveCorrect: 0,
                    proficiency: 0
                }
            });
        }

        // 2. Calculate SM-2
        // Reference: https://super-memory.com/english/ol/sm2.htm

        let { interval, easinessFactor, consecutiveCorrect } = progress;
        // Adjust for schema types (Prisma might return basic types)

        // q: quality (0-5)
        // correct: quality >= 3

        if (quality >= 3) {
            if (consecutiveCorrect === 0) {
                interval = 1;
            } else if (consecutiveCorrect === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * easinessFactor);
            }
            consecutiveCorrect += 1;
        } else {
            interval = 1; // Reset interval
            consecutiveCorrect = 0;
        }

        // Update EF
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        const q = quality;
        easinessFactor = easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        if (easinessFactor < MIN_EF) easinessFactor = MIN_EF;

        // Calculate next review date
        const nextDate = new Date();
        nextDate.setDate(now.getDate() + interval);
        // Normalize to start of day? Or exact time? SM-2 usually uses days. 
        // Let's keep time for now, or maybe set to early morning.

        // Update DB
        const updated = await prisma.userProgress.update({
            where: { id: progress.id },
            data: {
                interval,
                easinessFactor,
                consecutiveCorrect,
                lastReviewed: now,
                nextReviewDate: nextDate,
                // Simple proficiency mapping for other features
                proficiency: Math.min(100, progress.proficiency + (quality >= 3 ? 10 : -20)),
                isUnfamiliar: quality < 3
            }
        });

        // Log Review
        await prisma.reviewLog.create({
            data: {
                userId,
                wordId,
                isCorrect: quality >= 3,
                mistakeType: quality < 3 ? 'MEMORY_LAPSE' : null
            }
        });

        return NextResponse.json({
            success: true,
            nextReviewDate: nextDate,
            interval: interval
        });

    } catch (error) {
        console.error('Error submitting review:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
