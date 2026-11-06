from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
import os
import shutil
import subprocess
import sys
import json
import logging

logger = logging.getLogger(__name__)

from app.database.connection import get_db
from app.models.user import User, StudentProfile
from app.models.session import EvaluationAttempt
from app.models.minigame import (
    MiniGameConfig,
    SeeItSignItItem,
    PuzzleSignItem,
    MagicFingersItem,
    MiniGameSession,
    GameType
)
from app.schemas.minigame import (
    MiniGameConfigCreate,
    MiniGameConfigUpdate,
    MiniGameConfigResponse,
    MiniGameConfigDetailResponse,
    SeeItSignItItemResponse,
    PuzzleSignItemResponse,
    MagicFingersItemResponse,
    SeeItSignItActivityCreate,
    PuzzleSignActivityCreate,
    MagicFingersActivityCreate,
    MiniGameScoreSubmit,
    MiniGameScoreResponse
)
from app.api.scores import compute_level_from_xp
from app.core.streak import record_streak_activity

router = APIRouter(prefix="/minigames", tags=["Mini-Games (Modules 7, 8, 9)"])

# Define storage directories for uploaded minigame assets
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# Resolve Python executable robustly
def get_python_exe():
    local_app_py = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python311\python.exe")
    if os.path.exists(local_app_py):
        return local_app_py
    if sys.executable and os.path.exists(sys.executable) and not sys.executable.endswith("uvicorn.exe"):
        return sys.executable
    venv_py = os.path.join(PROJECT_ROOT, "apps", "student-desktop", "desktop", "venv", "Scripts", "python.exe")
    if os.path.exists(venv_py):
        return venv_py
    return sys.executable or "python"

DESKTOP_PYTHON = get_python_exe()
EXTRACTOR_SCRIPT = os.path.join(PROJECT_ROOT, "apps", "student-desktop", "desktop", "baselines", "extract_baseline.py")

MINIGAME_IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "minigames", "images"))
MINIGAME_VIDEOS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "minigames", "videos"))

# Storage and desktop baseline directories
STORAGE_BASELINES_MINIGAMES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "baselines", "minigames"))
DESKTOP_BASELINES_MINIGAMES_DIR = os.path.join(PROJECT_ROOT, "apps", "student-desktop", "desktop", "baselines", "minigames")

# Also keep student desktop frontend public assets synchronized for direct offline access if present
DESKTOP_PUBLIC_VIDEOS = os.path.join(PROJECT_ROOT, "apps", "student-desktop", "frontend", "public", "videos")

for d in [
    MINIGAME_IMAGES_DIR,
    MINIGAME_VIDEOS_DIR,
    STORAGE_BASELINES_MINIGAMES_DIR,
    DESKTOP_BASELINES_MINIGAMES_DIR,
    os.path.join(STORAGE_BASELINES_MINIGAMES_DIR, "puzzle_sign"),
    os.path.join(STORAGE_BASELINES_MINIGAMES_DIR, "see_it_sign_it"),
    os.path.join(STORAGE_BASELINES_MINIGAMES_DIR, "magic_fingers"),
    os.path.join(DESKTOP_BASELINES_MINIGAMES_DIR, "puzzle_sign"),
    os.path.join(DESKTOP_BASELINES_MINIGAMES_DIR, "see_it_sign_it"),
    os.path.join(DESKTOP_BASELINES_MINIGAMES_DIR, "magic_fingers"),
]:
    os.makedirs(d, exist_ok=True)


def extract_minigame_baseline(video_url: Optional[str], game_type: str, word_identifier: Optional[str]):
    """
    Given a video URL (e.g. /minigames/videos/vid_xyz.mp4 or http://localhost:8000/minigames/videos/vid_xyz.mp4)
    and a word identifier (e.g. 'Ear' or 'Rain' or 'A'), executes MediaPipe Holistic 3D landmark extraction
    and saves the baseline JSON in both backend storage and student-desktop baselines.
    """
    if not video_url or not word_identifier:
        return

    clean_word = str(word_identifier).strip()
    if not clean_word or clean_word in ["+", "?", ""]:
        return

    # Extract filename from URL
    video_filename = os.path.basename(video_url.split("?")[0])
    video_path = os.path.join(MINIGAME_VIDEOS_DIR, video_filename)

    # Check alternative locations if not directly in MINIGAME_VIDEOS_DIR
    if not os.path.exists(video_path):
        candidate_desktop = os.path.join(DESKTOP_PUBLIC_VIDEOS, video_filename)
        if os.path.exists(candidate_desktop):
            video_path = candidate_desktop
        else:
            logger.warning(f"Video file not found for extraction: {video_path}")
            return

    # Target JSON filenames: baseline_<Word>.json, baseline_<word>.json, baseline_<WORD>.json
    backend_game_dir = os.path.join(STORAGE_BASELINES_MINIGAMES_DIR, game_type)
    desktop_game_dir = os.path.join(DESKTOP_BASELINES_MINIGAMES_DIR, game_type)
    os.makedirs(backend_game_dir, exist_ok=True)
    os.makedirs(desktop_game_dir, exist_ok=True)

    target_json_filename = f"baseline_{clean_word}.json"
    backend_json_path = os.path.join(backend_game_dir, target_json_filename)
    desktop_json_path = os.path.join(desktop_game_dir, target_json_filename)

    try:
        logger.info(f"Extracting baseline for {game_type} word '{clean_word}' from {video_path}...")
        
        # 100% in-process MediaPipe Holistic extraction (zero subprocess overhead, immune to 0xc0000142)
        from app.core.extract_baseline import extract_landmarks
        
        res = extract_landmarks(video_path, backend_json_path, clean_word)
        if res and res.get("success"):
            if os.path.exists(backend_json_path):
                try:
                    if os.path.normcase(os.path.abspath(backend_json_path)) != os.path.normcase(os.path.abspath(desktop_json_path)):
                        shutil.copyfile(backend_json_path, desktop_json_path)
                except Exception as ce:
                    logger.debug(f"Desktop baseline copy note: {ce}")
                logger.info(f"Successfully generated baseline in-process for {game_type} '{clean_word}' ({res.get('total_frames', 0)} frames, {res.get('hands_detected_frames', 0)} hand frames)")
                return
        else:
            err_msg = res.get("error") if res else "Unknown extraction failure"
            logger.warning(f"In-process extraction could not extract baseline for {game_type} '{clean_word}': {err_msg}")
    except Exception as e:
        logger.error(f"Error during baseline extraction for {game_type} '{clean_word}': {e}")


# ── Media Upload Endpoint ───────────────────────────────────────────────────
@router.post("/upload/media", status_code=status.HTTP_201_CREATED)
async def upload_minigame_media(file: UploadFile = File(...)):
    """
    Upload an image or video asset for mini-games.
    Returns the accessible URL for the uploaded file.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    image_exts = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]
    video_exts = [".mp4", ".webm", ".mov", ".mkv"]

    file_bytes = await file.read()

    if ext in image_exts:
        filename = f"img_{uuid.uuid4().hex[:10]}{ext}"
        destination = os.path.join(MINIGAME_IMAGES_DIR, filename)
        with open(destination, "wb") as buffer:
            buffer.write(file_bytes)

        # Dual-mode Cloud Sync: upload image to Supabase Storage (thumbnails folder)
        try:
            from app.core.supabase_storage import upload_to_supabase
            await upload_to_supabase("thumbnails", filename, file_bytes)
        except Exception as sup_err:
            logger.warning(f"[Supabase Storage Warning - Minigame Image]: {sup_err}")

        return {
            "status": "success",
            "type": "image",
            "url": f"/minigames/images/{filename}"
        }
    elif ext in video_exts:
        filename = f"vid_{uuid.uuid4().hex[:10]}{ext}"
        destination = os.path.join(MINIGAME_VIDEOS_DIR, filename)
        with open(destination, "wb") as buffer:
            buffer.write(file_bytes)

        # Copy to desktop public videos directory if it exists
        if os.path.exists(DESKTOP_PUBLIC_VIDEOS):
            try:
                shutil.copyfile(destination, os.path.join(DESKTOP_PUBLIC_VIDEOS, filename))
            except Exception:
                pass

        # Dual-mode Cloud Sync: upload video to Supabase Storage (videos folder)
        try:
            from app.core.supabase_storage import upload_to_supabase
            await upload_to_supabase("videos", filename, file_bytes)
        except Exception as sup_err:
            logger.warning(f"[Supabase Storage Warning - Minigame Video]: {sup_err}")

        return {
            "status": "success",
            "type": "video",
            "url": f"/minigames/videos/{filename}"
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: images {image_exts} or videos {video_exts}"
        )


# ── MiniGame Config CRUD ────────────────────────────────────────────────────
@router.post("/config", status_code=status.HTTP_201_CREATED, response_model=MiniGameConfigDetailResponse)
async def create_minigame_config(
    data: MiniGameConfigCreate, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a mini-game activity and optionally its initial rounds/items.
    Baseline AI extraction is dispatched via BackgroundTasks for sub-second responses.
    """
    config = MiniGameConfig(
        id=uuid.uuid4(),
        game_type=data.game_type,
        title=data.title,
        description=data.description,
        difficulty=data.difficulty or 1,
        is_active=True
    )
    db.add(config)
    await db.flush()

    if data.game_type == "see_it_sign_it" and data.see_it_sign_it_items:
        for idx, item_data in enumerate(data.see_it_sign_it_items):
            item = SeeItSignItItem(
                id=uuid.uuid4(),
                config_id=config.id,
                objective_image_url=item_data.objective_image_url,
                objective_answer=item_data.objective_answer,
                reference_video_url=item_data.reference_video_url,
                index_order=item_data.index_order if item_data.index_order is not None else idx
            )
            db.add(item)
            if item_data.reference_video_url and item_data.objective_answer:
                background_tasks.add_task(
                    extract_minigame_baseline, 
                    item_data.reference_video_url, 
                    "see_it_sign_it", 
                    item_data.objective_answer
                )

    elif data.game_type == "puzzle_sign" and data.puzzle_sign_items:
        for idx, item_data in enumerate(data.puzzle_sign_items):
            item = PuzzleSignItem(
                id=uuid.uuid4(),
                config_id=config.id,
                word_one=item_data.word_one,
                word_two=item_data.word_two,
                hidden_word=item_data.hidden_word,
                word_form=item_data.word_form,
                word_one_image_url=item_data.word_one_image_url,
                word_two_image_url=item_data.word_two_image_url,
                word_form_image_url=item_data.word_form_image_url,
                reference_video_url=item_data.reference_video_url,
                index_order=item_data.index_order if item_data.index_order is not None else idx
            )
            db.add(item)
            if item_data.reference_video_url and item_data.hidden_word:
                background_tasks.add_task(
                    extract_minigame_baseline, 
                    item_data.reference_video_url, 
                    "puzzle_sign", 
                    item_data.hidden_word
                )

    elif data.game_type == "magic_fingers" and data.magic_fingers_items:
        for idx, item_data in enumerate(data.magic_fingers_items):
            item = MagicFingersItem(
                id=uuid.uuid4(),
                config_id=config.id,
                word=item_data.word,
                hidden_positions=item_data.hidden_positions or [],
                objective_image_url=item_data.objective_image_url,
                reference_video_url=item_data.reference_video_url,
                reference_video_url_2=item_data.reference_video_url_2,
                index_order=item_data.index_order if item_data.index_order is not None else idx
            )
            db.add(item)
            # For magic fingers, baseline targets are the individual letters
            if item_data.reference_video_url and item_data.word and item_data.hidden_positions:
                for pos in item_data.hidden_positions:
                    if 0 <= pos < len(item_data.word):
                        letter = item_data.word[pos]
                        background_tasks.add_task(
                            extract_minigame_baseline, 
                            item_data.reference_video_url, 
                            "magic_fingers", 
                            letter
                        )

    await db.commit()

    # Re-fetch with all relationships loaded
    result = await db.execute(
        select(MiniGameConfig)
        .options(
            selectinload(MiniGameConfig.see_it_sign_it_items),
            selectinload(MiniGameConfig.puzzle_sign_items),
            selectinload(MiniGameConfig.magic_fingers_items)
        )
        .where(MiniGameConfig.id == config.id)
    )
    return result.scalar_one()


@router.get("/config", response_model=List[MiniGameConfigDetailResponse])
async def list_all_minigame_configs(
    game_type: Optional[str] = Query(None, description="Optional filter by game type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch all active mini-game configurations across all games.
    """
    query = (
        select(MiniGameConfig)
        .options(
            selectinload(MiniGameConfig.see_it_sign_it_items),
            selectinload(MiniGameConfig.puzzle_sign_items),
            selectinload(MiniGameConfig.magic_fingers_items)
        )
        .where(MiniGameConfig.is_active == True)
    )
    if game_type:
        query = query.where(MiniGameConfig.game_type == game_type)
    query = query.order_by(MiniGameConfig.game_type.asc(), MiniGameConfig.difficulty.asc(), MiniGameConfig.created_at.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/config/{config_id}", response_model=MiniGameConfigDetailResponse)
async def get_minigame_config_details(config_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Fetch a single game configuration with all nested items.
    """
    result = await db.execute(
        select(MiniGameConfig)
        .options(
            selectinload(MiniGameConfig.see_it_sign_it_items),
            selectinload(MiniGameConfig.puzzle_sign_items),
            selectinload(MiniGameConfig.magic_fingers_items)
        )
        .where(MiniGameConfig.id == config_id, MiniGameConfig.is_active == True)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Game configuration not found")
    return config


@router.get("/activities/{game_type}", response_model=List[MiniGameConfigDetailResponse])
async def get_all_activities_by_game_type(game_type: str, db: AsyncSession = Depends(get_db)):
    """
    Fetch all active activities for a specific game type with all child round items loaded.
    Used by the Student Desktop app to play full activities dynamically.
    """
    result = await db.execute(
        select(MiniGameConfig)
        .options(
            selectinload(MiniGameConfig.see_it_sign_it_items),
            selectinload(MiniGameConfig.puzzle_sign_items),
            selectinload(MiniGameConfig.magic_fingers_items)
        )
        .where(MiniGameConfig.game_type == game_type, MiniGameConfig.is_active == True)
        .order_by(MiniGameConfig.difficulty.asc(), MiniGameConfig.created_at.asc())
    )
    return result.scalars().all()


# ── Dedicated Mini-Game Endpoints ──────────────────────────────────────────

# 1. See It Sign It
@router.get("/see-it-sign-it", response_model=List[MiniGameConfigDetailResponse])
async def get_see_it_sign_it_activities(db: AsyncSession = Depends(get_db)):
    """
    Dedicated endpoint to fetch all active 'See It Sign It' activities with rounds and reference videos.
    """
    return await get_all_activities_by_game_type("see_it_sign_it", db)

@router.post("/see-it-sign-it", status_code=status.HTTP_201_CREATED, response_model=MiniGameConfigDetailResponse)
async def create_see_it_sign_it_activity(
    data: SeeItSignItActivityCreate, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated endpoint to create a 'See It Sign It' activity with rounds and reference videos.
    """
    payload = MiniGameConfigCreate(
        game_type="see_it_sign_it",
        title=data.title,
        description=data.description,
        difficulty=data.difficulty,
        see_it_sign_it_items=data.items
    )
    return await create_minigame_config(payload, background_tasks, db)


# 2. Puzzle Sign
@router.get("/puzzle-sign", response_model=List[MiniGameConfigDetailResponse])
async def get_puzzle_sign_activities(db: AsyncSession = Depends(get_db)):
    """
    Dedicated endpoint to fetch all active 'Puzzle Sign' activities with rounds and reference videos.
    """
    return await get_all_activities_by_game_type("puzzle_sign", db)

@router.post("/puzzle-sign", status_code=status.HTTP_201_CREATED, response_model=MiniGameConfigDetailResponse)
async def create_puzzle_sign_activity(
    data: PuzzleSignActivityCreate, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated endpoint to create a 'Puzzle Sign' activity with rounds and reference videos.
    """
    payload = MiniGameConfigCreate(
        game_type="puzzle_sign",
        title=data.title,
        description=data.description,
        difficulty=data.difficulty,
        puzzle_sign_items=data.items
    )
    return await create_minigame_config(payload, background_tasks, db)


# 3. Magic Fingers
@router.get("/magic-fingers", response_model=List[MiniGameConfigDetailResponse])
async def get_magic_fingers_activities(db: AsyncSession = Depends(get_db)):
    """
    Dedicated endpoint to fetch all active 'Magic Fingers' activities with rounds and reference videos.
    """
    return await get_all_activities_by_game_type("magic_fingers", db)

@router.post("/magic-fingers", status_code=status.HTTP_201_CREATED, response_model=MiniGameConfigDetailResponse)
async def create_magic_fingers_activity(
    data: MagicFingersActivityCreate, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated endpoint to create a 'Magic Fingers' activity with rounds and reference videos.
    """
    payload = MiniGameConfigCreate(
        game_type="magic_fingers",
        title=data.title,
        description=data.description,
        difficulty=data.difficulty,
        magic_fingers_items=data.items
    )
    return await create_minigame_config(payload, background_tasks, db)



@router.put("/config/{config_id}", response_model=MiniGameConfigDetailResponse)
async def update_minigame_config(
    config_id: uuid.UUID,
    data: MiniGameConfigUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a mini-game configuration and its rounds/items.
    Baseline AI extraction is dispatched via BackgroundTasks for sub-second responses.
    """
    result = await db.execute(
        select(MiniGameConfig)
        .options(
            selectinload(MiniGameConfig.see_it_sign_it_items),
            selectinload(MiniGameConfig.puzzle_sign_items),
            selectinload(MiniGameConfig.magic_fingers_items)
        )
        .where(MiniGameConfig.id == config_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Game configuration not found")

    if data.title is not None:
        config.title = data.title
    if data.description is not None:
        config.description = data.description
    if data.difficulty is not None:
        config.difficulty = data.difficulty
    if data.is_active is not None:
        config.is_active = data.is_active

    # Replace items if provided
    if data.see_it_sign_it_items is not None and config.game_type == "see_it_sign_it":
        for old_item in list(config.see_it_sign_it_items):
            await db.delete(old_item)
        for idx, item_data in enumerate(data.see_it_sign_it_items):
            db.add(SeeItSignItItem(
                id=uuid.uuid4(),
                config_id=config.id,
                objective_image_url=item_data.objective_image_url,
                objective_answer=item_data.objective_answer,
                reference_video_url=item_data.reference_video_url,
                index_order=item_data.index_order if item_data.index_order is not None else idx
            ))
            if item_data.reference_video_url and item_data.objective_answer:
                background_tasks.add_task(
                    extract_minigame_baseline, 
                    item_data.reference_video_url, 
                    "see_it_sign_it", 
                    item_data.objective_answer
                )

    elif data.puzzle_sign_items is not None and config.game_type == "puzzle_sign":
        for old_item in list(config.puzzle_sign_items):
            await db.delete(old_item)
        for idx, item_data in enumerate(data.puzzle_sign_items):
            db.add(PuzzleSignItem(
                id=uuid.uuid4(),
                config_id=config.id,
                word_one=item_data.word_one,
                word_two=item_data.word_two,
                hidden_word=item_data.hidden_word,
                word_form=item_data.word_form,
                word_one_image_url=item_data.word_one_image_url,
                word_two_image_url=item_data.word_two_image_url,
                word_form_image_url=item_data.word_form_image_url,
                reference_video_url=item_data.reference_video_url,
                index_order=item_data.index_order if item_data.index_order is not None else idx
            ))
            if item_data.reference_video_url and item_data.hidden_word:
                background_tasks.add_task(
                    extract_minigame_baseline, 
                    item_data.reference_video_url, 
                    "puzzle_sign", 
                    item_data.hidden_word
                )

    elif data.magic_fingers_items is not None and config.game_type == "magic_fingers":
        for old_item in list(config.magic_fingers_items):
            await db.delete(old_item)
        for idx, item_data in enumerate(data.magic_fingers_items):
            db.add(MagicFingersItem(
                id=uuid.uuid4(),
                config_id=config.id,
                word=item_data.word,
                hidden_positions=item_data.hidden_positions or [],
                objective_image_url=item_data.objective_image_url,
                reference_video_url=item_data.reference_video_url,
                reference_video_url_2=item_data.reference_video_url_2,
                index_order=item_data.index_order if item_data.index_order is not None else idx
            ))
            if item_data.reference_video_url and item_data.word and item_data.hidden_positions:
                for pos in item_data.hidden_positions:
                    if 0 <= pos < len(item_data.word):
                        letter = item_data.word[pos]
                        background_tasks.add_task(
                            extract_minigame_baseline, 
                            item_data.reference_video_url, 
                            "magic_fingers", 
                            letter
                        )

    await db.commit()

    # Re-fetch updated
    fresh = await db.execute(
        select(MiniGameConfig)
        .options(
            selectinload(MiniGameConfig.see_it_sign_it_items),
            selectinload(MiniGameConfig.puzzle_sign_items),
            selectinload(MiniGameConfig.magic_fingers_items)
        )
        .where(MiniGameConfig.id == config.id)
    )
    return fresh.scalar_one()


@router.delete("/config/{config_id}", status_code=status.HTTP_200_OK)
async def delete_minigame_config(
    config_id: uuid.UUID,
    hard_delete: bool = Query(False, description="Whether to permanently remove the config"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(MiniGameConfig).where(MiniGameConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game configuration not found")
    
    if hard_delete:
        await db.delete(config)
    else:
        config.is_active = False
    await db.commit()
    return {"status": "deleted" if hard_delete else "deactivated", "config_id": str(config_id)}


# ── Scores & Sessions ───────────────────────────────────────────────────────
@router.post("/scores", status_code=status.HTTP_201_CREATED, response_model=MiniGameScoreResponse)
async def submit_minigame_score(data: MiniGameScoreSubmit, db: AsyncSession = Depends(get_db)):
    prev_highest_res = await db.execute(
        select(func.max(MiniGameSession.highest_score))
        .where(
            MiniGameSession.student_id == data.student_id,
            MiniGameSession.game_type == data.game_type
        )
    )
    prev_highest = prev_highest_res.scalar() or 0.0
    highest = max(prev_highest, data.score)

    session = MiniGameSession(
        id=uuid.uuid4(),
        student_id=data.student_id,
        game_type=data.game_type,
        score=data.score,
        highest_score=highest,
        streak=data.streak,
        rounds_completed=data.rounds_completed
    )
    db.add(session)

    user_res = await db.execute(select(User).where(User.id == data.student_id))
    user = user_res.scalar_one_or_none()

    prof_res = await db.execute(select(StudentProfile).where(StudentProfile.student_id == data.student_id))
    profile = prof_res.scalar_one_or_none()

    if user or profile:
        eval_xp_res = await db.execute(
            select(func.coalesce(func.sum(EvaluationAttempt.xp_earned), 0))
            .where(EvaluationAttempt.student_id == data.student_id)
        )
        total_eval_xp = eval_xp_res.scalar() or 0

        game_xp_res = await db.execute(
            select(func.coalesce(func.sum(MiniGameSession.score), 0))
            .where(MiniGameSession.student_id == data.student_id)
        )
        total_game_xp = (game_xp_res.scalar() or 0) + data.score

        total_xp = int(total_eval_xp + total_game_xp)
        new_level = compute_level_from_xp(total_xp)

        if profile:
            profile.total_xp = total_xp
            profile.level = new_level
            if (data.score and data.score > 0) or (data.rounds_completed and data.rounds_completed > 0):
                record_streak_activity(profile)
        if user:
            user.level = new_level

    await db.commit()
    await db.refresh(session)
    return session


@router.get("/scores/{student_id}", response_model=List[dict])
async def get_student_minigame_stats(student_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stats = []
    game_types = ["see_it_sign_it", "puzzle_sign", "magic_fingers"]
    for gtype in game_types:
        res = await db.execute(
            select(MiniGameSession)
            .where(
                MiniGameSession.student_id == student_id,
                MiniGameSession.game_type == gtype
            )
            .order_by(MiniGameSession.created_at.desc())
            .limit(1)
        )
        latest = res.scalar_one_or_none()
        
        highest_res = await db.execute(
            select(func.max(MiniGameSession.highest_score))
            .where(
                MiniGameSession.student_id == student_id,
                MiniGameSession.game_type == gtype
            )
        )
        highest_score = highest_res.scalar() or 0.0

        stats.append({
            "game_type": gtype,
            "highest_score": highest_score,
            "latest_score": latest.score if latest else 0.0,
            "streak": latest.streak if latest else 0,
            "rounds_completed": latest.rounds_completed if latest else 0
        })
    return stats