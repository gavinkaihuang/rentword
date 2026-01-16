
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Update all NULL wordBookId to 1 (High School Words)
    const result = await prisma.word.updateMany({
        where: { wordBookId: null },
        data: { wordBookId: 1 }
    });
    console.log(`Updated ${result.count} words to WordBook ID 1.`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
