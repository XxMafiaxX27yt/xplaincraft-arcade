// npm run build -> games/kit3d/vendor.js (one minified ES module)
import { build } from 'esbuild';
import { statSync } from 'fs';
import { gzipSync } from 'zlib';
import { readFileSync } from 'fs';
const out = '../../games/kit3d/vendor.js';
await build({ entryPoints: ['src/vendor.js'], bundle: true, format: 'esm', minify: true, target: 'es2020', outfile: out, legalComments: 'none', logLevel: 'warning' });
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('vendor.js', kb(statSync(out).size), '| gzip', kb(gzipSync(readFileSync(out)).length));
