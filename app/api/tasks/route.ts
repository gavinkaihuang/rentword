import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { formatWordForTask } from '@/lib/word-utils';

export async function POST(request: Request) {
    try {
        const userIdHeader = request.headers.get('x-user-id');
        if (!userIdHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = parseInt(userIdHeader);

        const body = await request.json();
        const { mode, ...params } = body;

        const cookieStore = await cookies();
        const activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');


        // Fetch active WordBook details for displayMode
        const activeWordBook = await prisma.wordBook.findUnique({
            where: { id: activeWordBookId }
        });
        const displayMode = activeWordBook?.displayMode || 1;

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
                const startWord = await prisma.word.findFirst({ where: { spelling: from, wordBookId: activeWordBookId } });
                if (startWord) fromNum = startWord.orderIndex;
            }
            if (isNaN(toNum)) {
                const endWord = await prisma.word.findFirst({ where: { spelling: to, wordBookId: activeWordBookId } });
                if (endWord) toNum = endWord.orderIndex;
            }

            description = `Range Learning: ${from}-${to}`;

            if (isNaN(fromNum) || isNaN(toNum)) {
                return NextResponse.json({ error: `Invalid range parameters: ${from}, ${to} could not be resolved` }, { status: 400 });
            }

            const words = await prisma.word.findMany({
                where: {
                    wordBookId: activeWordBookId,
                    orderIndex: {
                        gte: fromNum,
                        lte: toNum
                    }
                },
                take: limitNum
            });

            questions = await generateQuestions(words, activeWordBookId, displayMode);

        } else if (mode === '4') { // Daily Review
            const { date } = params;
            description = `Daily Review: ${date}`;

            if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

            const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

            const logs = await prisma.reviewLog.findMany({
                where: {
                    createdAt: { gte: startOfDay, lte: endOfDay },
                    userId: userId
                },
                select: { wordId: true },
                distinct: ['wordId']
            });

            if (logs.length > 0) {
                const wordIds = logs.map(l => l.wordId);
                const words = await prisma.word.findMany({ where: { id: { in: wordIds }, wordBookId: activeWordBookId } });
                questions = await generateQuestions(words, activeWordBookId, displayMode);
            }
        } else if (mode === '2') { // Smart Review
            // TODO: Real review logic based on UserProgress
            // For now, let's just pick 20 random words to prevent crash
            description = 'Smart Review';
            const words = await prisma.word.findMany({
                where: { wordBookId: activeWordBookId },
                take: 20,
                orderBy: { id: 'asc' }
            });
            questions = await generateQuestions(words, activeWordBookId, displayMode);

        } else if (mode === '7') { // Smart Mistake Review
            description = 'Smart Mistake Review';

            // 1. Get all words with error history FOR THIS USER
            const errorLogs = await prisma.reviewLog.findMany({
                where: { isCorrect: false, userId: userId },
                select: { wordId: true },
                distinct: ['wordId']
            });

            if (errorLogs.length === 0) {
                return NextResponse.json({ error: 'No mistakes found to review!', questions: [] });
            }

            const candidateIds = errorLogs.map(l => l.wordId);

            // 2. Check progress FOR THIS USER
            const progressList = await prisma.userProgress.findMany({
                where: {
                    wordId: { in: candidateIds },
                    userId: userId
                }
            });
            const progressMap = new Map();
            progressList.forEach(p => progressMap.set(p.wordId, p));

            const unmasteredIds: number[] = [];
            const masteredIdsList: number[] = [];

            candidateIds.forEach(id => {
                const p = progressMap.get(id);
                const consecutive = p?.consecutiveCorrect || 0;
                if (consecutive === 0) {
                    unmasteredIds.push(id);
                } else {
                    masteredIdsList.push(id);
                }
            });

            // 3. Selection Strategy
            const selectedIds = new Set(unmasteredIds);
            const masteredCount = masteredIdsList.length;
            let takeMastered = Math.max(5, Math.ceil(masteredCount * 0.2));
            const shuffledMastered = masteredIdsList.sort(() => Math.random() - 0.5);

            for (let i = 0; i < Math.min(takeMastered, masteredCount); i++) {
                selectedIds.add(shuffledMastered[i]);
            }

            const MIN_SESSION_SIZE = 10;
            if (selectedIds.size < MIN_SESSION_SIZE && masteredCount > 0) {
                for (const id of shuffledMastered) {
                    if (selectedIds.size >= MIN_SESSION_SIZE) break;
                    selectedIds.add(id);
                }
            }

            const finalIds = Array.from(selectedIds).sort(() => Math.random() - 0.5);

            const words = await prisma.word.findMany({
                where: { id: { in: finalIds } }
            });

            const wordMap = new Map(words.map(w => [w.id, w]));
            const orderedWords = finalIds.map(id => wordMap.get(id)).filter(w => w !== undefined);
            const filteredOrderedWords = orderedWords.filter(w => w.wordBookId === activeWordBookId);

            questions = await generateQuestions(filteredOrderedWords, activeWordBookId, displayMode);

        } else if (mode === '3') { // Random
            const limit = parseInt(params.limit) || 20;
            description = 'Random Practice';
            // Random query with Prisma + SQLite
            const words = await prisma.$queryRaw<any[]>`SELECT * FROM "Word" WHERE wordBookId = ${activeWordBookId} ORDER BY RANDOM() LIMIT ${limit}`;
            questions = await generateQuestions(words, activeWordBookId, displayMode);

        } else if (mode === '5' || mode === '6') { // Select Words (or old logic)
            const ids = params.ids; // comma separated string?
            description = 'Selected Words';

            if (ids) {
                const idArray = ids.split(',').map((id: string) => parseInt(id)).filter((n: number) => !isNaN(n));
                if (idArray.length > 0) {
                    const words = await prisma.word.findMany({
                        where: { id: { in: idArray }, wordBookId: activeWordBookId }
                    });
                    questions = await generateQuestions(words, activeWordBookId, displayMode);
                }
            }

        } else if (mode === '8') { // Unfamiliar Words
            description = 'Unfamiliar Words';

            // 1. Find all unfamiliar words for this user
            const unfamiliarProgress = await prisma.userProgress.findMany({
                where: {
                    userId: userId,
                    isUnfamiliar: true
                },
                select: { wordId: true }
            });

            if (unfamiliarProgress.length === 0) {
                return NextResponse.json({ error: 'No unfamiliar words found!', questions: [] });
            }

            const wordIds = unfamiliarProgress.map(p => p.wordId);

            // 2. Fetch words
            const words = await prisma.word.findMany({
                where: {
                    id: { in: wordIds },
                    wordBookId: activeWordBookId
                },
                orderBy: { spelling: 'asc' } // Or timestamp if available? Spelling is fine.
            });

            // 3. Generate questions (shuffle words first)
            const shuffledWords = words.sort(() => Math.random() - 0.5);
            questions = await generateQuestions(shuffledWords, activeWordBookId, displayMode);
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
                userId: userId
            }
        });

        return NextResponse.json({ task });

    } catch (error) {
        console.error('Error creating task:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const userIdHeader = request.headers.get('x-user-id');
    if (!userIdHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = parseInt(userIdHeader);

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
        const tasks = await prisma.task.findMany({
            where: { userId: userId },
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
            },
            userId: userId
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ tasks });
}

// Helper to escape regex special characters
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to sanitize meaning by masking the spelling
function sanitizeMeaning(meaning: string, spelling: string) {
    if (!meaning || !spelling) return meaning;
    try {
        const escapedSpelling = escapeRegExp(spelling);
        const startBoundary = /^\w/.test(spelling) ? '\\b' : '';
        const endBoundary = /\w$/.test(spelling) ? '\\b' : '';
        const regex = new RegExp(`${startBoundary}${escapedSpelling}${endBoundary}`, 'gi');
        return meaning.replace(regex, '____');
    } catch (e) {
        return meaning;
    }
}

// Helper to generate questions with options
async function generateQuestions(words: any[], activeWordBookId: number, displayMode: number = 1) {
    return await Promise.all(words.map(async (word) => {
        const distractors = await prisma.$queryRaw<Array<{ meaning: String, spelling: String }>>`
            SELECT meaning, spelling FROM "Word" 
            WHERE id != ${word.id} AND wordBookId = ${activeWordBookId}
            ORDER BY RANDOM() 
            LIMIT 3
        `;

        const options = [
            {
                label: 'Correct',
                value: sanitizeMeaning(word.meaning, word.spelling),
                isCorrect: true
            },
            ...distractors.map(d => ({
                label: 'Option',
                value: sanitizeMeaning(d.meaning as string, d.spelling as string),
                isCorrect: false
            }))
        ];

        const shuffledOptions = options.sort(() => Math.random() - 0.5);
        return {
            word: formatWordForTask(word, displayMode),
            options: shuffledOptions.map(o => ({ meaning: o.value, isCorrect: o.isCorrect }))
        };
    }));
}
