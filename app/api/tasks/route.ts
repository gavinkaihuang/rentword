import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mode, ...params } = body;

        if (!mode) {
            return NextResponse.json({ error: 'Missing mode' }, { status: 400 });
        }

        let questions: any[] = [];
        let description = 'Learning Session';

        // --- Logic copied/adapted from existing api/learn routes ---
        // We reuse the logic to generate the *content* of the task instantly.

        if (mode === '1') { // Range
            const { from, to, limit } = params;
            let fromNum = parseInt(from);
            let toNum = parseInt(to);
            const limitNum = parseInt(limit) || 20;

            // If not numbers, try to find words by spelling
            if (isNaN(fromNum)) {
                const startWord = await prisma.word.findFirst({ where: { spelling: from } });
                if (startWord) fromNum = startWord.orderIndex;
            }
            if (isNaN(toNum)) {
                const endWord = await prisma.word.findFirst({ where: { spelling: to } });
                if (endWord) toNum = endWord.orderIndex;
            }

            description = `Range Learning: ${from}-${to}`;

            if (isNaN(fromNum) || isNaN(toNum)) {
                return NextResponse.json({ error: `Invalid range parameters: ${from}, ${to} could not be resolved` }, { status: 400 });
            }

            const words = await prisma.word.findMany({
                where: {
                    orderIndex: {
                        gte: fromNum,
                        lte: toNum
                    }
                },
                take: limitNum
            });

            questions = await generateQuestions(words);

        } else if (mode === '4') { // Daily Review
            // ... Logic for daily review (Mode 4) ...
            const { date } = params;
            description = `Daily Review: ${date}`;

            if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

            const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

            const logs = await prisma.reviewLog.findMany({
                where: { createdAt: { gte: startOfDay, lte: endOfDay } },
                select: { wordId: true },
                distinct: ['wordId']
            });

            if (logs.length > 0) {
                const wordIds = logs.map(l => l.wordId);
                const words = await prisma.word.findMany({ where: { id: { in: wordIds } } });
                questions = await generateQuestions(words);
            }
        } else if (mode === '2') { // Smart Review (General - Placeholder for now)
            // TODO: Real review logic based on UserProgress
            // For now, let's just pick 20 random words to prevent crash
            description = 'Smart Review';
            const words = await prisma.word.findMany({
                take: 20,
                orderBy: { id: 'asc' } // Placeholder
            });
            // Ideally: fetch from UserProgress where nextReviewDate <= now
            questions = await generateQuestions(words);

        } else if (mode === '7') { // Smart Mistake Review
            description = 'Smart Mistake Review';

            // 1. Get all words with error history
            const errorLogs = await prisma.reviewLog.findMany({
                where: { isCorrect: false },
                select: { wordId: true },
                distinct: ['wordId']
            });

            if (errorLogs.length === 0) {
                return NextResponse.json({ error: 'No mistakes found to review!', questions: [] });
            }

            const candidateIds = errorLogs.map(l => l.wordId);

            // 2. Check progress
            const progressList = await prisma.userProgress.findMany({
                where: { wordId: { in: candidateIds } }
            });
            const progressMap = new Map();
            progressList.forEach(p => progressMap.set(p.wordId, p));

            const unmasteredIds: number[] = [];
            const masteredIdsList: number[] = [];

            candidateIds.forEach(id => {
                const p = progressMap.get(id);
                // If no progress record, it's unmastered. If consecutiveCorrect is 0, it's unmastered.
                const consecutive = p?.consecutiveCorrect || 0;
                if (consecutive === 0) {
                    unmasteredIds.push(id);
                } else {
                    masteredIdsList.push(id);
                }
            });

            // 3. Selection Strategy
            // Take ALL unmastered words (User requested to review all mistakes)
            const selectedIds = new Set(unmasteredIds);

            // Take 20% of mastered words, but at least 5 (if available)
            const masteredCount = masteredIdsList.length;
            let takeMastered = Math.max(5, Math.ceil(masteredCount * 0.2));

            // Randomize mastered list
            const shuffledMastered = masteredIdsList.sort(() => Math.random() - 0.5);

            // Add the initial batch of mastered
            for (let i = 0; i < Math.min(takeMastered, masteredCount); i++) {
                selectedIds.add(shuffledMastered[i]);
            }

            // 4. Ensure Minimum Session Size (e.g. 10)
            // If we have fewer than 10 words total, fill up with more mastered words if possible
            const MIN_SESSION_SIZE = 10;
            if (selectedIds.size < MIN_SESSION_SIZE && masteredCount > 0) {
                // Try to add more from shuffledMastered that aren't already in selectedIds
                for (const id of shuffledMastered) {
                    if (selectedIds.size >= MIN_SESSION_SIZE) break;
                    selectedIds.add(id);
                }
            }

            // Convert to array and shuffle final result
            const finalIds = Array.from(selectedIds).sort(() => Math.random() - 0.5);

            // Fetch words
            const words = await prisma.word.findMany({
                where: { id: { in: finalIds } }
            });

            // Preserve order of finalIds is tricky with `in` clause, but generateQuestions shuffles options anyway.
            // We want the queue to be the shuffled list.
            // Map words back to ordered list.
            const wordMap = new Map(words.map(w => [w.id, w]));
            const orderedWords = finalIds.map(id => wordMap.get(id)).filter(w => w !== undefined);

            questions = await generateQuestions(orderedWords);

        } else if (mode === '3') { // Random
            const limit = parseInt(params.limit) || 20;
            description = 'Random Practice';
            const words = await prisma.$queryRaw<any[]>`SELECT * FROM "Word" ORDER BY RANDOM() LIMIT ${limit}`;
            questions = await generateQuestions(words);

        } else if (mode === '5' || mode === '6') { // Select Words (or old logic)
            const ids = params.ids; // comma separated string?
            description = 'Selected Words';

            if (ids) {
                const idArray = ids.split(',').map((id: string) => parseInt(id)).filter((n: number) => !isNaN(n));
                if (idArray.length > 0) {
                    const words = await prisma.word.findMany({
                        where: { id: { in: idArray } }
                    });
                    questions = await generateQuestions(words);
                }
            }
        }

        if (questions.length === 0) {
            return NextResponse.json({ error: 'No questions generated', questions: [] });
        }

        // Create Task
        const task = await prisma.task.create({
            data: {
                mode,
                description,
                totalCount: questions.length,
                content: JSON.stringify(questions),
                progress: JSON.stringify({ masteredIds: [] }),
            }
        });

        return NextResponse.json({ task });

    } catch (error) {
        console.error('Error creating task:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
        // Return all tasks or recent? For now let's require date or return recent 20
        const tasks = await prisma.task.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return NextResponse.json({ tasks });
    }

    const startOfDay = new Date(dateStr); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr); endOfDay.setHours(23, 59, 59, 999);

    const tasks = await prisma.task.findMany({
        where: {
            createdAt: {
                gte: startOfDay,
                lte: endOfDay
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ tasks });
}

// Helper to generate questions with options
async function generateQuestions(words: any[]) {
    return await Promise.all(words.map(async (word) => {
        const distractors = await prisma.$queryRaw<Array<{ meaning: String }>>`
            SELECT meaning FROM "Word" 
            WHERE id != ${word.id} 
            ORDER BY RANDOM() 
            LIMIT 3
        `;

        const options = [
            { label: 'Correct', value: word.meaning, isCorrect: true },
            ...distractors.map(d => ({ label: 'Option', value: d.meaning, isCorrect: false }))
        ];

        // Shuffle options and return
        const shuffledOptions = options.sort(() => Math.random() - 0.5);
        return {
            word: {
                id: word.id,
                spelling: word.spelling,
                orderIndex: word.orderIndex,
                phonetic: word.phonetic,
                grammar: word.grammar,
                example: word.example
            },
            options: shuffledOptions.map(o => ({ meaning: o.value, isCorrect: o.isCorrect }))
        };
    }));
}
