const Tesseract = require('tesseract.js');
const fs = require('fs');

async function testOCR() {
    let imageBuffer = fs.readFileSync('C:\\Users\\durge\\.gemini\\antigravity\\brain\\fab1ef01-7942-4f79-8c5d-17fc1804c5d4\\media__1775624575926.jpg');
    let result = await Tesseract.recognize(imageBuffer, 'eng');
    console.log("Words array available: ", !!result.data.words);
    if(result.data.words) {
         console.log(result.data.words[0].text, result.data.words[0].bbox, result.data.words[0].confidence);
    }
}
testOCR();
