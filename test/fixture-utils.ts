import fs from 'fs';
import path from 'path';

/** Recursively lists every .html fixture under a directory. */
export function findHtmlFixtures(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findHtmlFixtures(fullPath);
    if (entry.isFile() && entry.name.endsWith('.html')) return [fullPath];
    return [];
  });
}
