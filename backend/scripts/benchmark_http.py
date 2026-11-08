"""Read-only HTTP timings, not browser DCL/LCP or authenticated workflow timings."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import statistics
import time

import httpx


def measure(client, method, url, **kwargs):
    start = time.perf_counter()
    with client.stream(method, url, **kwargs) as response:
        headers_at = time.perf_counter()
        body = response.read()
    return {"status": response.status_code, "ttfb_ms": round((headers_at - start) * 1000, 2),
            "total_ms": round((time.perf_counter() - start) * 1000, 2), "decoded_bytes": len(body),
            "cache": response.headers.get("x-vercel-cache"), "cache_control": response.headers.get("cache-control"),
            "content_encoding": response.headers.get("content-encoding")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default="https://maatru-care.vercel.app")
    parser.add_argument("--backend", default="https://maatrucare.onrender.com")
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    assert 1 <= args.samples <= 100
    report = {"timestamp_utc": datetime.now(timezone.utc).isoformat(),
              "methodology": "Sequential httpx HTTP/1.1 pooled connections; anonymous, read-only. First sample is not a proven cold start. Body sizes are decoded bytes. No browser metrics inferred.",
              "origin": args.origin, "backend": args.backend, "routes": {}}
    with httpx.Client(timeout=45, follow_redirects=True) as client:
        for path in ("/care-circle", "/dashboard", "/tasks", "/handoffs", "/consent"):
            report["routes"][path] = [measure(client, "GET", args.origin.rstrip("/") + path) for _ in range(3)]
        samples = [measure(client, "GET", args.backend.rstrip("/") + "/api/health") for _ in range(args.samples + 1)]
        report["backend_first_sample"] = samples[0]
        report["backend_warm_samples"] = samples[1:]
        latencies = sorted(s["total_ms"] for s in samples[1:])
        report["backend_warm_summary"] = {"n": len(latencies), "p50_ms": statistics.median(latencies),
                                           "p95_ms": latencies[max(0, int(len(latencies) * .95 + .999) - 1)] if len(latencies) >= 20 else None}
        report["cors_preflight"] = measure(client, "OPTIONS", args.backend.rstrip("/") + "/api/tasks", headers={
            "Origin": args.origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"routes": {p: [s["total_ms"] for s in samples] for p, samples in report["routes"].items()},
                      "backend_warm": report["backend_warm_summary"], "cors_ms": report["cors_preflight"]["total_ms"]}))


if __name__ == "__main__":
    main()
