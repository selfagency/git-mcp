import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const rootPkgPath = resolve(__dirname, '..', 'package.json');
  const outDir = resolve(__dirname, '..', 'dist');
  const raw = await readFile(rootPkgPath, 'utf8');
  const { name, version, description, keywords, homepage, bugs, repository, license, author } = JSON.parse(raw);

  const distPkg = {
    name,
    version,
    description,
    keywords,
    homepage,
    bugs,
    repository,
    license,
    author,
    type: 'module',
    main: './index.js',
    types: './index.d.ts',
    files: ['./index.js', './index.js.map', './index.d.ts', './skills'],
    bin: {
      'git-mcp': './index.js',
    },
    exports: {
      '.': {
        import: './index.js',
        types: './index.d.ts',
      },
    },
    dependencies: JSON.parse(raw).dependencies,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n', 'utf8');
  console.log('Wrote', resolve(outDir, 'package.json'));

  const skillsSrc = resolve(__dirname, '..', 'skills');
  const skillsDest = resolve(outDir, 'skills');
  try {
    await cp(skillsSrc, skillsDest, { recursive: true });
    console.log('Copied', skillsSrc, 'to', skillsDest);
  } catch {
    console.warn('No skills/ directory found; skipping copy.');
  }

  const readmeSrc = resolve(__dirname, '..', 'README.md');
  const readmeDest = resolve(outDir, 'README.md');
  try {
    await copyFile(readmeSrc, readmeDest);
    console.log('Copied', readmeSrc, 'to', readmeDest);
  } catch {
    console.warn('No README.md found; skipping copy.');
  }
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
