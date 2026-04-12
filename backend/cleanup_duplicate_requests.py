"""
Run this ONCE to close all the duplicate B+ requests in your DB.
It keeps only the LATEST open request per hospital+blood_group, closes the rest.

Usage:
  cd backend
  python cleanup_duplicate_requests.py
"""

from supabase import create_client

SUPABASE_URL = "https://rxvdtnsgsrzmcoenxxxt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dmR0bnNnc3J6bWNvZW54eHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ4MDg2OSwiZXhwIjoyMDg3MDU2ODY5fQ.pyfSaRI5YF8bLXQygyDaCIhyKzPL3vF1qe4IFmwWmog"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch all open requests
res = supabase.table("blood_requests") \
    .select("id, hospital_id, blood_group, created_at") \
    .in_("status", ["open", "donor_contacted"]) \
    .order("created_at", desc=True) \
    .execute()

requests = res.data or []
print(f"Found {len(requests)} open/donor_contacted requests")

# Group by hospital_id + blood_group, keep latest, close rest
seen = {}
to_close = []

for r in requests:
    key = (r["hospital_id"], r["blood_group"])
    if key not in seen:
        seen[key] = r["id"]  # keep this one (latest)
    else:
        to_close.append(r["id"])  # close duplicates

print(f"Keeping {len(seen)} unique requests, closing {len(to_close)} duplicates\n")

for rid in to_close:
    supabase.table("blood_requests").update({"status": "closed"}).eq("id", rid).execute()
    print(f"  ✅ Closed duplicate request {rid}")

print(f"\nDone! Closed {len(to_close)} duplicate requests.")