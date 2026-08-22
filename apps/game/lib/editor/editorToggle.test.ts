// HM-EDITOR-0.2: proves the Editor Mode toggle is safe outside a
// browser (SSR) -- the node:test runner has no `window`, so this
// exercises exactly the isBrowser() guard path every server render hits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readEditorToggle, writeEditorToggle } from "./editorToggle";

test("HM-EDITOR-0.2: readEditorToggle returns false outside a browser (no window/localStorage), never throws", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(readEditorToggle(), false);
});

test("HM-EDITOR-0.2: writeEditorToggle is a safe no-op outside a browser -- never throws", () => {
  assert.doesNotThrow(() => writeEditorToggle(true));
  assert.doesNotThrow(() => writeEditorToggle(false));
});
