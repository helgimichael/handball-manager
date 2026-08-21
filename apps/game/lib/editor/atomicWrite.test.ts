import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { atomicWriteJsonFile, serializeJson } from "./atomicWrite";

function withTempDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hm-editor-atomicwrite-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("serializeJson uses 2-space indent with no added trailing newline (matches source file formatting)", () => {
  const json = serializeJson({ a: 1, b: [1, 2] });
  assert.equal(json, '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  assert.ok(!json.endsWith("\n"));
});

test("writes a new file when none exists yet, no backup created", () => {
  withTempDir((dir) => {
    const file = path.join(dir, "data.json");
    atomicWriteJsonFile(file, { hello: "world" });
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).hello, "world");
    assert.equal(fs.existsSync(`${file}.bak`), false);
  });
});

test("overwriting an existing file creates exactly one .bak with the PREVIOUS content", () => {
  withTempDir((dir) => {
    const file = path.join(dir, "data.json");
    atomicWriteJsonFile(file, { version: 1 });
    atomicWriteJsonFile(file, { version: 2 });

    assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).version, 2);
    assert.equal(fs.existsSync(`${file}.bak`), true);
    assert.equal(JSON.parse(fs.readFileSync(`${file}.bak`, "utf8")).version, 1);
  });
});

test("a second overwrite replaces the single .bak rather than accumulating backups", () => {
  withTempDir((dir) => {
    const file = path.join(dir, "data.json");
    atomicWriteJsonFile(file, { version: 1 });
    atomicWriteJsonFile(file, { version: 2 });
    atomicWriteJsonFile(file, { version: 3 });

    const backupCount = fs.readdirSync(dir).filter((f) => f.endsWith(".bak")).length;
    assert.equal(backupCount, 1, "exactly one backup file must exist, never accumulating");
    assert.equal(JSON.parse(fs.readFileSync(`${file}.bak`, "utf8")).version, 2);
  });
});

test("no leftover temp files remain after a successful write", () => {
  withTempDir((dir) => {
    atomicWriteJsonFile(path.join(dir, "data.json"), { ok: true });
    const leftovers = fs.readdirSync(dir).filter((f) => f.includes(".tmp-"));
    assert.deepEqual(leftovers, []);
  });
});
