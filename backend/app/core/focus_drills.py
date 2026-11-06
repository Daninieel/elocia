import os
import json
import logging
from typing import Dict, Set, Optional, List, Any

logger = logging.getLogger(__name__)

# File path for persistent resolved drills across server restarts
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_RESOLVED_FILE = os.path.join(_BASE_DIR, "database", "resolved_focus_drills.json")

# In-memory stores: student_id -> drill_record
_ACTIVE_FOCUS_DRILLS: Dict[str, Any] = {}
_RESOLVED_KEYS: Set[str] = set()


def _load_resolved_from_disk():
    global _RESOLVED_KEYS
    try:
        if os.path.exists(_RESOLVED_FILE):
            with open(_RESOLVED_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    # Only retain valid student-namespaced keys (exclude 'all' broadcasts)
                    _RESOLVED_KEYS = {
                        str(k).strip()
                        for k in data
                        if str(k).startswith("student:") and not str(k).startswith("student:all:")
                    }
    except Exception as e:
        logger.warning(f"Could not load resolved focus drills from disk: {e}")


def _save_resolved_to_disk():
    try:
        os.makedirs(os.path.dirname(_RESOLVED_FILE), exist_ok=True)
        with open(_RESOLVED_FILE, "w", encoding="utf-8") as f:
            json.dump(sorted(list(_RESOLVED_KEYS)), f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save resolved focus drills to disk: {e}")


# Initialize from disk
_load_resolved_from_disk()


def get_active_drill(student_id: str) -> Optional[dict]:
    """
    Returns the active focus drill strictly assigned to this specific student (or alias).
    Never falls back to broadcast 'all' to prevent cross-account drill popups.
    """
    if not student_id:
        return None
    sid = str(student_id).strip()
    if not sid or sid.lower() in ("all", "none", "null"):
        return None
    return _ACTIVE_FOCUS_DRILLS.get(sid)


def set_active_drill(student_id: str, drill_record: dict, aliases: Optional[List[str]] = None):
    """
    Saves an active drill specifically for the targeted student and any associated aliases.
    Rejects setting drills on 'all' broadcast.
    """
    if not student_id:
        return
    sid = str(student_id).strip()
    if not sid or sid.lower() in ("all", "none", "null"):
        return

    _ACTIVE_FOCUS_DRILLS[sid] = drill_record
    if aliases:
        for alias in aliases:
            if alias:
                alias_str = str(alias).strip()
                if alias_str and alias_str.lower() not in ("all", "none", "null"):
                    _ACTIVE_FOCUS_DRILLS[alias_str] = drill_record


def clear_active_drill(student_id: str, aliases: Optional[List[str]] = None):
    """
    Clears the active drill strictly for the given student without affecting any other students.
    """
    if not student_id:
        return
    sid = str(student_id).strip()
    if not sid or sid.lower() in ("all", "none", "null"):
        return

    _ACTIVE_FOCUS_DRILLS.pop(sid, None)
    if aliases:
        for alias in aliases:
            if alias:
                _ACTIVE_FOCUS_DRILLS.pop(str(alias).strip(), None)


def mark_sign_resolved(
    student_id: str,
    stage_id: Optional[int] = None,
    sign_id: Optional[int] = None,
    sign_name: Optional[str] = None
):
    """
    Marks a specific sign as resolved strictly for this student.
    Never registers global keys to avoid clearing struggles for other students.
    """
    if not student_id:
        return
    sid = str(student_id).strip()
    if not sid or sid.lower() in ("all", "none", "null"):
        return

    keys_to_add = []

    if sign_name:
        s_clean = sign_name.strip().lower()
        keys_to_add.append(f"student:{sid}:sign_name:{s_clean}")
        if stage_id is not None:
            keys_to_add.append(f"student:{sid}:stage:{stage_id}:sign_name:{s_clean}")

    if sign_id is not None:
        keys_to_add.append(f"student:{sid}:sign_id:{sign_id}")
        if stage_id is not None:
            keys_to_add.append(f"student:{sid}:stage:{stage_id}:sign_id:{sign_id}")

    for k in keys_to_add:
        _RESOLVED_KEYS.add(k)

    _save_resolved_to_disk()


def mark_drill_completed(
    student_id: str,
    stage_id: Optional[int] = None,
    signs: Optional[List[str]] = None
):
    """
    Marks an entire focus drill / stage as completed and resolved strictly for this student.
    Also clears their pending active drill.
    """
    if not student_id:
        return
    sid = str(student_id).strip()
    if not sid or sid.lower() in ("all", "none", "null"):
        return

    if stage_id is not None:
        _RESOLVED_KEYS.add(f"student:{sid}:stage:{stage_id}")

    if signs:
        for s in signs:
            if s:
                mark_sign_resolved(student_id=sid, stage_id=stage_id, sign_name=str(s))

    # Clear active drill for this student only
    clear_active_drill(sid)
    _save_resolved_to_disk()


def is_sign_resolved(
    student_id: str,
    stage_id: Optional[int] = None,
    sign_id: Optional[int] = None,
    sign_name: Optional[str] = None,
    passed_practice_signs: Optional[Set[Any]] = None
) -> bool:
    """
    Checks if a sign's Tier 4 struggle has been resolved strictly for this student via:
    1. A passed practice attempt in the database (passed_practice_signs).
    2. Explicit registration in _RESOLVED_KEYS with student:{sid}: prefix.
    3. Student stage-level resolution.
    """
    if not student_id:
        return False
    sid = str(student_id).strip()
    if not sid or sid.lower() in ("all", "none", "null"):
        return False

    # 1. Check against DB passed practice signs for this student
    if passed_practice_signs:
        if sign_id is not None and (sign_id in passed_practice_signs or str(sign_id) in passed_practice_signs):
            return True
        if sign_name:
            s_clean = sign_name.strip().lower()
            if s_clean in passed_practice_signs or sign_name in passed_practice_signs:
                return True

    # 2. Check student stage-level resolution
    if stage_id is not None:
        if f"student:{sid}:stage:{stage_id}" in _RESOLVED_KEYS:
            return True

    # 3. Check student sign_name keys
    if sign_name:
        s_clean = sign_name.strip().lower()
        candidates = [
            f"student:{sid}:sign_name:{s_clean}",
        ]
        if stage_id is not None:
            candidates.append(f"student:{sid}:stage:{stage_id}:sign_name:{s_clean}")
        if any(c in _RESOLVED_KEYS for c in candidates):
            return True

    # 4. Check student sign_id keys
    if sign_id is not None:
        candidates = [
            f"student:{sid}:sign_id:{sign_id}",
        ]
        if stage_id is not None:
            candidates.append(f"student:{sid}:stage:{stage_id}:sign_id:{sign_id}")
        if any(c in _RESOLVED_KEYS for c in candidates):
            return True

    return False


def get_resolved_keys_for_student(student_id: str) -> List[str]:
    """
    Returns resolved focus drill keys strictly belonging to this student.
    """
    if not student_id:
        return []
    sid = str(student_id).strip()
    if not sid or sid.lower() in ("all", "none", "null"):
        return []
    prefix = f"student:{sid}:"
    return [k for k in _RESOLVED_KEYS if k.startswith(prefix)]
