import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const requiredFiles = [
  'README.md',
  'SHOWCASE_STANDARD.md',
  'SECURITY.md',
  'docs/architecture.md',
  'docs/evaluation.md',
  'examples/README.md',
  'package.json',
];

const requiredHeadings = [
  '## Purpose',
  '## Shared Showcase Scenario',
  '## Capability Map',
  '## Quality Bar',
  '## Official References',
  '## Current State',
];

test('repository foundation contains every required file', () => {
  for (const path of requiredFiles) {
    assert.equal(existsSync(path), true, `missing ${path}`);
  }
});

test('README preserves the shared semantic structure', () => {
  const readme = readFileSync('README.md', 'utf8');
  for (const heading of requiredHeadings) {
    assert.equal(
      readme.split(/\r?\n/).includes(heading),
      true,
      `missing heading: ${heading}`,
    );
  }
});

test('foundation does not contain placeholder credentials', () => {
  const files = requiredFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(files, /(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][^"']+["']/i);
});
