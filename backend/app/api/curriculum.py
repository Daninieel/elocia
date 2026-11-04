from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete
from sqlalchemy.orm import selectinload
from app.database.connection import get_db
from app.models.baseline import FSLBaseline, CurriculumStage, Curriculum, CurriculumSection, CurriculumUnit
from app.models.session import EvaluationAttempt, StudentStageProgress
from app.models.user import User, StudentProfile
from app.schemas.curriculum import (
    CurriculumCreate, CurriculumUpdate, CurriculumResponse,
    SectionCreate, SectionUpdate, SectionResponse,
    UnitCreate, UnitUpdate, UnitResponse,
    StageCreate, StageUpdate, StageResponse
)
from typing import List, Optional, Dict, Any
import os
import uuid
import time
from app.core.streak import get_effective_streak

# Storage paths for cleanup & static visual aids
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PUBLIC_VIDEOS_DIR = os.path.join(PROJECT_ROOT, "apps", "student-desktop", "frontend", "public", "videos")
BASELINES_DIR = os.path.join(PROJECT_ROOT, "apps", "student-desktop", "desktop", "baselines")
STORAGE_VIDEOS_DIR = os.path.join(PROJECT_ROOT, "backend", "storage", "videos")
STORAGE_BASELINES_DIR = os.path.join(PROJECT_ROOT, "backend", "storage", "baselines")
PUBLIC_THUMBNAILS_DIR = os.path.join(PROJECT_ROOT, "apps", "student-desktop", "frontend", "public", "thumbnails")
STORAGE_THUMBNAILS_DIR = os.path.join(PROJECT_ROOT, "backend", "storage", "thumbnails")
os.makedirs(PUBLIC_THUMBNAILS_DIR, exist_ok=True)
os.makedirs(STORAGE_THUMBNAILS_DIR, exist_ok=True)

def resolve_sign_photo(sign_id: Optional[int], stage_id: Optional[int] = None, sign_name: Optional[str] = None) -> Optional[str]:
    """Resolve static visual aid image path for learners with mtime cache-busting."""
    candidates = []
    if sign_id:
        candidates.extend([f"{sign_id}.png", f"{sign_id}.jpg", f"{sign_id}.jpeg", f"{sign_id}.webp", f"thumb_{sign_id}.png"])
    if stage_id:
        candidates.extend([f"{stage_id}.png", f"{stage_id}.jpg", f"{stage_id}.jpeg", f"{stage_id}.webp", f"thumb_{stage_id}.png"])
    if sign_name:
        candidates.extend([f"{sign_name}.png", f"{sign_name}.jpg", f"thumb_{sign_name}.png"])

    for cand in candidates:
        s_path = os.path.join(STORAGE_THUMBNAILS_DIR, cand)
        p_path = os.path.join(PUBLIC_THUMBNAILS_DIR, cand)
        active_path = s_path if os.path.exists(s_path) else (p_path if os.path.exists(p_path) else None)
        if active_path:
            try:
                mtime = int(os.path.getmtime(active_path))
                return f"/thumbnails/{cand}?t={mtime}"
            except Exception:
                return f"/thumbnails/{cand}"

    return f"/thumbnails/{sign_id}.png" if sign_id else None

def remove_baseline_disk_files(video_filename: Optional[str], stage_id: Optional[int]):
    """Safely delete video and baseline JSON files from disk."""
    if video_filename:
        for folder in [PUBLIC_VIDEOS_DIR, STORAGE_VIDEOS_DIR]:
            vpath = os.path.join(folder, video_filename)
            if os.path.exists(vpath):
                try:
                    os.remove(vpath)
                except Exception:
                    pass
    if stage_id is not None:
        json_name = f"baseline_{stage_id}.json"
        for folder in [
            BASELINES_DIR,
            os.path.join(BASELINES_DIR, "lessons"),
            STORAGE_BASELINES_DIR,
            os.path.join(STORAGE_BASELINES_DIR, "lessons")
        ]:
            jpath = os.path.join(folder, json_name)
            if os.path.exists(jpath):
                try:
                    os.remove(jpath)
                except Exception:
                    pass

router = APIRouter(tags=["Curriculum & Progression"])

# In-memory TTL cache for curriculum structure
import time
_curriculum_cache: Dict[str, Dict[str, Any]] = {}
CURRICULUM_CACHE_TTL = 60  # seconds

def invalidate_curriculum_cache():
    global _curriculum_cache
    _curriculum_cache.clear()

@router.get("/curriculum")
async def get_curriculum(grade_level: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)):
    """
    Returns curriculum structure built dynamically from curriculums -> sections -> units -> stages -> baselines.
    Includes backward-compatible fallback to flat curriculum_stages if normalized tables are not yet populated.
    """
    cache_key = str(grade_level)
    now = time.time()
    if cache_key in _curriculum_cache:
        entry = _curriculum_cache[cache_key]
        if now - entry["timestamp"] < CURRICULUM_CACHE_TTL:
            return entry["data"]

    try:
        # 1. Try querying normalized tables first
        curr_query = select(Curriculum).where(Curriculum.is_active == True)
        if grade_level:
            curr_query = curr_query.where(Curriculum.grade_level == grade_level)
        curr_query = curr_query.order_by(Curriculum.grade_level.asc())
        curr_res = await db.execute(curr_query)
        curr_list = curr_res.scalars().all()

        if curr_list:
            curr_ids = [c.id for c in curr_list]
            sections_res = await db.execute(
                select(CurriculumSection)
                .where(CurriculumSection.curriculum_id.in_(curr_ids))
                .order_by(CurriculumSection.section_number.asc())
            )
            sections = sections_res.scalars().all()

            sec_ids = [s.id for s in sections]
            units_res = await db.execute(
                select(CurriculumUnit)
                .where(CurriculumUnit.section_id.in_(sec_ids))
                .order_by(CurriculumUnit.unit_number.asc())
            )
            units = units_res.scalars().all()

            unit_ids = [u.id for u in units]
            stages_res = await db.execute(
                select(CurriculumStage)
                .where(CurriculumStage.unit_id.in_(unit_ids), CurriculumStage.is_active == True)
                .order_by(CurriculumStage.stage_number.asc())
            )
            stages = stages_res.scalars().all()

            baselines_res = await db.execute(
                select(FSLBaseline)
                .where(FSLBaseline.is_active == True)
                .order_by(FSLBaseline.order_index.asc().nulls_last(), FSLBaseline.sign_id.asc().nulls_last())
            )
            baselines = baselines_res.scalars().all()

            baselines_by_stage: Dict[int, List[Dict[str, Any]]] = {}
            for b in baselines:
                if b.sign_id is None or b.sign_id == 0:
                    continue
                item = {
                    "globalId": b.sign_id,
                    "name": b.sign_name,
                    "videoUrl": f"/videos/{b.video_filename}" if b.video_filename else None,
                    "videoFilename": b.video_filename,
                    "photoUrl": resolve_sign_photo(b.sign_id, b.stage_id, b.sign_name)
                }
                if b.stage_id_new is not None:
                    baselines_by_stage.setdefault(b.stage_id_new, []).append(item)

            stages_by_unit: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
            for st in stages:
                if st.unit_id:
                    stages_by_unit.setdefault(st.unit_id, []).append({
                        "id": st.stage_number,
                        "title": st.title,
                        "description": st.description or "",
                        "items": baselines_by_stage.get(st.id, [])
                    })

            units_by_sec: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
            for un in units:
                units_by_sec.setdefault(un.section_id, []).append({
                    "id": un.unit_number,
                    "title": un.title,
                    "stages": stages_by_unit.get(un.id, [])
                })

            curriculum_sections = []
            for sec in sections:
                sec_units = units_by_sec.get(sec.id, [])
                # Only include sections that contain at least one stage
                has_stages = any(len(u.get("stages", [])) > 0 for u in sec_units)
                if has_stages:
                    curriculum_sections.append({
                        "id": sec.section_number,
                        "title": sec.title,
                        "units": sec_units
                    })

            # If a specific grade level was requested, do not fall back to flat/all stages!
            # Return the sections matching this grade level (empty if teacher hasn't created any yet)
            if grade_level is not None:
                res_data = {"sections": curriculum_sections}
                _curriculum_cache[cache_key] = {"data": res_data, "timestamp": now}
                return res_data

            if curriculum_sections:
                res_data = {"sections": curriculum_sections}
                _curriculum_cache[cache_key] = {"data": res_data, "timestamp": now}
                return res_data

        # If a specific grade level was requested and no normalized curriculum exists for it,
        # return empty sections so Grade 2 & Grade 3 students don't mistakenly see Grade 1 lessons!
        if grade_level is not None:
            res_data = {"sections": []}
            _curriculum_cache[cache_key] = {"data": res_data, "timestamp": now}
            return res_data

        # 2. Fallback to reading flat curriculum_stages if normalized tables are not yet populated
        stages_res = await db.execute(
            select(CurriculumStage)
            .where(CurriculumStage.is_active == True)
            .order_by(CurriculumStage.stage_number.asc())
        )
        stages = stages_res.scalars().all()

        baselines_res = await db.execute(
            select(FSLBaseline)
            .where(FSLBaseline.is_active == True)
            .order_by(FSLBaseline.order_index.asc().nulls_last(), FSLBaseline.sign_id.asc().nulls_last())
        )
        baselines = baselines_res.scalars().all()

        baselines_by_stage: Dict[int, List[Dict[str, Any]]] = {}
        custom_baselines: List[Dict[str, Any]] = []

        for b in baselines:
            if b.sign_id is None or b.sign_id == 0:
                continue
            item = {
                "globalId": b.sign_id,
                "name": b.sign_name,
                "videoUrl": f"/videos/{b.video_filename}" if b.video_filename else None,
                "videoFilename": b.video_filename,
                "photoUrl": resolve_sign_photo(b.sign_id, b.stage_id, b.sign_name)
            }
            if b.stage_id_new is not None:
                baselines_by_stage.setdefault(b.stage_id_new, []).append(item)
            else:
                custom_baselines.append(item)

        sections_map: Dict[int, Dict[str, Any]] = {}
        for st in stages:
            sec_num = st.section_number
            if sec_num not in sections_map:
                sections_map[sec_num] = {
                    "id": sec_num,
                    "title": st.section_title,
                    "units": []
                }

            sec = sections_map[sec_num]
            unit = next((u for u in sec["units"] if u["id"] == st.unit_number), None)
            if not unit:
                unit = {
                    "id": st.unit_number,
                    "title": st.unit_title,
                    "stages": []
                }
                sec["units"].append(unit)

            unit["stages"].append({
                "id": st.stage_number,
                "title": st.title,
                "description": st.description or "",
                "items": baselines_by_stage.get(st.id, [])
            })

        curriculum = [sections_map[k] for k in sorted(sections_map.keys())]

        if custom_baselines and curriculum:
            curriculum[0]["units"].append({
                "id": 99,
                "title": "Teacher Custom Signs",
                "stages": [
                    {
                        "id": 1000 + idx,
                        "title": f"FSL Sign: {cb['name']}",
                        "description": f"Custom sign '{cb['name']}'",
                        "items": [cb]
                    }
                    for idx, cb in enumerate(custom_baselines)
                ]
            })

        res_data = {"sections": curriculum}
        _curriculum_cache[cache_key] = {"data": res_data, "timestamp": now}
        return res_data

    except Exception as e:
        # Fallback in case of DB error
        print(f"Curriculum DB warning: {e}")
        return {"sections": []}


@router.get("/users/{student_id}/progress")
async def get_student_progress(student_id: str, db: AsyncSession = Depends(get_db)):
    try:
        stud_uuid = uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid student UUID")

    user_res = await db.execute(select(User).where(User.id == stud_uuid))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    profile_res = await db.execute(select(StudentProfile).where(StudentProfile.student_id == stud_uuid))
    profile = profile_res.scalar_one_or_none()

    # Query progression from student_stage_progress (source of truth)
    prog_res = await db.execute(
        select(StudentStageProgress, CurriculumStage)
        .join(CurriculumStage, StudentStageProgress.stage_id == CurriculumStage.id)
        .where(StudentStageProgress.student_id == stud_uuid)
        .order_by(CurriculumStage.stage_number.asc())
    )
    rows = prog_res.all()

    # Fetch ordered list of active curriculum stages for this student's grade level with section info
    student_grade = profile.grade_level if profile else 1
    all_stages_query = (
        select(CurriculumStage, CurriculumSection.id.label("section_id"))
        .join(CurriculumUnit, CurriculumStage.unit_id == CurriculumUnit.id)
        .join(CurriculumSection, CurriculumUnit.section_id == CurriculumSection.id)
        .join(Curriculum, CurriculumSection.curriculum_id == Curriculum.id)
        .where(CurriculumStage.is_active == True, Curriculum.grade_level == student_grade)
        .order_by(CurriculumSection.section_number.asc(), CurriculumStage.stage_number.asc())
    )
    all_stages_res = await db.execute(all_stages_query)
    all_active_stage_rows = all_stages_res.all()

    # Build a map of stage progression keyed by stage id
    ssp_map = {ssp.stage_id: ssp for ssp, stage in rows}

    unlocked_stages = []
    stage_progress = []

    # Sequential unlock per section:
    # First stage of EVERY section is always accessible/unlocked!
    # Subsequent stages in a section unlock when the prior stage in that same section is passed.
    current_sec_id = None
    prev_passed = True

    # Pre-aggregate distinct completed signs by stage for this student in ONE fast grouped query
    completed_signs_query = (
        select(
            EvaluationAttempt.stage_id_new,
            func.count(func.distinct(EvaluationAttempt.sign_id))
        )
        .where(
            EvaluationAttempt.student_id == stud_uuid,
            EvaluationAttempt.passed == True
        )
        .group_by(EvaluationAttempt.stage_id_new)
    )
    completed_res = await db.execute(completed_signs_query)
    completed_map = {st_id: count for st_id, count in completed_res.all() if st_id is not None}

    for stage, sec_id in all_active_stage_rows:
        if sec_id != current_sec_id:
            # New section begins: first stage of this section is always unlocked!
            current_sec_id = sec_id
            prev_passed = True

        ssp = ssp_map.get(stage.id)

        # Determine correct unlock state within this section
        should_be_unlocked = prev_passed

        if ssp:
            # Self-heal: fix stale unlocked=True when prior stages not passed
            if ssp.unlocked and not should_be_unlocked:
                ssp.unlocked = False
            # Self-heal: unlock if prior stage passed but this wasn't marked
            elif not ssp.unlocked and should_be_unlocked:
                ssp.unlocked = True

            effective_unlocked = ssp.unlocked
            effective_passed = ssp.passed
            best_score = round(float(ssp.best_score or 0.0), 1)
            stars = ssp.stars or 0
        else:
            effective_unlocked = should_be_unlocked
            effective_passed = False
            best_score = 0.0
            stars = 0

        # Fast in-memory lookup from pre-aggregated map (0ms vs N SQL roundtrips!)
        completed_signs = completed_map.get(stage.id, 0)

        if effective_unlocked:
            unlocked_stages.append(stage.stage_number)

        stage_progress.append({
            "stage_id": stage.stage_number,
            "unlocked": effective_unlocked,
            "passed": effective_passed,
            "best_score": best_score,
            "stars": stars,
            "completed_signs": completed_signs
        })

        # For the next iteration: this stage must be passed to unlock the next
        prev_passed = effective_passed

    # Commit any self-healing changes
    await db.commit()

    # If stages exist for this grade level but none unlocked yet, unlock the first one
    if all_active_stage_rows and not unlocked_stages:
        first_st = all_active_stage_rows[0][0]
        unlocked_stages = [first_st.stage_number]
        for sp in stage_progress:
            if sp["stage_id"] == first_st.stage_number:
                sp["unlocked"] = True
                break

    streak = get_effective_streak(profile)

    # Calculate culminating mastery across signs (aligned with Web Parent & Teacher standards)
    all_student_attempts_res = await db.execute(
        select(EvaluationAttempt)
        .where(EvaluationAttempt.student_id == stud_uuid)
        .order_by(EvaluationAttempt.created_at.desc())
    )
    all_student_attempts = all_student_attempts_res.scalars().all()

    latest_per_sign = {}
    mastered_signs = set()
    for a in all_student_attempts:
        key = f"{a.stage_id or 1}_{a.sign_id or 1}"
        if key not in latest_per_sign:
            latest_per_sign[key] = a
        if a.passed:
            mastered_signs.add(a.sign_id or 1)

    mastery_list = list(latest_per_sign.values()) if latest_per_sign else all_student_attempts
    avg_score = round(float(sum((a.score_overall or 0.0) for a in mastery_list) / len(mastery_list)), 2) if mastery_list else 0.0
    total_signs_mastered = len(mastered_signs)

    return {
        "student_id": student_id,
        "student_name": user.name,
        "unlocked_stages": sorted(unlocked_stages),
        "stages": stage_progress,
        "total_signs_mastered": total_signs_mastered,
        "current_streak": streak,
        "avg_score": avg_score
    }


# ── 1. Curriculums CRUD ───────────────────────────────────────────────────────
@router.get("/curriculums", response_model=List[CurriculumResponse])
async def list_curriculums(
    grade_level: Optional[int] = Query(None, description="Filter by grade level"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Curriculum).where(Curriculum.is_active == True)
    if grade_level is not None:
        query = query.where(Curriculum.grade_level == grade_level)
    query = query.order_by(Curriculum.grade_level.asc(), Curriculum.created_at.asc())
    res = await db.execute(query)
    return res.scalars().all()

@router.post("/curriculums", response_model=CurriculumResponse, status_code=status.HTTP_201_CREATED)
async def create_curriculum(payload: CurriculumCreate, db: AsyncSession = Depends(get_db)):
    new_curr = Curriculum(
        grade_level=payload.grade_level,
        title=payload.title,
        description=payload.description
    )
    db.add(new_curr)
    await db.commit()
    await db.refresh(new_curr)
    invalidate_curriculum_cache()
    return new_curr

@router.get("/curriculums/{curriculum_id}", response_model=CurriculumResponse)
async def get_curriculum_by_id(curriculum_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Curriculum)
        .options(
            selectinload(Curriculum.sections)
            .selectinload(CurriculumSection.units)
            .selectinload(CurriculumUnit.stages)
        )
        .where(Curriculum.id == curriculum_id)
    )
    curr = res.scalar_one_or_none()
    if not curr:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curr

@router.put("/curriculums/{curriculum_id}", response_model=CurriculumResponse)
async def update_curriculum(curriculum_id: uuid.UUID, payload: CurriculumUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id))
    curr = res.scalar_one_or_none()
    if not curr:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    if payload.title is not None:
        curr.title = payload.title
    if payload.grade_level is not None:
        curr.grade_level = payload.grade_level
    if payload.description is not None:
        curr.description = payload.description
    if payload.is_active is not None:
        curr.is_active = payload.is_active
    await db.commit()

    updated_res = await db.execute(
        select(Curriculum)
        .options(
            selectinload(Curriculum.sections)
            .selectinload(CurriculumSection.units)
            .selectinload(CurriculumUnit.stages)
        )
        .where(Curriculum.id == curriculum_id)
    )
    invalidate_curriculum_cache()
    return updated_res.scalar_one()

@router.delete("/curriculums/{curriculum_id}", status_code=status.HTTP_200_OK)
async def delete_curriculum(curriculum_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id))
    curr = res.scalar_one_or_none()
    if not curr:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    curr.is_active = False
    await db.commit()
    invalidate_curriculum_cache()
    return {"status": "deactivated", "curriculum_id": str(curriculum_id)}


# ── 2. Sections CRUD ──────────────────────────────────────────────────────────
@router.get("/curriculums/{curriculum_id}/sections", response_model=List[SectionResponse])
async def list_curriculum_sections(curriculum_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(CurriculumSection)
        .options(
            selectinload(CurriculumSection.units)
            .selectinload(CurriculumUnit.stages)
        )
        .where(CurriculumSection.curriculum_id == curriculum_id)
        .order_by(CurriculumSection.section_number.asc())
    )
    return res.scalars().all()

@router.post("/curriculums/{curriculum_id}/sections", response_model=SectionResponse, status_code=status.HTTP_201_CREATED)
async def create_curriculum_section(curriculum_id: uuid.UUID, payload: SectionCreate, db: AsyncSession = Depends(get_db)):
    curr_res = await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id))
    if not curr_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Curriculum not found")

    sec_num = payload.section_number
    if sec_num is None:
        max_sec_res = await db.execute(
            select(func.coalesce(func.max(CurriculumSection.section_number), 0))
            .where(CurriculumSection.curriculum_id == curriculum_id)
        )
        sec_num = max_sec_res.scalar() + 1

    new_sec = CurriculumSection(
        curriculum_id=curriculum_id,
        section_number=sec_num,
        title=payload.title
    )
    db.add(new_sec)
    await db.commit()
    
    # Reload with relationships so Pydantic SectionResponse can serialize .units without MissingGreenlet error
    res = await db.execute(
        select(CurriculumSection)
        .options(
            selectinload(CurriculumSection.units)
            .selectinload(CurriculumUnit.stages)
        )
        .where(CurriculumSection.id == new_sec.id)
    )
    return res.scalar_one()

@router.put("/curriculum-sections/{section_id}", response_model=SectionResponse)
async def update_curriculum_section(section_id: uuid.UUID, payload: SectionUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CurriculumSection).where(CurriculumSection.id == section_id))
    sec = res.scalar_one_or_none()
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    if payload.title is not None:
        sec.title = payload.title
    if payload.section_number is not None:
        sec.section_number = payload.section_number
    await db.commit()
    
    reloaded = await db.execute(
        select(CurriculumSection)
        .options(
            selectinload(CurriculumSection.units)
            .selectinload(CurriculumUnit.stages)
        )
        .where(CurriculumSection.id == sec.id)
    )
    return reloaded.scalar_one()

@router.delete("/curriculum-sections/{section_id}", status_code=status.HTTP_200_OK)
async def delete_curriculum_section(section_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CurriculumSection).where(CurriculumSection.id == section_id))
    sec = res.scalar_one_or_none()
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(sec)
    await db.commit()
    return {"status": "deleted", "section_id": str(section_id)}


# ── 3. Units CRUD ─────────────────────────────────────────────────────────────
@router.get("/curriculum-sections/{section_id}/units", response_model=List[UnitResponse])
async def list_section_units(section_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(CurriculumUnit)
        .options(selectinload(CurriculumUnit.stages))
        .where(CurriculumUnit.section_id == section_id)
        .order_by(CurriculumUnit.unit_number.asc())
    )
    return res.scalars().all()

@router.post("/curriculum-sections/{section_id}/units", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
async def create_section_unit(section_id: uuid.UUID, payload: UnitCreate, db: AsyncSession = Depends(get_db)):
    sec_res = await db.execute(select(CurriculumSection).where(CurriculumSection.id == section_id))
    if not sec_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Section not found")

    un_num = payload.unit_number
    if un_num is None:
        max_un_res = await db.execute(
            select(func.coalesce(func.max(CurriculumUnit.unit_number), 0))
            .where(CurriculumUnit.section_id == section_id)
        )
        un_num = max_un_res.scalar() + 1

    new_unit = CurriculumUnit(
        section_id=section_id,
        unit_number=un_num,
        title=payload.title
    )
    db.add(new_unit)
    await db.commit()
    
    reloaded = await db.execute(
        select(CurriculumUnit)
        .options(selectinload(CurriculumUnit.stages))
        .where(CurriculumUnit.id == new_unit.id)
    )
    return reloaded.scalar_one()

@router.put("/curriculum-units/{unit_id}", response_model=UnitResponse)
async def update_section_unit(unit_id: uuid.UUID, payload: UnitUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CurriculumUnit).where(CurriculumUnit.id == unit_id))
    un = res.scalar_one_or_none()
    if not un:
        raise HTTPException(status_code=404, detail="Unit not found")
    if payload.title is not None:
        un.title = payload.title
    if payload.unit_number is not None:
        un.unit_number = payload.unit_number
    await db.commit()
    await db.refresh(un)
    return un

@router.delete("/curriculum-units/{unit_id}", status_code=status.HTTP_200_OK)
async def delete_section_unit(unit_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CurriculumUnit).where(CurriculumUnit.id == unit_id))
    un = res.scalar_one_or_none()
    if not un:
        raise HTTPException(status_code=404, detail="Unit not found")
    await db.delete(un)
    await db.commit()
    return {"status": "deleted", "unit_id": str(unit_id)}


# ── 4. Stages CRUD ────────────────────────────────────────────────────────────
@router.get("/curriculum-units/{unit_id}/stages", response_model=List[StageResponse])
async def list_unit_stages(unit_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(CurriculumStage)
        .where(CurriculumStage.unit_id == unit_id, CurriculumStage.is_active == True)
        .order_by(CurriculumStage.stage_number.asc())
    )
    return res.scalars().all()

@router.post("/curriculum-units/{unit_id}/stages", response_model=StageResponse, status_code=status.HTTP_201_CREATED)
async def create_unit_stage(unit_id: uuid.UUID, payload: StageCreate, db: AsyncSession = Depends(get_db)):
    un_res = await db.execute(select(CurriculumUnit).where(CurriculumUnit.id == unit_id))
    if not un_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Unit not found")

    stage_number = payload.stage_number
    existing_number = await db.execute(
        select(CurriculumStage.id).where(
            CurriculumStage.stage_number == stage_number
        )
    )
    if existing_number.scalar_one_or_none() is not None:
        max_number = await db.execute(
            select(func.coalesce(func.max(CurriculumStage.stage_number), 0))
        )
        stage_number = (max_number.scalar() or 0) + 1

    new_stage = CurriculumStage(
        unit_id=unit_id,
        stage_number=stage_number,
        title=payload.title,
        description=payload.description
    )
    db.add(new_stage)
    await db.commit()
    await db.refresh(new_stage)
    return new_stage

@router.get("/curriculum-stages/{stage_id}")
async def get_curriculum_stage(stage_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch single stage details with linked baselines/videos for teacher view."""
    res = await db.execute(
        select(CurriculumStage)
        .options(selectinload(CurriculumStage.baselines))
        .where(CurriculumStage.id == stage_id)
    )
    st = res.scalar_one_or_none()
    if not st:
        # Fallback to stage_number lookup
        res_num = await db.execute(
            select(CurriculumStage)
            .options(selectinload(CurriculumStage.baselines))
            .where(CurriculumStage.stage_number == stage_id)
        )
        st = res_num.scalar_one_or_none()
        if not st:
            raise HTTPException(status_code=404, detail="Stage not found")

    # Format baseline demonstration videos/signs
    signs = []
    for b in (st.baselines or []):
        if b.is_active:
            signs.append({
                "id": str(b.id),
                "sign_id": b.sign_id or b.stage_id,
                "sign_name": b.sign_name,
                "video_filename": b.video_filename,
                "video_url": f"/videos/{b.video_filename}",
                "fps": b.fps,
                "total_frames": b.total_frames,
                "photo_url": resolve_sign_photo(b.sign_id or b.stage_id, b.stage_id, b.sign_name)
            })

    return {
        "id": st.id,
        "stage_number": st.stage_number,
        "title": st.title,
        "description": st.description or "",
        "section_title": st.section_title or "Section",
        "unit_title": st.unit_title or "Unit",
        "is_active": st.is_active,
        "unit_id": str(st.unit_id) if st.unit_id else None,
        "signs": signs
    }

@router.put("/curriculum-stages/{stage_id}", response_model=StageResponse)
async def update_curriculum_stage(stage_id: str, payload: StageUpdate, db: AsyncSession = Depends(get_db)):
    int_id = None
    try:
        int_id = int(stage_id)
    except (ValueError, TypeError):
        pass

    st = None
    if int_id is not None:
        res = await db.execute(select(CurriculumStage).where(CurriculumStage.id == int_id))
        st = res.scalar_one_or_none()
        if not st:
            res_num = await db.execute(select(CurriculumStage).where(CurriculumStage.stage_number == int_id))
            st = res_num.scalar_one_or_none()

    if not st:
        raise HTTPException(status_code=404, detail="Stage not found")
    if payload.title is not None:
        st.title = payload.title
    if payload.description is not None:
        st.description = payload.description
    if payload.stage_number is not None and payload.stage_number != st.stage_number:
        # Check if stage_number is already used by another stage
        existing_dup = await db.execute(
            select(CurriculumStage.id).where(
                CurriculumStage.stage_number == payload.stage_number,
                CurriculumStage.id != st.id
            )
        )
        if existing_dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=400,
                detail=f"Stage number {payload.stage_number} already exists. Please choose a different stage number."
            )
        st.stage_number = payload.stage_number
    if payload.is_active is not None:
        st.is_active = payload.is_active
    await db.commit()
    await db.refresh(st)
    return st

@router.delete("/curriculum-stages/{stage_id}", status_code=status.HTTP_200_OK)
async def delete_curriculum_stage(stage_id: str, db: AsyncSession = Depends(get_db)):
    int_id = None
    try:
        int_id = int(stage_id)
    except (ValueError, TypeError):
        pass

    st = None
    if int_id is not None:
        res = await db.execute(select(CurriculumStage).where(CurriculumStage.id == int_id))
        st = res.scalar_one_or_none()
        if not st:
            res_num = await db.execute(select(CurriculumStage).where(CurriculumStage.stage_number == int_id))
            st = res_num.scalar_one_or_none()

    if not st:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    stage_id_val = st.id
    
    # 1. Clean up student stage progress
    await db.execute(delete(StudentStageProgress).where(StudentStageProgress.stage_id == stage_id_val))
    
    # 2. Clean up associated baselines and evaluation attempts & disk files
    baselines_res = await db.execute(select(FSLBaseline).where(FSLBaseline.stage_id_new == stage_id_val))
    for b in baselines_res.scalars().all():
        remove_baseline_disk_files(b.video_filename, b.stage_id)
        if b.sign_id is not None:
            await db.execute(delete(EvaluationAttempt).where(EvaluationAttempt.sign_id == b.sign_id))
        if b.stage_id is not None:
            await db.execute(delete(EvaluationAttempt).where(EvaluationAttempt.stage_id == b.stage_id))
        await db.delete(b)
        
    await db.delete(st)
    await db.commit()
    return {"status": "deleted", "stage_id": stage_id_val}

@router.delete("/curriculum-signs/{sign_id}", status_code=status.HTTP_200_OK)
async def delete_curriculum_sign(sign_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a specific baseline sign (round) from a stage and purge disk files."""
    b = None
    # 1. Try matching UUID primary key if sign_id is uuid-like
    try:
        uuid_val = uuid.UUID(sign_id)
        res_uuid = await db.execute(select(FSLBaseline).where(FSLBaseline.id == uuid_val))
        b = res_uuid.scalar_one_or_none()
    except (ValueError, TypeError):
        pass

    # 2. Try integer sign_id or stage_id
    if not b:
        try:
            int_id = int(sign_id)
            res = await db.execute(select(FSLBaseline).where(FSLBaseline.sign_id == int_id))
            b = res.scalar_one_or_none()
            if not b:
                res_alt = await db.execute(select(FSLBaseline).where(FSLBaseline.stage_id == int_id))
                b = res_alt.scalar_one_or_none()
        except (ValueError, TypeError):
            pass

    if not b:
        raise HTTPException(status_code=404, detail="Sign baseline not found")

    # 3. Purge physical video & baseline json files from backend & student-desktop
    remove_baseline_disk_files(b.video_filename, b.stage_id)

    # 4. Clean up evaluation attempts referencing this sign
    if b.sign_id is not None:
        await db.execute(delete(EvaluationAttempt).where(EvaluationAttempt.sign_id == b.sign_id))
    if b.stage_id is not None:
        await db.execute(delete(EvaluationAttempt).where(EvaluationAttempt.stage_id == b.stage_id))

    await db.delete(b)
    await db.commit()
    return {"status": "deleted", "sign_id": sign_id}

from fastapi import UploadFile, File

async def find_baseline_by_id_or_ref(ref_id: str, db: AsyncSession) -> Optional[FSLBaseline]:
    """Find a baseline by UUID, sign_id, stage_id, or sign_name."""
    # 1. Try UUID
    try:
        uuid_val = uuid.UUID(ref_id)
        res = await db.execute(select(FSLBaseline).where(FSLBaseline.id == uuid_val))
        b = res.scalar_one_or_none()
        if b:
            return b
    except (ValueError, TypeError):
        pass

    # 2. Try integer sign_id or stage_id
    try:
        int_id = int(ref_id)
        res = await db.execute(select(FSLBaseline).where(FSLBaseline.sign_id == int_id))
        b = res.scalar_one_or_none()
        if b:
            return b
        res_alt = await db.execute(select(FSLBaseline).where(FSLBaseline.stage_id == int_id))
        b = res_alt.scalar_one_or_none()
        if b:
            return b
    except (ValueError, TypeError):
        pass

    # 3. Try matching sign_name
    res_name = await db.execute(select(FSLBaseline).where(FSLBaseline.sign_name == ref_id))
    return res_name.scalar_one_or_none()

@router.post("/curriculum-signs/{sign_id}/photo", status_code=status.HTTP_200_OK)
async def upload_curriculum_sign_photo(sign_id: str, photo: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Upload or update the static visual aid picture for an existing sign (including earlier uploads)."""
    b = await find_baseline_by_id_or_ref(sign_id, db)
    if not b:
        raise HTTPException(status_code=404, detail="Sign baseline not found")

    p_ext = os.path.splitext(photo.filename)[1].lower() or ".png"
    photo_bytes = await photo.read()
    resolved_id = b.sign_id or b.stage_id

    # Clean up any existing older variants across extensions to prevent shadowing
    extensions_to_clean = [".png", ".jpg", ".jpeg", ".webp"]
    prefixes_to_clean = []
    if resolved_id is not None:
        prefixes_to_clean.extend([f"{resolved_id}", f"thumb_{resolved_id}"])
    if b.stage_id is not None:
        prefixes_to_clean.extend([f"{b.stage_id}", f"thumb_{b.stage_id}"])
    if b.sign_name:
        prefixes_to_clean.extend([f"{b.sign_name}", f"thumb_{b.sign_name}"])

    for pfx in prefixes_to_clean:
        for ext in extensions_to_clean:
            fname = f"{pfx}{ext}"
            for d in [PUBLIC_THUMBNAILS_DIR, STORAGE_THUMBNAILS_DIR]:
                full_p = os.path.join(d, fname)
                if os.path.exists(full_p):
                    try:
                        os.remove(full_p)
                    except Exception:
                        pass

    saved_names = set()
    if resolved_id is not None:
        saved_names.add(f"{resolved_id}{p_ext}")
        saved_names.add(f"{resolved_id}.png")
        saved_names.add(f"thumb_{resolved_id}.png")
    if b.stage_id is not None:
        saved_names.add(f"{b.stage_id}{p_ext}")
        saved_names.add(f"{b.stage_id}.png")
        saved_names.add(f"thumb_{b.stage_id}.png")
    if b.sign_name:
        saved_names.add(f"{b.sign_name}{p_ext}")
        saved_names.add(f"{b.sign_name}.png")
        saved_names.add(f"thumb_{b.sign_name}.png")

    for name in saved_names:
        with open(os.path.join(PUBLIC_THUMBNAILS_DIR, name), "wb") as fp:
            fp.write(photo_bytes)
        with open(os.path.join(STORAGE_THUMBNAILS_DIR, name), "wb") as fb:
            fb.write(photo_bytes)

    # Cloud Sync: upload thumbnail to Supabase Storage (dual-mode)
    try:
        from app.core.supabase_storage import upload_to_supabase
        for name in saved_names:
            await upload_to_supabase("thumbnails", name, photo_bytes)
    except Exception as sup_err:
        print(f"[Supabase Thumbnail Upload Warning]: {sup_err}")

    invalidate_curriculum_cache()
    now_ts = int(time.time())
    primary_name = f"{resolved_id}{p_ext}" if resolved_id else f"{b.sign_name}{p_ext}"
    return {
        "status": "success",
        "sign_id": resolved_id,
        "photo_url": f"/thumbnails/{primary_name}?t={now_ts}"
    }

@router.put("/curriculum-signs/{sign_id}", status_code=status.HTTP_200_OK)
async def update_curriculum_sign(sign_id: str, payload: dict, db: AsyncSession = Depends(get_db)):
    """Update sign name or details of a baseline round."""
    b = await find_baseline_by_id_or_ref(sign_id, db)
    if not b:
        raise HTTPException(status_code=404, detail="Sign baseline not found")

    if "sign_name" in payload and payload["sign_name"]:
        b.sign_name = payload["sign_name"].strip()
    if "is_active" in payload:
        b.is_active = bool(payload["is_active"])

    await db.commit()
    await db.refresh(b)
    invalidate_curriculum_cache()
    return {"status": "updated", "sign_id": b.sign_id or b.stage_id, "sign_name": b.sign_name, "is_active": b.is_active}
