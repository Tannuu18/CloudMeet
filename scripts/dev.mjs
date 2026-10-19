import { spawn } from 'node:child_process';
const children = [spawn(process.execPath, ['--env-file-if-exists=.env', 'src/server.mjs'], {cwd: new URL('../backend/', import.meta.url), stdio:'inherit'}), spawn(process.execPath, ['../node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {cwd: new URL('../frontend/', import.meta.url), stdio:'inherit'})];
function stop(){ children.forEach(c => c.kill()); }
process.on('SIGINT',stop); process.on('SIGTERM',stop);
children.forEach(c => c.on('exit', code => {stop(); process.exitCode = code || 0;}));
