const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const fs = require('fs');

function extractDataFromText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const rawTextLower = text.toLowerCase();

    let cardType = 'Business';

    let email = '';
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
    for (let line of lines) {
        if (line.includes('@')) {
            let eLine = line.replace(/^(e-?mail|e|b|m|email id|email)[:\s-]*/i, '').trim();
            eLine = eLine.replace(/\s*@\s*/g, '@');
            eLine = eLine.replace(/\s+(in|com|net|org|co|us|uk|io)$/i, '.$1');
            let parts = eLine.split('@');
            if (parts.length === 2) {
                parts[0] = parts[0].replace(/\s+/g, '.');
                parts[1] = parts[1].replace(/\s+/g, '');
                eLine = parts.join('@');
            }
            const match = eLine.match(emailRegex);
            if (match) { email = match[0]; } else { email = eLine.replace(/[^a-zA-Z0-9._%+-@]/g, ''); }
            break;
        }
    }

    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5}|\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}|\d{4}[-.\s]?\d{4}[-.\s]?\d{2}|\d{10})(?!\d)/g;
    let textForPhone = text.replace(/(\d{4}[-.\s]?\d{4})[oO]/g, '$10');
    let phoneMatches = textForPhone.match(phoneRegex);
    let phone = phoneMatches ? phoneMatches[0].trim() : '';

    const webRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;

    let name = '';
    let company = '';
    const titleKeywords = ['manager', 'director', 'president', 'ceo', 'cfo', 'cto', 'founder', 'owner', 'head', 'vp', 'executive', 'engineer', 'developer', 'consultant', 'architect', 'supervisor', 'specialist', 'officer', 'representative', 'lead'];
    let nameFound = false;

    for (let line of lines) {
        if (line.match(emailRegex) || line.includes('@') || line.match(phoneRegex) || line.match(webRegex)) continue;
        if (line.length < 4 || line.length > 35) continue;

        const lowerLine = line.toLowerCase();
        let isTitle = titleKeywords.some(kw => lowerLine.includes(kw));

        if (!nameFound && !isTitle) {
            let clean = line.replace(/[^a-zA-Z\s.\-]/g, '').replace(/\s+/g, ' ').trim();
            let words = clean.split(' ');
            if (words.length > 1) {
                while (words.length >= 2 && words[words.length - 1].length <= 2) {
                    words.pop();
                }
            }
            name = words.join(' ');
            nameFound = true;
            continue;
        }
        if (nameFound && !company && !isTitle) {
            company = line.replace(/[^a-zA-Z0-9\s.\-&,]/g, '').trim();
            break;
        }
    }

    return { name, company, email, phone };
}

async function testOCR() {
    let imageBuffer = fs.readFileSync('C:\\Users\\durge\\.gemini\\antigravity\\brain\\fab1ef01-7942-4f79-8c5d-17fc1804c5d4\\media__1775624575926.jpg');
    let combinedText = '';
    let currentImage = await Jimp.read(imageBuffer);

    let partialExtraction = {};
    for (let i = 0; i < 3; i++) {
        if (i > 0) {
            currentImage.rotate(i === 1 ? 90 : 180);
            imageBuffer = await currentImage.getBufferAsync(Jimp.MIME_PNG);
        }

        let result = await Tesseract.recognize(imageBuffer, 'eng');
        combinedText += result.data.text + '\n\n';

        partialExtraction = extractDataFromText(combinedText);
        if ((partialExtraction.email && partialExtraction.phone && partialExtraction.name && partialExtraction.company)) {
            break;
        }
    }

    fs.writeFileSync('out.json', JSON.stringify({
        extraction: partialExtraction,
        rawText: combinedText
    }, null, 2));
}

testOCR();
