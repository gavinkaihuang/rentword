
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';

const prisma = new PrismaClient();

async function main() {
    const filePath = '/Users/gminihome/Documents/gptwords.json';

    // 1. Create or Find WordBook
    const wordBookName = 'GPT-8000 Words';
    let wordBook = await prisma.wordBook.findFirst({
        where: { name: wordBookName }
    });

    if (!wordBook) {
        console.log(`Creating WordBook: ${wordBookName}...`);
        wordBook = await prisma.wordBook.create({
            data: { name: wordBookName }
        });
    } else {
        console.log(`WordBook ${wordBookName} already exists. ID: ${wordBook.id}`);
        // Optional: Delete existing words to avoid duplicates?
        // For safety, let's keep adding, or maybe user wants a fresh start.
        // Assuming append or fresh run.
    }

    const wordBookId = wordBook.id;

    console.log('Reading file...');
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const wordsToInsert: any[] = [];
    let index = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;

        try {
            const item = JSON.parse(line);

            // Extract Meaning
            let meaning = 'See details';
            // Try to match "**分析词义：** ... \n" or similar
            const meaningMatch = item.content.match(/\*\*分析词义：\*\*\s*(.+?)(\n|$)/);
            if (meaningMatch && meaningMatch[1]) {
                meaning = meaningMatch[1].trim();
                // Truncate if too long (though String usually fits)
                if (meaning.length > 200) meaning = meaning.substring(0, 197) + '...';
            } else {
                // Fallback: strip markdown and take first chars
                const cleanText = item.content.replace(/\*\*/g, '').replace(/###/g, '');
                meaning = cleanText.substring(0, 50).replace(/\n/g, ' ') + '...';
            }

            wordsToInsert.push({
                spelling: item.word,
                meaning: meaning,
                content: item.content,
                orderIndex: index++,
                wordBookId: wordBookId,
                phonetic: '', // Not in JSON explicitly, maybe extract? Unnecessary complexity for now.
                grammar: '',
                example: '' // Examples are in content
            });

            if (wordsToInsert.length >= 500) {
                await prisma.word.createMany({ data: wordsToInsert });
                console.log(`Inserted ${index} words...`);
                wordsToInsert.length = 0;
            }

        } catch (e) {
            console.error('Failed to parse line:', line.substring(0, 50), e);
        }
    }

    if (wordsToInsert.length > 0) {
        await prisma.word.createMany({ data: wordsToInsert });
        console.log(`Inserted final batch. Total: ${index} words.`);
    }

    console.log('Import complete!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
