import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const files = readdirSync('supabase/migrations')
  .filter((name) => name.endsWith('.sql'))
  .sort();
writeFileSync(
  'supabase/setup.sql',
  '-- Fresh Supabase projects only. Run once, in SQL Editor, as the project owner.\n-- Generated from versioned migrations by npm run setup:sql.\n\n' +
    files
      .map((name) => `-- SOURCE: ${name}\n${readFileSync(`supabase/migrations/${name}`, 'utf8')}`)
      .join('\n\n'),
);
console.log(`Created supabase/setup.sql from ${files.length} migrations.`);
