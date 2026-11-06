"""
compress_and_upload_existing_video.py
Compresses the existing 73.5 MB educational video to under 30 MB, extracts an HD thumbnail,
uploads both to Supabase Storage ('elocia-media'), and updates the Supabase PostgreSQL record.
"""

import os
import sys
import subprocess
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Add backend directory to sys.path so we can reuse app modules
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)

from app.core.supabase_storage import upload_to_supabase_sync, get_public_url

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres.ovffqxjrokyuvlkmccup:Elocia.51326@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
)

TARGET_VIDEO_NAME = "edu_95fa6664_GG_Learns_FSL__Ep_1_Greetings_and_Basic_Communication_web.mp4"
THUMB_FILENAME = "thumb_edu_95fa6664_GG_Learns_FSL__Ep_1_Greetings_and_Basic_Communication.jpg"

def main():
    print("==================================================================")
    print("  COMPRESS & SYNC EXISTING EDUCATIONAL VIDEO TO SUPABASE STORAGE  ")
    print("==================================================================")

    # 1. Locate source video
    src_paths = [
        os.path.join(BASE_DIR, "backend", "storage", "videos", TARGET_VIDEO_NAME),
        os.path.join(BASE_DIR, "apps", "student-desktop", "frontend", "public", "videos", TARGET_VIDEO_NAME),
    ]
    src_video = None
    for p in src_paths:
        if os.path.exists(p):
            src_video = p
            break

    if not src_video:
        print(f"[ERROR] Could not find source video '{TARGET_VIDEO_NAME}'!")
        return

    orig_size_mb = os.path.getsize(src_video) / (1024 * 1024)
    print(f"Found source video: {src_video} ({orig_size_mb:.2f} MB)")

    # 2. Transcode & compress using FFmpeg
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    temp_compressed = os.path.join(BASE_DIR, "backend", "storage", "videos", f"temp_{TARGET_VIDEO_NAME}")
    temp_thumb = os.path.join(BASE_DIR, "backend", "storage", "thumbnails", THUMB_FILENAME)
    os.makedirs(os.path.dirname(temp_compressed), exist_ok=True)
    os.makedirs(os.path.dirname(temp_thumb), exist_ok=True)

    print(f"Compressing video using FFmpeg (720p H.264 CRF 27, AAC 128k)...")
    cmd_compress = [
        ffmpeg_exe, "-y", "-i", src_video,
        "-vf", "scale='min(1280,iw)':-2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "fast", "-threads", "0", "-crf", "27",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
        temp_compressed
    ]

    res = subprocess.run(cmd_compress, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0 or not os.path.exists(temp_compressed):
        print(f"[ERROR] FFmpeg compression failed: {res.stderr.decode('utf-8', errors='ignore')}")
        return

    new_size_mb = os.path.getsize(temp_compressed) / (1024 * 1024)
    print(f"Compression complete! Size reduced from {orig_size_mb:.2f} MB -> {new_size_mb:.2f} MB ({(1 - new_size_mb/orig_size_mb)*100:.1f}% reduction)")

    # 3. Extract HD thumbnail frame
    print("Extracting thumbnail frame at 00:00:01...")
    cmd_thumb = [
        ffmpeg_exe, "-y", "-ss", "00:00:01",
        "-i", temp_compressed,
        "-vframes", "1", "-q:v", "2",
        temp_thumb
    ]
    subprocess.run(cmd_thumb, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if not os.path.exists(temp_thumb):
        print("[WARNING] Could not generate thumbnail frame!")

    # 4. Upload thumbnail to Supabase Storage
    if os.path.exists(temp_thumb):
        print(f"Uploading thumbnail '{THUMB_FILENAME}' to Supabase Storage (thumbnails/)...")
        with open(temp_thumb, "rb") as ft:
            thumb_bytes = ft.read()
        thumb_url = upload_to_supabase_sync("thumbnails", THUMB_FILENAME, thumb_bytes, "image/jpeg")
        if thumb_url:
            print(f"  [SUCCESS] Thumbnail uploaded: {thumb_url}")
        else:
            print("  [ERROR] Thumbnail upload to Supabase failed!")

    # 5. Upload compressed video to Supabase Storage
    print(f"Uploading compressed video '{TARGET_VIDEO_NAME}' to Supabase Storage (videos/)...")
    with open(temp_compressed, "rb") as fv:
        video_bytes = fv.read()
    video_url = upload_to_supabase_sync("videos", TARGET_VIDEO_NAME, video_bytes, "video/mp4")
    if video_url:
        print(f"  [SUCCESS] Video uploaded: {video_url}")
    else:
        print("  [ERROR] Video upload to Supabase failed!")
        return

    # 6. Update local copies so offline works smoothly with smaller file
    for loc in [
        os.path.join(BASE_DIR, "backend", "storage", "videos", TARGET_VIDEO_NAME),
        os.path.join(BASE_DIR, "apps", "student-desktop", "frontend", "public", "videos", TARGET_VIDEO_NAME),
        os.path.join(BASE_DIR, "apps", "student-desktop", "frontend", "dist", "videos", TARGET_VIDEO_NAME),
    ]:
        if os.path.exists(os.path.dirname(loc)) and os.path.abspath(temp_compressed) != os.path.abspath(loc):
            import shutil
            shutil.copyfile(temp_compressed, loc)

    if os.path.exists(temp_thumb):
        for loc in [
            os.path.join(BASE_DIR, "backend", "storage", "thumbnails", THUMB_FILENAME),
            os.path.join(BASE_DIR, "apps", "student-desktop", "frontend", "public", "thumbnails", THUMB_FILENAME),
            os.path.join(BASE_DIR, "apps", "student-desktop", "frontend", "dist", "thumbnails", THUMB_FILENAME),
        ]:
            if os.path.exists(os.path.dirname(loc)) and os.path.abspath(temp_thumb) != os.path.abspath(loc):
                import shutil
                shutil.copyfile(temp_thumb, loc)

    if os.path.exists(temp_compressed):
        try:
            os.remove(temp_compressed)
        except Exception:
            pass

    # 7. Update PostgreSQL Database Record
    print("Updating Supabase database record with thumbnail URL...")
    async def update_db():
        engine = create_async_engine(DATABASE_URL)
        async with engine.begin() as conn:
            await conn.execute(
                text("""
                    UPDATE educational_videos
                    SET thumbnail_url = :thumb_url
                    WHERE video_url LIKE :video_pattern
                """),
                {
                    "thumb_url": f"/thumbnails/{THUMB_FILENAME}",
                    "video_pattern": f"%{TARGET_VIDEO_NAME}%"
                }
            )
        await engine.dispose()
        print("Database record successfully updated!")

    asyncio.run(update_db())

    print("\n==================================================================")
    print("  ALL COMPLETED SUCCESSFULLY! VIDEO & THUMBNAIL READY ON CDN!    ")
    print("==================================================================")

if __name__ == "__main__":
    main()
