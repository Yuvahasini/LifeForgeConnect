import os
import sys

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from utils.db import supabase

def main():
    print("Fetching users to delete...")
    try:
        users_resp = supabase.auth.admin.list_users()
        for u in users_resp:
            print(f"Deleting user {u.email} ({u.id})...")
            supabase.auth.admin.delete_user(u.id)
    except Exception as e:
        print(f"Failed to list/delete auth users: {e}")

    print("Cleaning up old duplicate profiles...")
    try:
        supabase.table("donors").delete().eq("mobile", "9000000001").execute()
        supabase.table("hospitals").delete().eq("reg_number", "TEST-H-001").execute()
    except Exception as e:
        print("Cleanup issues:", e)

    print("\nCreating Donor...")
    try:
        donor_auth = supabase.auth.admin.create_user({
            "email": "donor@test.com",
            "password": "password123",
            "email_confirm": True
        })
        donor_id = donor_auth.user.id
        print(f"Created Auth User for Donor: {donor_id}")
        
        supabase.table("donors").upsert({
            "id": donor_id,
            "name": "Arjun (Test Donor)",
            "mobile": "9000000001",
            "city": "Mumbai",
            "blood_group": "O+",
            "donor_types": ["blood","platelet","milk"],
            "is_verified": True,
            "lat": 19.0760,
            "lng": 72.8777,
            "trust_score": 95
        }).execute()
        print("Created Donor Profile.")
    except Exception as e:
        print(f"Failed to create donor: {e}")

    print("\nCreating Hospital...")
    try:
        hosp_auth = supabase.auth.admin.create_user({
            "email": "hospital@test.com",
            "password": "password123",
            "email_confirm": True
        })
        hosp_id = hosp_auth.user.id
        print(f"Created Auth User for Hospital: {hosp_id}")
        
        supabase.table("hospitals").upsert({
            "id": hosp_id,
            "name": "Apollo Test Hospital",
            "reg_number": "TEST-H-001",
            "address": "Main Road",
            "city": "Mumbai",
            "contact": "8000000001",
            "is_verified": True,
            "lat": 19.0044,
            "lng": 72.8421
        }).execute()
        print("Created Hospital Profile.")
    except Exception as e:
        print(f"Failed to create hospital: {e}")

if __name__ == "__main__":
    main()
