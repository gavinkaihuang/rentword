
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find 'about' in GPT-8000 Words (Book ID 3)
    const word = await prisma.word.findFirst({
        where: {
            spelling: 'about',
            wordBookId: 3
        }
    });

    if (!word) {
        console.log("Word 'about' not found in Book 3.");
        return;
    }

    console.log("Found Word:", word.spelling);
    console.log("--------------------------------");
    console.log("Raw Content Length:", word.content?.length);
    console.log("Roots:", word.roots);
    console.log("Affixes:", word.affixes);
    console.log("History:", word.history);
    console.log("Variations:", word.variations);
    console.log("Mnemonic:", word.mnemonic);
    console.log("Story:", word.story);
    console.log("--------------------------------");
    console.log("RAW CONTENT START:");
    console.log(word.content?.substring(0, 500)); // Show first 500 chars to check format
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
