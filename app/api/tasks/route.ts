import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
        let activeWordBookId = parseInt(cookieStore.get('active_wordbook_id')?.value || '1');

        if (params.wordBookId) {
            const parsedId = parseInt(params.wordBookId);
            if (!isNaN(parsedId)) {
                activeWordBookId = parsedId;
            }
        }


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
            // from/to are expected to be spellings now for Mode 1
            let startSpelling = from;
            let endSpelling = to;
            const limitNum = parseInt(limit) || 50;

            // In case frontend still sends some ID or index (unlikely but safe to check), 
            // the validation logic returns spellings, so we should be good.
            // If they are missing, we can't proceed well without them.

            description = `Range Learning: ${startSpelling}-${endSpelling}`;

            if (!startSpelling || !endSpelling) {
                return NextResponse.json({ error: `Invalid range parameters` }, { status: 400 });
            }

            const words = await prisma.word.findMany({
                where: {
                    wordBookId: activeWordBookId,
                    spelling: {
                        gte: startSpelling,
                        lte: endSpelling
                    }
                },
                orderBy: { spelling: 'asc' },
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
            // 1. Configuration
            const TOTAL_COUNT = 50;
            const OLD_WORDS_TARGET = 25;
            // Allow override via params for testing, but default to 50
            const limit = params.limit ? parseInt(params.limit) : TOTAL_COUNT;

            description = 'Random Practice';

            // 2. Fetch History (Last 7 Sessions)
            // We consider 'Task' creation as a session.
            const lastTasks = await prisma.task.findMany({
                where: { userId: userId },
                orderBy: { createdAt: 'desc' },
                take: 7
            });

            // 3. Extract Candidate Old Word IDs
            const seenWordIds = new Set<number>();
            for (const t of lastTasks) {
                try {
                    const content = JSON.parse(t.content);
                    if (Array.isArray(content)) {
                        content.forEach((q: any) => {
                            // Assuming content structure matches generateQuestions output: { word: { id, ... }, ... }
                            if (q.word && q.word.id) seenWordIds.add(q.word.id);
                        });
                    }
                } catch (e) {
                    // Ignore parsing errors for old/bad data
                }
            }

            const candidateOldIds = Array.from(seenWordIds);

            // 4. Select Old Words
            let selectedOldIds: number[] = [];

            if (candidateOldIds.length > 0) {
                // Fetch progress to determine weights
                const progressList = await prisma.userProgress.findMany({
                    where: {
                        userId: userId,
                        wordId: { in: candidateOldIds }
                    }
                });

                const progressMap = new Map();
                progressList.forEach(p => progressMap.set(p.wordId, p));

                // Categorize
                const errorIds: number[] = [];
                const unfamiliarIds: number[] = [];
                const correctIds: number[] = [];

                candidateOldIds.forEach(id => {
                    const p = progressMap.get(id);
                    if (!p) {
                        // If no progress record, treat as "Correct" or neutral? 
                        // Maybe "Unfamiliar" to be safe, or just "Correct" if we assume they learned it?
                        // Let's treat as Correct (neutral) for now, or maybe Unfamiliar if we want to reinforce.
                        // Given the prompt "Mistake > Unfamiliar > Correct", neutral is lowest.
                        correctIds.push(id);
                    } else {
                        if (p.consecutiveCorrect === 0) { // Assuming 0 means last was wrong or new
                            errorIds.push(id);
                        } else if (p.isUnfamiliar) {
                            unfamiliarIds.push(id);
                        } else {
                            correctIds.push(id);
                        }
                    }
                });

                const oldTarget = Math.min(candidateOldIds.length, OLD_WORDS_TARGET);

                if (candidateOldIds.length <= OLD_WORDS_TARGET) {
                    // Take all
                    selectedOldIds = candidateOldIds;
                } else {
                    // Weighted Random Selection
                    // Strategy: Assign slots? Or just probability?
                    // Prompt: Error:Unfamiliar:Correct = High:Medium:Low (e.g. 5:3:2)
                    // We can create a weighted pool.

                    const weightedPool: number[] = [];
                    // Weights
                    const W_ERROR = 5;
                    const W_UNFAMILIAR = 3;
                    const W_CORRECT = 2;

                    errorIds.forEach(id => { for (let i = 0; i < W_ERROR; i++) weightedPool.push(id); });
                    unfamiliarIds.forEach(id => { for (let i = 0; i < W_UNFAMILIAR; i++) weightedPool.push(id); });
                    correctIds.forEach(id => { for (let i = 0; i < W_CORRECT; i++) weightedPool.push(id); });

                    const selectedSet = new Set<number>();

                    // Shuffle pool
                    const shuffledPool = weightedPool.sort(() => Math.random() - 0.5);

                    for (const id of shuffledPool) {
                        if (selectedSet.size >= oldTarget) break;
                        selectedSet.add(id);
                    }
                    // Fallback if pool didn't fill (unlikely unless pool is empty, but we checked length)
                    // If unique items in pool < oldTarget (shouldn't happen since candidateOldIds.length > oldTarget)

                    // To be safe, if we still need words (due to duplicates in pool selection), fill from remaining candidates
                    if (selectedSet.size < oldTarget) {
                        const remaining = candidateOldIds.filter(id => !selectedSet.has(id));
                        for (const id of remaining) {
                            if (selectedSet.size >= oldTarget) break;
                            selectedSet.add(id);
                        }
                    }

                    selectedOldIds = Array.from(selectedSet);
                }
            }

            // 5. Select New Words
            const neededTotal = limit; // Should be 50
            const neededNew = Math.max(0, neededTotal - selectedOldIds.length);
            let selectedNewWords: any[] = [];

            if (neededNew > 0) {
                // Fetch random words from WordBook that are NOT in selectedOldIds
                // Note: Prisma doesn't support "NOT IN" with random easily efficiently, 
                // but for 8000 words, fetching IDs or using raw query is okay.
                // We use raw query for speed and randomness.

                // We need to exclude the words we already picked.
                // AND we arguably should exclude ALL "Old" words? 
                // Prompt: "Take 25 old... take 25 NEW". 
                // "New" usually means "not in the old list". 
                // If I exclude all `seenWordIds`, I might run out of words if user learned a lot.
                // But generally "new" means "from the book", excluding the ones we just picked as "old".

                if (selectedOldIds.length > 0) {
                    const oldIdsList = selectedOldIds.join(',');
                    selectedNewWords = await prisma.$queryRaw<any[]>`
                        SELECT * FROM "Word" 
                        WHERE wordBookId = ${activeWordBookId} 
                        AND id NOT IN (${Prisma.join(selectedOldIds)})
                        ORDER BY RANDOM() 
                        LIMIT ${neededNew}
                    `;
                } else {
                    selectedNewWords = await prisma.$queryRaw<any[]>`
                        SELECT * FROM "Word" 
                        WHERE wordBookId = ${activeWordBookId} 
                        ORDER BY RANDOM() 
                        LIMIT ${neededNew}
                    `;
                }
            }

            // 6. Combine
            let finalWords: any[] = [];

            // Fetch objects for old words
            if (selectedOldIds.length > 0) {
                const oldWords = await prisma.word.findMany({
                    where: { id: { in: selectedOldIds } }
                });
                finalWords = [...oldWords];
            }

            finalWords = [...finalWords, ...selectedNewWords];

            // Shuffle final result
            finalWords = finalWords.sort(() => Math.random() - 0.5);

            questions = await generateQuestions(finalWords, activeWordBookId, displayMode);


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
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2003') {
                // Quietly handle User Not Found (likely stale token)
                return NextResponse.json({ error: 'User not found. Please log in again.' }, { status: 401 });
            }
        }
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
