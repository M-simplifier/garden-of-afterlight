// Renderer QA uses the exact shipped CSS/JS with an example GHC result.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const file = path.resolve('examples/Domain/Order.hs');
const design = JSON.parse(execFileSync(process.execPath, ['dist/cli.cjs'], { input: JSON.stringify({ command: 'verify', root: path.resolve('examples'), file, trusted: true, cacheDir: path.resolve('.test-output/cache') }), encoding: 'utf8' }));
const bootstrap = `window.messages=[];window.acquireVsCodeApi=()=>({getState:()=>null,setState:()=>{},postMessage:m=>{window.messages.push(m);if(m.type==='ready')fetch('/model').then(r=>r.json()).then(design=>window.postMessage({type:'model',design,path:'Domain/Order.hs',trusted:true},'*'));}});`;
const routes = {
  '/': ['text/html; charset=utf-8', `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Haskell Design · Renderer QA</title><link rel="stylesheet" href="/design.css"></head><body><main id="app"></main><script>${bootstrap}</script><script src="/design.js"></script></body></html>`],
  '/model': ['application/json', JSON.stringify(design)],
  '/design.css': ['text/css', await readFile('media/design.css')],
  '/design.js': ['text/javascript', await readFile('media/design.js')]
};
http.createServer((req, res) => {
  const response = routes[req.url];
  if (!response) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': response[0] }); res.end(response[1]);
}).listen(4179, '127.0.0.1', () => console.log('Renderer QA: http://127.0.0.1:4179'));
