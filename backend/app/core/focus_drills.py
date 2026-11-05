import os
import json
import logging
from typing import Dict, Set, Optional, List, Any

logger = logging.getLogger(__name__)

# File path for persistent resolved drills across server restarts
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_RESOLVED_FILE = os.path.join(_BASE_DIR, "database", "resolved_focus_drills.json")

# In-memory stores
_ACTIVE_FOCUS_DRILLS: Dict[str, Any] = {}
_RESOLVED_KEYS: Set[str] = set()


def _load_resolved_from_disk():
    global _RESOLVED_KEYS
    try:
        if os.path.exists(_RESOLVED_FILE):
            with open(_RESOLVED_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    _RESOLVED_KEYS = set(data)
    except Exception as e:
        logger.warning(f"Could not load resolved focus drills from disk: {e}")


def _save_resolved_to_disk():
    try:
        os.makedirs(os.path.dirname(_RESOLVED_FILE), exist_ok=True)
        with open(_RESOLVED_FILE, "w", encoding="utf-8") as f:
            json.dump(list(_RESOLVED_KEYS), f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save resolved focus drills to disk: {e}")


# Initialize from disk
_load_resolved_from_disk()


def get_active_drill(student_id: str) -> Optional[dict]:
    sid = str(student_id)
    return _ACTIVE_FOCUS_DRILLS.get(sid) or _ACTIVE_FOCUS_DRILLS.get("all")


def set_active_drill(student_id: str, drill_record: dict, aliases: Optional[List[str]] = None):
    sid = str(student_id)
    _ACTIVE_FOCUS_DRILLS[sid] = drill_record
    if aliases:
        for alias in aliases:
            if alias:
                _ACTIVE_FOCUS_DRILLS[str(alias)] = drill_record


def clear_active_drill(student_id: str):
    sid = str(student_id)
    _ACTIVE_FOCUS_DRILLS.pop(sid, None)
    _ACTIVE_FOCUS_DRILLS.pop("all", None)


def mark_sign_resolved(
    student_id: str,
    stage_id: Optional[int] = None,
    sign_id: Optional[int] = None,
    sign_name: Optional[str] = None
):
    """
    Marks a specific sign as resolved for a student (and universally).
    """
    sid = str(student_id).strip()
    keys_to_add = []

    if sign_name:
        s_clean = sign_name.strip().lower()
        keys_to_add.append(f"sign_name:{s_clean}")
        keys_to_add.append(f"student:{sid}:sign_name:{s_clean}")
        keys_to_add.append(f"all:sign_name:{s_clean}")
        if stage_id is not None:
            keys_to_add.append(f"stage:{stage_id}:sign_name:{s_clean}")
            keys_to_add.append(f"student:{sid}:stage:{stage_id}:sign_name:{s_clean}")

    if sign_id is not None:
        keys_to_add.append(f"sign_id:{sign_id}")
        keys_to_add.append(f"student:{sid}:sign_id:{sign_id}")
        keys_to_add.append(f"all:sign_id:{sign_id}")
        if stage_id is not None:
            keys_to_add.append(f"stage:{stage_id}:sign_id:{sign_id}")
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
    Marks an entire focus drill / stage as completed and resolved.
    Also clears any pending active drill.
    """
    sid = str(student_id).strip()
    if stage_id is not None:
        _RESOLVED_KEYS.add(f"stage:{stage_id}")
        _RESOLVED_KEYS.add(f"student:{sid}:stage:{stage_id}")
        _RESOLVED_KEYS.add(f"all:stage:{stage_id}")

    if signs:
        for s in signs:
            if s:
                mark_sign_resolved(student_id=sid, stage_id=stage_id, sign_name=str(s))

    # Clear active drill
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
    Checks if a sign's Tier 4 struggle has been resolved either via:
    1. A passed practice attempt in the database (passed_practice_signs).
    2. Explicit registration in _RESOLVED_KEYS.
    3. Stage-level resolution.
    """
    sid = str(student_id).strip()

    # 1. Check against DB passed practice signs
    if passed_practice_signs:
        if sign_id is not None and (sign_id in passed_practice_signs or str(sign_id) in passed_practice_signs):
            return True
        if sign_name:
            s_clean = sign_name.strip().lower()
            if s_clean in passed_practice_signs or sign_name in passed_practice_signs:
                return True

    # 2. Check stage-level resolution
    if stage_id is not None:
        if (
            f"stage:{stage_id}" in _RESOLVED_KEYS or
            f"student:{sid}:stage:{stage_id}" in _RESOLVED_KEYS or
            f"all:stage:{stage_id}" in _RESOLVED_KEYS
        ):
            return True

    # 3. Check sign_name keys
    if sign_name:
        s_clean = sign_name.strip().lower()
        candidates = [
            f"sign_name:{s_clean}",
            f"student:{sid}:sign_name:{s_clean}",
            f"all:sign_name:{s_clean}",
        ]
        if stage_id is not None:
            candidates.extend([
                f"stage:{stage_id}:sign_name:{s_clean}",
                f"student:{sid}:stage:{stage_id}:sign_name:{s_clean}"
            ])
        if any(c in _RESOLVED_KEYS for c in candidates):
            return True

    # 4. Check sign_id keys
    if sign_id is not None:
        candidates = [
            f"sign_id:{sign_id}",
            f"student:{sid}:sign_id:{sign_id}",
            f"all:sign_id:{sign_id}",
        ]
        if stage_id is not None:
            candidates.extend([
                f"stage:{stage_id}:sign_id:{sign_id}",
                f"student:{sid}:stage:{stage_id}:sign_id:{sign_id}"
            ])
        if any(c in _RESOLVED_KEYS for c in candidates):
            return True

    return False


def get_resolved_keys_for_student(student_id: str) -> List[str]:
    sid = str(student_id).strip()
    return [k for k in _RESOLVED_KEYS if sid in k or k.startswith("all:") or not k.startswith("student:")]
