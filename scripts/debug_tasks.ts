import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Assuming user ID 1 for now, or fetch all
    const users = await prisma.user.findMany();
    const userId = users[0]?.id || 1;
    console.log(`Checking tasks for User ID: ${userId}`);

    const lastTasks = await prisma.task.findMany({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    console.log(`Found ${lastTasks.length} tasks.`);

    const seenWordIds = new Set<number>();

    for (const t of lastTasks) {
        console.log(`Task #${t.id} [${t.mode}] ${t.description} (size: ${t.totalCount})`);
        try {
            const content = JSON.parse(t.content);
            if (Array.isArray(content)) {
                console.log(`  - Content is Array of length ${content.length}`);
                if (content.length > 0) {
                    const first = content[0];
                    console.log(`  - Sample Item keys: ${Object.keys(first).join(', ')}`);
                    if (first.word) {
                        console.log(`  - Word keys: ${Object.keys(first.word).join(', ')}`);
                        console.log(`  - Word ID: ${first.word.id}`);
                    }
                }

                content.forEach((q: any) => {
                    if (q.word && q.word.id) seenWordIds.add(q.word.id);
                });
            } else {
                console.log(`  - Content is NOT Array: ${typeof content}`);
            }
        } catch (e) {
            console.log(`  - JSON Parse Error: ${e}`);
        }
    }

    console.log(`Total Unique Old IDs found: ${seenWordIds.size}`);
    console.log(`IDs: ${Array.from(seenWordIds).join(', ')}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
