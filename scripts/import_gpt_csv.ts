
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Import for words.csv to "GPT-8000 Words"...');

    // 1. Ensure WordBook "GPT-8000 Words" exists (fix typo from GTP8000 if necessary)
    const wordBookName = 'GPT-8000 Words';
    let wordBook = await prisma.wordBook.findFirst({
        where: { name: wordBookName }
    });

    if (!wordBook) {
        // Check for typo version
        const typoBook = await prisma.wordBook.findFirst({ where: { name: 'GTP8000 Words' } });
        if (typoBook) {
            console.log('Renaming "GTP8000 Words" to "GPT-8000 Words"...');
            wordBook = await prisma.wordBook.update({
                where: { id: typoBook.id },
                data: { name: wordBookName }
            });
        } else {
            console.log(`Creating new wordbook: ${wordBookName}`);
            wordBook = await prisma.wordBook.create({
                data: { name: wordBookName }
            });
        }
    }

    // 2. Read words.csv
    const filePath = path.join(process.cwd(), 'words.csv');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    const batchSize = 500;
    const words: any[] = [];

    // Regex to handle CSV lines: word,"definition"
    // Or sometimes simple: word,definition
    // A simple regex might not cover all CSV edge cases but let's try assuming standard structure from what we saw.
    // Line example:
    // a,"n. 字母A；第一流的；学业成绩达最高标准的评价符号"
    // abbr. 安（ampere）" -> Wait, line 2 in view_file seems weirdly formatted or it serves as continuation?
    // view_file output:
    // 1: a,"n. 字母A；第一流的；学业成绩达最高标准的评价符号
    // 2: abbr. 安（ampere）"
    // It seems multiline record? Or just broken CSV viewing?
    // Actually, it looks like `a` has a description start with `"` but where does it close?
    // Line 3: abandon,"n. 放任；狂热
    // Line 4: vt. 遗弃；放弃"

    // It seems the CSV has multiline values enclosed in quotes.
    // Simple line-by-line regex won't work if newlines are embedded in value.
    // We need a proper CSV parser or a custom state machine.
    // Since we don't want to install extra deps, we can try to use a simple state machine.

    let currentWord = '';
    let currentDef = '';
    let inQuotes = false;

    // Quick helper to commit a word
    const commitWord = async () => {
        if (currentWord && currentDef) {
            // Check if exists to avoid dupes?
            // "words_new.csv" data might overlap?
            // "High School Words" has "a", "abandon" etc.
            // If "GPT-8000" is also having them, we duplicate?
            // Wordbooks are separate, but `Word` model links to ONE wordbook: `wordBookId Int?`.
            // If we have same spelling, do we create a new row?
            // Schema: spelling String (not unique)
            // So we can have multiple "abandon" words, one for each book?
            // YES.

            words.push({
                spelling: currentWord.trim(),
                meaning: currentDef.trim(),
                wordBookId: wordBook!.id,
                orderIndex: count++,
                // Fill other obligatories with empty or defaults
                phonetic: '',
                grammar: '',
                example: ''
            });
        }
        currentWord = '';
        currentDef = '';
    }

    for await (const line of rl) {
        // Manual CSV parsing logic suitable for multi-line quotes
        // Format roughly: word,"meaning..."

        if (!inQuotes) {
            // Expecting start of new record
            const commaIndex = line.indexOf(',');
            if (commaIndex === -1) {
                // Garbage or empty
                continue;
            }

            // Check if it's a valid word line
            const potentialWord = line.substring(0, commaIndex);
            // Heuristic: word shouldn't be too long or contain weird chars? 
            // The file seems consistent.

            let remainder = line.substring(commaIndex + 1);

            // Start of meaning
            currentWord = potentialWord;

            if (remainder.trim().startsWith('"')) {
                inQuotes = true;
                // Remove first quote
                const firstQuoteObj = remainder.indexOf('"');
                remainder = remainder.substring(firstQuoteObj + 1);
            }

            currentDef += remainder;
        } else {
            // inside quotes, append line
            currentDef += '\n' + line;
        }

        if (inQuotes) {
            // Check if closing quote exists
            // Be careful of escaped quotes `""`? Assuming simple CSV.
            if (currentDef.trim().endsWith('"')) {
                inQuotes = false;
                // remove last quote
                const lastQuote = currentDef.lastIndexOf('"');
                if (lastQuote !== -1) {
                    currentDef = currentDef.substring(0, lastQuote);
                }
                await commitWord();
            }
        } else {
            // If not in quotes, it was a single line entry
            await commitWord();
        }

        if (words.length >= batchSize) {
            await prisma.word.createMany({ data: words });
            process.stdout.write(`\rImported ${count} words...`);
            words.length = 0;
        }
    }

    if (words.length > 0) {
        await prisma.word.createMany({ data: words });
        console.log(`\rImported final batch. Total: ${count}`);
    }

    console.log('Done.');
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
