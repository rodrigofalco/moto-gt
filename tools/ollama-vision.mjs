import { readFileSync } from 'fs';

const imagePath = process.argv[2];
const prompt = process.argv[3] ?? 'Describe this image.';

if (!imagePath) {
  console.error('Usage: node tools/ollama-vision.mjs <image-path> "<prompt>"');
  process.exit(1);
}

const base64 = readFileSync(imagePath).toString('base64');

const res = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3-vl:8b',
    prompt,
    images: [base64],
    stream: false,
  }),
});

if (!res.ok) {
  console.error(`Ollama request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const data = await res.json();
console.log(data.response ?? '');
