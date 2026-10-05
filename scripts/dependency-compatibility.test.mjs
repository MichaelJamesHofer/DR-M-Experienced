import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const tailwindRequire = createRequire(require.resolve("tailwindcss/package.json"));
const nextLintRequire = createRequire(require.resolve("@next/eslint-plugin-next"));

// Resolve from each actual consumer: hoisting can change between npm versions.
for (const consumer of ["chokidar", "micromatch"]) {
  const consumerRequire = createRequire(tailwindRequire.resolve(consumer));
  const braces = consumerRequire("braces");

  test(`${consumer}: brace lists, ranges, escaping and invalid syntax retain their behavior`, () => {
    assert.deepEqual(braces("src/**/*.{js,ts,jsx,tsx,mdx}"), ["src/**/*.(js|ts|jsx|tsx|mdx)"]);
    assert.deepEqual(braces.expand("{app,{pages,components}}/*.{ts,tsx}"), [
      "app/*.ts", "app/*.tsx", "pages/*.ts", "pages/*.tsx", "components/*.ts", "components/*.tsx",
    ]);
    assert.deepEqual(braces.expand("episode-{01..03}"), ["episode-01", "episode-02", "episode-03"]);
    assert.deepEqual(braces.expand(String.raw`a\{b,c}d`), ["a{b,c}d"]);
    assert.equal(braces.stringify(braces.parse("{a}"), { escapeInvalid: true }), "{a}");
  });

  test(`${consumer}: excessive string nesting is rejected before recursive traversal`, () => {
    const patterns = [
      "{".repeat(4000) + "a,b" + "}".repeat(4000),
      "(".repeat(4000) + "a" + ")".repeat(4000),
      "{(".repeat(2000) + "a" + ")}".repeat(2000),
      "{".repeat(4000),
    ];
    for (const pattern of patterns) {
      for (const method of ["parse", "compile", "expand", "stringify"]) {
        assert.throws(() => braces[method](pattern), { name: "SyntaxError", message: /exceeds max depth/ });
      }
    }
  });

  test(`${consumer}: the nesting boundary works and cannot be raised above 100`, () => {
    for (const [open, close] of [["{", "}"], ["(", ")"]]) {
      for (const method of ["parse", "compile", "expand", "stringify"]) {
        assert.doesNotThrow(() => braces[method](open.repeat(100) + "a" + close.repeat(100)));
        assert.throws(() => braces[method](open.repeat(101) + "a" + close.repeat(101), { maxDepth: Infinity }), /exceeds max depth/);
        assert.throws(() => braces[method](open.repeat(101) + "a" + close.repeat(101), { maxDepth: 1000 }), /exceeds max depth/);
        assert.throws(() => braces[method](open.repeat(4) + "a" + close.repeat(4), { maxDepth: 3 }), /exceeds max depth/);
      }
    }
  });

  test(`${consumer}: direct AST inputs also have a depth guard`, () => {
    for (const method of ["compile", "expand", "stringify"]) {
      const ast = { type: "root", nodes: [] };
      let parent = ast;
      for (let depth = 0; depth < 101; depth++) {
        const child = { type: "paren", nodes: [], parent };
        parent.nodes.push(child);
        parent = child;
      }
      parent.nodes.push({ type: "text", value: "a", parent });
      assert.throws(() => braces[method](ast), { name: "RangeError", message: /exceeds max depth/ });
    }
  });
}

async function globFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "drm-dependency-globs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "nested"));
  const files = ["page.tsx", "script.js", "notes.md", "nested/component.ts", "nested/readme.mdx"];
  await Promise.all(files.map((file) => writeFile(path.join(directory, file), "fixture")));
  return directory;
}

for (const [consumer, consumerRequire] of [["Tailwind", tailwindRequire], ["Next lint", nextLintRequire]]) {
  test(`${consumer}: fast-glob still discovers brace-pattern content files`, async (t) => {
    const directory = await globFixture(t);
    const glob = consumerRequire("fast-glob");
    assert.deepEqual(glob.sync("**/*.{js,ts,tsx,mdx}", { cwd: directory }).sort(), [
      "nested/component.ts", "nested/readme.mdx", "page.tsx", "script.js",
    ]);
  });
}

test("Tailwind: Chokidar still watches brace-pattern content files", { timeout: 10000 }, async (t) => {
  const directory = await globFixture(t);
  const chokidar = tailwindRequire("chokidar");
  const watcher = chokidar.watch("**/*.{js,ts,tsx,mdx}", { cwd: directory });
  t.after(() => watcher.close());
  const found = [];
  watcher.on("add", (file) => found.push(file.split(path.sep).join("/")));
  await new Promise((resolve, reject) => {
    watcher.once("ready", resolve);
    watcher.once("error", reject);
  });
  assert.deepEqual(found.sort(), ["nested/component.ts", "nested/readme.mdx", "page.tsx", "script.js"]);
});
