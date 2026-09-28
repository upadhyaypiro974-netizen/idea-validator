import { mkdir, copyFile, rm } from 'node:fs/promises';
await rm('public', { recursive: true, force: true });
await mkdir('public');
for (const file of ['index.html', 'styles.css', 'app.js', 'favicon.svg']) await copyFile(file, `public/${file}`);
