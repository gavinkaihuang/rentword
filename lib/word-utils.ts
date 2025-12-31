
export function formatWordForTask(word: any, displayMode: number = 1) {
    // DEBUG: Log the word content being processed
    if (word.spelling === 'about' || Math.random() < 0.05) { // Limit noise, ensure 'about' is caught
        console.log(`[Backend Debug] Formatting word: ${word.spelling}`);
        console.log(`- Roots: ${word.roots ? 'Present' : 'Missing'}`);
        // ...
    }

    return {
        id: word.id,
        spelling: word.spelling,
        meaning: word.meaning,
        phonetic: word.phonetic,
        grammar: word.grammar,
        example: word.example,

        // Rich content fields
        roots: word.roots || null,
        affixes: word.affixes || null,
        history: word.history || null,
        variations: word.variations || null,
        mnemonic: word.mnemonic || null,
        story: word.story || null,

        orderIndex: word.orderIndex,
        wordBookId: word.wordBookId, // Keep for legacy checks if needed
        displayMode: displayMode // Add display mode
    };
}
