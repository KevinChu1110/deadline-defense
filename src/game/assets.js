/**
 * Load maple mob GIFs and decode frames for canvas animation.
 */
import { parseGIF, decompressFrames } from "gifuct-js";

const cache = new Map();
const loading = new Map();

/**
 * @returns {Promise<{ frames: Array<{ canvas: HTMLCanvasElement, delay: number }>, width: number, height: number }>}
 */
export async function loadMobGif(filename) {
  if (cache.has(filename)) return cache.get(filename);
  if (loading.has(filename)) return loading.get(filename);

  const p = (async () => {
    const url = `/mobs/${filename}`;
    const buf = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${url}`);
      return r.arrayBuffer();
    });
    const gif = parseGIF(buf);
    const rawFrames = decompressFrames(gif, true);
    if (!rawFrames.length) throw new Error(`No frames: ${filename}`);

    const w = rawFrames[0].dims.width;
    const h = rawFrames[0].dims.height;
    // full-frame composite buffer (handle disposal)
    const full = document.createElement("canvas");
    full.width = gif.lsd?.width || w;
    full.height = gif.lsd?.height || h;
    const fctx = full.getContext("2d");
    fctx.imageSmoothingEnabled = false;

    const frames = [];
    for (const fr of rawFrames) {
      const { left, top, width, height } = fr.dims;
      const patch = document.createElement("canvas");
      patch.width = width;
      patch.height = height;
      const pctx = patch.getContext("2d");
      const imgData = pctx.createImageData(width, height);
      imgData.data.set(fr.patch);
      pctx.putImageData(imgData, 0, 0);

      if (fr.disposalType === 2) {
        fctx.clearRect(0, 0, full.width, full.height);
      }
      fctx.drawImage(patch, left, top);

      const out = document.createElement("canvas");
      out.width = full.width;
      out.height = full.height;
      const octx = out.getContext("2d");
      octx.imageSmoothingEnabled = false;
      octx.drawImage(full, 0, 0);

      frames.push({
        canvas: out,
        delay: Math.max(40, fr.delay || 100) / 1000,
      });
    }

    const result = { frames, width: full.width, height: full.height, filename };
    cache.set(filename, result);
    loading.delete(filename);
    return result;
  })().catch((err) => {
    loading.delete(filename);
    console.warn("[assets]", filename, err);
    return null;
  });

  loading.set(filename, p);
  return p;
}

export function preloadMobs(filenames) {
  return Promise.all(filenames.map((f) => loadMobGif(f)));
}

/** Pick frame by elapsed time (seconds). */
export function sampleGifFrame(gif, timeSec) {
  if (!gif?.frames?.length) return null;
  let t = timeSec % totalDuration(gif);
  for (const fr of gif.frames) {
    if (t <= fr.delay) return fr.canvas;
    t -= fr.delay;
  }
  return gif.frames[gif.frames.length - 1].canvas;
}

function totalDuration(gif) {
  return gif.frames.reduce((s, f) => s + f.delay, 0) || 1;
}

export function getCachedMob(filename) {
  return cache.get(filename) || null;
}
