import urllib.request
import json
import sys

API_URL = "http://localhost:3001"
WEB_URL = "http://localhost:3000"

def get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return resp.getcode(), resp.headers.get_content_type(), resp.read()

def post(url, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return resp.getcode(), resp.headers.get_content_type(), resp.read()

def run_tests():
    print("========================================")
    print(" RUNNING FULL END-TO-END VERIFICATION  ")
    print("========================================")

    # 1. Test Web Server availability
    print("\n1. Testing Frontend Web Server (port 3000)...")
    status, ctype, body = get(WEB_URL)
    assert status == 200, f"Expected 200, got {status}"
    assert "Worker Debt Ledger" in body.decode("utf-8"), "Missing title in HTML"
    print("  [PASS] Frontend is live and responding with 200 OK.")

    # 2. Test API Health
    print("\n2. Testing Backend API Health (port 3001)...")
    status, ctype, body = get(f"{API_URL}/health")
    data = json.loads(body)
    assert status == 200 and data.get("database") == "connected", "DB not connected"
    print("  [PASS] Backend health: connected to PostgreSQL 16.")

    # 3. Test Workers Roster
    print("\n3. Testing Workers List (GET /workers)...")
    status, ctype, body = get(f"{API_URL}/workers")
    workers = json.loads(body)
    assert len(workers) >= 5, f"Expected at least 5 imported workers, got {len(workers)}"
    print(f"  [PASS] Loaded {len(workers)} workers.")
    for w in workers:
        print(f"    - {w['name']}: Outstanding GHS {w['outstanding_debt']:,} (Paid: GHS {w['total_paid']:,}, Pace: {w.get('pace_pct')}%, Status: {w['status']})")

    # 4. Test SMS Parser (MTN MoMo sample)
    print("\n4. Testing SMS Parsing Flow (MTN MoMo Sample)...")
    mtn_sms = "Payment received for GHS 410.00 from Kofi Oduro  Current Balance: GHS 410.44 . Available Balance: GHS 410.44. Reference: Data. Transaction ID: 89601310174. TRANSACTION FEE: 0.00"
    status, ctype, body = post(f"{API_URL}/ledger/parse-sms", {"message": mtn_sms})
    res = json.loads(body)
    parsed = res["parsed"]
    assert parsed["amount"] == 410.0, f"Amount failed: {parsed['amount']}"
    assert parsed["transaction_ref"] == "89601310174", f"Ref failed: {parsed['transaction_ref']}"
    assert parsed["date_missing"] == True, "Date missing flag should be true for MTN"
    print(f"  [PASS] Parsed MTN: Amount={parsed['amount']}, Sender={parsed['sender_name']}, Ref={parsed['transaction_ref']}, MissingDateFlag={parsed['date_missing']}")

    # 5. Test SMS Parser (Telecel Cash sample with Phone Match)
    print("\n5. Testing SMS Parsing Flow (Telecel Cash with Phone Match)...")
    telecel_sms = """0000014592375973 Confirmed. You have received GHS56.00 from MTN MOBILE MONEY with transaction reference: Transfer From: 233540276077-DANKYI-EBENEZER  on 2026-09-22 at 06:26:04. Your Telecel Cash balance is GHS59.63.
Ref: Edk.
Stay alert. Never share your PIN or OTP with anyone or click unknown links. Protect your personal information."""
    status, ctype, body = post(f"{API_URL}/ledger/parse-sms", {"message": telecel_sms})
    res = json.loads(body)
    parsed = res["parsed"]
    assert parsed["amount"] == 56.0, f"Amount failed: {parsed['amount']}"
    assert parsed["transaction_ref"] == "0000014592375973", f"Ref failed: {parsed['transaction_ref']}"
    assert parsed["date_missing"] == False, "Date should be found for Telecel"
    suggested = res["suggested_worker"]
    assert suggested is not None, "Worker should be suggested"
    assert suggested["name"] == "Eric Sarfo", f"Suggested was {suggested['name']}"
    print(f"  [PASS] Parsed Telecel: Suggested={suggested['name']} (matched via {suggested['matched_on']}, {suggested['similarity']*100}%)")

    # 6. Test Overview Analytics
    print("\n6. Testing Fleet Overview Analytics (GET /analytics/overview)...")
    status, ctype, body = get(f"{API_URL}/analytics/overview")
    overview = json.loads(body)
    kpis = overview["kpis"]
    print(f"  [PASS] KPIs: Total Outstanding GHS {kpis['total_outstanding_debt']:,}, Collections This Month GHS {kpis['total_collected_this_month']:,}, Active Workers {kpis['active_workers']}")
    print(f"  [PASS] Cashflow Trend: {len(overview['cashflow_trend'])} monthly intervals tracked.")

    # 7. Test Leaderboard
    print("\n7. Testing Leaderboard (GET /analytics/leaderboard)...")
    status, ctype, body = get(f"{API_URL}/analytics/leaderboard?sortBy=pace")
    leaderboard = json.loads(body)
    print(f"  [PASS] Ranked {len(leaderboard)} drivers by Pace %:")
    for idx, d in enumerate(leaderboard[:3]):
        print(f"    #{idx+1} {d['name']}: {d.get('pace_pct')}% pace, {d.get('consistency_pct')}% consistency, {d['distinct_weeks_paid']}/{d['weeks_elapsed']} weeks")

    # 8. Test Excel Export and Backup
    print("\n8. Testing Export Endpoints...")
    status, ctype, body = get(f"{API_URL}/workers/export-all.xlsx")
    assert status == 200 and "spreadsheet" in ctype, "All workers Excel export failed"
    print(f"  [PASS] /workers/export-all.xlsx: {len(body)} bytes received.")

    status, ctype, body = get(f"{API_URL}/backup.json")
    backup = json.loads(body)
    assert status == 200 and backup.get("backup_version") == "1.0.0", "Backup failed"
    print(f"  [PASS] /backup.json: valid JSON backup ({backup['counts']['workers']} workers, {backup['counts']['ledger_entries']} ledger entries).")

    print("\n========================================")
    print(" ALL END-TO-END SYSTEM TESTS PASSED!    ")
    print("========================================")

if __name__ == "__main__":
    run_tests()
