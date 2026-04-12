"""
routes/platelet.py  (updated)
──────────────────────────────
Fixes:
  1. Life Window timer — reads real expiry_date column
  2. Patient anonymization — donors see "Patient A/B/C", hospitals see real names
  3. Block non-hospitals from POST /platelet/requests
  4. Donor accept/decline flow via platelet_matches
  5. Urgency filtering support
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, Header
from pydantic import BaseModel

from utils.db import supabase
from utils.matching import blood_compatible, days_since
from datetime import date

router = APIRouter()

PLATELET_VIABILITY_HOURS = 120  # 5 days


def _get_user_role(user_id: Optional[str]) -> Optional[str]:
    """Return 'hospital' | 'donor' | None for a given user_id."""
    if not user_id:
        return None
    h = supabase.table("hospitals").select("id").eq("id", user_id).execute()
    if h.data:
        return "hospital"
    d = supabase.table("donors").select("id").eq("id", user_id).execute()
    if d.data:
        return "donor"
    return None


def _anonymize(name: str, index: int) -> str:
    """Patient A, Patient B, … Patient Z, Patient AA …"""
    labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if index < 26:
        return f"Patient {labels[index]}"
    return f"Patient {labels[index // 26 - 1]}{labels[index % 26]}"


# ── GET /platelet/requests/open ───────────────────────────────────────────────

@router.get("/requests/open")
def get_open_platelet_requests(
    urgency: Optional[str] = Query(None),         # filter: critical/urgent/normal
    blood_group: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),         # pass from frontend to determine role
):
    query = supabase.table("platelet_requests") \
        .select("*, hospitals(name, city)") \
        .eq("status", "open") \
        .order("created_at", desc=True)

    if urgency:
        query = query.eq("urgency", urgency.lower())
    if blood_group:
        query = query.eq("blood_group", blood_group)

    res = query.execute()
    now = datetime.now(timezone.utc)

    # Determine if requester is a hospital (sees real names)
    role = _get_user_role(user_id)
    is_hospital = (role == "hospital")

    results = []
    for idx, r in enumerate(res.data or []):
        hospital = r.get("hospitals") or {}

        # ── Life Window calculation ──
        expiry_raw = r.get("expiry_date") or r.get("created_at")
        expiry_dt  = datetime.fromisoformat(expiry_raw.replace("Z", "+00:00"))

        # If we only have created_at, add 5 days
        if not r.get("expiry_date"):
            from datetime import timedelta
            expiry_dt = expiry_dt + timedelta(days=5)

        delta      = expiry_dt - now
        total_secs = delta.total_seconds()
        hours_left = max(0, int(total_secs / 3600))
        days_left  = max(0, int(total_secs / 86400))
        d, h       = divmod(hours_left, 24)
        expiry_label = f"{d}d {h}h"

        # ── Patient name — anonymize for donors/public ──
        display_name = r.get("patient_name") or "Anonymous"
        if not is_hospital:
            display_name = _anonymize(display_name, idx)

        results.append({
            "id":            r["id"],
            "patient":       display_name,
            "real_name":     r.get("patient_name") if is_hospital else None,
            "cancer":        r.get("cancer_type") or "—",
            "group":         r.get("blood_group") or "—",
            "units":         r.get("units", 1),
            "expiry":        expiry_label,
            "urgency":       (r.get("urgency") or "urgent").upper(),
            "hospital":      hospital.get("name", "Unknown"),
            "hospital_city": hospital.get("city", ""),
            "days_left":     days_left,
            "hours_left":    hours_left,
            "is_critical":   days_left <= 1,
            "hospital_id":   r.get("hospital_id"),
        })

    return results


# ── GET /platelet/donors ──────────────────────────────────────────────────────

@router.get("/donors")
def get_platelet_donors(
    blood_group: Optional[str] = Query(None),
    city:        Optional[str] = Query(None),
    limit:       int = Query(10, le=30),
):
    res = supabase.table("donors") \
        .select("id, name, city, blood_group, trust_score, is_available, last_donation_date, donor_types") \
        .eq("is_available", True) \
        .execute()

    results = []
    today = date.today()

    for d in (res.data or []):
        if "platelet" not in (d.get("donor_types") or []):
            continue
        if blood_group and d.get("blood_group"):
            if not blood_compatible(d["blood_group"], blood_group):
                continue
        if city and d.get("city"):
            if city.lower() not in d["city"].lower():
                continue

        since = days_since(d.get("last_donation_date"))
        days_unavail = max(0, 14 - since) if since is not None else 0
        if days_unavail == 0:
            next_avail = "Today"
        elif days_unavail == 1:
            next_avail = "Tomorrow"
        else:
            from datetime import timedelta
            avail_date = today + timedelta(days=days_unavail)
            next_avail = avail_date.strftime("%b %d")

        trust_raw = d.get("trust_score", 50)
        compat = min(99, 85 + int(trust_raw / 100 * 14))

        results.append({
            "id":            d["id"],
            "name":          d["name"],
            "group":         d.get("blood_group") or "—",
            "compat":        compat,
            "trust":         round(trust_raw / 100 * 5, 1),
            "lastApheresis": f"{since} days ago" if since is not None else "No record",
            "nextAvail":     next_avail,
            "city":          d.get("city") or "",
        })

    results.sort(key=lambda x: -x["compat"])
    return results[:limit]


# ── POST /platelet/requests ───────────────────────────────────────────────────

class PlateletRequestBody(BaseModel):
    patient_name: str
    cancer_type:  Optional[str] = None
    blood_group:  Optional[str] = None
    units:        int = 1
    urgency:      str = "urgent"
    hospital_id:  str


@router.post("/requests")
def post_platelet_request(body: PlateletRequestBody):
    # ── Guard: only hospitals can post ──
    role = _get_user_role(body.hospital_id)
    if role != "hospital":
        raise HTTPException(
            status_code=403,
            detail="Only verified hospitals can post platelet requests."
        )

    # Validate patient name (no gibberish)
    name = body.patient_name.strip()
    if len(name) < 2 or not any(c.isalpha() for c in name):
        raise HTTPException(status_code=422, detail="Please enter a valid patient name.")

    res = supabase.table("platelet_requests").insert({
        "patient_name": name,
        "cancer_type":  body.cancer_type,
        "blood_group":  body.blood_group,
        "units":        body.units,
        "urgency":      body.urgency,
        "hospital_id":  body.hospital_id,
        "status":       "open",
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create platelet request")

    return {
        "success":    True,
        "request_id": res.data[0]["id"],
        "message":    "Patient registered. Compatible donors will be alerted.",
    }


# ── POST /platelet/matches ── Donor expresses intent to donate ────────────────

class PlateletMatchBody(BaseModel):
    request_id: str
    donor_id:   str


@router.post("/matches")
def create_platelet_match(body: PlateletMatchBody):
    """Donor clicks 'Donate' — creates a pending match."""
    # ── 1. Donor Eligibility Check ──
    # Platelet (apheresis) donation usually requires a 14-day gap.
    donor = supabase.table("donors") \
        .select("last_donation_date") \
        .eq("id", body.donor_id) \
        .single() \
        .execute()
    
    if donor.data and donor.data.get("last_donation_date"):
        last_date = date.fromisoformat(donor.data["last_donation_date"])
        days_gap = (date.today() - last_date).days
        if days_gap < 14:
            raise HTTPException(
                status_code=403, 
                detail=f"Safety Lockout: You donated {days_gap} days ago. Please wait {14 - days_gap} more days before donating platelets."
            )

    # ── 2. Check not already matched ──
    existing = supabase.table("platelet_matches") \
        .select("id, status") \
        .eq("request_id", body.request_id) \
        .eq("donor_id", body.donor_id) \
        .execute()

    if existing.data:
        status = existing.data[0]["status"]
        if status in ("accepted", "confirmed", "completed"):
            raise HTTPException(status_code=409, detail=f"You already have an active match for this request (Status: {status}).")
        if status == "pending":
            raise HTTPException(status_code=409, detail="You already have a pending intent for this request.")

    res = supabase.table("platelet_matches").insert({
        "request_id": body.request_id,
        "donor_id":   body.donor_id,
        "status":     "pending",
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create match")

    return {"success": True, "match_id": res.data[0]["id"], "message": "Your donation intent has been recorded. The hospital will review and coordinate shortly."}


# ── PATCH /platelet/matches/{match_id} ── Donor accepts or declines ───────────

class MatchUpdateBody(BaseModel):
    status: str   # "accepted" | "declined"
    donor_id: str


@router.api_route("/matches/{match_id}", methods=["PATCH", "PUT"])
def update_platelet_match(match_id: str, body: MatchUpdateBody):
    """
    State Machine:
    - Donor: pending -> accepted | declined
    - Hospital: accepted -> confirmed
    - Hospital: confirmed -> completed
    """
    # Standardize status to lower case and strip whitespace
    status = body.status.strip().lower()
    
    allowed = ("accepted", "declined", "confirmed", "completed", "cancelled")
    if status not in allowed:
        raise HTTPException(status_code=422, detail=f"Invalid status requested: '{status}'. Expected one of {allowed}")

    # 1. Fetch match and request info
    match_res = supabase.table("platelet_matches") \
        .select("*, platelet_requests(hospital_id)") \
        .eq("id", match_id) \
        .single() \
        .execute()

    if not match_res.data:
        raise HTTPException(status_code=404, detail="Match not found.")
    
    match_data = match_res.data
    request_data = match_data.get("platelet_requests") or {}
    hospital_id = request_data.get("hospital_id")
    current_status = match_data["status"]

    # 2. Permission Check
    # Statuses updated by donor
    if body.status in ("accepted", "declined"):
        if match_data["donor_id"] != body.donor_id:
            raise HTTPException(status_code=403, detail="Only the donor can accept/decline.")
    
    # Statuses updated by hospital (Can confirm if pending or accepted)
    if body.status in ("confirmed", "completed"):
        if body.donor_id != hospital_id:
             raise HTTPException(status_code=403, detail="Only the requesting hospital can confirm/complete.")

    # 3. Update Match
    supabase.table("platelet_matches").update({
        "status":       body.status,
        "responded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", match_id).execute()

    # 4. Lifecycle Logic: If completed, close the request
    if body.status == "completed":
        supabase.table("platelet_requests") \
            .update({"status": "closed"}) \
            .eq("id", match_data["request_id"]) \
            .execute()
        
        # Also update donor's last_donation_date
        supabase.table("donors") \
            .update({"last_donation_date": date.today().isoformat()}) \
            .eq("id", match_data["donor_id"]) \
            .execute()

    return {"success": True, "status": body.status}


# ── GET /platelet/matches/donor/{donor_id} ── Donor's pending matches ─────────

@router.get("/matches/donor/{donor_id}")
def get_donor_matches(donor_id: str):
    """Returns all matches for a donor with request details."""
    res = supabase.table("platelet_matches") \
        .select("*, platelet_requests(patient_name, cancer_type, blood_group, units, urgency, hospitals(name, city))") \
        .eq("donor_id", donor_id) \
        .order("created_at", desc=True) \
        .execute()

    results = []
    for m in (res.data or []):
        req = m.get("platelet_requests") or {}
        hospital = req.get("hospitals") or {}
        results.append({
            "match_id":   m["id"],
            "status":     m["status"],
            "created_at": m["created_at"],
            "cancer":     req.get("cancer_type") or "—",
            "group":      req.get("blood_group") or "—",
            "units":      req.get("units", 1),
            "urgency":    (req.get("urgency") or "urgent").upper(),
            "hospital":   hospital.get("name", "Unknown"),
            "city":       hospital.get("city", ""),
        })
    return results


# ── GET /platelet/matches/hospital/{hospital_id} ── Hospital sees all matches ─

@router.get("/matches/hospital/{hospital_id}")
def get_hospital_matches(hospital_id: str):
    """Returns all matches for a hospital's requests."""
    # Get all request IDs for this hospital
    reqs = supabase.table("platelet_requests") \
        .select("id, patient_name, blood_group, urgency") \
        .eq("hospital_id", hospital_id) \
        .execute()

    if not reqs.data:
        return []

    req_ids = [r["id"] for r in reqs.data]
    req_map = {r["id"]: r for r in reqs.data}

    matches = supabase.table("platelet_matches") \
        .select("*, donors(name, blood_group, city, trust_score)") \
        .in_("request_id", req_ids) \
        .order("created_at", desc=True) \
        .execute()

    results = []
    for m in (matches.data or []):
        donor = m.get("donors") or {}
        req   = req_map.get(m["request_id"], {})
        results.append({
            "match_id":     m["id"],
            "request_id":   m["request_id"],
            "patient_name": req.get("patient_name", "—"),
            "status":       m["status"],
            "donor_name":   donor.get("name", "Unknown"),
            "donor_blood":  donor.get("blood_group", "—"),
            "donor_city":   donor.get("city", "—"),
            "donor_trust":  round((donor.get("trust_score", 50) / 100) * 5, 1),
            "created_at":   m["created_at"],
        })
    return results