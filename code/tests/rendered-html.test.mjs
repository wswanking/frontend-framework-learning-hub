import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the IoT Atlas framework launch portal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /IoT Atlas/);
  assert.match(html, /三框架，同一套 IoT 业务契约/);
  assert.match(html, /\/frameworks\/react\/index\.html#\//);
  assert.match(html, /\/frameworks\/vue\/index\.html#\//);
  assert.match(html, /\/frameworks\/angular\/index\.html#\//);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("does not retain the disposable starter preview", async () => {
  const previewUrl = new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url);
  await assert.rejects(import(previewUrl.href));
});
