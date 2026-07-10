export async function readJsonBody(
  request: Request,
  maxBodyBytes: number,
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new Error("Invalid body limit");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > maxBodyBytes
    ) {
      throw new Error("Invalid request body length");
    }
  }

  if (!request.body) throw new Error("Missing request body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        await reader.cancel("Request body too large").catch(() => undefined);
        throw new Error("Request body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(body) as unknown;
}
