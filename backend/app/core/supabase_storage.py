"""
supabase_storage.py
Handles dual-mode storage: uploads media and baselines to Supabase Storage ('elocia-media')
while keeping local disk storage intact for fast offline playback and instant access.
Includes memory-efficient disk-streaming upload to prevent Render 512MB RAM OOM.
"""

import os
import urllib.request
import urllib.error
import json
import asyncio
import time
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

def upload_file_to_supabase_streaming_sync(folder: str, filename: str, file_path: str, content_type: Optional[str] = None) -> Optional[str]:
    """
    Streams a file from disk to Supabase Storage in 8KB chunks.
    Consumes ~8 KB of RAM instead of buffering the entire file, preventing Render OOM.
    """
    if not SUPABASE_KEY or not SUPABASE_URL or not os.path.exists(file_path):
        return None

    clean_path = f"{folder.strip('/')}/{filename.strip('/')}"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{clean_path}"
    mimetype = content_type or _get_mime_type(filename)
    file_size = os.path.getsize(file_path)

    for attempt in range(1, 4):
        try:
            with open(file_path, "rb") as f_in:
                req = urllib.request.Request(
                    url,
                    data=f_in,
                    headers={
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": mimetype,
                        "Content-Length": str(file_size),
                        "x-upsert": "true",
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=120) as response:
                    if response.status in [200, 201]:
                        return get_public_url(folder, filename)
        except Exception as e:
            if attempt == 3:
                print(f"[Supabase Storage Warning] Could not stream-upload {clean_path} after 3 attempts: {e}")
                return None
            time.sleep(1.5 * attempt)

    return None

async def upload_file_to_supabase_streaming(folder: str, filename: str, file_path: str, content_type: Optional[str] = None) -> Optional[str]:
    """Asynchronously streams a file from disk to Supabase Storage with zero RAM overhead."""
    return await asyncio.to_thread(upload_file_to_supabase_streaming_sync, folder, filename, file_path, content_type)

def upload_to_supabase_sync(folder: str, filename: str, data: bytes, content_type: Optional[str] = None) -> Optional[str]:
    """
    Synchronously uploads bytes to Supabase Storage with x-upsert: true and retries.
    Used for small payloads (JSON, small images).
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

    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                if response.status in [200, 201]:
                    return get_public_url(folder, filename)
        except Exception as e:
            if attempt == 3:
                print(f"[Supabase Storage Warning] Could not upload {clean_path} after 3 attempts: {e}")
                return None
            time.sleep(1.5 * attempt)

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
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status in [200, 204]
    except Exception as e:
        print(f"[Supabase Storage Warning] Could not delete {clean_path}: {e}")
        return False

async def delete_from_supabase(folder: str, filename: str) -> bool:
    """Asynchronously deletes an object from Supabase Storage in an executor thread."""
    return await asyncio.to_thread(delete_from_supabase_sync, folder, filename)
