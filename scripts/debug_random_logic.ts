
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    const userId = users[0]?.id || 1;
    console.log(`Debug Logic for User ID: ${userId}`);

    // CONFIG
    const TOTAL_COUNT = 50;
    const OLD_WORDS_TARGET = 25;
    const activeWordBookId = 1; // Assuming 1

    // 2. Fetch History (Last 7 Sessions)
    const lastTasks = await prisma.task.findMany({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' },
        take: 7
    });

    console.log(`Found ${lastTasks.length} recent tasks`);

    // 3. Extract Candidate Old Word IDs
    const seenWordIds = new Set<number>();
    for (const t of lastTasks) {
        try {
            const content = JSON.parse(t.content);
            if (Array.isArray(content)) {
                content.forEach((q: any) => {
                    if (q.word && q.word.id) seenWordIds.add(q.word.id);
                });
            }
        } catch (e) {
        }
    }

    const candidateOldIds = Array.from(seenWordIds);
    console.log(`Candidate Old IDs (unique): ${candidateOldIds.length}`);
    if (candidateOldIds.length > 0) {
        console.log(`Sample candidates: ${candidateOldIds.slice(0, 5).join(', ')}`);
    }

    // 4. Select Old Words
    let selectedOldIds: number[] = [];

    if (candidateOldIds.length > 0) {
        // Fetch progress
        const progressList = await prisma.userProgress.findMany({
            where: {
                userId: userId,
                wordId: { in: candidateOldIds }
            }
        });
        console.log(`Found progress records: ${progressList.length}`);

        const progressMap = new Map();
        progressList.forEach(p => progressMap.set(p.wordId, p));

        const errorIds: number[] = [];
        const unfamiliarIds: number[] = [];
        const correctIds: number[] = [];

        candidateOldIds.forEach(id => {
            const p = progressMap.get(id);
            if (!p) {
                correctIds.push(id);
            } else {
                if (p.consecutiveCorrect === 0) {
                    errorIds.push(id);
                } else if (p.isUnfamiliar) {
                    unfamiliarIds.push(id);
                } else {
                    correctIds.push(id);
                }
            }
        });

        console.log(`Categorization: Error=${errorIds.length}, Unfamiliar=${unfamiliarIds.length}, Correct=${correctIds.length}`);

        const oldTarget = Math.min(candidateOldIds.length, OLD_WORDS_TARGET);

        if (candidateOldIds.length <= OLD_WORDS_TARGET) {
            selectedOldIds = candidateOldIds;
            console.log('Taking all candidates.');
        } else {
            console.log('Doing weighted selection...');
            const weightedPool: number[] = [];
            const W_ERROR = 5;
            const W_UNFAMILIAR = 3;
            const W_CORRECT = 2;

            errorIds.forEach(id => { for (let i = 0; i < W_ERROR; i++) weightedPool.push(id); });
            unfamiliarIds.forEach(id => { for (let i = 0; i < W_UNFAMILIAR; i++) weightedPool.push(id); });
            correctIds.forEach(id => { for (let i = 0; i < W_CORRECT; i++) weightedPool.push(id); });

            const selectedSet = new Set<number>();
            const shuffledPool = weightedPool.sort(() => Math.random() - 0.5);

            for (const id of shuffledPool) {
                if (selectedSet.size >= oldTarget) break;
                selectedSet.add(id);
            }
            // Fill if needed
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

    console.log(`Selected Old IDs count: ${selectedOldIds.length}`);

    // 5. New Words
    const neededTotal = TOTAL_COUNT;
    const neededNew = Math.max(0, neededTotal - selectedOldIds.length);
    console.log(`Need new words: ${neededNew}`);

    let selectedNewWords: any[] = [];
    if (neededNew > 0) {
        if (selectedOldIds.length > 0) {
            console.log(`Querying new words excluding ${selectedOldIds.length} IDs...`);
            // Simulate query
            const query = `SELECT id, spelling FROM "Word" WHERE wordBookId = ${activeWordBookId} AND id NOT IN (${selectedOldIds.join(',')}) ORDER BY RANDOM() LIMIT ${neededNew}`;
            console.log(`Query preview: ${query.substring(0, 100)}...`);

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

    console.log(`Selected New Words count: ${selectedNewWords.length}`);

    // Final
    console.log(`Final Total: ${selectedOldIds.length + selectedNewWords.length}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
