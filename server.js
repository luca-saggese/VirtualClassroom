const express = require('express');
const next = require('next');
const { spawn } = require('child_process');

const port = Number(process.env.PORT || 3000);
const dev = false;

function runBuild() {
  if (process.env.SKIP_BUILD === '1') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['run', 'build'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });
  });
}

async function start() {
  await runBuild();

  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = express();

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
