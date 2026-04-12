import os
from dotenv import load_dotenv
from supabase import create_client

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# `supabase` — used exclusively for DB table operations (service_role, bypasses RLS).
# NEVER call supabase.auth.sign_in_with_password() on this client: in supabase-py v2,
# sign_in mutates the client's session so subsequent table() calls run as the logged-in
# user (subject to RLS) rather than as service_role.
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# `supabase_auth` — a separate client used only for auth operations (sign_up, sign_in,
# admin.list_users, etc.). Its session is allowed to be overwritten by sign_in calls.
supabase_auth = create_client(SUPABASE_URL, SUPABASE_KEY)
