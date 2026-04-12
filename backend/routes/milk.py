"""
routes/milk.py
--------------
Production-grade MilkBridge endpoints for neonatal milk donation coordination.

Endpoints:
  GET  /milk/donors               -> Active donor cards with filtering
  GET  /milk/donors/{donor_id}    -> Single donor details
  GET  /milk/bank                 -> Milk Bank pasteurization log table
  GET  /milk/shortage-alerts      -> Open shortage alert cards
  GET  /milk/requests/open        -> All open requests with urgency timers
  GET  /milk/requests/for-donor   -> Requests matching a donor's location
  POST /milk/register-donor       -> Register as milk donor (upsert)
  POST /milk/requests             -> Hospital posts a shortage request
  POST /milk/match                -> Smart matching: find donors for a request
  POST /milk/matches/{id}/respond -> Donor accepts/declines a match
  POST /milk/donations            -> Log a new milk donation (Milk Passport)
  GET  /milk/donations/{passport_id} -> Get donation by passport ID
  GET  /milk/dashboard/hospital   -> Hospital dashboard data
  PATCH /milk/donors/{id}         -> Update donor availability/profile
"""

from datetime import date, datetime, timezone, time
from typing import Optional, List
import time as time_module
import logging
import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator

from utils.db import supabase
from utils.matching import haversine, days_since
from utils.sms import alert_donors

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Retry helper for Windows socket issues ────────────────────────────────────

def _safe_execute(query, retries=3, delay=0.5):
    """Execute a Supabase query with retry on socket errors."""
    last_error = None
    for attempt in range(retries):
        try:
            return query.execute()
        except Exception as e:
            last_error = e
            error_str = str(e)
            if "10035" in error_str or "ReadError" in error_str or "ConnectError" in error_str:
                logger.warning(f"Socket error on attempt {attempt + 1}, retrying: {error_str[:100]}")
                time_module.sleep(delay * (attempt + 1))
                continue
            raise
    raise last_error


# ── Notification helper ───────────────────────────────────────────────────────

def _create_notification(user_id: str, title: str, message: str, notif_type: str, module: str = "milk"):
    """Insert a row into the notifications table. Never raises - non-critical."""
    try:
        supabase.table("notifications").insert({
            "user_id":  user_id,
            "title":    title,
            "message":  message,
            "type":     notif_type,
            "module":   module,
            "is_read":  False,
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to create notification: {e}")


def _generate_passport_id() -> str:
    """Generate a unique Milk Passport ID."""
    yr = datetime.now().strftime("%Y")
    # Get max sequence for this year
    try:
        res = supabase.table("milk_donations") \
            .select("passport_id") \
            .like("passport_id", f"MP-{yr}-%") \
            .order("passport_id", desc=True) \
            .limit(1) \
            .execute()
        if res.data:
            last_id = res.data[0]["passport_id"]
            seq = int(last_id.split("-")[-1]) + 1
        else:
            seq = 1
    except Exception:
        seq = 1
    return f"MP-{yr}-{seq:06d}"


# ══════════════════════════════════════════════════════════════════════════════
# GET ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/donors")
def get_milk_donors(
    city: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    limit: int = Query(50, le=100),
):
    """
    Powers the 'Active Donors' card grid on MilkBridge.tsx.
    """
    query = supabase.table("milk_donors") \
        .select("*, donors(id, name, city, pincode, is_verified, trust_score, lat, lng)") \
        .eq("is_available", True)

    res = _safe_execute(query.limit(200))

    results = []
    for md in (res.data or []):
        donor = md.get("donors") or {}

        # Filter by city if specified
        if city:
            donor_city = (donor.get("city") or "").lower()
            if city.lower() not in donor_city:
                continue

        age_m = md.get("baby_age_months")
        qty = md.get("quantity_ml_per_day")

        # Calculate impact from matches table
        try:
            impact_res = supabase.table("matches") \
                .select("id", count="exact") \
                .eq("donor_id", md.get("donor_id")) \
                .eq("module", "milk") \
                .eq("status", "fulfilled") \
                .execute()
            babies_helped = impact_res.count or 0
        except Exception:
            babies_helped = 0

        impact_label = f"{babies_helped} {'babies' if babies_helped != 1 else 'baby'} fed" if babies_helped else "New donor"

        # Calculate distance if coordinates provided
        distance_km = None
        if lat and lng and donor.get("lat") and donor.get("lng"):
            distance_km = haversine(lat, lng, donor["lat"], donor["lng"])

        is_anonymous = md.get("is_anonymous", False)
        display_name = (
            f"Donor #{str(md['id'])[:8]}"
            if is_anonymous
            else donor.get("name", "Anonymous Donor")
        )

        results.append({
            "id":              md["id"],
            "donor_id":        md.get("donor_id"),
            "name":            display_name,
            "babyAge":         f"{age_m} months" if age_m is not None else "",
            "qty":             f"{qty}ml/day" if qty else "",
            "area":            donor.get("city", ""),
            "verified":        donor.get("is_verified", False),
            "is_screened":     md.get("screening_status") == "cleared",
            "is_anonymous":    is_anonymous,
            "impact":          impact_label,
            "trust_score":     donor.get("trust_score", 50),
            "distance_km":     distance_km,
            "distance":        f"{distance_km:.1f} km" if distance_km is not None else "",
        })

    # Sort by trust score
    results.sort(key=lambda x: -x["trust_score"])

    return results[:limit]


@router.get("/donors/{milk_donor_id}")
def get_milk_donor_detail(milk_donor_id: str):
    """Get detailed information about a specific milk donor."""
    try:
        res = supabase.table("milk_donors") \
            .select("*, donors(id, name, city, pincode, is_verified, trust_score, lat, lng)") \
            .eq("id", milk_donor_id) \
            .single() \
            .execute()
    except Exception as e:
        raise HTTPException(status_code=404, detail="Milk donor not found")

    if not res.data:
        raise HTTPException(status_code=404, detail="Milk donor not found")

    md = res.data
    donor = md.get("donors") or {}

    return {
        "id":              md["id"],
        "donor_id":        md.get("donor_id"),
        "name":            donor.get("name", "Anonymous") if not md.get("is_anonymous") else f"Donor #{str(md['id'])[:8]}",
        "baby_age_months": md.get("baby_age_months"),
        "quantity_ml_per_day": md.get("quantity_ml_per_day"),
        "city":            md.get("city") or donor.get("city", ""),
        "pincode":         md.get("pincode") or donor.get("pincode", ""),
        "screening_status": md.get("screening_status"),
        "screening_date":  md.get("screening_date"),
        "is_available":    md.get("is_available"),
        "is_anonymous":    md.get("is_anonymous"),
        "availability_start": md.get("availability_start"),
        "availability_end":   md.get("availability_end"),
        "verified":        donor.get("is_verified", False),
        "trust_score":     donor.get("trust_score", 50),
    }


@router.get("/bank")
def get_milk_bank():
    """
    Powers the 'Milk Bank - Pasteurization Log' table on MilkBridge.tsx.
    """
    # Get from milk_bank table only (existing schema)
    bank_res = supabase.table("milk_bank") \
        .select("*, donors(name)") \
        .order("pasteurized_date", desc=True) \
        .limit(50) \
        .execute()

    today = date.today()
    results = []

    def fmt_date(d):
        if not d:
            return ""
        try:
            return date.fromisoformat(d[:10]).strftime("%b %d")
        except Exception:
            return d

    for row in (bank_res.data or []):
        donor = row.get("donors") or {}
        expiry_str = row.get("expiry_date")
        status = row.get("status", "Available")

        if expiry_str:
            try:
                expiry_date = date.fromisoformat(expiry_str[:10])
                days_left = (expiry_date - today).days
                if days_left < 0:
                    status = "Expired"
                elif days_left <= 2:
                    status = "Low Stock"
            except Exception:
                pass

        results.append({
            "id":          row.get("passport_id", ""),
            "from":        donor.get("name", "Anonymous"),
            "pasteurized": fmt_date(row.get("pasteurized_date")),
            "expiry":      fmt_date(row.get("expiry_date")),
            "qty":         f"{row.get('quantity_liters', '')}L" if row.get('quantity_liters') else "",
            "status":      status,
        })

    return results


@router.get("/shortage-alerts")
def get_milk_shortage_alerts():
    """
    Powers the 'Shortage Alert' cards on MilkBridge.tsx.
    Returns open milk requests from hospitals/NICUs.
    """
    res = supabase.table("milk_requests") \
        .select("*, hospitals(name, city)") \
        .eq("status", "open") \
        .order("created_at", desc=True) \
        .execute()

    results = []
    now = datetime.now(timezone.utc)

    for r in (res.data or []):
        hospital = r.get("hospitals") or {}
        qty = r.get("daily_quantity_ml")

        # Calculate time elapsed
        raw_ts = r["created_at"].replace("Z", "+00:00")
        try:
            created = datetime.fromisoformat(raw_ts)
            elapsed = now - created
            hours_elapsed = elapsed.total_seconds() / 3600
            time_left_hours = max(0, 24 - hours_elapsed)
            h = int(time_left_hours)
            m = int((time_left_hours - h) * 60)
            time_left = f"{h}h {m:02d}m"
        except Exception:
            time_left = ""
            time_left_hours = 24

        results.append({
            "id":              r["id"],
            "hospital":        hospital.get("name", "Unknown Hospital"),
            "city":            hospital.get("city", ""),
            "infant_name":     r.get("infant_name"),
            "quantity_needed": f"{qty}ml/day" if qty else "",
            "volume_ml":       qty,
            "urgency":         (r.get("urgency") or "normal").upper(),
            "time_left":       time_left,
            "hours_left":      time_left_hours,
            "message":         f"NICU at {hospital.get('name','')}, {hospital.get('city','')} needs "
                              f"<strong>{qty}ml/day</strong> for premature infants."
                              if qty else "NICU needs donor milk for premature infants.",
        })

    return results


@router.get("/requests/open")
def get_open_milk_requests():
    """
    Get all open milk requests with urgency timers (parallel to BloodBridge).
    """
    return get_milk_shortage_alerts()


@router.get("/requests/for-donor")
def get_requests_for_donor(
    donor_id: str = Query(..., description="The donor's user ID"),
):
    """
    Get milk requests matching a donor's location and availability.
    Similar to BloodBridge's get_requests_for_donor endpoint.
    """
    try:
        # Get the milk donor profile
        donor_res = supabase.table("milk_donors") \
            .select("*, donors(city, pincode, lat, lng)") \
            .eq("donor_id", donor_id) \
            .eq("is_available", True) \
            .limit(1) \
            .execute()

        if not donor_res.data:
            return []

        md = donor_res.data[0]
        donor = md.get("donors") or {}
        donor_pincode = md.get("pincode") or donor.get("pincode")
        donor_city = md.get("city") or donor.get("city")
        donor_lat = donor.get("lat")
        donor_lng = donor.get("lng")

        # Get open requests
        req_res = supabase.table("milk_requests") \
            .select("*, hospitals(name, city, pincode, lat, lng)") \
            .eq("status", "open") \
            .order("created_at", desc=True) \
            .limit(30) \
            .execute()

        now = datetime.now(timezone.utc)
        results = []

        for r in (req_res.data or []):
            hospital = r.get("hospitals") or {}

            # Calculate distance if coordinates available
            distance_km = None
            hosp_lat = hospital.get("lat")
            hosp_lng = hospital.get("lng")
            if donor_lat and donor_lng and hosp_lat and hosp_lng:
                distance_km = haversine(donor_lat, donor_lng, hosp_lat, hosp_lng)

            # Check pincode match for priority
            req_pincode = r.get("pincode") or hospital.get("pincode", "")
            pincode_match = donor_pincode and req_pincode and donor_pincode == req_pincode

            # Time calculations
            raw_ts = r["created_at"].replace("Z", "+00:00")
            try:
                created = datetime.fromisoformat(raw_ts)
                elapsed = now - created
                hours_elapsed = elapsed.total_seconds() / 3600
            except Exception:
                hours_elapsed = 0

            urgency = (r.get("urgency") or "normal").upper()
            max_hours = {"CRITICAL": 6, "URGENT": 12, "NORMAL": 24}.get(urgency, 24)
            time_left_hours = max(0, max_hours - hours_elapsed)
            h = int(time_left_hours)
            m = int((time_left_hours - h) * 60)

            qty = r.get("daily_quantity_ml") or r.get("volume_needed_ml")

            results.append({
                "id":           r["id"],
                "hospital":     hospital.get("name", "Unknown Hospital"),
                "city":         hospital.get("city", ""),
                "volume_ml":    qty,
                "quantity":     f"{qty}ml" if qty else "",
                "urgency":      urgency,
                "timeLeft":     f"{h}h {m:02d}m",
                "hours_left":   time_left_hours,
                "distance_km":  distance_km,
                "distance":     f"{distance_km:.1f} km" if distance_km else "",
                "pincode_match": pincode_match,
                "posted":       f"{int(elapsed.total_seconds() / 60)} min ago"
                               if elapsed.total_seconds() < 3600
                               else f"{int(hours_elapsed)}h ago",
            })

        # Sort by pincode match, then distance, then urgency
        results.sort(key=lambda x: (
            0 if x["pincode_match"] else 1,
            x["distance_km"] if x["distance_km"] is not None else 9999,
            {"CRITICAL": 0, "URGENT": 1, "NORMAL": 2}.get(x["urgency"], 2)
        ))

        return results

    except Exception as e:
        logger.error(f"Error in get_requests_for_donor: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch requests. Please try again.")


# ══════════════════════════════════════════════════════════════════════════════
# POST ENDPOINTS - Registration
# ══════════════════════════════════════════════════════════════════════════════

class MilkDonorBody(BaseModel):
    donor_id: str
    baby_age_months: int = Field(..., ge=0, le=24, description="Baby's age in months (0-24)")
    quantity_ml_per_day: int = Field(..., ge=50, le=2000, description="ML available daily (50-2000)")
    pickup_location: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    test_doc_url: Optional[str] = None
    health_score: int = Field(default=70, ge=0, le=100)
    is_anonymous: bool = False
    availability_start: Optional[str] = "08:00"
    availability_end: Optional[str] = "20:00"

    @validator("pincode")
    def validate_pincode(cls, v):
        if v and len(v) != 6:
            raise ValueError("Pincode must be 6 digits")
        if v and not v.isdigit():
            raise ValueError("Pincode must contain only digits")
        return v


@router.post("/register-donor")
def register_milk_donor(body: MilkDonorBody):
    """
    Register or update a milk donor profile.
    Handles duplicates gracefully by updating existing records.
    """
    # Validate donor_id is not empty
    if not body.donor_id or not body.donor_id.strip():
        raise HTTPException(
            status_code=400,
            detail="donor_id is missing. Please log in again and retry."
        )

    logger.info(f"[register-donor] Received donor_id='{body.donor_id}'")

    # Validate donor_id exists in donors table
    # Use .limit(1) instead of .single() to avoid exception on 0 rows
    try:
        donor_check = supabase.table("donors") \
            .select("id, name, city, pincode, mobile") \
            .eq("id", body.donor_id) \
            .limit(1) \
            .execute()
    except Exception as e:
        logger.error(f"[register-donor] DB error checking donor_id='{body.donor_id}': {e}")
        raise HTTPException(status_code=500, detail="Database error. Please try again.")

    if not donor_check.data:
        logger.warning(f"[register-donor] donor_id='{body.donor_id}' not found in donors table")
        raise HTTPException(
            status_code=400,
            detail=f"No donor profile found for this account. "
                   f"Your user ID '{body.donor_id[:8]}...' is not in the donors table. "
                   f"Please log out, register again at /register, then log in."
        )

    donor_data = donor_check.data[0]

    # Check if already registered as milk donor
    existing = supabase.table("milk_donors") \
        .select("id") \
        .eq("donor_id", body.donor_id) \
        .limit(1) \
        .execute()

    # Core fields only (compatible with base schema)
    milk_donor_data = {
        "donor_id":            body.donor_id,
        "baby_age_months":     body.baby_age_months,
        "quantity_ml_per_day": body.quantity_ml_per_day,
        "health_score":        body.health_score,
        "test_doc_url":        body.test_doc_url,
        "is_available":        True,
    }

    if existing.data:
        # Update existing registration
        res = supabase.table("milk_donors") \
            .update(milk_donor_data) \
            .eq("donor_id", body.donor_id) \
            .execute()
        message = "Milk donor profile updated successfully!"
    else:
        # Create new registration
        res = supabase.table("milk_donors").insert(milk_donor_data).execute()
        message = "Registered as milk donor! You'll be notified when NICUs need your milk."

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to register milk donor")

    # Add 'milk' to donor_types
    donor = supabase.table("donors").select("donor_types").eq("id", body.donor_id).single().execute()
    if donor.data:
        types = donor.data.get("donor_types") or []
        if "milk" not in types:
            update = {"donor_types": list(set(types + ["milk"]))}
            if body.city or body.pickup_location:
                update["city"] = body.city or body.pickup_location
            if body.pincode:
                update["pincode"] = body.pincode
            supabase.table("donors").update(update).eq("id", body.donor_id).execute()

    return {
        "success": True,
        "milk_donor_id": res.data[0]["id"],
        "message": message,
    }


# ══════════════════════════════════════════════════════════════════════════════
# POST ENDPOINTS - Hospital Requests
# ══════════════════════════════════════════════════════════════════════════════

class MilkRequestBody(BaseModel):
    hospital_id: str
    infant_name: Optional[str] = None
    daily_quantity_ml: int = Field(..., ge=50, le=5000, description="Daily ML needed (50-5000)")
    urgency: Optional[str] = "normal"   # 'normal' | 'urgent' | 'critical'
    pincode: Optional[str] = None


@router.post("/requests")
def post_milk_request(body: MilkRequestBody):
    """
    Hospital posts a milk shortage request.
    """
    # Validate hospital_id exists
    try:
        hosp = supabase.table("hospitals") \
            .select("id, name, city, lat, lng") \
            .eq("id", body.hospital_id) \
            .single() \
            .execute()
    except Exception:
        hosp = None

    if not hosp or not hosp.data:
        raise HTTPException(
            status_code=400,
            detail=f"Hospital ID not found: {body.hospital_id}. Please verify the hospital is registered."
        )

    hosp_data = hosp.data
    hosp_name = hosp_data["name"]
    hosp_city = hosp_data.get("city", "")

    # Create the request
    request_data = {
        "hospital_id":       body.hospital_id,
        "infant_name":       body.infant_name,
        "daily_quantity_ml": body.daily_quantity_ml,
        "status":            "open",
        "urgency":           (body.urgency or "normal").lower(),
        "pincode":           body.pincode if body.pincode else None,
    }

    try:
        res = supabase.table("milk_requests").insert(request_data).execute()
    except Exception as e:
        logger.error(f"Failed to create milk request: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create milk request: {str(e)[:200]}")

    # res.data may be empty in some Supabase client versions — re-fetch the row id
    if res.data:
        request_id = res.data[0]["id"]
    else:
        try:
            refetch = supabase.table("milk_requests") \
                .select("id") \
                .eq("hospital_id", body.hospital_id) \
                .eq("status", "open") \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()
            request_id = refetch.data[0]["id"] if refetch.data else str(uuid.uuid4())
        except Exception:
            request_id = str(uuid.uuid4())

    # Find and notify all available donors
    donors_res = supabase.table("milk_donors") \
        .select("*, donors(id, name, mobile)") \
        .eq("is_available", True) \
        .execute()

    alerted_mobiles = []
    notified_count = 0

    for md in (donors_res.data or []):
        donor = md.get("donors") or {}
        donor_id = donor.get("id")

        if not donor_id:
            continue

        # Create in-app notification
        _create_notification(
            user_id=donor_id,
            title=f"Milk needed at {hosp_name}",
            message=f"{hosp_name}, {hosp_city} needs {body.daily_quantity_ml}ml/day for NICU. Can you help?",
            notif_type="milk_request",
        )
        notified_count += 1

        if donor.get("mobile"):
            alerted_mobiles.append(donor["mobile"])

    # SMS top 5 donors
    sms_msg = (
        f"NICU ALERT: {hosp_name}, {hosp_city} needs {body.daily_quantity_ml}ml/day of donor milk. "
        f"Reply YES or visit lifeforge.in. LifeForge MilkBridge."
    )
    sms_count = alert_donors(alerted_mobiles[:5], sms_msg)

    # Notify the hospital
    _create_notification(
        user_id=body.hospital_id,
        title="Milk request posted",
        message=f"Your request for {body.daily_quantity_ml}ml/day has been broadcast to {notified_count} donors.",
        notif_type="milk_response",
    )

    return {
        "success":        True,
        "request_id":     request_id,
        "donors_notified": notified_count,
        "sms_sent":       sms_count,
        "message":        f"Shortage alert posted. {notified_count} donor(s) notified.",
    }


# ══════════════════════════════════════════════════════════════════════════════
# POST ENDPOINTS - Smart Matching
# ══════════════════════════════════════════════════════════════════════════════

class MilkMatchBody(BaseModel):
    request_id: str
    max_distance_km: float = Field(default=50, ge=1, le=500)
    min_quantity_ml: Optional[int] = None
    limit: int = Field(default=10, ge=1, le=50)


@router.post("/match")
def find_milk_matches(body: MilkMatchBody):
    """
    Smart matching: find compatible donors for a milk request.
    Matches based on:
    - Screening status (must be cleared)
    - Proximity (pincode or distance)
    - Availability window
    - Donor availability status
    """
    # Get the request details
    try:
        req = supabase.table("milk_requests") \
            .select("*, hospitals(name, city, pincode, lat, lng)") \
            .eq("id", body.request_id) \
            .single() \
            .execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Request not found")

    if not req.data:
        raise HTTPException(status_code=404, detail="Request not found")

    request = req.data
    hospital = request.get("hospitals") or {}
    req_pincode = request.get("pincode") or hospital.get("pincode", "")
    req_lat = request.get("lat") or hospital.get("lat")
    req_lng = request.get("lng") or hospital.get("lng")
    required_qty = request.get("daily_quantity_ml") or body.min_quantity_ml

    # Get all available screened donors
    donors_res = supabase.table("milk_donors") \
        .select("*, donors(id, name, city, pincode, is_verified, trust_score, lat, lng, mobile)") \
        .eq("is_available", True) \
        .eq("screening_status", "cleared") \
        .execute()

    matches = []

    for md in (donors_res.data or []):
        donor = md.get("donors") or {}
        donor_pincode = md.get("pincode") or donor.get("pincode", "")

        # Check quantity requirement
        donor_qty = md.get("quantity_ml_per_day", 0)
        if body.min_quantity_ml and donor_qty < body.min_quantity_ml:
            continue

        # Calculate distance
        distance_km = None
        if req_lat and req_lng and donor.get("lat") and donor.get("lng"):
            distance_km = haversine(req_lat, req_lng, donor["lat"], donor["lng"])
            if distance_km > body.max_distance_km:
                continue

        # Pincode match bonus
        pincode_match = req_pincode and donor_pincode and req_pincode == donor_pincode

        # Calculate match score (0-100)
        score = 50  # Base score

        # Quantity score (up to 20 points)
        if required_qty and donor_qty >= required_qty:
            score += 20
        elif required_qty:
            score += int((donor_qty / required_qty) * 20)

        # Distance score (up to 20 points)
        if pincode_match:
            score += 20
        elif distance_km is not None:
            score += max(0, int(20 - (distance_km / body.max_distance_km) * 20))

        # Trust score (up to 10 points)
        score += int(donor.get("trust_score", 50) / 10)

        # Respect anonymity
        display_name = donor.get("name", "Anonymous Donor")
        if md.get("is_anonymous"):
            display_name = f"Donor #{str(md['id'])[:8]}"

        matches.append({
            "milk_donor_id": md["id"],
            "donor_id":      donor.get("id"),
            "name":          display_name,
            "city":          md.get("city") or donor.get("city", ""),
            "pincode":       donor_pincode,
            "quantity_ml":   donor_qty,
            "distance_km":   distance_km,
            "distance":      f"{distance_km:.1f} km" if distance_km else "Same area",
            "match_score":   min(100, score),
            "trust_score":   donor.get("trust_score", 50),
            "verified":      donor.get("is_verified", False),
            "is_anonymous":  md.get("is_anonymous", False),
            "pincode_match": pincode_match,
        })

    # Sort by match score descending
    matches.sort(key=lambda x: -x["match_score"])

    return {
        "request_id": body.request_id,
        "hospital":   hospital.get("name", "Unknown"),
        "city":       hospital.get("city", ""),
        "quantity_needed": request.get("daily_quantity_ml"),
        "urgency":    request.get("urgency", "normal"),
        "total_matches": len(matches),
        "matches":    matches[:body.limit],
    }


class MilkMatchCreateBody(BaseModel):
    request_id: str
    donor_id: str
    milk_donor_id: Optional[str] = None


@router.post("/matches")
def create_milk_match(body: MilkMatchCreateBody):
    """Create a match record between a donor and a request."""
    # Validate request exists
    req = supabase.table("milk_requests").select("id, hospital_id").eq("id", body.request_id).single().execute()
    if not req.data:
        raise HTTPException(status_code=404, detail="Request not found")

    # Validate donor exists
    donor = supabase.table("donors").select("id, name, mobile").eq("id", body.donor_id).single().execute()
    if not donor.data:
        raise HTTPException(status_code=404, detail="Donor not found")

    # Check for existing match
    existing = supabase.table("milk_matches") \
        .select("id") \
        .eq("request_id", body.request_id) \
        .eq("donor_id", body.donor_id) \
        .limit(1) \
        .execute()

    if existing.data:
        return {
            "success": True,
            "match_id": existing.data[0]["id"],
            "message": "Match already exists",
        }

    # Create match
    match_data = {
        "request_id":    body.request_id,
        "donor_id":      body.donor_id,
        "milk_donor_id": body.milk_donor_id,
        "status":        "pending",
        "notified_at":   datetime.now(timezone.utc).isoformat(),
    }

    res = supabase.table("milk_matches").insert(match_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create match")

    # Notify donor
    _create_notification(
        user_id=body.donor_id,
        title="You've been matched!",
        message="A hospital has requested your milk donation. Please respond on LifeForge.",
        notif_type="milk_match",
    )

    return {
        "success":  True,
        "match_id": res.data[0]["id"],
        "message":  "Match created and donor notified.",
    }


class MilkMatchResponseBody(BaseModel):
    donor_id: str
    status: str = Field(..., pattern="^(accepted|declined)$")


@router.post("/matches/{match_id}/respond")
def respond_to_milk_match(match_id: str, body: MilkMatchResponseBody):
    """Donor accepts or declines a match."""
    # Get the match
    match_res = supabase.table("milk_matches") \
        .select("*, milk_requests(hospital_id, hospitals(name))") \
        .eq("id", match_id) \
        .single() \
        .execute()

    if not match_res.data:
        raise HTTPException(status_code=404, detail="Match not found")

    match = match_res.data

    # Verify donor owns this match
    if match.get("donor_id") != body.donor_id:
        raise HTTPException(status_code=403, detail="You are not authorized to respond to this match")

    # Update match status
    supabase.table("milk_matches").update({
        "status":       body.status,
        "responded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", match_id).execute()

    # Also update central matches table if exists
    try:
        supabase.table("matches").update({
            "status": body.status,
        }).eq("request_id", match.get("request_id")).eq("donor_id", body.donor_id).eq("module", "milk").execute()
    except Exception:
        pass

    # Notify hospital
    request = match.get("milk_requests") or {}
    hospital = request.get("hospitals") or {}
    hospital_id = request.get("hospital_id")

    if hospital_id:
        if body.status == "accepted":
            _create_notification(
                user_id=hospital_id,
                title="Donor accepted!",
                message=f"A milk donor has accepted your request. Please coordinate pickup.",
                notif_type="milk_response",
            )
        else:
            _create_notification(
                user_id=hospital_id,
                title="Donor declined",
                message="A donor has declined. We're finding other matches.",
                notif_type="milk_response",
            )

    return {
        "success": True,
        "status":  body.status,
        "message": f"You have {body.status} this request.",
    }


@router.get("/matches/donor/{donor_id}")
def get_donor_matches(donor_id: str):
    """Get all matches for a specific donor (for donor's view)."""
    try:
        res = supabase.table("milk_matches") \
            .select("*, milk_requests(hospital_id, daily_quantity_ml, urgency, hospitals(name, city))") \
            .eq("donor_id", donor_id) \
            .order("created_at", desc=True) \
            .limit(20) \
            .execute()
    except Exception as e:
        logger.error(f"Error fetching donor matches: {e}")
        return []

    results = []
    for m in (res.data or []):
        request = m.get("milk_requests") or {}
        hospital = request.get("hospitals") or {}

        results.append({
            "id": m["id"],
            "request_id": m.get("request_id"),
            "hospital_name": hospital.get("name", "Unknown Hospital"),
            "hospital_city": hospital.get("city", ""),
            "volume_ml": request.get("daily_quantity_ml"),
            "urgency": (request.get("urgency") or "normal").upper(),
            "status": m.get("status"),
            "pickup_date": m.get("pickup_date"),
            "pickup_time": m.get("pickup_time"),
            "created_at": m.get("created_at"),
            "responded_at": m.get("responded_at"),
        })

    return results


class MilkMatchUpdateBody(BaseModel):
    status: str
    pickup_date: Optional[str] = None
    pickup_time: Optional[str] = None


@router.patch("/matches/{match_id}")
def update_milk_match_status(match_id: str, body: MilkMatchUpdateBody):
    """
    Update match status (for hospital workflow).
    Status flow: pending -> accepted -> pickup_scheduled -> collected -> delivered
    """
    # Get current match
    match_res = supabase.table("milk_matches") \
        .select("*, milk_requests(hospital_id), donors(id, name, mobile)") \
        .eq("id", match_id) \
        .single() \
        .execute()

    if not match_res.data:
        raise HTTPException(status_code=404, detail="Match not found")

    match = match_res.data
    donor = match.get("donors") or {}
    request = match.get("milk_requests") or {}

    # Build update data
    update_data = {"status": body.status}
    if body.pickup_date:
        update_data["pickup_date"] = body.pickup_date
    if body.pickup_time:
        update_data["pickup_time"] = body.pickup_time

    # Update the match
    supabase.table("milk_matches").update(update_data).eq("id", match_id).execute()

    # Create notifications based on status change
    donor_id = match.get("donor_id")
    if donor_id:
        if body.status == "pickup_scheduled":
            pickup_info = f"{body.pickup_date}"
            if body.pickup_time:
                pickup_info += f" at {body.pickup_time}"
            _create_notification(
                user_id=donor_id,
                title="Pickup Scheduled!",
                message=f"Your milk donation pickup is scheduled for {pickup_info}. Please keep the milk refrigerated.",
                notif_type="milk_pickup",
            )
            # Also try to send SMS
            if donor.get("mobile"):
                try:
                    from utils.sms import send_sms
                    send_sms(donor["mobile"], f"LifeForge: Your milk donation pickup is scheduled for {pickup_info}. Thank you!")
                except Exception:
                    pass
        elif body.status == "collected":
            _create_notification(
                user_id=donor_id,
                title="Donation Collected",
                message="Your milk donation has been collected. Thank you for helping save lives!",
                notif_type="milk_collected",
            )
        elif body.status == "delivered":
            _create_notification(
                user_id=donor_id,
                title="Donation Delivered!",
                message="Your milk donation has reached the NICU. A baby is being nourished because of you!",
                notif_type="milk_delivered",
            )

    return {
        "success": True,
        "message": f"Match status updated to {body.status}",
    }


# ══════════════════════════════════════════════════════════════════════════════
# POST ENDPOINTS - Donation Tracking (Milk Passport)
# ══════════════════════════════════════════════════════════════════════════════

class MilkDonationBody(BaseModel):
    donor_id: str
    request_id: Optional[str] = None
    collection_date: str
    volume_ml: int = Field(..., ge=50, le=5000)
    pasteurized: bool = False
    pasteurization_date: Optional[str] = None
    pasteurization_method: Optional[str] = None
    receiving_hospital_id: Optional[str] = None
    receiving_infant_ref: Optional[str] = None
    notes: Optional[str] = None


@router.post("/donations")
def create_milk_donation(body: MilkDonationBody):
    """
    Log a new milk donation (Milk Passport).
    Creates a tracked donation record with unique passport ID.
    """
    # Validate donor
    donor_res = supabase.table("donors").select("id, name").eq("id", body.donor_id).single().execute()
    if not donor_res.data:
        raise HTTPException(status_code=400, detail="Donor not found")

    # Get milk_donor_id if exists
    milk_donor = supabase.table("milk_donors").select("id").eq("donor_id", body.donor_id).limit(1).execute()
    milk_donor_id = milk_donor.data[0]["id"] if milk_donor.data else None

    # Validate hospital if provided
    if body.receiving_hospital_id:
        hosp = supabase.table("hospitals").select("id").eq("id", body.receiving_hospital_id).single().execute()
        if not hosp.data:
            raise HTTPException(status_code=400, detail="Receiving hospital not found")

    # Generate passport ID
    passport_id = _generate_passport_id()

    # Calculate expiry (7 days from pasteurization or collection)
    base_date = body.pasteurization_date or body.collection_date
    try:
        base = date.fromisoformat(base_date[:10])
        expiry = (base + __import__('datetime').timedelta(days=7)).isoformat()
    except Exception:
        expiry = None

    donation_data = {
        "passport_id":          passport_id,
        "donor_id":             body.donor_id,
        "milk_donor_id":        milk_donor_id,
        "request_id":           body.request_id,
        "collection_date":      body.collection_date,
        "volume_ml":            body.volume_ml,
        "pasteurized":          body.pasteurized,
        "pasteurization_date":  body.pasteurization_date,
        "pasteurization_method": body.pasteurization_method,
        "expiry_date":          expiry,
        "receiving_hospital_id": body.receiving_hospital_id,
        "receiving_infant_ref": body.receiving_infant_ref,
        "status":               "pasteurized" if body.pasteurized else "collected",
        "notes":                body.notes,
    }

    res = supabase.table("milk_donations").insert(donation_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create donation record")

    # Update last_donation_date on milk_donor
    if milk_donor_id:
        supabase.table("milk_donors").update({
            "last_donation_date": body.collection_date,
        }).eq("id", milk_donor_id).execute()

    # Create match record for tracking
    try:
        supabase.table("matches").insert({
            "module":     "milk",
            "donor_id":   body.donor_id,
            "request_id": body.request_id,
            "status":     "fulfilled",
        }).execute()
    except Exception:
        pass

    return {
        "success":     True,
        "passport_id": passport_id,
        "donation_id": res.data[0]["id"],
        "expiry_date": expiry,
        "message":     f"Donation logged! Milk Passport ID: {passport_id}",
    }


@router.get("/donations/{passport_id}")
def get_donation_by_passport(passport_id: str):
    """Get donation details by Milk Passport ID."""
    res = supabase.table("milk_donations") \
        .select("*, donors(name), hospitals:receiving_hospital_id(name, city)") \
        .eq("passport_id", passport_id) \
        .single() \
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Donation not found")

    d = res.data
    donor = d.get("donors") or {}
    hospital = d.get("hospitals") or {}

    return {
        "passport_id":          d["passport_id"],
        "donor_name":           donor.get("name", "Anonymous"),
        "collection_date":      d.get("collection_date"),
        "volume_ml":            d.get("volume_ml"),
        "pasteurized":          d.get("pasteurized"),
        "pasteurization_date":  d.get("pasteurization_date"),
        "pasteurization_method": d.get("pasteurization_method"),
        "expiry_date":          d.get("expiry_date"),
        "receiving_hospital":   hospital.get("name"),
        "receiving_city":       hospital.get("city"),
        "receiving_infant_ref": d.get("receiving_infant_ref"),
        "status":               d.get("status"),
        "quality_check_passed": d.get("quality_check_passed"),
        "created_at":           d.get("created_at"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/hospital/{hospital_id}")
def get_hospital_milk_dashboard(hospital_id: str):
    """
    Hospital-side MilkBridge dashboard showing:
    - Active requests
    - Matched donors
    - Donation history
    - Inventory / milk bank status
    """
    # Validate hospital
    hosp = supabase.table("hospitals").select("id, name, city").eq("id", hospital_id).single().execute()
    if not hosp.data:
        raise HTTPException(status_code=404, detail="Hospital not found")

    hospital = hosp.data

    # Get active requests
    requests_res = supabase.table("milk_requests") \
        .select("*") \
        .eq("hospital_id", hospital_id) \
        .eq("status", "open") \
        .order("created_at", desc=True) \
        .limit(10) \
        .execute()

    active_requests = []
    for r in (requests_res.data or []):
        active_requests.append({
            "id":         r["id"],
            "infant_ref": r.get("infant_name", "General NICU"),
            "volume_ml":  r.get("daily_quantity_ml"),
            "urgency":    r.get("urgency", "normal"),
            "created_at": r.get("created_at"),
        })

    # Get matched donors for active requests
    request_ids = [r["id"] for r in (requests_res.data or [])]
    matches = []

    if request_ids:
        matches_res = supabase.table("milk_matches") \
            .select("*, donors(name, city), milk_donors(quantity_ml_per_day)") \
            .in_("request_id", request_ids) \
            .order("created_at", desc=True) \
            .limit(20) \
            .execute()

        for m in (matches_res.data or []):
            donor = m.get("donors") or {}
            milk_donor = m.get("milk_donors") or {}
            matches.append({
                "id":          m["id"],
                "donor_name":  donor.get("name", "Anonymous"),
                "city":        donor.get("city", ""),
                "quantity_ml": milk_donor.get("quantity_ml_per_day"),
                "status":      m.get("status"),
                "request_id":  m.get("request_id"),
            })

    # Get donation history (received)
    donations_res = supabase.table("milk_donations") \
        .select("*, donors(name)") \
        .eq("receiving_hospital_id", hospital_id) \
        .order("collection_date", desc=True) \
        .limit(20) \
        .execute()

    donation_history = []
    for d in (donations_res.data or []):
        donor = d.get("donors") or {}
        donation_history.append({
            "passport_id": d.get("passport_id"),
            "donor_name":  donor.get("name", "Anonymous"),
            "volume_ml":   d.get("volume_ml"),
            "date":        d.get("collection_date"),
            "status":      d.get("status"),
        })

    # Calculate stats
    total_received = sum(d.get("volume_ml", 0) for d in (donations_res.data or []))
    fulfilled_count = len([d for d in (donations_res.data or []) if d.get("status") == "delivered"])

    return {
        "hospital": {
            "id":   hospital["id"],
            "name": hospital["name"],
            "city": hospital.get("city", ""),
        },
        "stats": {
            "active_requests":   len(active_requests),
            "pending_matches":   len([m for m in matches if m["status"] == "pending"]),
            "accepted_matches":  len([m for m in matches if m["status"] == "accepted"]),
            "total_received_ml": total_received,
            "donations_received": fulfilled_count,
        },
        "active_requests":  active_requests,
        "matched_donors":   matches,
        "donation_history": donation_history,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PATCH Endpoints - Updates
# ══════════════════════════════════════════════════════════════════════════════

class MilkDonorUpdateBody(BaseModel):
    is_available: Optional[bool] = None
    quantity_ml_per_day: Optional[int] = None
    baby_age_months: Optional[int] = None
    availability_start: Optional[str] = None
    availability_end: Optional[str] = None
    is_anonymous: Optional[bool] = None


@router.patch("/donors/{milk_donor_id}")
def update_milk_donor(milk_donor_id: str, body: MilkDonorUpdateBody):
    """Update milk donor availability or profile."""
    # Build update dict with only provided fields
    update_data = {k: v for k, v in body.dict().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = supabase.table("milk_donors").update(update_data).eq("id", milk_donor_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Milk donor not found")

    return {
        "success": True,
        "message": "Profile updated",
        "data":    res.data[0],
    }
