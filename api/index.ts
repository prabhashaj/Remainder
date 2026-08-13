import type { IncomingMessage, ServerResponse } from "node:http";

// @ts-ignore - dist/server/server.js is compiled at build time
import server from "../dist/server/server.js";

export default async function handler(req: Request | IncomingMessage, res?: ServerResponse) {
  if (req instanceof Request) {
    return server.fetch(req);
  }

  const host = req.headers.host || "localhost";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const url = new URL(req.url || "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, String(value));
      }
    }
  }

  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  let body: ReadableStream | null = null;
  if (hasBody) {
    body = new ReadableStream({
      start(controller) {
        req.on("data", (chunk) => controller.enqueue(chunk));
        req.on("end", () => controller.close());
        req.on("error", (err) => controller.error(err));
      },
    });
  }

  const webRequest = new Request(url.href, {
    method,
    headers,
    body,
    // @ts-ignore - duplex property for node fetch body
    duplex: hasBody ? "half" : undefined,
  });

  const webResponse = await server.fetch(webRequest);

  if (res) {
    res.statusCode = webResponse.status;
    webResponse.headers.forEach((val: string, key: string) => {
      res.setHeader(key, val);
    });

    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
    return;
  }

  return webResponse;
}
