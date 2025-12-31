
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';

const prisma = new PrismaClient();

async function main() {
    const filePath = './gptwords.json';

    // 1. Create or Find WordBook
    const wordBookName = 'GPT-8000 Words';
    let wordBook = await prisma.wordBook.findFirst({
        where: { name: wordBookName }
    });

    if (!wordBook) {
        console.log(`Creating WordBook: ${wordBookName}...`);
        wordBook = await prisma.wordBook.create({
            data: {
                name: wordBookName,
                displayMode: 2 // Ensure it is set to Rich Mode
            }
        });
    } else {
        console.log(`WordBook ${wordBookName} already exists. ID: ${wordBook.id}`);
        // Ensure displayMode is correct
        if (wordBook.displayMode !== 2) {
            await prisma.wordBook.update({
                where: { id: wordBook.id },
                data: { displayMode: 2 }
            });
            console.log('Updated displayMode to 2.');
        }
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

    // Helper to escape regex special characters for the title
    function escapeRegExp(string: string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const extractSection = (text: string, titles: string[]): string | null => {
        // Construct a regex that tries to match ANY of the possible titles.
        // We want to handle:
        // 1. Optional Start Markers: ###, ##, ** or NOTHING.
        // 2. Title (from list)
        // 3. Optional End Markers: **, : , ：
        // 4. Content until next section start.

        // Join titles with |
        const titlePattern = titles.map(t => escapeRegExp(t)).join('|');

        // Regex components:
        // (^|\n)\s*                     -> Start of string or Newline + whitespace
        // (?:(?:#{2,3}|\*\*)\s*)?       -> OPTIONAL Markdown markers (###, ##, **)
        // (${titlePattern})             -> One of the titles
        // (?:\*\*|[:：])?               -> Optional trailing ** or colon
        // \s*                           -> Consume whitespace/newlines after header
        // ([\s\S]+?)                    -> Lazy match content
        // (?=                           -> Lookahead for next section or end
        //   \n\s*(?:(?:#{2,3}|\*\*)\s*)?  -> Newline + potential next header start
        //   (?:${titlePattern})           -> Followed by a known title? (Actually hard to know all titles here, but we can look for markers)
        //   | $
        // )

        // The lookahead for "next section" is tricky because "down" has NO markers. 
        // "down" sections look like: 
        // 分析词义：...
        // 列举例句：...
        // So the next section starts with "Title：".

        // We can define "Next Section" as:
        // Newline + (Marker + Any Text) OR (Any Text + Colon/ChineseColon)
        // Or simpler: Just look for the SPECIFIC known titles we know exist?
        // But headers can be anything. 

        // Let's try to match specifically the Current Title block.
        // And stop at anything that LOOKS like a header.
        // A header looks like:
        // 1. (### or ## or **) + Text
        // 2. Text + (: or ：) -> But "Text" must be one of our known fields ideally? 
        //    "down" has "分析词义：", "词根分析：" etc.
        //    So stopping at "Known Title" is safest.

        // Let's just use a simpler greedy approach or splitting? 
        // No, regex is fine if we define the start well.

        // Improved Regex to handle:
        // 1. Headers depth 2-4 (##, ###, ####)
        // 2. Numbered titles (e.g. **1. Analysis**, 1. Analysis)
        // 3. Flexible markers including italics (e.g. _**Title**_)

        // titlePattern matches the pure text titles (e.g. "分析词义").
        // We need to allow optional numbering before it.
        // Numbering pattern: \d+(?:\\?\.?|、)?\s*
        // Note: The dot might be escaped in some JSON strings as "1\\." so we need to match optional backslash.
        // Also support circled numbers ① - ⑩ (unicode range approximately \u2460-\u2469)

        // Regex logic update for mixed Number/Marker order.
        // Cases:
        // 1. **1. Title** -> Marker (**), Number (1.), Title
        // 2. 1. **Title** -> Number (1.), Marker (**), Title
        // 3. ## 1. Title  -> Marker (##), Number (1.), Title

        // Current: Marker + Number + Title.
        // Need to allow: (Marker)? (Number)? (Marker)? Title.

        // Define patterns
        const markerPat = `(?:[#*_【]|\\s)+`;
        const numPat = `(?:(?:\\d+(?:\\\\?\\.|、)?|[①-⑩])\\s*)`;

        // We need a combined prefix that allows optional Marker-Number-Marker sequence.
        // Since both are optional and can be interleaved (usually just one swap), 
        // we can try: (Marker)? (Number)? (Marker)?

        const prefixPattern = `(?:(?:${markerPat})?(?:${numPat})?(?:${markerPat})?)`;

        // Let's list ALL known titles for the Lookahead.
        const allTitles = [
            '分析词义', '词义分析', 'Meaning Analysis', '词义解析',
            '列举例句', '例句', 'Example Sentences', '使用例句', '使用场景与例句', '举例', '例子', '实例分析', '例如', '使用案例', '举几个例句',
            '词根分析', 'Root Analysis',
            '词缀分析', 'Affix Analysis',
            '发展历史和文化背景', 'History and Culture', '词源及文化背景', '发展历史',
            '单词变形', 'Word Variations',
            '记忆辅助', 'Memory Aids', '小故事', 'Story'
        ].join('|');

        // Matches:
        // (?:^|\n)\s*                      (Start or Newline)
        // ${prefixPattern}                 (Flexible configuration of markers/numbers)
        // (${titlePattern})                (The Title Key)
        // (?:\*\*|[:：]|_|】)?             (Optional suffix)
        // \s+                              (Whitespace/Newline required after title)
        // ([\s\\S]+?)                       (Content)
        // (?=                              (Stop at)
        //   ... next header ...
        // )

        // Verify capture groups.
        // Group 1: Title
        // Group 2: Content

        // Added _ to suffix class: [\\*_】_]
        const strictRegex = new RegExp(`(?:^|\\n)\\s*${prefixPattern}(${titlePattern})(?:[\\*_】_]+)?[:：]?\\s*([\\s\\S]+?)(?=\\n\\s*${prefixPattern}(?:${allTitles})|\\n\\s*\\*\\s*\\*\\s*\\*|$)`, 'i');

        const match = text.match(strictRegex);
        return match && match[2] ? match[2].trim() : null;
    };

    for await (const line of rl) {
        if (!line.trim()) continue;

        try {
            const item = JSON.parse(line);
            if (!item.word) continue;

            const rawContent = item.content || '';

            // Map fields with aliases
            // Note: Since we updated the regex to handle numbering internally, we don't need to add numbered aliases.

            // Aliases Update:
            // Meaning: 分析词义, 词义分析, Meaning Analysis, 词义解析
            // Example: 列举例句, 例句, 使用例句, 使用场景与例句, 举例, 例子, 实例分析, 例如, 使用案例
            let content = extractSection(rawContent, ['分析词义', '词义分析', '词义解析']);
            const example = extractSection(rawContent, ['列举例句', '例句', '使用例句', '使用场景与例句', '举例', '例子', '实例分析', '例如', '使用案例']);

            // Fallback for Meaning (Content):
            // If content is null, some words like 'ABC' start directly with text and have no "Meaning" header, 
            // but do have subsequent headers like "例句". 
            // Strategy: If content is null, take everything from start until the first occurrence of ANY other known header.

            if (!content && rawContent) {
                // Check if rawContent has any of the known headers (except meaning headers, assuming they are missing)
                // Start searching for other headers.
                // We can use the same logic as regex lookahead.

                const otherTitles = [
                    '列举例句', '例句', 'Example Sentences', '使用例句', '使用场景与例句', '举例', '例子', '实例分析', '例如', '使用案例',
                    '词根分析', 'Root Analysis',
                    '词缀分析', 'Affix Analysis',
                    '发展历史和文化背景', 'History and Culture', '词源及文化背景', '发展历史',
                    '单词变形', 'Word Variations',
                    '记忆辅助', 'Memory Aids', '小故事', 'Story'
                ];
                // Escape and join
                const otherTitlesPattern = otherTitles.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

                // Regex to find the START of the first "Other Section"
                // Matches: 
                // \n\s*(?:markerPattern)?(?:numberedPattern)?(Title)
                // We need to match the marker/numbering too to know where to cut.

                const markerPattern = `(?:[#*_【]|\\s)+`; // Forced marker match? No, optional.
                // Re-use strict regex logic? No, just find the string.

                // Simplified regex for fallback search:
                const numberedPattern = `(?:(?:\\d+(?:\\\\?\\.|、)?|[①-⑩])\\s*)?`;

                const firstSectionRegex = new RegExp(`(?:^|\\n)\\s*(?:(?:[#*_【]|\\s)+)?${numberedPattern}(?:${otherTitlesPattern})`, 'i');
                const match = rawContent.match(firstSectionRegex);

                if (match) {
                    // Everything before the match is the Meaning
                    // match.index is where the next section starts.
                    content = rawContent.substring(0, match.index).trim();
                } else {
                    // No other sections found? 
                    // If the text is short enough, maybe it's just the definition?
                    // Or if it's "Bahmad" failure, better to leave null or take it?
                    // Let's take it if it's not empty, assuming single-paragraph definition.
                    if (rawContent.length < 1000) { // Arbitrary safety limit
                        content = rawContent.trim();
                    }
                }
            }

            const roots = extractSection(rawContent, ['词根分析']);
            const affixes = extractSection(rawContent, ['词缀分析']);
            const history = extractSection(rawContent, ['发展历史和文化背景', '词源及文化背景', '发展历史']);
            const variations = extractSection(rawContent, ['单词变形']);
            const mnemonic = extractSection(rawContent, ['记忆辅助']);
            const story = extractSection(rawContent, ['小故事']);

            // Generate meaning summary
            let meaningSummary = 'See details';

            if (content) {
                // Remove Markdown bold/formatting
                const cleanContent = content.replace(/(\*\*|__)/g, '').replace(/\n/g, ' ');
                meaningSummary = cleanContent.substring(0, 100);
                if (cleanContent.length > 100) meaningSummary += '...';
            } else if (rawContent) {
                meaningSummary = rawContent.replace(/###/g, '').replace(/\*/g, '').substring(0, 100) + '...';
            }

            wordsToInsert.push({
                spelling: item.word,
                meaning: meaningSummary,
                phonetic: '',
                grammar: '',

                content: content || null,
                example: example || null,
                roots: roots || null,
                affixes: affixes || null,
                history: history || null,
                variations: variations || null,
                mnemonic: mnemonic || null,
                story: story || null,

                orderIndex: index++,
                wordBookId: wordBookId,
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
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
