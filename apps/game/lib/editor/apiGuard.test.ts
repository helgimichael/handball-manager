// API-level enable/disable guard tests (HM-DATA-EDITOR-0.1, Spec S33).
//
// Imports the actual Next.js route handlers directly and invokes them
// with constructed Request objects -- no running server needed, and no
// mocking of the guard itself: this exercises the real
// isEditorEnabled() check every route calls first.
import { test } from "node:test";
import assert from "node:assert/strict";

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return fn().finally(() => {
    for (const key of Object.keys(vars)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test("GET /api/editor/status always responds, reporting the current flag state", async () => {
  const { GET } = await import("../../app/api/editor/status/route");
  await withEnv({ HM_EDITOR_ENABLED: undefined, NODE_ENV: "development" }, async () => {
    const res = await GET();
    assert.equal(res.status, 200);
    assert.equal((await res.json()).enabled, false);
  });
  await withEnv({ HM_EDITOR_ENABLED: "true", NODE_ENV: "development" }, async () => {
    const res = await GET();
    assert.equal((await res.json()).enabled, true);
  });
});

test("GET /api/editor/catalog refuses access with 403 when the editor is disabled", async () => {
  const { GET } = await import("../../app/api/editor/catalog/route");
  await withEnv({ HM_EDITOR_ENABLED: "false", NODE_ENV: "development" }, async () => {
    const res = await GET();
    assert.equal(res.status, 403);
  });
});

test("GET /api/editor/catalog succeeds when enabled in a non-production environment", async () => {
  const { GET } = await import("../../app/api/editor/catalog/route");
  await withEnv({ HM_EDITOR_ENABLED: "true", NODE_ENV: "development" }, async () => {
    const res = await GET();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray((await res.json()).clubs));
  });
});

test("GET /api/editor/catalog refuses access even when enabled, if NODE_ENV is production", async () => {
  const { GET } = await import("../../app/api/editor/catalog/route");
  await withEnv({ HM_EDITOR_ENABLED: "true", NODE_ENV: "production" }, async () => {
    const res = await GET();
    assert.equal(res.status, 403);
  });
});

test("GET /api/editor/clubs/:clubId/players refuses reads when disabled", async () => {
  const { GET } = await import("../../app/api/editor/clubs/[clubId]/players/route");
  await withEnv({ HM_EDITOR_ENABLED: "false", NODE_ENV: "development" }, async () => {
    const res = await GET(new Request("http://localhost/api/editor/clubs/anything/players"), {
      params: Promise.resolve({ clubId: "anything" }),
    });
    assert.equal(res.status, 403);
  });
});

test("PUT /api/editor/players/:playerId refuses writes when disabled -- never touches the filesystem", async () => {
  const { PUT } = await import("../../app/api/editor/players/[playerId]/route");
  await withEnv({ HM_EDITOR_ENABLED: "false", NODE_ENV: "development" }, async () => {
    const request = new Request("http://localhost/api/editor/players/whatever", {
      method: "PUT",
      body: JSON.stringify({ clubId: "whatever", player: {}, roster: {} }),
    });
    const res = await PUT(request, { params: Promise.resolve({ playerId: "whatever" }) });
    assert.equal(res.status, 403);
  });
});

test("GET /api/editor/players/:playerId refuses reads when disabled", async () => {
  const { GET } = await import("../../app/api/editor/players/[playerId]/route");
  await withEnv({ HM_EDITOR_ENABLED: "false", NODE_ENV: "development" }, async () => {
    const res = await GET(new Request("http://localhost/api/editor/players/whatever?clubId=x"), {
      params: Promise.resolve({ playerId: "whatever" }),
    });
    assert.equal(res.status, 403);
  });
});
