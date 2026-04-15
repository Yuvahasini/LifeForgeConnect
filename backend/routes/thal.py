"""
routes/thal.py
--------------
Endpoints consumed by ThalCare.tsx:

  ── Hospital / Staff side ──
  GET  /thal/patients                       → patient cards list with countdown labels
  GET  /thal/patients/{id}/matches          → find eligible donors for upcoming transfusion
  GET  /thal/patients/{id}/history          → transfusion history timeline
  GET  /thal/calendar                       → 7-day transfusion calendar widget
  GET  /thal/dashboard                      → operational stats for hospital
  POST /thal/patients                       → register a new thal patient
  POST /thal/transfusion-done               → update last transfusion date, recalc next
  POST /thal/assign-donor                   → assign a donor to a patient (blocks re-use)

  ── Donor side ──
  GET  /thal/donor/{donor_id}/assignments   → list pending/accepted assignments for a donor
  POST /thal/respond                        → donor accepts or declines an assignment

Rules enforced:
  1. A donor CANNOT donate to the same thal patient twice.
  2. 7 days (1 week) before the next transfusion date the system auto-surfaces
     compatible donors who have NEVER donated to that patient before.

State model for matches:
  pending  → hospital assigned, waiting for donor response
  accepted → donor confirmed, ready for transfusion
  declined → donor declined, hospital needs to reassign
  fulfilled → transfusion completed
"""

from datetime import date, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.db import supabase
from utils.matching import days_until, countdown_label, blood_compatible, haversine, days_since
from utils.thal_predictor import predict_next_interval, get_smart_next_date

router = APIRouter()

# When to start surfacing donor matches before the transfusion date
MATCH_WINDOW_DAYS = 7   # 1 week before
AUTO_NOTIFY_DAYS = 5    # auto-notify hospital N days before due date
DONOR_COOLDOWN_DAYS = 56  # days a donor is unavailable after accepting


# ── Notification Helper ──────────────────────────────────────────────────────

def _notify(user_id: str, title: str, message: str, ntype: str = "alert"):
    """Insert a notification row — the existing AuthContext polls every 30s."""
    try:
        supabase.table("notifications").insert({
            "user_id": user_id,
            "title":   title,
            "message": message,
            "type":    ntype,
            "module":  "thal",
        }).execute()
    except Exception as e:
        print(f"[thal._notify] Failed to send notification: {e}")


# ── GET /thal/patients ────────────────────────────────────────────────────────

@router.get("/patients")
def get_thal_patients(hospital_id: Optional[str] = None):
    """
    Powers the 'Active Patients' list on ThalCare.tsx.
    Returns patients with:
      - countdown       ("3 days", "OVERDUE", "Today")
      - is_urgent       (days <= 2)
      - is_critical     (overdue + no accepted donor)
      - needs_match_now (days <= 7  → time to find a donor)
      - freq label      ("Every 21 days")
      - donor           ("Priya M." or "Unmatched")
      - donor_status    ("pending" | "accepted" | "fulfilled" | null)
      - past_donor_ids  (IDs already used — frontend can dim them)
    """
    query = supabase.table("thal_patients") \
        .select("*, hospitals(name, city)")

    if hospital_id:
        query = query.eq("hospital_id", hospital_id)

    res = query.execute()
    patients = res.data or []

    result = []
    for p in patients:
        hospital  = p.get("hospitals") or {}
        next_date = p.get("next_transfusion_date")
        due_days  = days_until(next_date)
        freq      = p.get("transfusion_frequency_days") or 21

        # ── Current assigned donor (pending, accepted, or fulfilled) ─────────
        # Priority: accepted > pending > fulfilled (most recent first)
        match = supabase.table("matches") \
            .select("donor_id, status, donors(name, mobile)") \
            .eq("request_id", p["id"]) \
            .eq("module", "thal") \
            .in_("status", ["pending", "accepted", "fulfilled"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        donor_name = "Unmatched"
        donor_status = None
        current_match_id = None
        current_donor_id = None
        donor_mobile = None
        if match.data:
            m = match.data[0]
            donor_info = m.get("donors")
            if donor_info:
                donor_name = donor_info.get("name", "Unmatched")
                if m.get("status") == "accepted":
                    donor_mobile = donor_info.get("mobile")
            donor_status = m.get("status")
            current_match_id = m.get("id") if "id" in m else None
            current_donor_id = m.get("donor_id")

        # ── Collect ALL past donors for this patient (no-repeat rule) ────────
        past = supabase.table("matches") \
            .select("donor_id") \
            .eq("request_id", p["id"]) \
            .eq("module", "thal") \
            .execute()

        past_donor_ids = list({row["donor_id"] for row in (past.data or []) if row.get("donor_id")})

        # ── needs_match_now: 7 days or less until next transfusion ───────────
        needs_match_now = (
            due_days is not None and 0 <= due_days <= MATCH_WINDOW_DAYS
        )

        # ── is_critical: overdue AND no accepted donor ───────────────────────
        is_overdue = due_days is not None and due_days < 0
        is_critical = is_overdue and donor_status not in ("accepted", "fulfilled")

        # ── AUTO-NOTIFY: if within AUTO_NOTIFY_DAYS and no donor, alert hospital ─
        if (
            due_days is not None
            and 0 <= due_days <= AUTO_NOTIFY_DAYS
            and donor_status not in ("pending", "accepted", "fulfilled")
            and p.get("hospital_id")
        ):
            _auto_notify_hospital_if_needed(p["id"], p["name"], p.get("hospital_id"), due_days)

        # ── Adaptive prediction info ──────────────────────────────────────
        prediction = _get_prediction_for_patient(p["id"], freq)

        result.append({
            "id":              p["id"],
            "name":            p["name"],
            "age":             _calc_age(p.get("dob")),
            "group":           p.get("blood_group") or "—",
            "hospital":        f"{hospital.get('name', '')}, {hospital.get('city', '')}",
            "hospital_id":     p.get("hospital_id"),
            "freq":            f"Every {freq} days",
            "nextDate":        next_date or "—",
            "donor":           donor_name,
            "donor_status":    donor_status,
            "donor_mobile":    donor_mobile,
            "current_match_id": current_match_id,
            "current_donor_id": current_donor_id,
            "countdown":       countdown_label(due_days),
            "days_until":      due_days,
            "is_urgent":       due_days is not None and due_days <= 2,
            "is_critical":     is_critical,
            "needs_match_now": needs_match_now,
            "past_donor_ids":  past_donor_ids,
            "prediction":      prediction,
        })

    result.sort(key=lambda x: (x["days_until"] if x["days_until"] is not None else 999))
    return result


# ── GET /thal/patients/{patient_id}/matches ───────────────────────────────────

@router.get("/patients/{patient_id}/matches")
def get_thal_matches(patient_id: str):
    """
    Returns compatible, available donors who have NEVER donated to this patient
    before (no-repeat rule). Only callable when ≤ 7 days remain until
    next transfusion (enforced on frontend; backend also returns a warning).

    Sorted by trust_score desc, then city proximity (if lat/lng stored).
    """
    # 1. Load the patient
    patient_res = supabase.table("thal_patients") \
        .select("blood_group, next_transfusion_date, name") \
        .eq("id", patient_id) \
        .single() \
        .execute()

    if not patient_res.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient        = patient_res.data
    blood_group    = patient["blood_group"]
    next_date      = patient.get("next_transfusion_date")
    due_days       = days_until(next_date)

    # 2. Warn if called too early (> 7 days away) — doesn't block, just informs
    early_warning = None
    if due_days is not None and due_days > MATCH_WINDOW_DAYS:
        early_warning = (
            f"Transfusion is {due_days} days away. "
            f"Matches are normally surfaced {MATCH_WINDOW_DAYS} days before."
        )

    # 3. Collect IDs of donors who have already donated to this patient
    past_res = supabase.table("matches") \
        .select("donor_id") \
        .eq("request_id", patient_id) \
        .eq("module", "thal") \
        .execute()

    used_donor_ids: set[str] = {
        row["donor_id"] for row in (past_res.data or []) if row.get("donor_id")
    }

    # 4. Pull all available, verified donors
    donors_res = supabase.table("donors") \
        .select("id, name, blood_group, city, trust_score, is_verified, lat, lng, last_donation_date") \
        .eq("is_available", True) \
        .eq("is_verified", True) \
        .execute()

    donors = donors_res.data or []

    # 4b. Get hospital location for proximity scoring
    hospital_lat, hospital_lng = None, None
    if patient_res.data:
        hosp_id = None
        # fetch hospital_id from patient record
        p_full = supabase.table("thal_patients").select("hospital_id").eq("id", patient_id).single().execute()
        if p_full.data:
            hosp_id = p_full.data.get("hospital_id")
        if hosp_id:
            h_res = supabase.table("hospitals").select("lat, lng").eq("id", hosp_id).single().execute()
            if h_res.data:
                hospital_lat = h_res.data.get("lat")
                hospital_lng = h_res.data.get("lng")

    # 4c. Count lifetime donations per donor (from matches table)
    all_thal_matches = supabase.table("matches") \
        .select("donor_id") \
        .eq("module", "thal") \
        .eq("status", "fulfilled") \
        .execute()
    lifetime_counts: dict[str, int] = {}
    for m in (all_thal_matches.data or []):
        did = m.get("donor_id")
        if did:
            lifetime_counts[did] = lifetime_counts.get(did, 0) + 1

    # 5. Filter: blood compatible AND not previously used for THIS patient
    eligible = []
    for d in donors:
        donor_id = d["id"]
        if donor_id in used_donor_ids:
            continue                          # ← no-repeat rule
        if not blood_compatible(d.get("blood_group", ""), blood_group):
            continue

        # ── ML Scoring ─────────────────────────────────────────────────
        score = 0.0

        # Factor 1: Days since last donation (longer gap = higher, max 30 pts)
        days_gap = days_since(d.get("last_donation_date"))
        if days_gap is not None:
            score += min(days_gap / 4.0, 30.0)   # 120+ days → max 30 pts
        else:
            score += 20.0   # never donated = good candidate

        # Factor 2: Lifetime donation count (experience, max 20 pts)
        lifetime = lifetime_counts.get(donor_id, 0)
        score += min(lifetime * 4.0, 20.0)  # 5+ donations → max 20 pts

        # Factor 3: Trust score (max 30 pts)
        trust = d.get("trust_score") or 0
        score += trust * 0.3   # 100 trust → 30 pts

        # Factor 4: Proximity to hospital (max 20 pts, closer = higher)
        distance_km = None
        if hospital_lat and hospital_lng and d.get("lat") and d.get("lng"):
            distance_km = haversine(hospital_lat, hospital_lng, d["lat"], d["lng"])
            # 0 km → 20 pts, 100+ km → 0 pts
            score += max(0, 20.0 - (distance_km / 5.0))

        eligible.append({
            "donor_id":    donor_id,
            "name":        d["name"],
            "blood_group": d["blood_group"],
            "city":        d["city"],
            "trust_score": d.get("trust_score") or 0,
            "is_verified": d.get("is_verified", False),
            "previously_donated_to_patient": False,
            "match_score":      round(score, 1),
            "days_since_donation": days_gap,
            "lifetime_donations": lifetime,
            "distance_km":       distance_km,
        })

    # Sort by ML match_score descending (best candidates first)
    eligible.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "patient_id":       patient_id,
        "patient_name":     patient["name"],
        "blood_group":      blood_group,
        "next_transfusion": next_date,
        "days_until":       due_days,
        "needs_match_now":  due_days is not None and 0 <= due_days <= MATCH_WINDOW_DAYS,
        "early_warning":    early_warning,
        "excluded_donors":  len(used_donor_ids),
        "matches":          eligible,
    }


# ── GET /thal/patients/{patient_id}/history ───────────────────────────────────

@router.get("/patients/{patient_id}/history")
def get_patient_history(patient_id: str, limit: int = 10):
    """
    Returns the transfusion history for a patient — all fulfilled (and accepted)
    matches, most recent first. Used by the History Timeline modal.
    """
    # Verify patient exists
    patient_res = supabase.table("thal_patients") \
        .select("name, blood_group, transfusion_frequency_days") \
        .eq("id", patient_id) \
        .single() \
        .execute()

    if not patient_res.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient = patient_res.data

    # Fetch match history
    history_res = supabase.table("matches") \
        .select("id, donor_id, status, created_at, match_score, donors(name, blood_group, city)") \
        .eq("request_id", patient_id) \
        .eq("module", "thal") \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    history = []
    for m in (history_res.data or []):
        donor = m.get("donors") or {}
        history.append({
            "match_id":     m["id"],
            "donor_name":   donor.get("name", "Unknown"),
            "donor_group":  donor.get("blood_group", "—"),
            "donor_city":   donor.get("city", "—"),
            "status":       m["status"],
            "date":         m["created_at"][:10] if m.get("created_at") else "—",
        })

    return {
        "patient_id":   patient_id,
        "patient_name": patient["name"],
        "blood_group":  patient["blood_group"],
        "frequency":    patient["transfusion_frequency_days"],
        "total":        len(history),
        "history":      history,
    }


# ── GET /thal/calendar ────────────────────────────────────────────────────────

@router.get("/calendar")
def get_thal_calendar(days_ahead: int = 7):
    """
    Powers the 7-day Transfusion Calendar widget on ThalCare.tsx.
    Days where a patient is due in ≤ 7 days are auto-flagged so staff
    know to start searching for donors.
    """
    today  = date.today()
    cutoff = today + timedelta(days=days_ahead - 1)

    res = supabase.table("thal_patients") \
        .select("name, blood_group, next_transfusion_date") \
        .gte("next_transfusion_date", today.isoformat()) \
        .lte("next_transfusion_date", cutoff.isoformat()) \
        .execute()

    by_date: dict[str, list[str]] = {}
    for p in (res.data or []):
        d     = p.get("next_transfusion_date", "")[:10]
        label = f"{p['name'].split()[0]} ({p['blood_group']})"
        by_date.setdefault(d, []).append(label)

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    calendar  = []
    for i in range(days_ahead):
        day      = today + timedelta(days=i)
        dstr     = day.isoformat()
        patients = by_date.get(dstr, [])
        calendar.append({
            "day":              day_names[day.weekday()],
            "date":             str(day.day),
            "has":              len(patients) > 0,
            "label":            patients[0] if patients else None,
            "patients":         patients,
            "needs_match_now":  len(patients) > 0,   # within the 7-day window
        })

    return calendar


# ── GET /thal/dashboard ───────────────────────────────────────────────────────

@router.get("/dashboard")
def get_thal_dashboard(hospital_id: Optional[str] = None):
    """
    Operational summary for hospital staff.
    Returns counts: due_today, due_this_week, unmatched, overdue, total_active.
    """
    query = supabase.table("thal_patients").select("id, next_transfusion_date")
    if hospital_id:
        query = query.eq("hospital_id", hospital_id)

    res = query.execute()
    patients = res.data or []

    today = date.today()
    due_today = 0
    due_this_week = 0
    overdue = 0
    total_active = len(patients)

    patient_ids = [p["id"] for p in patients]

    for p in patients:
        d = days_until(p.get("next_transfusion_date"))
        if d is not None:
            if d < 0:
                overdue += 1
            elif d == 0:
                due_today += 1
            elif d <= 7:
                due_this_week += 1

    # Count unmatched: patients within match window with no pending/accepted donor
    unmatched = 0
    if patient_ids:
        for p in patients:
            d = days_until(p.get("next_transfusion_date"))
            if d is not None and d <= MATCH_WINDOW_DAYS:
                m = supabase.table("matches") \
                    .select("id") \
                    .eq("request_id", p["id"]) \
                    .eq("module", "thal") \
                    .in_("status", ["pending", "accepted"]) \
                    .limit(1) \
                    .execute()
                if not m.data:
                    unmatched += 1

    return {
        "due_today":     due_today,
        "due_this_week": due_this_week,
        "overdue":       overdue,
        "unmatched":     unmatched,
        "total_active":  total_active,
    }


# ── POST /thal/patients ───────────────────────────────────────────────────────

class ThalPatientBody(BaseModel):
    name: str
    blood_group: str
    hospital_id: Optional[str] = None   # Auto-filled from logged-in hospital if omitted
    transfusion_frequency_days: int = 21
    last_transfusion_date: Optional[str] = None   # "YYYY-MM-DD"
    dob: Optional[str] = None


@router.post("/patients")
def register_thal_patient(body: ThalPatientBody):
    """Called by 'Register Patient' button on ThalCare.tsx."""
    if not body.hospital_id:
        raise HTTPException(
            status_code=400,
            detail="Hospital ID is required. Please log in as a hospital."
        )

    freq = body.transfusion_frequency_days

    if body.last_transfusion_date:
        last = date.fromisoformat(body.last_transfusion_date)
    else:
        last = date.today()

    next_date = last + timedelta(days=freq)

    try:
        res = supabase.table("thal_patients").insert({
            "name":                       body.name,
            "blood_group":                body.blood_group,
            "hospital_id":                body.hospital_id,
            "transfusion_frequency_days": freq,
            "last_transfusion_date":      last.isoformat(),
            "next_transfusion_date":      next_date.isoformat(),
            "dob":                        body.dob,
        }).execute()
    except Exception as e:
        # Catch UUID errors or foreign key violations
        err_msg = str(e)
        if "22P02" in err_msg:
            raise HTTPException(status_code=400, detail="Invalid Hospital ID format (must be a valid UUID)")
        raise HTTPException(status_code=500, detail=f"Database error: {err_msg}")

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to register patient")

    days_away = (next_date - date.today()).days
    match_notice = (
        f"Donor matching will begin {MATCH_WINDOW_DAYS} days before "
        f"the transfusion date ({next_date.strftime('%b %d, %Y')})."
    )

    return {
        "success":      True,
        "patient_id":   res.data[0]["id"],
        "next_date":    next_date.isoformat(),
        "message":      f"Patient registered. Next transfusion: {next_date.strftime('%b %d, %Y')}",
        "match_notice": match_notice,
        "days_away":    days_away,
    }


# ── POST /thal/transfusion-done ───────────────────────────────────────────────

class TransfusionDoneBody(BaseModel):
    patient_id: str
    transfusion_date: str   # "YYYY-MM-DD"


@router.post("/transfusion-done")
def mark_transfusion_done(body: TransfusionDoneBody):
    """
    Updates last transfusion date and recalculates next date using
    the adaptive predictor (weighted moving average of past intervals).
    Falls back to configured frequency for patients with little history.
    """
    patient = supabase.table("thal_patients") \
        .select("transfusion_frequency_days, name, hospital_id, last_transfusion_date") \
        .eq("id", body.patient_id) \
        .single() \
        .execute()

    if not patient.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    freq = patient.data["transfusion_frequency_days"] or 21
    last = date.fromisoformat(body.transfusion_date)

    # ── Collect past transfusion dates for prediction ─────────────────────
    past_dates = _collect_transfusion_dates(body.patient_id)
    past_dates.append(body.transfusion_date)  # include this one too

    # ── Use adaptive predictor ────────────────────────────────────────────
    next_date_str, prediction = get_smart_next_date(
        last_transfusion=body.transfusion_date,
        configured_freq=freq,
        past_transfusion_dates=past_dates,
    )
    next_date = date.fromisoformat(next_date_str)

    supabase.table("thal_patients").update({
        "last_transfusion_date": last.isoformat(),
        "next_transfusion_date": next_date.isoformat(),
    }).eq("id", body.patient_id).execute()

    # Mark the most recent accepted match as fulfilled
    latest_match = supabase.table("matches") \
        .select("id, donor_id") \
        .eq("request_id", body.patient_id) \
        .eq("module", "thal") \
        .in_("status", ["accepted", "pending"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if latest_match.data:
        match_row = latest_match.data[0]
        supabase.table("matches").update({
            "status": "fulfilled",
        }).eq("id", match_row["id"]).execute()

        # Notify donor: thank you
        if match_row.get("donor_id"):
            _notify(
                match_row["donor_id"],
                "Transfusion Completed — Thank You! 🎉",
                f"Your donation for {patient.data['name']} has been recorded. "
                f"Thank you for supporting a thalassemia patient!",
                ntype="success",
            )

    # Build prediction summary for the response
    pred_msg = ""
    if prediction["method"] == "adaptive":
        pred_msg = (
            f" (AI-predicted: {prediction['predicted_days']}d based on "
            f"{len(prediction['intervals'])} past intervals, "
            f"confidence {prediction['confidence']:.0%}, trend: {prediction['trend']})"
        )

    return {
        "success":   True,
        "next_date": next_date.isoformat(),
        "message":   f"Transfusion recorded. Next session: {next_date.strftime('%b %d, %Y')}{pred_msg}",
        "match_window_starts": (next_date - timedelta(days=MATCH_WINDOW_DAYS)).isoformat(),
        "prediction": prediction,
    }


# ── POST /thal/assign-donor ───────────────────────────────────────────────────

class AssignDonorBody(BaseModel):
    patient_id: str
    donor_id: str


@router.post("/assign-donor")
def assign_thal_donor(body: AssignDonorBody):
    """
    Assigns a donor to an upcoming thal transfusion.

    Enforces the NO-REPEAT rule:
      → If this donor has already fulfilled a transfusion for this patient
        in ANY previous cycle, the request is rejected with 409 Conflict.
    """
    # 1. Check no-repeat: same donor × same patient in 'matches' table
    existing = supabase.table("matches") \
        .select("id") \
        .eq("request_id", body.patient_id) \
        .eq("donor_id",   body.donor_id) \
        .eq("module",     "thal") \
        .execute()

    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=(
                "This donor has already donated to this patient in a previous cycle. "
                "Please choose a different donor to ensure donor diversity and patient safety."
            )
        )

    # 2. Get patient info for notification
    patient_res = supabase.table("thal_patients") \
        .select("name, blood_group, next_transfusion_date, hospital_id") \
        .eq("id", body.patient_id) \
        .single() \
        .execute()

    patient_name = "a patient"
    hospital_id = None
    next_trans = "upcoming"
    if patient_res.data:
        patient_name = patient_res.data.get("name", "a patient")
        hospital_id = patient_res.data.get("hospital_id")
        next_trans = patient_res.data.get("next_transfusion_date", "upcoming")

    # 3. Insert the match record
    res = supabase.table("matches").insert({
        "request_id":  body.patient_id,
        "donor_id":    body.donor_id,
        "module":      "thal",
        "status":      "pending",
        "match_score": 1.0,   # 1.0 = manually assigned
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to assign donor")

    # 4. Notify donor about the assignment
    _notify(
        body.donor_id,
        "ThalCare Assignment 💉",
        f"You've been assigned to donate for {patient_name} "
        f"(next transfusion: {next_trans}). Please confirm or decline.",
    )

    return {
        "success":  True,
        "match_id": res.data[0]["id"],
        "message":  "Donor assigned successfully. Notification sent to donor.",
    }


# ── GET /thal/donor/{donor_id}/assignments ────────────────────────────────────

@router.get("/donor/{donor_id}/assignments")
def get_donor_assignments(donor_id: str):
    """
    Returns pending and accepted ThalCare assignments for a donor.
    Powers the donor-side view on ThalCare.tsx.
    """
    matches_res = supabase.table("matches") \
        .select("id, request_id, status, created_at, match_score") \
        .eq("donor_id", donor_id) \
        .eq("module", "thal") \
        .in_("status", ["pending", "accepted"]) \
        .order("created_at", desc=True) \
        .execute()

    assignments = []
    for m in (matches_res.data or []):
        # Get patient details
        patient_res = supabase.table("thal_patients") \
            .select("name, blood_group, next_transfusion_date, transfusion_frequency_days, hospitals(name, city, contact)") \
            .eq("id", m["request_id"]) \
            .single() \
            .execute()

        if not patient_res.data:
            continue

        p = patient_res.data
        hospital = p.get("hospitals") or {}
        due_days = days_until(p.get("next_transfusion_date"))

        assignments.append({
            "match_id":        m["id"],
            "patient_id":      m["request_id"],
            "patient_name":    p["name"],
            "blood_group":     p["blood_group"],
            "next_transfusion": p.get("next_transfusion_date") or "—",
            "days_until":      due_days,
            "countdown":       countdown_label(due_days),
            "frequency":       f"Every {p.get('transfusion_frequency_days', 21)} days",
            "hospital":        f"{hospital.get('name', '')}, {hospital.get('city', '')}",
            "hospital_contact": hospital.get("contact") if m["status"] == "accepted" else None,
            "status":          m["status"],
            "assigned_at":     m["created_at"][:10] if m.get("created_at") else "—",
            "is_urgent":       due_days is not None and due_days <= 2,
        })

    return assignments


# ── POST /thal/respond ────────────────────────────────────────────────────────

class ThalRespondBody(BaseModel):
    match_id: str
    donor_id: str
    action: str   # "accept" | "decline"


@router.post("/respond")
def respond_to_assignment(body: ThalRespondBody):
    """
    Donor accepts or declines a ThalCare assignment.
    On accept: status → 'accepted', hospital notified.
    On decline: status → 'declined', hospital notified to reassign.
    """
    if body.action not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'decline'")

    # Verify the match exists and belongs to this donor
    match_res = supabase.table("matches") \
        .select("id, request_id, donor_id, status") \
        .eq("id", body.match_id) \
        .eq("donor_id", body.donor_id) \
        .eq("module", "thal") \
        .single() \
        .execute()

    if not match_res.data:
        raise HTTPException(status_code=404, detail="Assignment not found or does not belong to you")

    match_data = match_res.data
    if match_data["status"] not in ("pending",):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot {body.action} — assignment is already '{match_data['status']}'"
        )

    new_status = "accepted" if body.action == "accept" else "declined"

    supabase.table("matches").update({
        "status": new_status,
    }).eq("id", body.match_id).execute()

    # Get patient and hospital info for notifications
    patient_res = supabase.table("thal_patients") \
        .select("name, hospital_id, blood_group") \
        .eq("id", match_data["request_id"]) \
        .single() \
        .execute()

    patient_name = "a patient"
    hospital_id = None
    patient_blood = None
    if patient_res.data:
        patient_name = patient_res.data.get("name", "a patient")
        hospital_id = patient_res.data.get("hospital_id")
        patient_blood = patient_res.data.get("blood_group")

    # Get donor name for the hospital notification
    donor_res = supabase.table("donors") \
        .select("name") \
        .eq("id", body.donor_id) \
        .single() \
        .execute()

    donor_name = donor_res.data.get("name", "A donor") if donor_res.data else "A donor"

    if body.action == "accept":
        # ── PHASE 3: Donor cooldown — mark unavailable for 56 days ────────
        try:
            cooldown_until = (date.today() + timedelta(days=DONOR_COOLDOWN_DAYS)).isoformat()
            supabase.table("donors").update({
                "is_available": False,
                "last_donation_date": date.today().isoformat(),
            }).eq("id", body.donor_id).execute()
        except Exception as e:
            print(f"[thal.respond] Cooldown update failed: {e}")

        # Notify hospital
        if hospital_id:
            _notify(
                hospital_id,
                "Donor Confirmed ✅",
                f"{donor_name} accepted the assignment for {patient_name}. "
                f"Ready for transfusion.",
                ntype="success",
            )
        msg = "You've accepted this assignment. The hospital has been notified."
    else:
        # Notify hospital
        if hospital_id:
            _notify(
                hospital_id,
                "Donor Declined — Auto-Reassigning ⚠️",
                f"{donor_name} declined the assignment for {patient_name}. "
                f"The system is searching for the next available donor.",
                ntype="alert",
            )

        # ── PHASE 4: Auto-fallback — find and assign next best donor ─────
        auto_assigned = _auto_assign_next_donor(
            patient_id=match_data["request_id"],
            declined_donor_id=body.donor_id,
            patient_blood=patient_blood,
            hospital_id=hospital_id,
            patient_name=patient_name,
        )
        if auto_assigned:
            msg = "You've declined this assignment. The system has auto-assigned another donor."
        else:
            msg = "You've declined this assignment. No other eligible donors found — hospital notified."

    return {
        "success": True,
        "status":  new_status,
        "message": msg,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_age(dob: Optional[str]) -> Optional[int]:
    if not dob:
        return None
    try:
        d = date.fromisoformat(dob[:10])
        return (date.today() - d).days // 365
    except Exception:
        return None


# ── Phase 2: Auto-notify hospital before due date ────────────────────────────

# Track which patients we've already notified this server session to avoid spam
_notified_patients: set[str] = set()

def _auto_notify_hospital_if_needed(
    patient_id: str, patient_name: str, hospital_id: str, days_left: int
):
    """Send a one-time notification to the hospital when a patient is within
    AUTO_NOTIFY_DAYS of their transfusion and has no donor assigned."""
    cache_key = f"{patient_id}:{date.today().isoformat()}"
    if cache_key in _notified_patients:
        return  # already notified today

    # Check if we already sent a thal auto-notify for this patient today
    existing = supabase.table("notifications") \
        .select("id") \
        .eq("user_id", hospital_id) \
        .eq("module", "thal") \
        .like("title", "%Upcoming Transfusion%") \
        .gte("created_at", date.today().isoformat()) \
        .execute()

    if existing.data:
        _notified_patients.add(cache_key)
        return  # already notified via DB

    urgency = "TODAY" if days_left == 0 else f"in {days_left} day(s)"
    _notify(
        hospital_id,
        f"⚠️ Upcoming Transfusion — {patient_name}",
        f"{patient_name} needs a transfusion {urgency} but has no assigned donor. "
        f"Please open ThalCare → Find Donor to assign a compatible donor.",
        ntype="alert",
    )
    _notified_patients.add(cache_key)


# ── Phase 4: Auto-assign next best donor on decline ──────────────────────────

def _auto_assign_next_donor(
    patient_id: str,
    declined_donor_id: str,
    patient_blood: Optional[str],
    hospital_id: Optional[str],
    patient_name: str,
) -> bool:
    """Automatically find and assign the next best eligible donor after a decline.
    Returns True if a new donor was assigned, False if none found."""
    if not patient_blood:
        return False

    # 1. Collect all past donor IDs for this patient (including the one who just declined)
    past_res = supabase.table("matches") \
        .select("donor_id") \
        .eq("request_id", patient_id) \
        .eq("module", "thal") \
        .execute()
    used_ids = {row["donor_id"] for row in (past_res.data or []) if row.get("donor_id")}

    # 2. Find available, verified donors with matching blood group
    donors_res = supabase.table("donors") \
        .select("id, name, blood_group, trust_score, last_donation_date") \
        .eq("is_available", True) \
        .eq("is_verified", True) \
        .execute()

    candidates = []
    for d in (donors_res.data or []):
        if d["id"] in used_ids:
            continue
        if not blood_compatible(d.get("blood_group", ""), patient_blood):
            continue
        # Simple score: trust + days since donation
        score = (d.get("trust_score") or 0) * 0.3
        gap = days_since(d.get("last_donation_date"))
        if gap is not None:
            score += min(gap / 4.0, 30.0)
        else:
            score += 20.0
        candidates.append((score, d))

    if not candidates:
        # No donors available — notify hospital
        if hospital_id:
            _notify(
                hospital_id,
                "No Donors Available ❌",
                f"Auto-reassignment failed for {patient_name}. "
                f"No eligible donors found. Please search manually.",
                ntype="alert",
            )
        return False

    # 3. Pick best candidate
    candidates.sort(key=lambda x: x[0], reverse=True)
    best = candidates[0][1]

    # 4. Insert match record
    res = supabase.table("matches").insert({
        "request_id": patient_id,
        "donor_id":   best["id"],
        "module":     "thal",
        "status":     "pending",
        "match_score": round(candidates[0][0], 2),
    }).execute()

    if not res.data:
        return False

    # 5. Notify the new donor
    _notify(
        best["id"],
        "ThalCare Assignment 💉",
        f"You've been auto-assigned to donate for {patient_name}. "
        f"Please confirm or decline in your ThalCare dashboard.",
    )

    # 6. Notify hospital about auto-reassignment
    if hospital_id:
        _notify(
            hospital_id,
            "Auto-Reassigned ✅",
            f"{best['name']} has been automatically assigned to {patient_name} "
            f"after the previous donor declined.",
            ntype="success",
        )

    return True


def _collect_transfusion_dates(patient_id: str) -> list[str]:
    """
    Reconstruct approximate past transfusion dates from the matches table.
    Each fulfilled match represents a completed transfusion cycle.
    Also includes the patient's last_transfusion_date from the table.
    """
    dates = []

    # Get patient's recorded last transfusion
    patient_res = supabase.table("thal_patients") \
        .select("last_transfusion_date, transfusion_frequency_days") \
        .eq("id", patient_id) \
        .single() \
        .execute()

    if patient_res.data:
        last = patient_res.data.get("last_transfusion_date")
        if last:
            dates.append(str(last)[:10])

    # Get all fulfilled match dates (these are recorded transfusion events)
    matches_res = supabase.table("matches") \
        .select("created_at") \
        .eq("request_id", patient_id) \
        .eq("module", "thal") \
        .eq("status", "fulfilled") \
        .order("created_at", desc=False) \
        .execute()

    for m in (matches_res.data or []):
        if m.get("created_at"):
            dates.append(str(m["created_at"])[:10])

    # De-duplicate and sort
    dates = sorted(set(dates))
    return dates


def _get_prediction_for_patient(patient_id: str, configured_freq: int) -> dict:
    """Build prediction info for a patient card (lightweight)."""
    try:
        past_dates = _collect_transfusion_dates(patient_id)
        if len(past_dates) < 2:
            return {
                "method": "fallback",
                "predicted_days": configured_freq,
                "confidence": 0.0,
                "trend": "stable",
                "trend_detail": "Not enough history for adaptive prediction.",
            }
        prediction = predict_next_interval(past_dates, configured_freq)
        return {
            "method":         prediction["method"],
            "predicted_days": prediction["predicted_days"],
            "confidence":     prediction["confidence"],
            "trend":          prediction["trend"],
            "trend_detail":   prediction["trend_detail"],
        }
    except Exception as e:
        print(f"[thal._get_prediction] Error for {patient_id}: {e}")
        return {
            "method": "fallback",
            "predicted_days": configured_freq,
            "confidence": 0.0,
            "trend": "stable",
            "trend_detail": "Prediction error — using configured frequency.",
        }


# ── GET /thal/patients/{patient_id}/prediction ────────────────────────────────

@router.get("/patients/{patient_id}/prediction")
def get_patient_prediction(patient_id: str):
    """
    Returns full adaptive prediction details for a specific patient.
    Shows the model's analysis: intervals, trend, confidence, predicted days.
    """
    patient_res = supabase.table("thal_patients") \
        .select("name, blood_group, transfusion_frequency_days, last_transfusion_date, next_transfusion_date") \
        .eq("id", patient_id) \
        .single() \
        .execute()

    if not patient_res.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient = patient_res.data
    freq = patient["transfusion_frequency_days"] or 21

    past_dates = _collect_transfusion_dates(patient_id)
    prediction = predict_next_interval(past_dates, freq)

    return {
        "patient_id":     patient_id,
        "patient_name":   patient["name"],
        "blood_group":    patient["blood_group"],
        "configured_freq": freq,
        "current_next":   patient.get("next_transfusion_date"),
        "last_transfusion": patient.get("last_transfusion_date"),
        "data_points":    len(past_dates),
        "prediction":     prediction,
    }