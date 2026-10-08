/**
 * IPFS Gateway Latency Measurement Script (Peer Review Revision - Day 7)
 * 
 * Measures IPFS retrieval latency across public gateways:
 * 1. Cold Fetch Latency (initial request)
 * 2. 50 Warm Fetches with P50 (Median), P95, and P99 calculation
 */

import { performance } from "perf_hooks";

// Target CID specified in peer review revision (supports custom CID via env)
const TARGET_CID = process.env.IPFS_CID || "bafybeibnc4f7j63vshv7g2y";
const WARM_FETCH_COUNT = 50;
const REQUEST_TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 1000);

// Target Public Gateways
const GATEWAYS = [
  {
    name: "Pinata Gateway",
    url: "https://gateway.pinata.cloud/ipfs/",
  },
  {
    name: "Cloudflare IPFS",
    url: "https://cloudflare-ipfs.com/ipfs/",
  },
  {
    name: "IPFS.io Gateway",
    url: "https://ipfs.io/ipfs/",
  },
  {
    name: "Protocol Labs (dweb.link)",
    url: "https://dweb.link/ipfs/",
  },
];

/**
 * Perform a single fetch request and record execution time
 */
async function measureRequest(gatewayUrl, cid, timeoutMs = REQUEST_TIMEOUT_MS) {
  const fullUrl = `${gatewayUrl}${cid}`;
  const start = performance.now();
  let status = "OK";
  let httpCode = null;

  try {
    const response = await fetch(fullUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "IPFS-Benchmark-Client/1.0",
        "Accept": "application/json, text/plain, */*",
      },
    });
    httpCode = response.status;
    status = `${response.status} ${response.statusText}`;
  } catch (error) {
    if (error.name === "TimeoutError") {
      status = "Timeout (>1000ms)";
    } else if (error.code === "ENOTFOUND" || error.code === "EAI_FAIL") {
      status = "DNS Unresolved";
    } else {
      status = error.code || error.name || "Network Error";
    }
  }

  const durationMs = performance.now() - start;
  return { durationMs, status, httpCode };
}

/**
 * Calculate percentile from a sorted array of numbers
 * @param {number[]} sortedArray - Array of latencies sorted ascending
 * @param {number} percentile - Target percentile (e.g. 50, 95, 99)
 */
function calculatePercentile(sortedArray, percentile) {
  if (!sortedArray || sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return sortedArray[0];

  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sortedArray[lower];
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Calculate statistical metrics: Min, Max, Mean, P50, P95, P99
 */
function calculateStats(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / sorted.length;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
  };
}

/**
 * Main benchmark execution
 */
async function runBenchmark() {
  console.log("================================================================================");
  console.log("             IPFS RETRIEVAL LATENCY BENCHMARK (DAY 7 PEER REVIEW)               ");
  console.log("================================================================================");
  console.log(`Target CID        : ${TARGET_CID}`);
  console.log(`Sample Size       : 1 Cold Fetch + ${WARM_FETCH_COUNT} Warm Fetches per gateway`);
  console.log(`Per-request Limit : ${REQUEST_TIMEOUT_MS}ms timeout`);
  console.log(`Timestamp         : ${new Date().toISOString()}`);
  console.log("================================================================================\n");

  const results = [];

  for (let i = 0; i < GATEWAYS.length; i++) {
    const gw = GATEWAYS[i];
    process.stdout.write(`[${i + 1}/${GATEWAYS.length}] Testing ${gw.name.padEnd(28)}... `);

    // 1. Cold Fetch
    const coldResult = await measureRequest(gw.url, TARGET_CID);

    // 2. 50 Warm Fetches
    const warmLatencies = [];
    let lastStatus = coldResult.status;

    for (let j = 0; j < WARM_FETCH_COUNT; j++) {
      const warmResult = await measureRequest(gw.url, TARGET_CID);
      warmLatencies.push(warmResult.durationMs);
      lastStatus = warmResult.status;
    }

    const stats = calculateStats(warmLatencies);

    results.push({
      gateway: gw.name,
      url: gw.url,
      coldFetchMs: coldResult.durationMs,
      coldStatus: coldResult.status,
      warmStats: stats,
      sampleStatus: lastStatus,
    });

    console.log(`Done. Cold: ${coldResult.durationMs.toFixed(1)}ms | Warm P50: ${stats.p50.toFixed(1)}ms`);
  }

  // Display Formatted Results Table
  console.log("\n================================================================================");
  console.log("                           BENCHMARK RESULTS REPORT                             ");
  console.log("================================================================================");
  console.log(
    "Gateway".padEnd(28) +
    "Cold (ms)".padStart(12) +
    "P50/Med".padStart(10) +
    "P95".padStart(10) +
    "P99".padStart(10) +
    "Mean".padStart(10)
  );
  console.log("-".repeat(80));

  for (const r of results) {
    console.log(
      r.gateway.padEnd(28) +
      r.coldFetchMs.toFixed(1).padStart(12) +
      r.warmStats.p50.toFixed(1).padStart(10) +
      r.warmStats.p95.toFixed(1).padStart(10) +
      r.warmStats.p99.toFixed(1).padStart(10) +
      r.warmStats.mean.toFixed(1).padStart(10)
    );
  }
  console.log("================================================================================\n");

  // Print Slither Automated Security Scan Instructions (Task 2)
  console.log("================================================================================");
  console.log("          SLITHER (AUTOMATED SECURITY SCAN) SETUP & RUN INSTRUCTIONS            ");
  console.log("================================================================================");
  console.log("Slither is a Python-based static analysis framework for Solidity smart contracts.");
  console.log("It cannot be run purely via npm and requires a Python 3 environment.\n");
  console.log("1. INSTALLATION:");
  console.log("   If you haven't installed Slither yet, run in your terminal:");
  console.log("   $ pip3 install slither-analyzer\n");
  console.log("2. EXECUTION (from polygon-contract directory):");
  console.log("   To run a full project security audit, execute:");
  console.log("   $ slither .\n");
  console.log("3. INDIVIDUAL CONTRACT AUDITS:");
  console.log("   $ slither contracts/CertificateNFT.sol");
  console.log("   $ slither contracts/CORegistry.sol");
  console.log("================================================================================\n");
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});

