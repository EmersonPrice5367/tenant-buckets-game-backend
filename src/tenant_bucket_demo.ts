import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { infrai } from "./infrai_storage.js";

export function bucketForTenant(tenantId: string): string {
  const digest = createHash("sha256").update(tenantId).digest("hex").slice(0, 20);
  return `game-tenant-${digest}`;
}

async function storePlayerSnapshot(tenantId: string, playerId: string): Promise<void> {
  const bucket = bucketForTenant(tenantId);
  const key = `players/${playerId}.json`;

  await infrai.storage.bucket.create(bucket);

  const snapshot = JSON.stringify({ playerId, level: 12, inventory: ["compass", "torch"] });
  await infrai.storage.object.put(
    bucket,
    key,
    Buffer.from(snapshot).toString("base64"),
    randomUUID(),
  );

  const object = await infrai.storage.object.head(bucket, key);
  const listing = await infrai.storage.object.list(bucket);
  console.log({ tenantId, bucket, stored: object.found, keys: listing.items.map((item) => item.key) });
}

const tenantId = process.argv[2] ?? "guild-red";
const playerId = process.argv[3] ?? "player-42";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await storePlayerSnapshot(tenantId, playerId);
}
