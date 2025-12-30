
export function formatWordForTask(word: any) {
    // DEBUG: Log the word content being processed
    if (word.spelling === 'about' || Math.random() < 0.05) { // Limit noise, ensure 'about' is caught
        console.log(`[Backend Debug] Formatting word: ${word.spelling}`);
        console.log(`- Roots: ${word.roots ? 'Present' : 'Missing'}`);
        console.log(`- Affixes: ${word.affixes ? 'Present' : 'Missing'}`);
        console.log(`- History: ${word.history ? 'Present' : 'Missing'}`);
        console.log(`- Example: ${word.example ? 'Present' : 'Missing'}`);
        console.log('--- Full Object ---');
        console.log(JSON.stringify(word, null, 2));
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
        wordBookId: word.wordBookId // Pass book ID for UI styling
    };
}
