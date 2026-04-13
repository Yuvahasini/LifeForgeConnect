from utils.db import supabase, supabase_auth

# List ALL auth users and find aster ones
users = supabase_auth.auth.admin.list_users()
for u in users:
    if u.email and "aster" in u.email.lower():
        print(f"Auth ID: {u.id} | Email: {u.email} | Created: {u.created_at}")

print("\n--- Hospital rows ---")
r = supabase.table("hospitals").select("id, name, city").execute()
for h in (r.data or []):
    if "aster" in h["name"].lower():
        print(f"Hospital ID: {h['id']} | Name: {h['name']} | City: {h.get('city','')}")

# Also check if e8ab3b51 exists in donors table (maybe it's a donor account?)
print("\n--- Checking e8ab3b51... in donors ---")
r2 = supabase.table("donors").select("id, name, city").eq("id", "e8ab3b51-6b14-4d3e-9914-5966d2f9b8f9").execute()
print(f"Donor lookup: {r2.data}")
