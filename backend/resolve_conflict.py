import sys

with open('backend/routes/blood.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Resolve the first conflict block
chunk1_start = text.find('<<<<<<< HEAD\n    """Hospital targets a specific donor')
chunk1_end = text.find('hosp_city = hosp.get("city", "")\n>>>>>>> 8599f70285646bff509b7469152832c016176cb0') + len('hosp_city = hosp.get("city", "")\n>>>>>>> 8599f70285646bff509b7469152832c016176cb0')

if chunk1_start == -1 or chunk1_end < chunk1_start:
    print('Failed to find chunk 1')
    sys.exit(1)

replacement1 = '''    """Verified hospital targets a specific donor."""
    # 1. Validate hospital — try the provided ID first
    hosp_data = None

    try:
        hosp = supabase.table("hospitals") \\
            .select("id, name, city, is_verified") \\
            .eq("id", body.hospital_id) \\
            .single() \\
            .execute()
        hosp_data = hosp.data
    except Exception as e:
        logger.warning(f"Hospital lookup failed for {body.hospital_id}: {e}")

    # If not found, check if this ID belongs to a donor (common stale-session issue)
    if not hosp_data:
        try:
            donor_check = supabase.table("donors") \\
                .select("id, name") \\
                .eq("id", body.hospital_id) \\
                .limit(1) \\
                .execute()
            if donor_check.data:
                donor_name = donor_check.data[0].get("name", "Unknown")
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"You are logged in as donor '{donor_name}', not as a hospital. "
                        f"Please log out and log back in using the Hospital/Org tab "
                        f"with your hospital credentials."
                    )
                )
        except HTTPException:
            raise
        except Exception:
            pass

        raise HTTPException(
            status_code=400,
            detail="Hospital not found for your account. Please log out and log back in as a hospital."
        )

    if not hosp_data.get("is_verified"):
        raise HTTPException(status_code=403, detail="Only verified hospitals can send donor requests.")

    hosp_name   = hosp_data["name"]
    hosp_city   = hosp_data.get("city", "")
    hospital_id = hosp_data["id"]'''

text = text[:chunk1_start] + replacement1 + text[chunk1_end:]

# Resolve the second conflict block
chunk2_start = text.find('<<<<<<< HEAD\n        "message":    f"Request sent to {donor_name}. {\\'SMS alert sent!\\' if sms_count else \\'In-app notification sent.\\'}",\n=======')
chunk2_end = text.find('        "message": f"Response recorded: {new_status}.",\n>>>>>>> 8599f70285646bff509b7469152832c016176cb0') + len('        "message": f"Response recorded: {new_status}.",\n>>>>>>> 8599f70285646bff509b7469152832c016176cb0')

if chunk2_start == -1 or chunk2_end < chunk2_start:
    print('Failed to find chunk 2')
    sys.exit(1)

# we just want to keep the HEAD message for the first part and all the main logic for POST /blood/respond
replacement2 = '''        "message":    f"Request sent to {donor_name}. {'SMS alert sent!' if sms_count else 'In-app notification sent.'}",
    }


# ── POST /blood/respond ───────────────────────────────────────────────────────

class DonorRespondBody(BaseModel):
    request_id: str
    donor_id:   str
    action:     str  # "accept" | "decline"


@router.post("/respond")
def donor_respond(body: DonorRespondBody):
    """Verified donor accepts or declines a blood request."""
    if body.action not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'decline'.")

    # Verification gate
    donor_res = supabase.table("donors") \\
        .select("id, name, is_verified, blood_group") \\
        .eq("id", body.donor_id) \\
        .single() \\
        .execute()
    if not donor_res.data:
        raise HTTPException(status_code=400, detail="Donor not found.")
    if not donor_res.data.get("is_verified"):
        raise HTTPException(status_code=403, detail="Only verified donors can respond to blood requests.")

    donor_name = donor_res.data["name"]
    new_status = "accepted" if body.action == "accept" else "declined"

    # Upsert or update the response row — update ALL rows for this donor+request
    try:
        existing = supabase.table("blood_donor_responses") \\
            .select("id") \\
            .eq("request_id", body.request_id) \\
            .eq("donor_id", body.donor_id) \\
            .execute()

        if existing.data:
            # Update ALL rows (there might be duplicates from old bug)
            result = supabase.table("blood_donor_responses") \\
                .update({"status": new_status, "responded_at": datetime.now(timezone.utc).isoformat()}) \\
                .eq("request_id", body.request_id) \\
                .eq("donor_id", body.donor_id) \\
                .execute()
            logger.info(f"Updated donor response: {result.data}")
        else:
            result = supabase.table("blood_donor_responses").insert({
                "request_id":   body.request_id,
                "donor_id":     body.donor_id,
                "status":       new_status,
                "responded_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            logger.info(f"Inserted donor response: {result.data}")
    except Exception as e:
        logger.error(f"blood_donor_responses error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save response: {e}")

    # If accepted → update request status + notify hospital
    if body.action == "accept":
        req_res = supabase.table("blood_requests") \\
            .select("hospital_id, blood_group, units") \\
            .eq("id", body.request_id) \\
            .single() \\
            .execute()
        if req_res.data:
            supabase.table("blood_requests") \\
                .update({"status": "donor_contacted"}) \\
                .eq("id", body.request_id) \\
                .execute()

            notify(
                user_id    = req_res.data["hospital_id"],
                title      = f"✅ Donor accepted: {donor_name}",
                message    = f"{donor_name} has accepted your {req_res.data['blood_group']} blood request.",
                notif_type = "blood_response",
                module     = "blood",
            )

    return {
        "success": True,
        "status":  new_status,
        "message": f"Response recorded: {new_status}.",'''

text = text[:chunk2_start] + replacement2 + text[chunk2_end:]

with open('backend/routes/blood.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
