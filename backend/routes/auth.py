"""
routes/auth.py
--------------
Endpoints consumed by:
  • /register page  → POST /auth/register/donor
                    → POST /auth/register/hospital
  • /login page     → POST /auth/login
                    → POST /auth/otp/send
                    → POST /auth/otp/verify
"""

import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional

from utils.db import supabase
from utils.sms import send_sms

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────────

class DonorRegisterRequest(BaseModel):
    first_name: str
    last_name: str
    mobile: str
    aadhaar: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    city: str
    pincode: Optional[str] = None
    blood_group: str
    donor_types: list[str]
    email: EmailStr
    password: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class HospitalRegisterRequest(BaseModel):
    name: str
    reg_number: str
    license: Optional[str] = None
    address: str
    city: str
    contact_person: str
    contact_mobile: str
    contact_email: EmailStr
    password: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "donor"   # "donor" | "hospital" | "admin"


class OtpSendRequest(BaseModel):
    mobile: str


class OtpVerifyRequest(BaseModel):
    mobile: str
    otp: str


# ── Donor Registration ────────────────────────────────────────────────────────

@router.post("/register/donor")
def register_donor(req: DonorRegisterRequest):
    try:
        auth_res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Auth error: {e}")

    user_id = auth_res.user.id if auth_res.user else None
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create auth user")

    try:
        res = supabase.table("donors").insert({
            "id":                 user_id,
            "name":               f"{req.first_name} {req.last_name}",
            "mobile":             req.mobile,
            "aadhaar":            req.aadhaar,
            "dob":                req.dob,
            "gender":             req.gender,
            "city":               req.city,
            "pincode":            req.pincode,
            "blood_group":        req.blood_group,
            "donor_types":        req.donor_types,
            "hla_type":           [],
            "is_available":       True,
            "last_donation_date": None,
            "trust_score":        50,
            "is_verified":        True,
            "lat":                req.lat,
            "lng":                req.lng,
        }).execute()
    except Exception as e:
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception as delete_err:
            print(f"[register_donor] Cleanup failed: {delete_err}")
        err_msg = str(e)
        if "duplicate key" in err_msg.lower():
            if "mobile" in err_msg:
                raise HTTPException(status_code=400, detail="Mobile number already registered")
            if "aadhaar" in err_msg:
                raise HTTPException(status_code=400, detail="Aadhaar number already registered")
        raise HTTPException(status_code=400, detail=f"Registration failed: {err_msg}")

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create donor profile")

    return {
        "success": True,
        "donor_id": user_id,
        "message": "Donor registered successfully.",
    }


# ── Hospital Registration ─────────────────────────────────────────────────────

@router.post("/register/hospital")
def register_hospital(req: HospitalRegisterRequest):
    print(f"[register_hospital] Attempting to sign up {req.contact_email}")
    try:
        auth_res = supabase.auth.sign_up({
            "email": req.contact_email,
            "password": req.password,
        })
    except Exception as e:
        print(f"[register_hospital] Auth error: {e}")
        raise HTTPException(status_code=400, detail=f"Auth error: {e}")

    user_id = auth_res.user.id if auth_res.user else None
    print(f"[register_hospital] Auth successful, user_id: {user_id}")

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="This email is already registered or requires confirmation. Try logging in."
        )

    try:
        res = supabase.table("hospitals").insert({
            "id":          user_id,
            "name":        req.name,
            "reg_number":  req.reg_number,
            "license":     req.license,
            "address":     req.address,
            "city":        req.city,
            "contact":     req.contact_mobile,
            "is_verified": True,
            "lat":         req.lat,   # saved so login can return it to the map
            "lng":         req.lng,   # saved so login can return it to the map
        }).execute()
    except Exception as e:
        print(f"[register_hospital] Profile insert failed: {e}")
        if user_id:
            try:
                supabase.auth.admin.delete_user(user_id)
                print(f"[register_hospital] Cleaned up user {user_id}")
            except Exception as delete_err:
                print(f"[register_hospital] Cleanup failed: {delete_err}")
        err_msg = str(e)
        if "duplicate key" in err_msg.lower():
            raise HTTPException(status_code=400, detail="Registration number already exists")
        raise HTTPException(status_code=400, detail=f"Registration failed: {err_msg}")

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create hospital profile")

    return {
        "success": True,
        "hospital_id": user_id,
        "message": "Hospital registered successfully.",
    }


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(req: LoginRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Login failed: {e}")

    if not res.session:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = res.user.id
    profile = None
    redirect = "/dashboard"

    try:
        if req.role == "donor":
            # Include lat/lng so donor can also appear on maps if needed
            p = supabase.table("donors") \
                .select("name,city,blood_group,trust_score,is_verified,donor_types,lat,lng") \
                .eq("id", user_id).single().execute()
            profile = p.data
            redirect = "/dashboard"

        elif req.role == "hospital":
            # ← CRITICAL: select lat,lng — these power the blue hospital pin on the map
            p = supabase.table("hospitals") \
                .select("name,city,is_verified,lat,lng") \
                .eq("id", user_id).single().execute()
            profile = p.data
            redirect = "/dashboard?role=hospital"

    except Exception as e:
        # Profile not found in DB means they are trying to log in with the wrong role
        print(f"[login] Profile lookup failed for {req.role} {user_id}: {e}")
        error_msg = "No donor profile found." if req.role == "donor" else "No hospital profile found."
        raise HTTPException(
            status_code=403, 
            detail=f"Invalid login portal: {error_msg} Are you trying to log in as a {'hospital' if req.role == 'donor' else 'donor'}?"
        )

    return {
        "success":      True,
        "access_token": res.session.access_token,
        "user_id":      user_id,
        "role":         req.role,
        "profile":      profile,   # contains lat/lng for hospital
        "redirect":     redirect,
    }


# ── OTP Send ──────────────────────────────────────────────────────────────────

@router.post("/otp/send")
def send_otp(req: OtpSendRequest):
    otp = "".join(random.choices(string.digits, k=6))

    supabase.table("otp_store").upsert({
        "mobile": req.mobile,
        "otp": otp,
    }).execute()

    sms_sent = send_sms(
        req.mobile,
        f"Your LifeForge Connect OTP is: {otp}. Valid for 10 minutes. Do not share."
    )

    return {
        "success":  True,
        "sms_sent": sms_sent,
        "otp_dev":  otp,  # remove in production
        "message":  f"OTP {'sent via SMS' if sms_sent else 'generated (SMS not configured)'}.",
    }


# ── OTP Verify ────────────────────────────────────────────────────────────────

@router.post("/otp/verify")
def verify_otp(req: OtpVerifyRequest):
    res = supabase.table("otp_store") \
        .select("otp, created_at") \
        .eq("mobile", req.mobile) \
        .single() \
        .execute()

    if not res.data:
        raise HTTPException(status_code=400, detail="No OTP found for this mobile number")

    stored = res.data
    created = datetime.fromisoformat(stored["created_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - created > timedelta(minutes=10):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if stored["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    supabase.table("otp_store").delete().eq("mobile", req.mobile).execute()

    return {"success": True, "verified": True, "mobile": req.mobile}