import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

test('compiled site visit handler loads with native ESM and rejects GET', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'usk-visit-esm-'));
  try {
    await writeFile(join(dir, 'package.json'), '{"type":"module"}');
    for (const name of ['site-visit', '_siteVisitService', '_rateLimit']) {
      const source = await readFile(new URL(`../api/${name}.ts`, import.meta.url), 'utf8');
      const output = ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        rewriteRelativeImportExtensions: true,
      }}).outputText;
      await writeFile(join(dir, `${name}.js`), output);
    }
    const { default: handler } = await import(pathToFileURL(join(dir, 'site-visit.js')).href);
    let status = 0;
    const headers = new Map();
    const res = { setHeader: (k, v) => headers.set(k, v), status: (n) => { status = n; return res; }, json: (body) => body };
    await handler({ method: 'GET' }, res);
    assert.equal(status, 405);
    assert.equal(headers.get('Allow'), 'POST');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('site visit dependency graph also loads with native type stripping', async () => {
  const { execFileSync } = await import('node:child_process');
  const url = new URL('../api/site-visit.ts', import.meta.url).href;
  execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    'await import(' + JSON.stringify(url) + ')'], {
      env: { ...process.env, NODE_OPTIONS: '' },
      timeout: 10000,
    });
});
