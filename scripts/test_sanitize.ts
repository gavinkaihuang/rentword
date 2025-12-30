
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeMeaning(meaning: string, spelling: string) {
    if (!meaning || !spelling) return meaning;
    try {
        const escapedSpelling = escapeRegExp(spelling);
        const startBoundary = /^\w/.test(spelling) ? '\\b' : '';
        const endBoundary = /\w$/.test(spelling) ? '\\b' : '';

        const regex = new RegExp(`${startBoundary}${escapedSpelling}${endBoundary}`, 'gi');
        return meaning.replace(regex, '____');
    } catch (e) {
        return meaning;
    }
}

const tests = [
    { word: "apple", text: "This is an apple.", expected: "This is an ____." },
    { word: "apple", text: "Pineapple is sweet.", expected: "Pineapple is sweet." }, // No boundary match
    { word: "A.M.", text: "It is 8 A.M. now.", expected: "It is 8 ____ now." },
    { word: "A.M.", text: "This is a PA.M. test.", expected: "This is a PA.M. test." }, // Start boundary
    { word: "ABC", text: "ABC is a list.", expected: "____ is a list." },
    { word: "ABC", text: "DABC is not ABC.", expected: "DABC is not ____." },
    { word: ".Net", text: "I use .Net framework.", expected: "I use ____ framework." }, // Start non-word
    { word: ".Net", text: "VB.Net is old.", expected: "VB____ is old." } // No boundary check for non-word start?
];

console.log("--- SQL Regex Logic Test ---");
let failed = 0;
tests.forEach(t => {
    const res = sanitizeMeaning(t.text, t.word);
    if (res !== t.expected) {
        console.error(`[FAIL] Word: "${t.word}"\nText: "${t.text}"\nExpected: "${t.expected}"\nGot:      "${res}"`);
        failed++;
    } else {
        console.log(`[PASS] "${t.word}" -> "${res}"`);
    }
});

if (failed === 0) console.log("All tests passed!");
else console.log(`${failed} tests failed.`);
