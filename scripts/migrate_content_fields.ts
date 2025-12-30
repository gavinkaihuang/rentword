
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to extract section content
function extractSection(content: string, keyVariants: string[]): string | null {
    // Escape special chars for regex
    // We want to find: (Header)(Content)(NextHeader|End)
    // Header can be `**Key:**` or `### Key` or `**Key**`

    // Construct a flexible regex part for the key
    // e.g. "分析词义" -> matches "**分析词义：**", "### 分析词义", "**分析词义**"
    // Regex: (\*\*|###\s*)Key(：|:)?(\*\*|\s*\n)

    for (const key of keyVariants) {
        // Simple iteration over variants is safer than complex regex generation
        // Variants: "分析词义", "列举例句" etc.

        // Build a regex that matches the start of the section
        // Matches:
        // 1. `**Key：**` or `**Key:**` or `**Key**`
        // 2. `### Key`
        const headerRegex = new RegExp(`(?:\\*\\*|###\\s*)${key}(?:：|:)?(?:\\*\\*)?`, 'g');

        // We find the match.
        const match = headerRegex.exec(content);
        if (!match) continue;

        const startIndex = match.index + match[0].length;

        // Find the END of this section.
        // The end is the start of the NEXT section (starts with ** or ###) OR End of string.
        // But we must be careful not to stop at bold text inside the content.
        // Usually headers are at the start of a line or preceded by \n\n.

        const remainingText = content.substring(startIndex);

        // Look for next header. A header usually looks like \n\n**...** or \n\n### ...
        // We look for the nearest match of *any* known headers?
        // Or simply regex for `\n\n(\*\*|###\s*)`? 
        // Let's rely on the specific list of known headers to be safe.
        // "分析词义", "列举例句", "词根分析", "词缀分析", "发展历史和文化背景", "单词变形", "记忆辅助", "小故事"
        // Also "例句" is sometimes used instead of "列举例句".

        const allHeaders = [
            "分析词义", "列举例句", "例句", "词根分析", "词缀分析",
            "发展历史和文化背景", "单词变形", "记忆辅助", "小故事"
        ];

        let minEndIndex = remainingText.length;

        for (const h of allHeaders) {
            // Avoid matching the current header again if it appears literally (unlikely if we just matched it)
            // Regex for next header:
            const nextHeaderRegex = new RegExp(`(?:\\n|^)(?:\\*\\*|###\\s*)${h}(?:：|:)?(?:\\*\\*)?`);
            const nextMatch = nextHeaderRegex.exec(remainingText);
            if (nextMatch) {
                // We want the start of the next match
                if (nextMatch.index < minEndIndex && nextMatch.index > 0) { // >0 to avoid immediate match if weird
                    minEndIndex = nextMatch.index;
                }
            }
        }

        let sectionContent = remainingText.substring(0, minEndIndex).trim();
        return sectionContent;
    }
    return null;
}

// Map for user fields
const fieldMappings = [
    { dbField: 'meaning', keys: ['分析词义'] },
    { dbField: 'example', keys: ['列举例句', '例句'] },
    { dbField: 'roots', keys: ['词根分析'] },
    { dbField: 'affixes', keys: ['词缀分析'] },
    { dbField: 'history', keys: ['发展历史和文化背景'] },
    { dbField: 'variations', keys: ['单词变形'] },
    { dbField: 'mnemonic', keys: ['记忆辅助'] },
    { dbField: 'story', keys: ['小故事'] }
];

async function main() {
    console.log("Starting migration...");

    // Fetch all words with content
    const words = await prisma.word.findMany({
        where: {
            content: {
                not: null
            }
        }
    });

    console.log(`Found ${words.length} words to process.`);
    let updatedCount = 0;

    for (const word of words) {
        if (!word.content) continue;

        const updateData: any = {};

        for (const mapping of fieldMappings) {
            const extracted = extractSection(word.content, mapping.keys);
            if (extracted) {
                updateData[mapping.dbField] = extracted;
            }
        }

        // Only update if we found something
        if (Object.keys(updateData).length > 0) {
            await prisma.word.update({
                where: { id: word.id },
                data: updateData
            });
            updatedCount++;
            if (updatedCount % 500 === 0) {
                console.log(`Updated ${updatedCount} words...`);
            }
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} words.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
