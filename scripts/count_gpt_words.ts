
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.word.count({
        where: {
            wordBook: {
                name: 'GPT-8000 Words'
            }
        }
    });
    console.log(`Total words in GPT-8000 Words: ${count}`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
