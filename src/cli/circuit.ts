import { basename } from 'node:path';

import { main } from './dogfood.js';

export { main };

const invokedDirectly =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(basename(process.argv[1])));

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
