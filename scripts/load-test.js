/**
 * Simple script to load test the health check endpoint and simulate multiple webhook events.
 * Useful for validating rate limits and connection pooling before launch.
 *
 * Usage: node scripts/load-test.js
 */

const fetch = require("node-fetch"); // Use node-fetch if Node < 18, or native fetch in Node 18+

const TARGET_URL = process.env.BASE_URL || "http://localhost:3000";

async function runHealthCheckLoadTest(concurrency = 50, requests = 500) {
  console.log(
    `Starting Health Check Load Test: ${requests} requests at concurrency ${concurrency}`,
  );

  let completed = 0;
  let successful = 0;
  let failed = 0;
  let start = Date.now();

  const runRequest = async () => {
    try {
      const res = await fetch(`${TARGET_URL}/api/health`);
      if (res.ok) {
        successful++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    } finally {
      completed++;
    }
  };

  const pool = new Set();
  for (let i = 0; i < requests; i++) {
    const p = runRequest().finally(() => pool.delete(p));
    pool.add(p);
    if (pool.size >= concurrency) {
      await Promise.race(pool);
    }
  }
  await Promise.all(pool);

  console.log(`Finished Health Check Load Test in ${Date.now() - start}ms`);
  console.log(`Success: ${successful}, Failed: ${failed}`);
}

async function main() {
  await runHealthCheckLoadTest(20, 100);
}

main().catch(console.error);
