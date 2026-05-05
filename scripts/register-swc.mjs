import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loaderPath = join(__dirname, '../node_modules/@swc-node/register/esm/esm.mjs');

register(pathToFileURL(loaderPath).href, import.meta.url);
