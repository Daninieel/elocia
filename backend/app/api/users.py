from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Numeric, case, delete
from typing import List, Optional
import uuid
from passlib.context import CryptContext

from app.database.connection import get_db
from app.models.user import User, UserRole, StudentProfile, ParentStudent
from app.models.session import EvaluationAttempt, StudentStageProgress
from app.models.minigame import MiniGameSession, MiniGameConfig
from app.models.classroom import Class, ClassStudent, EducationalVideo
from app.models.baseline import FSLBaseline
from app.schemas.auth import StudentCreate, AdultCreate
from app.schemas.user import UserResponse, UserUpdate
from app.core.streak import get_effective_streak

router = APIRouter(tags=["User Management"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/users/students", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_student(data: StudentCreate, db: AsyncSession = Depends(get_db)):
    grade = data.grade_level or 1

    # Find highest sequence number in this grade level from student_profiles
    max_num_res = await db.execute(
        select(func.coalesce(func.max(StudentProfile.student_number), 0))
        .where(StudentProfile.grade_level == grade)
    )
    next_num = (max_num_res.scalar() or 0) + 1
    code = f"G{grade}-{next_num:02d}"

    stud_id = uuid.uuid4()
    # 1. Create User identity
    student = User(
        id=stud_id,
        name=data.name,
        role=UserRole.student
    )
    db.add(student)

    # 2. Create StudentProfile as primary source of truth
    profile = StudentProfile(
        student_id=stud_id,
        student_code=code,
        student_number=next_num,
        pin=data.pin,
        grade_level=grade,
        color=data.color or "#3B82F6",
        emoji=data.emoji or "👦",
        total_xp=0,
        level=1,
        streak=0
    )
    db.add(profile)
    await db.flush()

    if data.parent_id:
        parent_check = await db.execute(
            select(User).where(User.id == data.parent_id, User.role == UserRole.parent, User.is_active == True)
        )
        if not parent_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected parent account not found or is inactive"
            )

        parent_rel = ParentStudent(
            parent_id=data.parent_id,
            student_id=stud_id,
            relationship="Parent"
        )
        db.add(parent_rel)

    await db.commit()
    await db.refresh(student)

    # Return structured UserResponse populated from profile
    return UserResponse(
        id=student.id,
        name=student.name,
        role=student.role,
        is_active=student.is_active,
        color=profile.color,
        emoji=profile.emoji,
        grade_level=profile.grade_level,
        student_number=profile.student_number,
        student_code=profile.student_code,
        level=profile.level,
        streak=profile.streak,
        avg_score=0.0,
        signs_mastered=0,
        stages_complete=0,
        total_xp=profile.total_xp,
        created_at=student.created_at
    )

@router.post("/users/adults", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_adult(data: AdultCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
        
    user = User(
        id=uuid.uuid4(),
        name=data.name,
        role=data.role,
        username=data.username,
        password_hash=pwd_context.hash(data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/students", response_model=List[dict])
async def get_students(
    status: Optional[str] = Query("active", description="'active', 'inactive', or 'all'"),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            User,
            StudentProfile,
            func.coalesce(func.round(cast(func.avg(EvaluationAttempt.score_overall), Numeric), 1), 0.0).label("avg_score")
        )
        .join(StudentProfile, User.id == StudentProfile.student_id)
        .outerjoin(EvaluationAttempt, User.id == EvaluationAttempt.student_id)
        .where(User.role == UserRole.student)
    )
    if status == "active":
        query = query.where(User.is_active == True)
    elif status == "inactive":
        query = query.where(User.is_active == False)

    query = query.group_by(User.id, StudentProfile.student_id).order_by(
        StudentProfile.grade_level.asc(), StudentProfile.student_number.asc(), User.created_at.asc()
    )
    result = await db.execute(query)
    rows = result.all()
    # Query student IDs that have active Tier 4 attempts in official evaluations.
    # Low score (e.g. 60%) or failed attempts do NOT trigger the red dot unless the student actually reaches Tier 4!
    tier4_res = await db.execute(
        select(EvaluationAttempt.student_id)
        .where(
            EvaluationAttempt.activity_type == "evaluation",
            EvaluationAttempt.tier_level == 4
        )
        .distinct()
    )
    flagged_student_ids = {str(sid) for (sid,) in tier4_res.all()}

    return [
        {
            "id": str(u.id),
            "name": u.name,
            "is_active": u.is_active,
            "color": sp.color,
            "emoji": sp.emoji,
            "grade_level": sp.grade_level or 1,
            "student_number": sp.student_number,
            "student_code": sp.student_code or f"G{sp.grade_level or 1}-01",
            "level": sp.level,
            "streak": get_effective_streak(sp),
            "avg_score": float(avg),
            "has_tier4_flag": str(u.id) in flagged_student_ids
        }
        for u, sp, avg in rows
    ]

@router.get("/parents", response_model=List[dict])
async def get_parents(
    search: Optional[str] = Query(None, description="Search parent by name or username"),
    db: AsyncSession = Depends(get_db)
):
    query = select(User).where(User.role == UserRole.parent, User.is_active == True)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where((User.name.ilike(term)) | (User.username.ilike(term)))
    query = query.order_by(User.name.asc())
    result = await db.execute(query)
    parents = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "username": p.username
        }
        for p in parents
    ]

@router.get("/parents/{parent_id}/students", response_model=List[dict])
async def get_parent_students(parent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Fetch all students linked to a specific parent account.
    Used by the Parent Portal to display the parent's children.
    """
    parent_check = await db.execute(
        select(User).where(User.id == parent_id, User.is_active == True)
    )
    parent = parent_check.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent user not found")

    query = (
        select(ParentStudent, User, StudentProfile)
        .join(User, ParentStudent.student_id == User.id)
        .outerjoin(StudentProfile, User.id == StudentProfile.student_id)
        .where(ParentStudent.parent_id == parent_id, User.is_active == True)
        .order_by(StudentProfile.grade_level.asc(), User.name.asc())
    )
    result = await db.execute(query)
    rows = result.all()

    # Query student IDs that have active Tier 4 or unpassed attempts based on their LATEST attempt per sign
    # (If a student previously failed but subsequently practiced and passed the sign, the flag is cleared!)
    # Optimization: Filter strictly to this parent's linked children to prevent scanning the entire attempts table!
    child_ids = [u.id for _, u, _ in rows]
    flagged_student_ids = set()
    if child_ids:
        latest_attempts_sub = (
            select(
                EvaluationAttempt.student_id,
                EvaluationAttempt.sign_id,
                EvaluationAttempt.passed,
                EvaluationAttempt.tier_level,
                func.row_number().over(
                    partition_by=(EvaluationAttempt.student_id, EvaluationAttempt.sign_id),
                    order_by=EvaluationAttempt.created_at.desc()
                ).label("rn")
            )
            .where(EvaluationAttempt.student_id.in_(child_ids))
            .subquery()
        )
        tier4_res = await db.execute(
            select(latest_attempts_sub.c.student_id)
            .where(
                latest_attempts_sub.c.rn == 1,
                (latest_attempts_sub.c.passed == False) | (latest_attempts_sub.c.tier_level >= 4)
            )
            .distinct()
        )
        flagged_student_ids = {str(sid) for (sid,) in tier4_res.all()}

    students = []
    for ps, u, sp in rows:
        students.append({
            "student_id": str(u.id),
            "id": str(u.id),
            "name": u.name,
            "student_code": sp.student_code if sp else None,
            "student_number": sp.student_number if sp else None,
            "grade_level": sp.grade_level if sp else 1,
            "color": sp.color if sp else "#3B82F6",
            "emoji": sp.emoji if sp else "👦",
            "relationship": ps.relationship or "Parent",
            "total_xp": sp.total_xp if sp else 0,
            "level": sp.level if sp else 1,
            "streak": get_effective_streak(sp),
            "has_tier4_flag": str(u.id) in flagged_student_ids
        })
    return students

@router.post("/parents/{parent_id}/students/{student_id}", status_code=status.HTTP_201_CREATED)
async def link_parent_student(
    parent_id: uuid.UUID,
    student_id: uuid.UUID,
    relationship: str = Query("Parent", description="Relationship label, e.g. Mother, Father, Guardian"),
    db: AsyncSession = Depends(get_db)
):
    """
    Link a child to a parent. Supports multiple parents per child (e.g. Mother and Father).
    """
    p_res = await db.execute(
        select(User).where(User.id == parent_id, User.role == UserRole.parent, User.is_active == True)
    )
    if not p_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent user not found or inactive")

    s_res = await db.execute(
        select(User).where(User.id == student_id, User.role == UserRole.student, User.is_active == True)
    )
    if not s_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student user not found or inactive")

    existing = await db.execute(
        select(ParentStudent).where(ParentStudent.parent_id == parent_id, ParentStudent.student_id == student_id)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_linked", "parent_id": str(parent_id), "student_id": str(student_id)}

    new_link = ParentStudent(
        parent_id=parent_id,
        student_id=student_id,
        relationship=relationship
    )
    db.add(new_link)
    await db.commit()
    return {"status": "linked", "parent_id": str(parent_id), "student_id": str(student_id), "relationship": relationship}

@router.delete("/parents/{parent_id}/students/{student_id}", status_code=status.HTTP_200_OK)
async def unlink_parent_student(
    parent_id: uuid.UUID,
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a parent-child connection without deleting either user account.
    """
    existing = await db.execute(
        select(ParentStudent).where(ParentStudent.parent_id == parent_id, ParentStudent.student_id == student_id)
    )
    link = existing.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent-student relationship not found")

    await db.delete(link)
    await db.commit()
    return {"status": "unlinked", "parent_id": str(parent_id), "student_id": str(student_id)}

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    role: Optional[UserRole] = Query(None),
    status: Optional[str] = Query("all", description="'active', 'inactive', or 'all'"),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(User, StudentProfile)
        .outerjoin(StudentProfile, User.id == StudentProfile.student_id)
    )
    if status == "active":
        query = query.where(User.is_active == True)
    elif status == "inactive":
        query = query.where(User.is_active == False)

    if role:
        query = query.where(User.role == role)
    result = await db.execute(query)
    rows = result.all()

    # 1. Fetch parent-student links with student name & student grade level
    parent_links_res = await db.execute(
        select(ParentStudent.parent_id, User.name, StudentProfile.grade_level)
        .join(User, ParentStudent.student_id == User.id)
        .outerjoin(StudentProfile, User.id == StudentProfile.student_id)
    )
    children_by_parent = {}
    for p_id, s_name, s_grade in parent_links_res.all():
        grade_str = f"Grade {s_grade}" if s_grade else ""
        item_str = f"{s_name} ({grade_str})" if grade_str else s_name
        children_by_parent.setdefault(p_id, []).append(item_str)

    # Also fetch all linked parents for each student
    student_parents_res = await db.execute(
        select(ParentStudent.student_id, ParentStudent.parent_id, User.name, User.username, ParentStudent.relationship)
        .join(User, ParentStudent.parent_id == User.id)
    )
    parents_by_student = {}
    for s_id, p_id, p_name, p_uname, p_rel in student_parents_res.all():
        parents_by_student.setdefault(s_id, []).append({
            "id": p_id,
            "name": p_name,
            "username": p_uname,
            "relationship": p_rel or "Parent"
        })

    # 2. Fetch assigned classes for teachers
    classes_res = await db.execute(select(Class.teacher_id, Class.name, Class.grade_level))
    classes_by_teacher = {}
    for t_id, c_name, c_grade in classes_res.all():
        classes_by_teacher.setdefault(t_id, []).append(f"{c_name} (Grade {c_grade})")

    responses = []
    for u, sp in rows:
        children_list = children_by_parent.get(u.id, [])
        children_summary = ", ".join(children_list) if children_list else None

        teacher_classes = classes_by_teacher.get(u.id, [])
        class_name = ", ".join(teacher_classes) if teacher_classes else None

        # Only students have a student grade level
        student_grade = sp.grade_level if (sp and u.role == UserRole.student) else None

        p_list = parents_by_student.get(u.id, []) if u.role == UserRole.student else []
        parent_summary = ", ".join([p["name"] for p in p_list]) if p_list else None
        first_parent_id = p_list[0]["id"] if p_list else None

        responses.append(
            UserResponse(
                id=u.id,
                name=u.name,
                role=u.role,
                username=u.username,
                is_active=u.is_active,
                color=sp.color if sp else None,
                emoji=sp.emoji if sp else None,
                grade_level=student_grade,
                student_number=sp.student_number if sp else None,
                student_code=sp.student_code if sp else None,
                parent_id=first_parent_id,
                parent_name=parent_summary,
                parents=p_list,
                parent_summary=parent_summary,
                children_summary=children_summary,
                class_name=class_name,
                level=sp.level if sp else None,
                streak=get_effective_streak(sp) if sp else None,
                avg_score=0.0,
                signs_mastered=0,
                stages_complete=0,
                total_xp=sp.total_xp if sp else None,
                created_at=u.created_at
            )
        )
    return responses

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User, StudentProfile)
        .outerjoin(StudentProfile, User.id == StudentProfile.student_id)
        .where(User.id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user, profile = row

    # Consolidated query: compute live eval XP, avg score, and signs mastered in 1 query
    eval_stats_res = await db.execute(
        select(
            func.coalesce(func.sum(EvaluationAttempt.xp_earned), 0).label("eval_xp"),
            func.coalesce(
                func.round(cast(func.avg(case((EvaluationAttempt.score_overall > 0, EvaluationAttempt.score_overall))), Numeric), 1),
                0.0
            ).label("avg_score"),
            func.count(func.distinct(case((EvaluationAttempt.passed == True, EvaluationAttempt.sign_id)))).label("signs_mastered")
        )
        .where(EvaluationAttempt.student_id == user_id)
    )
    eval_row = eval_stats_res.first()
    total_eval_xp = eval_row.eval_xp if eval_row else 0
    avg_score = float(eval_row.avg_score or 0.0) if eval_row else 0.0
    signs_mastered = int(eval_row.signs_mastered or 0) if eval_row else 0

    game_xp_res = await db.execute(
        select(func.coalesce(func.sum(MiniGameSession.score), 0))
        .where(MiniGameSession.student_id == user_id)
    )
    total_game_xp = game_xp_res.scalar() or 0

    computed_xp = int(total_eval_xp + total_game_xp)

    # Compute live stages_complete from StudentStageProgress
    stages_res = await db.execute(
        select(func.count(StudentStageProgress.id))
        .where(StudentStageProgress.student_id == user_id, StudentStageProgress.passed == True)
    )
    stages_complete = int(stages_res.scalar() or 0)
    if stages_complete == 0 and signs_mastered > 0:
        stages_complete = signs_mastered

    # Fetch all parent info if student
    parents_list = []
    parent_summary = None
    first_parent_id = None
    if user.role == UserRole.student:
        p_res = await db.execute(
            select(ParentStudent.parent_id, User.name, User.username, ParentStudent.relationship)
            .join(User, ParentStudent.parent_id == User.id)
            .where(ParentStudent.student_id == user_id)
        )
        for p_id, p_name, p_uname, p_rel in p_res.all():
            parents_list.append({
                "id": p_id,
                "name": p_name,
                "username": p_uname,
                "relationship": p_rel or "Parent"
            })
        if parents_list:
            parent_summary = ", ".join([p["name"] for p in parents_list])
            first_parent_id = parents_list[0]["id"]

    # Check if student has active Tier 4 / unpassed flags based on their LATEST attempt per sign
    has_tier4_flag = False
    if user.role == UserRole.student:
        latest_attempts_sub = (
            select(
                EvaluationAttempt.sign_id,
                EvaluationAttempt.passed,
                EvaluationAttempt.tier_level,
                func.row_number().over(
                    partition_by=EvaluationAttempt.sign_id,
                    order_by=EvaluationAttempt.created_at.desc()
                ).label("rn")
            )
            .where(EvaluationAttempt.student_id == user_id)
            .subquery()
        )
        t4_check = await db.execute(
            select(latest_attempts_sub.c.sign_id)
            .where(
                latest_attempts_sub.c.rn == 1,
                (latest_attempts_sub.c.passed == False) | (latest_attempts_sub.c.tier_level >= 4)
            )
            .limit(1)
        )
        has_tier4_flag = t4_check.first() is not None

    return UserResponse(
        id=user.id,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        color=profile.color if profile else None,
        emoji=profile.emoji if profile else None,
        grade_level=profile.grade_level if profile else 1,
        student_number=profile.student_number if profile else None,
        student_code=profile.student_code if profile else None,
        parent_id=first_parent_id,
        parent_name=parent_summary,
        parents=parents_list,
        parent_summary=parent_summary,
        level=profile.level if profile else 1,
        streak=get_effective_streak(profile),
        avg_score=avg_score,
        signs_mastered=signs_mastered,
        stages_complete=stages_complete,
        total_xp=profile.total_xp if profile else computed_xp,
        has_tier4_flag=has_tier4_flag,
        created_at=user.created_at
    )

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: uuid.UUID, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User, StudentProfile)
        .outerjoin(StudentProfile, User.id == StudentProfile.student_id)
        .where(User.id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user, profile = row

    if data.name is not None:
        user.name = data.name
    if data.password is not None and data.password.strip():
        user.password_hash = pwd_context.hash(data.password.strip())
    if data.is_active is not None:
        if user.role == UserRole.admin and not data.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin accounts are permanently protected and cannot be deactivated."
            )
        user.is_active = data.is_active

    if profile:
        if data.pin is not None:
            profile.pin = data.pin
        if data.color is not None:
            profile.color = data.color
        if data.emoji is not None:
            profile.emoji = data.emoji
        if data.grade_level is not None:
            profile.grade_level = data.grade_level
        if data.student_code is not None:
            profile.student_code = data.student_code

    if user.role == UserRole.student:
        if data.remove_parent or (data.parent_ids is not None and len(data.parent_ids) == 0):
            existing_links = await db.execute(
                select(ParentStudent).where(ParentStudent.student_id == user_id)
            )
            for link in existing_links.scalars().all():
                await db.delete(link)
        elif data.parent_ids is not None:
            # Sync entire parent_ids list
            existing_links = await db.execute(
                select(ParentStudent).where(ParentStudent.student_id == user_id)
            )
            for link in existing_links.scalars().all():
                await db.delete(link)

            for pid in data.parent_ids:
                p_check = await db.execute(
                    select(User).where(User.id == pid, User.role == UserRole.parent, User.is_active == True)
                )
                if p_check.scalar_one_or_none():
                    db.add(ParentStudent(parent_id=pid, student_id=user_id, relationship="Parent"))
        elif data.parent_id is not None:
            existing_links = await db.execute(
                select(ParentStudent).where(ParentStudent.student_id == user_id)
            )
            for link in existing_links.scalars().all():
                await db.delete(link)

            p_check = await db.execute(
                select(User).where(User.id == data.parent_id, User.role == UserRole.parent, User.is_active == True)
            )
            if p_check.scalar_one_or_none():
                db.add(ParentStudent(parent_id=data.parent_id, student_id=user_id, relationship="Parent"))

    await db.commit()
    await db.refresh(user)
    if profile:
        await db.refresh(profile)

    # Fetch updated parents for student
    parents_list = []
    parent_summary = None
    first_parent_id = None
    if user.role == UserRole.student:
        p_res = await db.execute(
            select(ParentStudent.parent_id, User.name, User.username, ParentStudent.relationship)
            .join(User, ParentStudent.parent_id == User.id)
            .where(ParentStudent.student_id == user_id)
        )
        for p_id, p_name, p_uname, p_rel in p_res.all():
            parents_list.append({
                "id": p_id,
                "name": p_name,
                "username": p_uname,
                "relationship": p_rel or "Parent"
            })
        if parents_list:
            parent_summary = ", ".join([p["name"] for p in parents_list])
            first_parent_id = parents_list[0]["id"]

    return UserResponse(
        id=user.id,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        color=profile.color if profile else None,
        emoji=profile.emoji if profile else None,
        grade_level=profile.grade_level if profile else 1,
        student_number=profile.student_number if profile else None,
        student_code=profile.student_code if profile else None,
        parent_id=first_parent_id,
        parent_name=parent_summary,
        parents=parents_list,
        parent_summary=parent_summary,
        level=profile.level if profile else 1,
        streak=get_effective_streak(profile),
        avg_score=0.0,
        signs_mastered=0,
        stages_complete=0,
        total_xp=profile.total_xp if profile else 0,
        created_at=user.created_at
    )

@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def deactivate_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin accounts are permanently protected and cannot be deactivated."
        )
    
    user.is_active = False

    # When a teacher is deactivated, remove their assigned classroom association
    if user.role == UserRole.teacher:
        await db.execute(
            Class.__table__.update()
            .where(Class.teacher_id == user_id)
            .values(teacher_id=None)
        )

    await db.commit()
    return {"status": "deactivated", "user_id": str(user_id)}

@router.delete("/users/{user_id}/permanent", status_code=status.HTTP_200_OK)
async def delete_user_permanently(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin accounts are permanently protected and cannot be deleted."
        )
    
    try:
        # Clean up foreign keys that don't cascade automatically
        # 1. Nullify created_by references in educational videos and baselines
        await db.execute(
            EducationalVideo.__table__.update()
            .where(EducationalVideo.created_by == user_id)
            .values(created_by=None)
        )
        await db.execute(
            FSLBaseline.__table__.update()
            .where(FSLBaseline.created_by == user_id)
            .values(created_by=None)
        )

        # 2. Delete student evaluations and minigame sessions
        await db.execute(delete(EvaluationAttempt).where(EvaluationAttempt.student_id == user_id))
        await db.execute(delete(StudentStageProgress).where(StudentStageProgress.student_id == user_id))
        await db.execute(delete(MiniGameSession).where(MiniGameSession.student_id == user_id))

        # 3. Clean up parent/student links and classroom rosters
        await db.execute(delete(ParentStudent).where((ParentStudent.parent_id == user_id) | (ParentStudent.student_id == user_id)))
        await db.execute(delete(ClassStudent).where(ClassStudent.student_id == user_id))

        # 4. If teacher, unassign their classes instead of abruptly deleting classrooms, or delete if empty
        await db.execute(
            Class.__table__.update()
            .where(Class.teacher_id == user_id)
            .values(teacher_id=None)
        )

        # 5. Delete student profile if exists
        await db.execute(delete(StudentProfile).where(StudentProfile.student_id == user_id))

        # 6. Delete user
        await db.delete(user)
        await db.commit()
        return {"status": "deleted", "user_id": str(user_id)}
    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Failed to permanently delete user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to permanently delete user: {str(e)}"
        )

@router.patch("/users/{user_id}/reactivate", status_code=status.HTTP_200_OK)
async def reactivate_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user.is_active = True
    await db.commit()
    return {"status": "reactivated", "user_id": str(user_id)}