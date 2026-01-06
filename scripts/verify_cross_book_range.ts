
import prisma from '@/lib/prisma';

async function main() {
    const book1Id = 1;
    const book2Id = 3; // GPT-8000

    // 1. Find overlapping words
    // Fetch all spellings from Book 1
    const words1 = await prisma.word.findMany({
        where: { wordBookId: book1Id },
        select: { spelling: true, orderIndex: true }
    });
    const map1 = new Map(words1.map(w => [w.spelling, w.orderIndex]));

    // Fetch all spellings from Book 2
    const words2 = await prisma.word.findMany({
        where: { wordBookId: book2Id },
        select: { spelling: true, orderIndex: true }
    });
    const map2 = new Map(words2.map(w => [w.spelling, w.orderIndex]));

    // Find intersection
    const intersection = words1.filter(w => map2.has(w.spelling));
    console.log(`Found ${intersection.length} overlapping words.`);

    // 2. Find pairs with large discrepancy
    // We want a pair (A, B) where distance in Book 2 is SMALL (e.g. < 50) and distance in Book 1 is LARGE (e.g. > 500).
    // This simulates the user seeing them close in Book 2 (context) but getting massive result in Book 1 (active).

    // Optimization: We can't check all pairs (N^2).
    // Let's just pick word A, and look at its neighbors in Book 2.
    let discrepancyCount = 0;

    for (const wordA of intersection) {
        const idx2_A = map2.get(wordA.spelling)!;

        // Look at words close to A in Book 2 (e.g. next 10 words)
        // We need to reverse map idx2 -> word to find neighbors efficiently?
        // Let's just iterate words2 linearly? No.
        // Let's make an array sorted by index for Book 2.
    }
}

async function efficientCheck() {
    const book1Id = 1;
    const book2Id = 3;

    const words1 = await prisma.word.findMany({
        where: { wordBookId: book1Id },
        orderBy: { orderIndex: 'asc' },
        select: { spelling: true, orderIndex: true }
    });
    const map1 = new Map(words1.map(w => [w.spelling, w.orderIndex]));

    const words2 = await prisma.word.findMany({
        where: { wordBookId: book2Id },
        orderBy: { orderIndex: 'asc' },
        select: { spelling: true, orderIndex: true }
    });

    // Check adjacent pairs in Book 2
    for (let i = 0; i < words2.length - 1; i++) {
        const wA = words2[i];
        const wB = words2[i + 1]; // Adjacent in Book 2
        // Or check a small window
        for (let j = 1; j <= 5; j++) {
            if (i + j >= words2.length) break;
            const target = words2[i + j];

            if (map1.has(wA.spelling) && map1.has(target.spelling)) {
                const idx1_A = map1.get(wA.spelling)!;
                const idx1_B = map1.get(target.spelling)!;

                const dist1 = Math.abs(idx1_A - idx1_B);

                // In Book 2, distance is j (small).
                // If dist1 is larger than say 100, we found a candidate.
                if (dist1 > 500) {
                    console.log(`Discrepancy Found!`);
                    console.log(`Words: "${wA.spelling}" and "${target.spelling}"`);
                    console.log(`Book 2 (GPT-8000) Distance: ${j} (Indices ${wA.orderIndex} -> ${target.orderIndex})`);
                    console.log(`Book 1 (HS Words) Distance: ${dist1} (Indices ${idx1_A} -> ${idx1_B})`);
                    return; // Found one example
                }
            }
        }
    }
    console.log("No significant discrepancies found.");
}

efficientCheck()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
