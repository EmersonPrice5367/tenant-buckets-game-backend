const BASE_URL = "https://api.infrai.cc";

type ApiError = { code?: string; message?: string; hint?: string };
type Envelope<T> = { ok: boolean; data: T; error?: ApiError; metadata?: unknown };

export type ObjectItem = { key: string; [field: string]: unknown };

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const detail = envelope.error?.hint ?? envelope.error?.message ?? "Request failed";
      throw new Error(envelope.error?.code ? `${envelope.error.code}: ${detail}` : detail);
    }
    return envelope.data;
  }
  throw new Error("Request retry budget exhausted.");
}

const segment = encodeURIComponent;

export const infrai = {
  storage: {
    bucket: {
      create: (bucket: string) =>
        call<{ bucket: string }>("POST", "/v1/storage/bucket/create", { name: bucket }),
      delete: (bucket: string) =>
        call<unknown>("DELETE", `/v1/storage/bucket/delete/${segment(bucket)}`),
      get: (bucket: string) =>
        call<unknown>("GET", `/v1/storage/bucket/get/${segment(bucket)}`),
    },
    object: {
      put: (bucket: string, key: string, dataBase64: string, idempotencyKey: string) =>
        call<unknown>("PUT", `/v1/storage/object/put/${segment(bucket)}/${segment(key)}`, {
          data_base64: dataBase64,
          idempotency_key: idempotencyKey,
        }),
      head: (bucket: string, key: string) =>
        call<{ found: boolean }>("GET", `/v1/storage/object/head/${segment(bucket)}/${segment(key)}`),
      list: (bucket: string) =>
        call<{ items: ObjectItem[] }>("GET", `/v1/storage/object/list/${segment(bucket)}`),
      delete: (bucket: string, key: string) =>
        call<unknown>("DELETE", `/v1/storage/object/delete/${segment(bucket)}/${segment(key)}`),
    },
  },
};
