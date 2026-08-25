import assert from "node:assert/strict";
import test from "node:test";
import { bucketForTenant } from "../src/tenant_bucket_demo.js";

test("tenant bucket names are stable and separated", () => {
  const first = bucketForTenant("guild-red");
  assert.equal(first, bucketForTenant("guild-red"));
  assert.notEqual(first, bucketForTenant("guild-blue"));
  assert.match(first, /^game-tenant-[a-f0-9]{20}$/);
});
