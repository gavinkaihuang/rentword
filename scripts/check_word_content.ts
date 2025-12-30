
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find a word that likely has rich content (from GPT-8000 book)
    const word = await prisma.word.findFirst({
        where: {
            wordBookId: 3, // GPT-8000
            roots: { not: null } // Find one with roots
        }
    });

    if (!word) {
        console.log("No words found with 'roots' content in Book 3.");
        return;
    }

    console.log("Found Word:", word.spelling);
    console.log("--------------------------------");
    console.log("Roots:", word.roots);
    console.log("Affixes:", word.affixes);
    console.log("History:", word.history);
    console.log("Variations:", word.variations);
    console.log("Mnemonic:", word.mnemonic);
    console.log("Story:", word.story);
    console.log("--------------------------------");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
