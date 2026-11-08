"""Explicit read-only PostgreSQL plans, without importing the application/startup.

Pass an external connection string through MAATRUCARE_PROFILE_DATABASE_URL only.
No application records, credentials, or connection strings are written to output.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time

import psycopg


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--patient-id", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    url = os.environ["MAATRUCARE_PROFILE_DATABASE_URL"]
    started = time.perf_counter()
    with psycopg.connect(url, sslmode="require", connect_timeout=15) as connection:
        connect_ms = (time.perf_counter() - started) * 1000
        # PostgreSQL enforces read-only at the transaction boundary.
        connection.execute("SET TRANSACTION READ ONLY")
        connection.execute("SET LOCAL statement_timeout = '5000ms'")
        assert connection.execute("SHOW transaction_read_only").fetchone()[0] == "on"
        plans = {}
        for table in ("caregivers", "tasks", "care_handoffs", "timeline_events"):
            query = psycopg.sql.SQL("EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM {} WHERE patient_id = %s ORDER BY id DESC LIMIT 50").format(psycopg.sql.Identifier(table))
            plan = connection.execute(query, (args.patient_id,)).fetchone()[0][0]
            plans[table] = {"planning_ms": plan["Planning Time"], "execution_ms": plan["Execution Time"],
                            "returned_rows": plan["Plan"]["Actual Rows"], "plan": plan["Plan"]["Node Type"]}
        samples = []
        for _ in range(20):
            started = time.perf_counter()
            connection.execute("SELECT 1").fetchone()
            samples.append((time.perf_counter() - started) * 1000)
        samples.sort()
        report = {"timestamp_utc": datetime.now(timezone.utc).isoformat(), "read_only": True,
                  "methodology": "External TLS connection from local machine; fixed read-only ID queries, not full application endpoints. No migrations or application imports.",
                  "connect_ms": round(connect_ms, 2), "select_1_samples": 20,
                  "select_1_p50_ms": round((samples[9] + samples[10]) / 2, 2), "select_1_p95_ms": round(samples[18], 2), "plans": plans}
        connection.rollback()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Avoid printing a driver exception that might include a connection string.
        raise SystemExit(f"Read-only profiling failed ({type(error).__name__}); no credentials printed.") from None
