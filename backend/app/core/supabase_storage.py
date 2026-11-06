"""
supabase_storage.py
Handles dual-mode storage: uploads media and baselines to Supabase Storage ('elocia-media')
while keeping local disk storage intact for fast offline playback and instant access.
"""

import os
import urllib.request
import urllib.error
import json
import asyncio
from typing import Optional

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ovffqxjrokyuvlkmccup.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZmZxeGpyb2t5dXZsa21jY3VwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQxOTg5OCwiZXhwIjoyMTAzOTk1ODk4fQ.Tk0FKf1oTPHdnYtq1b9MN-GtfiYPDPyCYZ7y_H0XNKw")
BUCKET_NAME = os.getenv("SUPABASE_STORAGE_BUCKET", "elocia-media")

def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".mp4":
        return "video/mp4"
    elif ext == ".png":
        return "image/png"
    elif ext in [".jpg", ".jpeg"]:
        return "image/jpeg"
    elif ext == ".webp":
        return "image/webp"
    elif ext == ".json":
        return "application/json"
    return "application/octet-stream"

def get_public_url(folder: str, filename: str) -> str:
    """Returns the direct public CDN URL for an object in the Supabase bucket."""
    clean_path = f"{folder.strip('/')}/{filename.strip('/')}"
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{clean_path}"

def upload_to_supabase_sync(folder: str, filename: str, data: bytes, content_type: Optional[str] = None) -> Optional[str]:
    """
    Synchronously uploads bytes to Supabase Storage with x-upsert: true.
    Returns the public URL on success, or None on failure.
    """
    if not SUPABASE_KEY or not SUPABASE_URL:
        return None

    clean_path = f"{folder.strip('/')}/{filename.strip('/')}"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{clean_path}"
    mimetype = content_type or _get_mime_type(filename)

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": mimetype,
            "x-upsert": "true",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            if response.status in [200, 201]:
                return get_public_url(folder, filename)
    except Exception as e:
        # Graceful fallback: log and return None so local storage continues uninterrupted
        print(f"[Supabase Storage Warning] Could not upload {clean_path}: {e}")
        return None

    return None

async def upload_to_supabase(folder: str, filename: str, data: bytes, content_type: Optional[str] = None) -> Optional[str]:
    """Asynchronously uploads bytes to Supabase Storage in an executor thread."""
    return await asyncio.to_thread(upload_to_supabase_sync, folder, filename, data, content_type)

def delete_from_supabase_sync(folder: str, filename: str) -> bool:
    """Deletes an object from Supabase Storage."""
    if not SUPABASE_KEY or not SUPABASE_URL:
        return False

    clean_path = f"{folder.strip('/')}/{filename.strip('/')}"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}"
    body = json.dumps({"prefixes": [clean_path]}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        },
        method="DELETE"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status in [200, 204]
    except Exception as e:
        print(f"[Supabase Storage Warning] Could not delete {clean_path}: {e}")
        return False

async def delete_from_supabase(folder: str, filename: str) -> bool:
    return await asyncio.to_thread(delete_from_supabase_sync, folder, filename)

