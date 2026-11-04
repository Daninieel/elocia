"""
sync_all_to_supabase.py
Seeds and synchronizes all local demonstration videos, visual aid thumbnails,
and MediaPipe baseline landmark JSONs to Supabase Storage ('elocia-media').
Skips any files that already exist in Supabase to minimize bandwidth and execution time.
"""

import os
import sys
import json
import urllib.request
import urllib.error
import time

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ovffqxjrokyuvlkmccup.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZmZxeGpyb2t5dXZsa21jY3VwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQxOTg5OCwiZXhwIjoyMTAzOTk1ODk4fQ.Tk0FKf1oTPHdnYtq1b9MN-GtfiYPDPyCYZ7y_H0XNKw")
BUCKET_NAME = os.getenv("SUPABASE_STORAGE_BUCKET", "elocia-media")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_mime_type(filename: str) -> str:
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

def list_existing_files(folder: str) -> set:
    """Fetches list of existing filenames in Supabase bucket under a given prefix."""
    existing = set()
    url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET_NAME}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    offset = 0
    limit = 100
    while True:
        payload = json.dumps({"prefix": folder, "limit": limit, "offset": offset}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if not data:
                    break
                for item in data:
                    name = item.get("name")
                    if name:
                        existing.add(name)
                if len(data) < limit:
                    break
                offset += len(data)
        except Exception as e:
            print(f"[Warning] Failed to list existing files for '{folder}': {e}")
            break
    return existing

def upload_file_to_supabase(folder: str, filename: str, filepath: str) -> bool:
    """Uploads a local file to Supabase Storage."""
    clean_path = f"{folder.strip('/')}/{filename.strip('/')}"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{clean_path}"
    mimetype = get_mime_type(filename)

    with open(filepath, "rb") as f:
        file_bytes = f.read()

    req = urllib.request.Request(
        url,
        data=file_bytes,
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": mimetype,
            "x-upsert": "true",
        },
        method="POST"
    )

    retries = 3
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                if response.status in [200, 201]:
                    return True
        except Exception as e:
            if attempt == retries - 1:
                print(f"  [ERROR] Failed to upload {clean_path}: {e}")
                return False
            time.sleep(1)
    return False

def sync_category(category_name: str, folder_prefix: str, local_dirs: list, valid_extensions: list):
    print(f"\n=======================================================")
    print(f"  SYNCING {category_name.upper()} -> '{folder_prefix}/'")
    print(f"=======================================================")

    # 1. Gather all local files
    local_files = {}
    for d in local_dirs:
        abs_d = os.path.abspath(os.path.join(BASE_DIR, d))
        if not os.path.exists(abs_d):
            continue
        for root, _, files in os.walk(abs_d):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in valid_extensions:
                    if f not in local_files:
                        local_files[f] = os.path.join(root, f)

    print(f"Found {len(local_files)} unique local {category_name} files.")

    # 2. Get existing files in Supabase
    print(f"Checking existing files in Supabase 'elocia-media/{folder_prefix}'...")
    existing_in_cloud = list_existing_files(folder_prefix)
    print(f"Already in Supabase: {len(existing_in_cloud)} files.")

    # 3. Filter files that need uploading
    to_upload = {name: path for name, path in local_files.items() if name not in existing_in_cloud}
    print(f"Pending uploads: {len(to_upload)} files.")

    if not to_upload:
        print(f"All {category_name} are already up-to-date in Supabase!")
        return

    # 4. Upload loop
    success_count = 0
    fail_count = 0
    total = len(to_upload)

    for idx, (name, path) in enumerate(to_upload.items(), 1):
        size_kb = os.path.getsize(path) / 1024
        print(f"[{idx}/{total}] Uploading {name} ({size_kb:.1f} KB)...", end=" ", flush=True)
        ok = upload_file_to_supabase(folder_prefix, name, path)
        if ok:
            print("DONE")
            success_count += 1
        else:
            print("FAILED")
            fail_count += 1

    print(f"\nResult for {category_name}: {success_count} uploaded successfully, {fail_count} failed.")

def main():
    print("=======================================================")
    print("   ELOCIA -> SUPABASE STORAGE BATCH MIGRATION TOOL    ")
    print("   Bucket: elocia-media                                ")
    print(f"   Project URL: {SUPABASE_URL}                        ")
    print("=======================================================")

    # 1. Sync Baselines (JSON) - highest priority & tiny (~28 MB total)
    sync_category(
        category_name="Baselines",
        folder_prefix="baselines",
        local_dirs=[
            "apps/student-desktop/desktop/baselines",
            "backend/storage/baselines",
        ],
        valid_extensions=[".json"]
    )

    # 2. Sync Thumbnails (PNG/JPG/WEBP)
    sync_category(
        category_name="Thumbnails & Visual Aids",
        folder_prefix="thumbnails",
        local_dirs=[
            "backend/storage/thumbnails",
            "apps/student-desktop/frontend/public/thumbnails",
        ],
        valid_extensions=[".png", ".jpg", ".jpeg", ".webp"]
    )

    # 3. Sync Videos (MP4)
    sync_category(
        category_name="Demonstration Videos",
        folder_prefix="videos",
        local_dirs=[
            "backend/storage/videos",
            "apps/student-desktop/frontend/public/videos",
        ],
        valid_extensions=[".mp4"]
    )

    print("\n=======================================================")
    print("   ALL CATEGORIES SYNC FINISHED!                      ")
    print("=======================================================\n")

if __name__ == "__main__":
    main()

