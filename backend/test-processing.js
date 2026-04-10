// Updated test script for generic OCR post-processing logic
function splitCamelCase(text) {
    if (!text) return '';
    return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
}

function toTitleCase(text) {
    if (!text) return '';
    const meaningfulShorts = ['BD', 'HR', 'IT', 'VP', 'MD', 'CEO', 'CTO', 'CFO', 'COO', 'GM', 'DR', 'AVP', 'SVP', 'DGM'];
    return text.split(' ').map(word => {
        const clean = word.replace(/[^a-zA-Z]/g, '');
        if (meaningfulShorts.includes(clean.toUpperCase())) return word.toUpperCase();
        if (clean.length >= 2 && clean.length <= 3 && clean === clean.toUpperCase() && clean.match(/^[A-Z]+$/)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

function isMeaningfulWord(word) {
    if (!word) return false;
    if (['-', '&', '|', '/', '\\', '(', ')', ','].includes(word.trim())) return true;
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (!cleanWord) return false;
    const meaningfulShorts = ['BD', 'HR', 'IT', 'VP', 'MD', 'CEO', 'CTO', 'CFO', 'COO', 'GM', 'DR', 'AVP', 'SVP', 'DGM'];
    if (meaningfulShorts.includes(cleanWord.toUpperCase())) return true;
    if (cleanWord.length >= 2 && cleanWord.length <= 3 && cleanWord === cleanWord.toUpperCase()) return true;
    if (cleanWord.length < 3) return false;
    if (!/[aeiouyAEIOUY]/.test(cleanWord) && cleanWord.length > 3) return false;
    return true;
}

function cleanNoise(text) {
    if (!text) return '';
    const words = text.split(/\s+/);
    const cleanedWords = words.filter(word => {
        const lettersCount = (word.match(/[a-zA-Z]/g) || []).length;
        if (lettersCount / word.length < 0.5 && word.length > 2) return false;
        return isMeaningfulWord(word);
    });
    return cleanedWords.join(' ').trim();
}

// Test cases
const tests = [
    { input: "JohnDoe", expected: "John Doe", fn: t => toTitleCase(splitCamelCase(t)) },
    { input: "Manager- BD & Customer Success", expected: "Manager - BD & Customer Success", fn: t => toTitleCase(cleanNoise(t.replace(/-/g, ' - '))) },
    { input: "Manager (Sales/Marketing)", expected: "Manager (Sales/marketing)", fn: t => toTitleCase(cleanNoise(t.replace(/\(/g, ' ( ').replace(/\//g, ' / ').replace(/\)/g, ' ) '))) },
    { input: "VP of Engineering", expected: "VP Of Engineering", fn: t => toTitleCase(t) },
];

console.log("=== Running final OCR post-processing tests ===");
let passed = 0;
tests.forEach((test, i) => {
    const result = test.fn(test.input).replace(/\s+/g, ' ').trim();
    if (result === test.expected) {
        console.log(`Test ${i+1} PASSED: ${test.input} => ${result}`);
        passed++;
    } else {
        console.error(`Test ${i+1} FAILED: ${test.input} => expected "${test.expected}", got "${result}"`);
    }
});
console.log(`=== Result: ${passed}/${tests.length} tests passed ===`);
