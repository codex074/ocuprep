import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const version = packageJson.version;
const artifact = path.resolve(`electron-dist/YATA-${version}-portable.exe`);
const publicBaseUrl = process.env.ELECTRON_DOWNLOAD_BASE_URL;

if (!publicBaseUrl?.startsWith('https://')) {
  throw new Error('กำหนด ELECTRON_DOWNLOAD_BASE_URL เป็น HTTPS URL ที่เก็บไฟล์บน Vercel/Blob');
}

const bytes = await readFile(artifact);
const manifest = {
  version,
  url: `${publicBaseUrl.replace(/\/$/, '')}/${path.basename(artifact)}`,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  notes: process.env.ELECTRON_RELEASE_NOTES || '',
  publishedAt: new Date().toISOString(),
};

await mkdir('electron-dist', { recursive: true });
await writeFile(
  'electron-dist/latest.json',
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
console.log(`Created electron-dist/latest.json for YATA ${version}`);
