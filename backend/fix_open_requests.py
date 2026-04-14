"""Fix open requests that already have confirmed/accepted matches."""
from utils.db import supabase

open_reqs = supabase.table("platelet_requests").select("id, patient_name, status").eq("status", "open").execute()
print("Open requests before fix:")
for r in open_reqs.data:
    matches = supabase.table("platelet_matches").select("id, status").eq("request_id", r["id"]).execute()
    statuses = [m["status"] for m in (matches.data or [])]
    name = r["patient_name"]
    print(f"  {name}: request=open, match statuses={statuses}")
    if any(s in ("accepted", "confirmed", "completed") for s in statuses):
        supabase.table("platelet_requests").update({"status": "matched"}).eq("id", r["id"]).execute()
        print(f"    -> Updated to matched")

after = supabase.table("platelet_requests").select("patient_name, status").execute()
print("\nAll requests after fix:")
for r in after.data:
    print(f"  {r['patient_name']}: {r['status']}")
