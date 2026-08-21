import { test } from "node:test";
import assert from "node:assert/strict";
import { isEditorEnabled } from "./env";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("disabled by default when HM_EDITOR_ENABLED is unset", () => {
  withEnv({ HM_EDITOR_ENABLED: undefined, NODE_ENV: "development" }, () => {
    assert.equal(isEditorEnabled(), false);
  });
});

test("disabled when HM_EDITOR_ENABLED is any value other than the literal string 'true'", () => {
  withEnv({ HM_EDITOR_ENABLED: "1", NODE_ENV: "development" }, () => {
    assert.equal(isEditorEnabled(), false);
  });
  withEnv({ HM_EDITOR_ENABLED: "TRUE", NODE_ENV: "development" }, () => {
    assert.equal(isEditorEnabled(), false);
  });
});

test("enabled when the flag is set AND NODE_ENV is not production", () => {
  withEnv({ HM_EDITOR_ENABLED: "true", NODE_ENV: "development" }, () => {
    assert.equal(isEditorEnabled(), true);
  });
  withEnv({ HM_EDITOR_ENABLED: "true", NODE_ENV: "test" }, () => {
    assert.equal(isEditorEnabled(), true);
  });
});

test("the flag is refused in production regardless of HM_EDITOR_ENABLED (Spec S10)", () => {
  withEnv({ HM_EDITOR_ENABLED: "true", NODE_ENV: "production" }, () => {
    assert.equal(isEditorEnabled(), false);
  });
});
