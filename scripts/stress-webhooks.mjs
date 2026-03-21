#!/usr/bin/env node

const baseUrl = process.env.STRESS_BASE_URL || "http://localhost:3000";
const totalEvents = Number(process.env.STRESS_EVENTS || 50_000);
const concurrency = Number(process.env.STRESS_CONCURRENCY || 50);
const apiKey = process.env.STRESS_API_KEY || process.env.WAR_ROOM_WEBHOOK_API_KEY || "";

const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/webhooks/warroom?provider=utmify`;
const startedAt = Date.now();

let sent = 0;
let ok = 0;
let failed = 0;

async function postOne(index) {
  const eventId = `stress-${Date.now()}-${index}`;
  const body = {
    provider: "utmify",
    event_id: eventId,
    spend: 1000 + (index % 500),
    creatives: [
      {
        creative_id: `ID${1000 + (index % 200)}`,
        source: "meta",
        profit: 500 + (index % 90),
        roas: 2 + ((index % 30) / 20),
      },
    ],
  };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      ok += 1;
      return;
    }
    failed += 1;
  } catch {
    failed += 1;
  }
}

async function worker(workerId) {
  while (true) {
    const current = sent;
    if (current >= totalEvents) {
      return;
    }
    sent += 1;
    await postOne(current);
    if ((current + 1) % 1000 === 0 && workerId === 0) {
      const elapsedSec = Math.max(1, (Date.now() - startedAt) / 1000);
      const rate = ((ok + failed) / elapsedSec).toFixed(1);
      console.log(`Progress: ${current + 1}/${totalEvents} | ok=${ok} fail=${failed} | rate=${rate} req/s`);
    }
  }
}

async function run() {
  console.log(`Starting webhook stress test`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Total events: ${totalEvents}`);
  console.log(`Concurrency: ${concurrency}`);

  const jobs = Array.from({ length: Math.max(1, concurrency) }, (_, idx) => worker(idx));
  await Promise.all(jobs);

  const elapsedMs = Date.now() - startedAt;
  const elapsedSec = Math.max(1, elapsedMs / 1000);
  const throughput = ((ok + failed) / elapsedSec).toFixed(1);
  const successRate = ((ok / Math.max(1, ok + failed)) * 100).toFixed(2);

  console.log("\nStress test completed");
  console.log(`Elapsed: ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`Total: ${ok + failed}`);
  console.log(`OK: ${ok}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${successRate}%`);
  console.log(`Throughput: ${throughput} req/s`);
}

run().catch((error) => {
  console.error("Stress test crashed:", error);
  process.exitCode = 1;
});
