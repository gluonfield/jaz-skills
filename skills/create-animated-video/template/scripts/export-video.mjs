#!/usr/bin/env node
// ──────────────────────────────────────────────────────────
// Frame-perfect video export for animated React videos.
//
// Overrides the browser's timing APIs with a virtual clock
// that advances exactly 1/FPS per frame. Each frame is
// captured and piped to ffmpeg, producing smooth video
// with zero dropped frames.
//
// Usage:
//   npm run export                       # → video-export.mp4
//   npm run export my-video.mp4          # custom filename
//   FPS=60 npm run export               # 60fps (default 30)
//   SCALE=2 npm run export              # 2x render (default, sharper lines)
//   WIDTH=3840 HEIGHT=2160 npm run export  # 4K output
//
// Requires:
//   puppeteer  (devDep)
//   ffmpeg     (system — brew install ffmpeg)
// ──────────────────────────────────────────────────────────

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const FPS = parseInt(process.env.FPS || '30', 10);
const WIDTH = parseInt(process.env.WIDTH || '1920', 10);
const HEIGHT = parseInt(process.env.HEIGHT || '1080', 10);
const SCALE = parseFloat(process.env.SCALE || '2');
const FRAME_MS = 1000 / FPS;
const EXPORT_PORT = 5099;
const MAX_SECONDS = 120;
const EXIT_BUFFER_FRAMES = Math.ceil(FPS * 1.5);

// ── Virtual clock script (injected before page loads) ────

const VIRTUAL_CLOCK = `(function() {
  // ── Disable WAAPI so Framer Motion uses JS animation path ──
  // Framer Motion v12 delegates opacity/transform/filter/clipPath to
  // Element.prototype.animate (WAAPI), which runs on the compositor
  // and ignores our JS virtual clock. Removing it forces ALL animations
  // through requestAnimationFrame, which we control.
  delete Element.prototype.animate;

  const _setTimeout = window.setTimeout.bind(window);
  const _clearTimeout = window.clearTimeout.bind(window);
  const _setInterval = window.setInterval.bind(window);
  const _clearInterval = window.clearInterval.bind(window);
  const _perfNow = performance.now.bind(performance);
  const _dateNow = Date.now;

  let vt = _perfNow();
  const dateBase = _dateNow() - vt;

  performance.now = () => vt;
  Date.now = () => Math.floor(vt + dateBase);

  const timers = new Map();
  let tid = 100000;

  window.setTimeout = (fn, ms, ...a) => {
    if (typeof fn !== 'function') return 0;
    const id = tid++;
    timers.set(id, { fn, a, at: vt + Math.max(0, ms || 0), t: 'to' });
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);

  window.setInterval = (fn, ms, ...a) => {
    if (typeof fn !== 'function') return 0;
    const id = tid++;
    const d = Math.max(1, ms || 0);
    timers.set(id, { fn, a, at: vt + d, d, t: 'iv' });
    return id;
  };
  window.clearInterval = (id) => timers.delete(id);

  let rafs = [];
  let rid = 1;

  window.requestAnimationFrame = (cb) => {
    const id = rid++;
    rafs.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafs = rafs.filter(r => r.id !== id);
  };

  window.__tick = (deltaMs) => {
    vt += deltaMs;
    const ids = [...timers.keys()];
    for (const id of ids) {
      const t = timers.get(id);
      if (!t || vt < t.at) continue;
      if (t.t === 'iv') { t.at += t.d; } else { timers.delete(id); }
      try { t.fn(...t.a); } catch(e) { console.error(e); }
    }
    const q = rafs;
    rafs = [];
    for (const { cb } of q) {
      try { cb(vt); } catch(e) { console.error(e); }
    }
  };

  window.__flush = () => new Promise(r => _setTimeout(() => _setTimeout(r, 0), 0));

  // Combined tick+flush for fewer round trips
  window.__advance = (ms) => {
    window.__tick(ms);
    return window.__flush();
  };

  window.__exportDone = false;
})();`;

// ── Helpers ──────────────────────────────────────────────

function log(msg) { process.stdout.write(`  ${msg}\n`); }

function progress(sec, suffix) {
  process.stdout.write(`\r  ${sec.toFixed(1)}s captured${suffix}`);
}

async function buildProject() {
  log('Building project...');
  await new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'build'], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`vite build failed with code ${code}`));
    });
  });
}

async function startPreviewServer() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(EXPORT_PORT)], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  await new Promise((resolve, reject) => {
    const timeout = _t(() => reject(new Error('Preview server timeout')), 20000);
    const check = (d) => {
      if (d.toString().match(/ready|Local:|Preview/i)) { clearTimeout(timeout); resolve(); }
    };
    server.stdout.on('data', check);
    server.stderr.on('data', check);
  });
  return server;
}
const _t = setTimeout; // real setTimeout for Node side

// ── Main ─────────────────────────────────────────────────

async function main() {
  let outputFile = process.argv[2] || 'video-export.mp4';
  if (!outputFile.endsWith('.mp4') && !outputFile.endsWith('.webm')) {
    outputFile += '.mp4';
  }

  // Check ffmpeg
  try {
    const { status } = await import('child_process').then(m =>
      new Promise(r => { const p = m.spawn('ffmpeg', ['-version'], { stdio: 'pipe' }); p.on('close', (s) => r({ status: s })); })
    );
    if (status !== 0) throw new Error();
  } catch {
    console.error('\n  ffmpeg is required. Install: brew install ffmpeg\n');
    process.exit(1);
  }

  console.log(`\n  Video Export (${WIDTH}x${HEIGHT} @${SCALE}x, ${FPS}fps)`);
  console.log('  ─────────────────────────────────────\n');

  // 1. Build & serve (static files — no HMR interference)
  await buildProject();
  log('Starting preview server...');
  const server = await startPreviewServer();

  try {
    // 2. Browser
    log(`Launching browser (${WIDTH}x${HEIGHT} @${SCALE}x)...`);
    const browser = await puppeteer.launch({
      headless: 'new',
      protocolTimeout: 180000,
      args: [`--window-size=${WIDTH},${HEIGHT}`, '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });

    // 3. Inject virtual clock BEFORE page loads
    await page.evaluateOnNewDocument(VIRTUAL_CLOCK);

    // 4. Hook recording lifecycle
    await page.exposeFunction('stopRecording', () => {
      return page.evaluate(() => { window.__exportDone = true; });
    });
    await page.exposeFunction('startRecording', async () => {});

    // 5. Navigate
    log('Loading video...');
    await page.goto(`http://localhost:${EXPORT_PORT}`, { waitUntil: 'domcontentloaded' });

    // Let React mount
    await page.evaluate('window.__flush()');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(`window.__advance(${FRAME_MS})`);
    }

    // 6. Start ffmpeg
    const isWebm = outputFile.endsWith('.webm');
    const ffmpegArgs = isWebm
      ? ['-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(FPS), '-i', '-',
         '-c:v', 'libvpx-vp9', '-crf', '18', '-b:v', '0', '-pix_fmt', 'yuv420p', outputFile]
      : ['-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(FPS), '-i', '-',
         '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', outputFile];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

    // 7. Frame capture loop
    log('Recording...');
    let frame = 0;
    const maxFrames = FPS * MAX_SECONDS;
    let done = false;

    while (frame < maxFrames && !done) {
      // Single round trip: tick + flush combined
      await page.evaluate(`window.__advance(${FRAME_MS})`);

      // JPEG screenshot — much faster than PNG
      const jpg = await page.screenshot({ type: 'jpeg', quality: 95, captureBeyondViewport: false });
      ffmpeg.stdin.write(jpg);
      frame++;

      if (frame % FPS === 0) {
        progress(frame / FPS, '...');
      }

      // Check done flag every 10 frames to reduce round trips
      if (frame % 10 === 0) {
        done = await page.evaluate('window.__exportDone');
      }
    }

    // Exit buffer — freeze on last frame (don't advance time to avoid loop restart)
    if (done) {
      const lastFrame = await page.screenshot({ type: 'jpeg', quality: 95, captureBeyondViewport: false });
      for (let i = 0; i < EXIT_BUFFER_FRAMES; i++) {
        ffmpeg.stdin.write(lastFrame);
        frame++;
      }
    }

    progress(frame / FPS, ' — finalizing...\n');

    // 8. Finalize ffmpeg
    ffmpeg.stdin.end();
    await new Promise((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });

    log(`Saved → ${outputFile} (${frame} frames, ${(frame / FPS).toFixed(1)}s)`);
    await browser.close();
  } finally {
    server.kill();
  }

  console.log('\n  Done.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n  Export failed: ${err.message}\n`);
  process.exit(1);
});
