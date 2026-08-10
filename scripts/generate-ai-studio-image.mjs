import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [promptFile, outputFile, referenceFile, aspectRatio = '3:2', imageSize = '2K'] = process.argv.slice(2);

if (!promptFile || !outputFile) {
    console.error(
        'Usage: node scripts/generate-ai-studio-image.mjs <prompt.txt> <output-file> [reference-image] [aspect-ratio] [image-size]',
    );
    process.exit(1);
}

const env = await readFile('.env', 'utf8');
const keyLine = env.split(/\r?\n/).find((line) => line.startsWith('AISTUDIO_API_KEY='));
const apiKey = keyLine?.slice('AISTUDIO_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '');

if (!apiKey) {
    throw new Error('AISTUDIO_API_KEY is missing from .env');
}

const prompt = await readFile(promptFile, 'utf8');
const parts = [{ text: prompt }];

if (referenceFile) {
    const reference = await readFile(referenceFile);
    const mimeType = referenceFile.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    parts.unshift({
        inlineData: {
            mimeType,
            data: reference.toString('base64'),
        },
    });
}

const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent',
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio,
                    imageSize,
                },
            },
        }),
    },
);

if (!response.ok) {
    throw new Error(`AI Studio image request failed (${response.status}): ${await response.text()}`);
}

const result = await response.json();
const imagePart = result.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => part.inlineData?.data);

if (!imagePart) {
    throw new Error('AI Studio returned no image data');
}

const outputPath = resolve(outputFile);
const image = Buffer.from(imagePart.inlineData.data, 'base64');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, image);

console.log(`Generated ${outputPath} (${image.length} bytes, ${imagePart.inlineData.mimeType})`);
