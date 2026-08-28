// Vercel serverless entry-point.
// This file sits at the root api/ folder so Vercel auto-discovers it
// AND uses the root package.json scope.  We use createRequire so that
// we can load the CommonJS server/index.js even though the root project
// has "type":"module".
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);

// Resolve the server directory relative to this file so Vercel's bundler
// can trace the dependency correctly.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'server', 'index.js');

const app = require(serverPath);

export default app;
