"""
utils/blood_notify.py
---------------------
Thin notification helper for BloodBridge.
Other modules do NOT need to import or modify this file.

Usage:
    from utils.blood_notify import notify
    notify(user_id="...", title="...", message="...", notif_type="blood_request", module="blood")
"""

import logging
from utils.db import supabase

logger = logging.getLogger(__name__)


def notify(user_id: str, title: str, message: str, notif_type: str, module: str = "blood") -> None:
    """
    Insert one notification row. Never raises — notifications are non-critical.
    This is BloodBridge's own wrapper; do not edit the shared notifications table logic here.
    """
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
        logger.warning(f"blood_notify failed (non-fatal): {e}")