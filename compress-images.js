#!/usr/bin/env node
/**
 * Compress project images that are over threshold. Only touches files that need it.
 * PNG: lossless recompress (max deflate). JPEG: quality 88 (high quality).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECTS_DIR = path.join(__dirname, 'projects');
const MIN_SIZE = 350 * 1024; // Only compress files > 350KB
const JPEG_QUALITY = 88;

function getAllImages(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) getAllImages(full, list);
    else if (/\.(png|jpe?g)$/i.test(e.name)) list.push(full);
  }
  return list;
}

async function compress(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.size < MIN_SIZE) return { skipped: true, size: stat.size };

  const ext = path.extname(filePath).toLowerCase();
  const tmpPath = filePath + '.tmp.' + path.basename(filePath);

  try {
    let pipeline = sharp(filePath);
    if (ext === '.png') {
      await pipeline
        .png({ compressionLevel: 9, effort: 10 })
        .toFile(tmpPath);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      await pipeline
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(tmpPath);
    } else return { skipped: true, size: stat.size };

    const newStat = fs.statSync(tmpPath);
    if (newStat.size < stat.size) {
      fs.renameSync(tmpPath, filePath);
      return { saved: stat.size - newStat.size, before: stat.size, after: newStat.size };
    }
    fs.unlinkSync(tmpPath);
    return { skipped: true, noSave: true };
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw err;
  }
}

async function main() {
  const images = getAllImages(PROJECTS_DIR);
  let totalBefore = 0, totalAfter = 0;
  const compressed = [];

  for (const filePath of images) {
    const rel = path.relative(__dirname, filePath);
    try {
      const result = await compress(filePath);
      if (result.saved !== undefined) {
        totalBefore += result.before;
        totalAfter += result.after;
        compressed.push({ rel, saved: result.saved, before: result.before, after: result.after });
      }
    } catch (e) {
      console.error('Error:', rel, e.message);
    }
  }

  if (compressed.length) {
    console.log('Compressed', compressed.length, 'files:');
    compressed.forEach(({ rel, saved, before, after }) => {
      const pct = ((1 - after / before) * 100).toFixed(1);
      console.log('  ', rel, (before / 1024).toFixed(0) + 'KB ->', (after / 1024).toFixed(0) + 'KB', '(' + pct + '% smaller)');
    });
    console.log('Total saved:', ((totalBefore - totalAfter) / 1024 / 1024).toFixed(2), 'MB');
  } else {
    console.log('No files needed compression (all under', MIN_SIZE / 1024, 'KB or already optimal).');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
