import { test } from "node:test";
import assert from "node:assert/strict";
import { svOrdinal } from "./ordinal";

test("Swedish ordinals: 1:a and 2:a, otherwise :e, with 11 and 12 as exceptions", () => {
  assert.deepEqual([1, 2, 3, 4, 7, 11, 12, 13, 14, 21, 22, 23, 101, 111].map(svOrdinal), ["1:a", "2:a", "3:e", "4:e", "7:e", "11:e", "12:e", "13:e", "14:e", "21:a", "22:a", "23:e", "101:a", "111:e"]);
});
