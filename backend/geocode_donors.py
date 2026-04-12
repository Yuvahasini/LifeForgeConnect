"""
Run this ONCE to geocode existing donors who have no lat/lng.
Usage:
  pip install supabase requests
  python geocode_donors.py
"""

import time
import requests
from supabase import create_client

SUPABASE_URL = "https://rxvdtnsgsrzmcoenxxxt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dmR0bnNnc3J6bWNvZW54eHh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ4MDg2OSwiZXhwIjoyMDg3MDU2ODY5fQ.pyfSaRI5YF8bLXQygyDaCIhyKzPL3vF1qe4IFmwWmog"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def geocode(city: str, pincode: str = None) -> tuple:
    query = pincode if pincode else f"{city}, India"
    try:
        res = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "LifeForgeConnect/1.0", "Accept-Language": "en"},
            timeout=5,
        )
        data = res.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  Geocoding failed for '{query}': {e}")
    return None, None

# Fetch donors without lat/lng
res = supabase.table("donors").select("id, name, city, pincode, lat, lng").execute()
donors = [d for d in (res.data or []) if not d.get("lat") or not d.get("lng")]

print(f"Found {len(donors)} donors without coordinates\n")

for donor in donors:
    city    = donor.get("city") or ""
    pincode = donor.get("pincode") or ""
    name    = donor.get("name") or donor["id"]

    if not city and not pincode:
        print(f"  Skipping {name} — no city or pincode")
        continue

    lat, lng = geocode(city, pincode)
    if lat and lng:
        supabase.table("donors").update({"lat": lat, "lng": lng}).eq("id", donor["id"]).execute()
        print(f"  ✅ {name} ({city}) → {lat:.4f}, {lng:.4f}")
    else:
        print(f"  ❌ {name} ({city}) — could not geocode")

    time.sleep(1)  # Respect Nominatim rate limit (1 req/sec)

print("\nDone!")