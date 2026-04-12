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

from utils.db import supabase, supabase_auth
from utils.sms import send_sms

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────────

class DonorRegisterRequest(BaseModel):
    # Step 1 — Personal
    first_name: str
    last_name: str
    mobile: str
    aadhaar: Optional[str] = None
    dob: Optional[str] = None        # "YYYY-MM-DD"
    gender: Optional[str] = None
    city: str
    pincode: Optional[str] = None
    # Step 2 — Donation prefs
    blood_group: str
    donor_types: list[str]           # ["blood","platelet","marrow","organ","milk"]
    # Step 3 — Account
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
    """
    Called by Register.tsx (DonorRegister component) on step 3 submit.
    1. Pre-check: block duplicate email registration (prevents ghost UUID bug)
    2. Creates Supabase Auth user
    3. Inserts donor profile row
    """
    # 0. Pre-check: block if this email is already registered in donors table
    try:
        dup_check = supabase_auth.auth.admin.list_users()
        for u in (dup_check or []):
            if u.email and u.email.lower() == req.email.lower():
                raise HTTPException(
                    status_code=400,
                    detail="This email is already registered. Please log in instead."
                )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[register_donor] Pre-check skipped: {e}")

    # 1. Create auth user
    try:
        auth_res = supabase_auth.auth.sign_up({
            "email": req.email,
            "password": req.password,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Auth error: {e}")

    user_id = auth_res.user.id if auth_res.user else None
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create auth user")

    # Guard: if donors row already exists for this user_id, skip insert
    try:
        existing = supabase.table("donors").select("id").eq("id", user_id).limit(1).execute()
        if existing.data:
            return {
                "success": True,
                "donor_id": user_id,
                "message": "Donor profile already exists. Please log in.",
            }
    except Exception:
        pass

    # 2. Insert donor profile
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
            "is_verified":        False,
            "lat":                req.lat,
            "lng":                req.lng,
        }).execute()
    except Exception as e:
        # Cleanup auth user if profile fails
        try:
            supabase_auth.auth.admin.delete_user(user_id)
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
        "message": "Donor registered successfully. Pending verification.",
    }


# ── Hospital Registration ─────────────────────────────────────────────────────

@router.post("/register/hospital")
def register_hospital(req: HospitalRegisterRequest):
    """Called by Register.tsx (HospitalRegister component) on submit."""
    print(f"[register_hospital] Attempting to sign up {req.contact_email}")
    try:
        auth_res = supabase_auth.auth.sign_up({
            "email": req.contact_email,
            "password": req.password,
        })
    except Exception as e:
        print(f"[register_hospital] Auth error: {e}")
        raise HTTPException(status_code=400, detail=f"Auth error: {e}")

    user_id = auth_res.user.id if auth_res.user else None
    print(f"[register_hospital] Auth successful, user_id: {user_id}")

    if not user_id:
        print("[register_hospital] User already exists or confirmation required (no user_id)")
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
            "is_verified": False,
            "lat":         req.lat,
            "lng":         req.lng,
        }).execute()
    except Exception as e:
        # Cleanup auth user if profile fails
        print(f"[register_hospital] Profile insert failed: {e}")
        if user_id:
            try:
                supabase_auth.auth.admin.delete_user(user_id)
                print(f"[register_hospital] Cleaned up user {user_id}")
            except Exception as delete_err:
                print(f"[register_hospital] Cleanup failed: {delete_err}")
        
        err_msg = str(e)
        if "duplicate key" in err_msg.lower():
            raise HTTPException(status_code=400, detail="Registration number already exists")
        raise HTTPException(status_code=400, detail=f"Registration failed: {err_msg}")

    if not res.data:
        print("[register_hospital] ERROR: No data returned from insert")
        raise HTTPException(status_code=500, detail="Failed to create hospital profile")

    return {
        "success": True,
        "hospital_id": user_id,
        "message": "Hospital registered. Pending admin verification.",
    }


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(req: LoginRequest):
    """
    Called by Login.tsx on 'Sign In' button.
    Returns a session token the frontend stores in localStorage.
    """
    try:
        res = supabase_auth.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Login failed: {e}")

    if not res.session:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = res.user.id

    # Look up additional profile details
    profile = None
    redirect = "/dashboard"

    try:
        if req.role == "donor":
            p = supabase.table("donors").select("name,city,blood_group,trust_score,is_verified,donor_types").eq("id", user_id).single().execute()
            profile = p.data
            redirect = "/dashboard"
        elif req.role == "hospital":
            p = supabase.table("hospitals").select("name,city,is_verified").eq("id", user_id).single().execute()
            profile = p.data
            redirect = "/dashboard?role=hospital"
    except Exception as e:
        # Profile not found in DB — login still succeeds, but profile will be None
        print(f"[login] Profile lookup failed for {req.role} {user_id}: {e}")
        profile = None

    return {
        "success": True,
        "access_token": res.session.access_token,
        "user_id": user_id,
        "role": req.role,
        "profile": profile,
        "redirect": redirect,
    }


# ── OTP Send ──────────────────────────────────────────────────────────────────

@router.post("/otp/send")
def send_otp(req: OtpSendRequest):
    """
    Called by Login.tsx and Register.tsx 'Get OTP' button.
    Generates 6-digit OTP, stores it, sends via Twilio SMS.
    """
    otp = "".join(random.choices(string.digits, k=6))

    # Upsert into otp_store (mobile is primary key)
    supabase.table("otp_store").upsert({
        "mobile": req.mobile,
        "otp": otp,
    }).execute()

    sms_sent = send_sms(
        req.mobile,
        f"Your LifeForge Connect OTP is: {otp}. Valid for 10 minutes. Do not share."
    )

    return {
        "success": True,
        "sms_sent": sms_sent,
        # Only return otp in dev mode (remove in production!)
        "otp_dev": otp,
        "message": f"OTP {'sent via SMS' if sms_sent else 'generated (SMS not configured)'}.",
    }


# ── OTP Verify ────────────────────────────────────────────────────────────────

@router.post("/otp/verify")
def verify_otp(req: OtpVerifyRequest):
    """Called after user enters the 6-digit OTP."""
    res = supabase.table("otp_store") \
        .select("otp, created_at") \
        .eq("mobile", req.mobile) \
        .single() \
        .execute()

    if not res.data:
        raise HTTPException(status_code=400, detail="No OTP found for this mobile number")

    stored = res.data
    # Check expiry (10 minutes)
    created = datetime.fromisoformat(stored["created_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - created > timedelta(minutes=10):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if stored["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    # Delete after successful verification
    supabase.table("otp_store").delete().eq("mobile", req.mobile).execute()

    return {"success": True, "verified": True, "mobile": req.mobile}