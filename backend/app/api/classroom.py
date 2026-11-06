from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from pydantic import BaseModel, field_validator
import sys
import uuid
import os
import shutil

from app.database.connection import get_db
from app.models.classroom import Class, ClassStudent, EducationalVideo
from app.models.user import User, StudentProfile
from app.core.supabase_storage import upload_to_supabase, upload_file_to_supabase_streaming, delete_from_supabase_sync
import gc

router = APIRouter(prefix="/classes", tags=["Classes & Rosters"])
videos_router = APIRouter(prefix="/educational-videos", tags=["Educational Videos"])

# In-memory TTL cache for educational videos
import time
_edu_videos_cache = {}
EDU_VIDEOS_CACHE_TTL = 60  # seconds

def invalidate_educational_videos_cache():
    global _edu_videos_cache
    _edu_videos_cache.clear()

# ── Schemas ──────────────────────────────────────────────────────────────────
class ClassCreate(BaseModel):
    teacher_id: Optional[uuid.UUID] = None
    name: str
    grade_level: int = 1
    school_year: str = "2026-2027"

    @field_validator("teacher_id", mode="before")
    @classmethod
    def parse_teacher_id(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean or v_clean.lower() in ("none", "null", "undefined", ""):
                return None
            return uuid.UUID(v_clean)
        return v

class ClassUpdate(BaseModel):
    name: Optional[str] = None
    teacher_id: Optional[uuid.UUID] = None
    grade_level: Optional[int] = None
    school_year: Optional[str] = None

    @field_validator("teacher_id", mode="before")
    @classmethod
    def parse_teacher_id(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean or v_clean.lower() in ("none", "null", "undefined", ""):
                return None
            return uuid.UUID(v_clean)
        return v

class AddStudentToClass(BaseModel):
    student_id: uuid.UUID

class EducationalVideoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: str = "Science"
    grade_level: int = 1
    duration_minutes: int = 10
    video_url: str
    thumbnail_url: Optional[str] = None
    created_by: Optional[uuid.UUID] = None

class EducationalVideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    grade_level: Optional[int] = None
    duration_minutes: Optional[int] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

# ── Endpoints: Classes ────────────────────────────────────────────────────────
@router.get("/")
async def list_classes(teacher_id: Optional[uuid.UUID] = None, db: AsyncSession = Depends(get_db)):
    query = (
        select(Class, User.name.label("teacher_name"), func.count(ClassStudent.id).label("student_count"))
        .outerjoin(User, Class.teacher_id == User.id)
        .outerjoin(ClassStudent, Class.id == ClassStudent.class_id)
        .group_by(Class.id, User.name)
        .order_by(Class.grade_level.asc(), Class.name.asc())
    )
    if teacher_id:
        query = query.where(Class.teacher_id == teacher_id)
    res = await db.execute(query)
    classes = res.all()
    return [
        {
            "id": str(c.id),
            "teacher_id": str(c.teacher_id),
            "teacher_name": teacher_name or "Unassigned",
            "name": c.name,
            "grade_level": c.grade_level,
            "school_year": c.school_year,
            "student_count": student_count or 0,
            "created_at": c.created_at
        }
        for c, teacher_name, student_count in classes
    ]

@router.get("/{class_id}")
async def get_class(class_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Class).where(Class.id == class_id))
    cls = res.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return {
        "id": str(cls.id),
        "teacher_id": str(cls.teacher_id) if cls.teacher_id else None,
        "name": cls.name,
        "grade_level": cls.grade_level,
        "school_year": cls.school_year,
        "created_at": cls.created_at
    }

@router.put("/{class_id}")
async def update_class(class_id: uuid.UUID, payload: ClassUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Class).where(Class.id == class_id))
    cls = res.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if payload.name is not None:
        cls.name = payload.name
    if payload.teacher_id is not None:
        cls.teacher_id = payload.teacher_id
    if payload.grade_level is not None:
        cls.grade_level = payload.grade_level
    if payload.school_year is not None:
        cls.school_year = payload.school_year
    await db.commit()
    await db.refresh(cls)
    return {"status": "updated", "class_id": str(cls.id), "name": cls.name}

@router.delete("/{class_id}")
async def delete_class(class_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Class).where(Class.id == class_id))
    cls = res.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Classroom not found")
    await db.delete(cls)
    await db.commit()
    return {"status": "deleted", "class_id": str(class_id)}

@router.post("/")
async def create_class(payload: ClassCreate, db: AsyncSession = Depends(get_db)):
    new_class = Class(
        teacher_id=payload.teacher_id,
        name=payload.name,
        grade_level=payload.grade_level,
        school_year=payload.school_year
    )
    db.add(new_class)
    await db.commit()
    await db.refresh(new_class)
    return {"status": "created", "class_id": str(new_class.id), "name": new_class.name}

@router.post("/{class_id}/students")
async def enroll_student(class_id: uuid.UUID, payload: AddStudentToClass, db: AsyncSession = Depends(get_db)):
    # Check if student exists
    user_res = await db.execute(select(User).where(User.id == payload.student_id))
    if not user_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student user not found")
        
    enrollment = ClassStudent(class_id=class_id, student_id=payload.student_id)
    db.add(enrollment)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        return {"status": "already_enrolled"}
    return {"status": "enrolled", "class_id": str(class_id), "student_id": str(payload.student_id)}

@router.get("/{class_id}/students")
async def get_class_roster(class_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(ClassStudent, User, StudentProfile)
        .join(User, ClassStudent.student_id == User.id)
        .outerjoin(StudentProfile, User.id == StudentProfile.student_id)
        .where(ClassStudent.class_id == class_id)
        .order_by(StudentProfile.grade_level.asc(), StudentProfile.student_number.asc(), User.name.asc())
    )
    res = await db.execute(query)
    roster = []
    for cs, u, sp in res.all():
        roster.append({
            "id": str(u.id),
            "name": u.name,
            "student_code": sp.student_code if sp else None,
            "student_number": sp.student_number if sp else None,
            "grade_level": sp.grade_level if sp else 1,
            "color": sp.color if sp else "#3B82F6",
            "emoji": sp.emoji if sp else "👦",
            "enrolled_at": cs.enrolled_at
        })
    return {"class_id": str(class_id), "students": roster}

# ── Endpoints: Educational Videos ─────────────────────────────────────────────
@videos_router.get("", include_in_schema=False)
@videos_router.get("/")
async def list_educational_videos(
    grade_level: Optional[int] = None,
    subject: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    cache_key = f"{grade_level}_{subject}"
    now = time.time()
    if cache_key in _edu_videos_cache:
        entry = _edu_videos_cache[cache_key]
        if now - entry["timestamp"] < EDU_VIDEOS_CACHE_TTL:
            return entry["data"]

    # Only show actual educational videos, exclude auto-created stage demonstration copies
    query = select(EducationalVideo).where(EducationalVideo.subject != "FSL Demonstration")
    if grade_level:
        query = query.where(EducationalVideo.grade_level == grade_level)
    if subject:
        query = query.where(EducationalVideo.subject == subject)
    res = await db.execute(query)
    videos = res.scalars().all()
    data = [
        {
            "id": str(v.id),
            "title": v.title,
            "description": v.description,
            "subject": v.subject,
            "grade_level": v.grade_level,
            "duration_minutes": v.duration_minutes,
            "video_url": v.video_url,
            "thumbnail_url": v.thumbnail_url,
            "created_at": v.created_at
        }
        for v in videos
    ]
    _edu_videos_cache[cache_key] = {"data": data, "timestamp": now}
    return data

@videos_router.post("", include_in_schema=False)
@videos_router.post("/")
async def upload_educational_video(payload: EducationalVideoCreate, db: AsyncSession = Depends(get_db)):
    video = EducationalVideo(
        title=payload.title,
        description=payload.description,
        subject=payload.subject,
        grade_level=payload.grade_level,
        duration_minutes=payload.duration_minutes,
        video_url=payload.video_url,
        thumbnail_url=payload.thumbnail_url,
        created_by=payload.created_by
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)
    invalidate_educational_videos_cache()
    return {"status": "created", "video_id": str(video.id), "title": video.title}

@videos_router.post("/upload-file")
async def upload_educational_video_file(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    subject: str = Form(...),
    grade_level: int = Form(1),
    duration_minutes: int = Form(5),
    thumbnail_url: Optional[str] = Form(None),
    video: UploadFile = File(...),
    thumbnail: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    ext = os.path.splitext(video.filename)[1].lower()
    if ext not in [".mp4", ".webm", ".mov", ".mkv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported video format. Please upload an .mp4, .webm, or .mov file."
        )

    clean_title = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    video_filename = f"edu_{uuid.uuid4().hex[:8]}_{clean_title}{ext}"

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    public_dir = os.path.join(project_root, "apps", "student-desktop", "frontend", "public", "videos")
    storage_dir = os.path.join(project_root, "backend", "storage", "videos")
    storage_thumb_dir = os.path.join(project_root, "backend", "storage", "thumbnails")
    public_thumb_dir = os.path.join(project_root, "apps", "student-desktop", "frontend", "public", "thumbnails")
    os.makedirs(public_dir, exist_ok=True)
    os.makedirs(storage_dir, exist_ok=True)
    os.makedirs(storage_thumb_dir, exist_ok=True)
    os.makedirs(public_thumb_dir, exist_ok=True)

    # 1. Save local thumbnail file if uploaded and stream to Supabase (Zero RAM overhead)
    resolved_thumb_url = thumbnail_url
    if thumbnail and thumbnail.filename:
        thumb_ext = os.path.splitext(thumbnail.filename)[1].lower()
        if thumb_ext in [".png", ".jpg", ".jpeg", ".webp", ".svg"]:
            thumb_filename = f"thumb_{uuid.uuid4().hex[:8]}_{clean_title}{thumb_ext}"
            thumb_stor_path = os.path.join(storage_thumb_dir, thumb_filename)
            thumb_pub_path = os.path.join(public_thumb_dir, thumb_filename)
            with open(thumb_stor_path, "wb") as f_th:
                shutil.copyfileobj(thumbnail.file, f_th)
            shutil.copyfile(thumb_stor_path, thumb_pub_path)
            resolved_thumb_url = f"/thumbnails/{thumb_filename}"
            try:
                await upload_file_to_supabase_streaming("thumbnails", thumb_filename, thumb_stor_path)
            except Exception as sup_th_err:
                print(f"[Supabase Storage Warning - Custom Thumbnail]: {sup_th_err}")

    # 2. Save uploaded video to disk
    pub_path = os.path.join(public_dir, video_filename)
    stor_path = os.path.join(storage_dir, video_filename)

    with open(pub_path, "wb") as f_pub:
        shutil.copyfileobj(video.file, f_pub)
    shutil.copyfile(pub_path, stor_path)

    # Clean memory before compression
    gc.collect()

    # 3. Memory-Optimized FFmpeg Compression (Render 512MB RAM safe)
    try:
        import imageio_ffmpeg, subprocess
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        h264_filename = f"edu_{uuid.uuid4().hex[:8]}_{clean_title}_web.mp4"
        h264_pub_path = os.path.join(public_dir, h264_filename)

        raw_size = os.path.getsize(pub_path) if os.path.exists(pub_path) else 0
        needs_compression = (ext != ".mp4") or (raw_size > 40 * 1024 * 1024)

        if needs_compression:
            # Memory-capped single-threaded ultrafast 720p transcode (< 35MB RAM footprint)
            cmd = [
                ffmpeg_exe, "-y", "-i", pub_path,
                "-vf", "scale='min(1280,iw)':-2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-preset", "ultrafast",
                "-threads", "1",
                "-max_muxing_queue_size", "1024",
                "-crf", "28",
                "-c:a", "aac", "-b:a", "96k",
                "-movflags", "+faststart",
                h264_pub_path
            ]
        else:
            # Instant container remux & faststart without re-encoding
            cmd = [
                ffmpeg_exe, "-y", "-i", pub_path,
                "-c", "copy",
                "-threads", "1",
                "-movflags", "+faststart",
                h264_pub_path
            ]

        extra_flags = {}
        if sys.platform == "win32":
            extra_flags["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180, **extra_flags)
        if res.returncode == 0 and os.path.exists(h264_pub_path):
            if os.path.exists(pub_path):
                try:
                    os.remove(pub_path)
                except Exception:
                    pass
            pub_path = h264_pub_path
            video_filename = h264_filename
            stor_path = os.path.join(storage_dir, video_filename)
            shutil.copyfile(pub_path, stor_path)
        invalidate_educational_videos_cache()
    except Exception as transcode_err:
        print(f"Web video transcode skipped: {transcode_err}")

    # Reclaim memory after transcode
    gc.collect()

    # 4. Auto-generate video thumbnail from 1.0s if none was uploaded
    if not resolved_thumb_url:
        try:
            import imageio_ffmpeg, subprocess
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            auto_thumb_filename = f"thumb_{uuid.uuid4().hex[:8]}_{clean_title}.jpg"
            auto_thumb_stor_path = os.path.join(storage_thumb_dir, auto_thumb_filename)
            auto_thumb_pub_path = os.path.join(public_thumb_dir, auto_thumb_filename)
            extra_flags = {}
            if sys.platform == "win32":
                extra_flags["creationflags"] = 0x08000000
            cmd_thumb = [
                ffmpeg_exe, "-y", "-ss", "00:00:01",
                "-i", pub_path,
                "-vframes", "1", "-q:v", "2",
                "-threads", "1",
                auto_thumb_stor_path
            ]
            t_res = subprocess.run(cmd_thumb, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, **extra_flags)
            if t_res.returncode == 0 and os.path.exists(auto_thumb_stor_path):
                shutil.copyfile(auto_thumb_stor_path, auto_thumb_pub_path)
                resolved_thumb_url = f"/thumbnails/{auto_thumb_filename}"
                await upload_file_to_supabase_streaming("thumbnails", auto_thumb_filename, auto_thumb_stor_path, "image/jpeg")
        except Exception as auto_th_err:
            print(f"[Supabase Storage Warning - Auto Thumbnail]: {auto_th_err}")

    # 5. Zero-RAM Disk Streaming Upload to Supabase Storage ('videos' folder)
    try:
        await upload_file_to_supabase_streaming("videos", video_filename, pub_path, "video/mp4")
    except Exception as sup_v_err:
        print(f"[Supabase Storage Warning - Video]: {sup_v_err}")

    # Reclaim memory before returning
    gc.collect()

    new_vid = EducationalVideo(
        title=title,
        description=description,
        subject=subject,
        grade_level=grade_level,
        duration_minutes=duration_minutes,
        video_url=f"/videos/{video_filename}",
        thumbnail_url=resolved_thumb_url
    )
    db.add(new_vid)
    await db.commit()
    await db.refresh(new_vid)
    return {
        "status": "created",
        "video_id": str(new_vid.id),
        "title": new_vid.title,
        "video_url": new_vid.video_url,
        "thumbnail_url": new_vid.thumbnail_url
    }

@videos_router.put("/{video_id}")
async def update_educational_video(
    video_id: uuid.UUID,
    payload: EducationalVideoUpdate,
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(EducationalVideo).where(EducationalVideo.id == video_id))
    video = res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Educational video not found")

    if payload.title is not None:
        video.title = payload.title
    if payload.description is not None:
        video.description = payload.description
    if payload.subject is not None:
        video.subject = payload.subject
    if payload.grade_level is not None:
        video.grade_level = payload.grade_level
    if payload.duration_minutes is not None:
        video.duration_minutes = payload.duration_minutes
    if payload.video_url is not None:
        video.video_url = payload.video_url
    if payload.thumbnail_url is not None:
        video.thumbnail_url = payload.thumbnail_url

    await db.commit()
    await db.refresh(video)
    invalidate_educational_videos_cache()
    return {
        "status": "updated",
        "video_id": str(video.id),
        "title": video.title,
        "description": video.description,
        "subject": video.subject,
        "grade_level": video.grade_level,
        "duration_minutes": video.duration_minutes,
        "video_url": video.video_url,
        "thumbnail_url": video.thumbnail_url
    }

@videos_router.delete("/{video_id}")
async def delete_educational_video(video_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(EducationalVideo).where(EducationalVideo.id == video_id))
    video = res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Educational video not found")

    # Cloud Sync: Delete video and thumbnail from Supabase Storage
    try:
        if video.video_url:
            v_filename = video.video_url.split("?")[0].split("/")[-1]
            if v_filename:
                delete_from_supabase_sync("videos", v_filename)
        if video.thumbnail_url and video.thumbnail_url.startswith("/thumbnails/"):
            th_filename = video.thumbnail_url.split("?")[0].split("/")[-1]
            if th_filename:
                delete_from_supabase_sync("thumbnails", th_filename)
    except Exception as del_err:
        print(f"[Supabase Storage Warning - Delete]: {del_err}")

    await db.delete(video)
    await db.commit()
    invalidate_educational_videos_cache()
    return {"status": "deleted", "video_id": str(video_id)}

