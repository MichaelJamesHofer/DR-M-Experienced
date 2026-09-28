#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// The header, footer, browser tabs, and home-screen shortcut share one mark.
const app = new URL("../src/app/", import.meta.url);
const source = await readFile(new URL("icon.svg", app));
const sizes = [16, 32, 48, 64];
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
);

// ICO directory followed by lossless PNG frames at native browser sizes.
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});

const outputs = new Map([
  ["favicon.ico", Buffer.concat([directory, ...images])],
  ["apple-icon.png", await sharp(source).resize(180, 180).flatten({ background: "#0A0F1A" }).png().toBuffer()],
]);

for (const [name, expected] of outputs) {
  const destination = new URL(name, app);
  if (process.argv.includes("--check")) {
    const actual = await readFile(destination);
    // Compare decoded pixels, not encoder-specific PNG bytes.
    if (name.endsWith(".ico")) {
      assert.equal(actual.readUInt16LE(0), 0);
      assert.equal(actual.readUInt16LE(2), 1);
      assert.equal(actual.readUInt16LE(4), sizes.length);
      for (const [index, size] of sizes.entries()) {
        const entry = 6 + index * 16;
        assert.equal(actual[entry], size);
        assert.equal(actual[entry + 1], size);
        const start = actual.readUInt32LE(entry + 12);
        const length = actual.readUInt32LE(entry + 8);
        assert.deepEqual(
          await sharp(actual.subarray(start, start + length)).raw().toBuffer(),
          await sharp(images[index]).raw().toBuffer(),
          `${name} ${size}px differs from icon.svg; run npm run generate:site-icons`,
        );
      }
    } else {
      const metadata = await sharp(actual).metadata();
      assert.equal(metadata.width, 180);
      assert.equal(metadata.height, 180);
      assert.equal(metadata.hasAlpha, false);
      assert.deepEqual(
        await sharp(actual).raw().toBuffer(),
        await sharp(expected).raw().toBuffer(),
        `${name} differs from icon.svg; run npm run generate:site-icons`,
      );
    }
  } else {
    await writeFile(destination, expected);
  }
}

console.log(`Site icons ${process.argv.includes("--check") ? "verified" : "generated"}: ${sizes.join("/")}px favicon and 180px Apple touch icon.`);
