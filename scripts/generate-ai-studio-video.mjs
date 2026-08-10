import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [promptFile, startImageFile, outputFile, aspectRatio = '16:9'] = process.argv.slice(2);

if (!promptFile || !startImageFile || !outputFile) {
    console.error(
        'Usage: node scripts/generate-ai-studio-video.mjs <prompt.txt> <start-image> <output.mp4> [aspect-ratio]',
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
const startImage = await readFile(startImageFile);
const mimeType = startImageFile.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
const model = 'veo-3.1-lite-generate-preview';
const apiBase = 'https://generativelanguage.googleapis.com/v1beta';

const response = await fetch(`${apiBase}/models/${model}:predictLongRunning`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
        instances: [
            {
                prompt,
                image: {
                    bytesBase64Encoded: startImage.toString('base64'),
                    mimeType,
                },
            },
        ],
        parameters: {
            aspectRatio,
            durationSeconds: 4,
            resolution: '720p',
        },
    }),
});

if (!response.ok) {
    throw new Error(`AI Studio video request failed (${response.status}): ${await response.text()}`);
}

const operation = await response.json();

if (!operation.name) {
    throw new Error('AI Studio returned no operation name');
}

console.log(`Video generation started: ${operation.name}`);

let result;

for (let attempt = 1; attempt <= 60; attempt += 1) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10_000));

    const pollResponse = await fetch(`${apiBase}/${operation.name}`, {
        headers: { 'x-goog-api-key': apiKey },
    });

    if (!pollResponse.ok) {
        throw new Error(`AI Studio operation poll failed (${pollResponse.status}): ${await pollResponse.text()}`);
    }

    result = await pollResponse.json();

    if (result.done) {
        break;
    }

    if (attempt % 3 === 0) {
        console.log(`Still generating (${attempt * 10}s elapsed)`);
    }
}

if (!result?.done) {
    throw new Error('AI Studio video generation timed out after 10 minutes');
}

if (result.error) {
    throw new Error(`AI Studio video generation failed: ${JSON.stringify(result.error)}`);
}

const videoUri = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

if (!videoUri) {
    throw new Error('AI Studio returned no downloadable video');
}

const videoResponse = await fetch(videoUri, {
    headers: { 'x-goog-api-key': apiKey },
});

if (!videoResponse.ok) {
    throw new Error(`AI Studio video download failed (${videoResponse.status}): ${await videoResponse.text()}`);
}

const outputPath = resolve(outputFile);
const video = Buffer.from(await videoResponse.arrayBuffer());
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, video);

console.log(`Generated ${outputPath} (${video.length} bytes)`);
