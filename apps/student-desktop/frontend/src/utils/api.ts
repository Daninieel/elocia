const CLOUD_FALLBACK_URL = 'https://elocia.onrender.com';
const SUPABASE_CDN_FALLBACK = 'https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media';

export function getApiBase(): string {
  if (typeof window !== 'undefined' && (window as any).__ELOCIA_API_URL__) {
    return (window as any).__ELOCIA_API_URL__;
  }
  const custom = typeof window !== 'undefined' ? localStorage.getItem('elocia_api_host') : null;
  // If localStorage still holds stale local 127.0.0.1:8000, ignore it and use live cloud default
  if (custom && custom.trim() && !custom.includes('127.0.0.1:8000') && !custom.includes('localhost:8000')) {
    return custom.trim().replace(/\/+$/, '');
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('127.0.0.1:8000') && !envUrl.includes('localhost:8000')) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return CLOUD_FALLBACK_URL;
}

export function setApiBase(url: string) {
  if (typeof window !== 'undefined') {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    localStorage.setItem('elocia_api_host', clean);
    (window as any).__ELOCIA_API_URL__ = clean;
    fetch('http://127.0.0.1:8001/app-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_url: clean }),
    }).catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  fetch('http://127.0.0.1:8001/app-config')
    .then((res) => res.json())
    .then((data) => {
      if (data && data.api_url) {
        const clean = data.api_url.trim().replace(/\/+$/, '');
        // Prioritize active non-local server_config.json over stale cache
        if (clean && !clean.includes('127.0.0.1:8000') && !clean.includes('localhost:8000')) {
          localStorage.setItem('elocia_api_host', clean);
          (window as any).__ELOCIA_API_URL__ = clean;
        } else {
          localStorage.setItem('elocia_api_host', CLOUD_FALLBACK_URL);
          (window as any).__ELOCIA_API_URL__ = CLOUD_FALLBACK_URL;
        }
        window.dispatchEvent(new Event('elocia-api-url-ready'));
      }
    })
    .catch(() => {
      (window as any).__ELOCIA_API_URL__ = CLOUD_FALLBACK_URL;
    });
}

export const API_BASE = {
  toString: () => getApiBase(),
  valueOf: () => getApiBase(),
} as any as string;

/**
 * Normalizes image and video URLs returned by the backend.
 * Handles relative paths (/minigames/...), localhost:8000 origins, and direct paths.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Replace localhost or 127.0.0.1 origins with current API_BASE
  if (trimmed.startsWith('http://localhost:8000') || trimmed.startsWith('http://127.0.0.1:8000')) {
    return trimmed.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, API_BASE);
  }

  // Already a full external URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Direct Supabase CDN resolution for static folders
  if (trimmed.startsWith('/thumbnails/')) {
    return `${SUPABASE_CDN_FALLBACK}${trimmed}`;
  }
  if (trimmed.startsWith('/videos/')) {
    return `${SUPABASE_CDN_FALLBACK}${trimmed}`;
  }
  if (trimmed.startsWith('/minigames/images/')) {
    return `${SUPABASE_CDN_FALLBACK}${trimmed}`;
  }
  if (trimmed.startsWith('/minigames/videos/')) {
    return `${SUPABASE_CDN_FALLBACK}${trimmed}`;
  }

  // Relative path starting with slash (e.g. /minigames/images/...)
  if (trimmed.startsWith('/')) {
    return `${API_BASE}${trimmed}`;
  }

  // Relative path without leading slash
  return `${API_BASE}/${trimmed}`;
}

export interface SeeItSignItItemDetail {
  id: string;
  config_id: string;
  objective_image_url: string | null;
  objective_answer: string;
  reference_video_url: string | null;
  index_order: number;
}

export interface PuzzleSignItemDetail {
  id: string;
  config_id: string;
  word_one: string;
  word_two: string;
  hidden_word: string;
  word_form: string;
  missing_position?: 1 | 2;
  word_one_image_url: string | null;
  word_two_image_url: string | null;
  word_form_image_url: string | null;
  reference_video_url: string | null;
  index_order: number;
}

export interface MagicFingersItemDetail {
  id: string;
  config_id: string;
  word: string;
  hidden_positions: number[];
  objective_image_url: string | null;
  reference_video_url: string | null;
  reference_video_url_2?: string | null;
  index_order: number;
}

export interface MiniGameActivityDetail {
  id: string;
  game_type: string;
  title: string;
  description: string | null;
  difficulty: number;
  is_active: boolean;
  see_it_sign_it_items: SeeItSignItItemDetail[];
  puzzle_sign_items: PuzzleSignItemDetail[];
  magic_fingers_items: MagicFingersItemDetail[];
}

export interface MiniGameConfigItem {
  id: string;
  game_type: string;
  title: string;
  target_sign?: string;
  prompt_image?: string | null;
  hint_text?: string | null;
  options?: string | null;
  difficulty: number;
}

export interface StudentProfileData {
  id: string;
  name: string;
  color: string;
  emoji: string;
  grade_level?: number;
  student_number?: number;
  student_code?: string;
  total_xp?: number;
  level?: number;
  streak?: number;
  avg_score?: number;
  signs_mastered?: number;
  stages_complete?: number;
}

export async function fetchStudents(): Promise<StudentProfileData[]> {
  try {
    const res = await fetch(`${API_BASE}/students`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch students from backend:', err);
    return [];
  }
}

export async function fetchUserById(userId: string): Promise<StudentProfileData | null> {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch user by id from backend:', err);
    return null;
  }
}

export async function updateUser(userId: string, data: Partial<StudentProfileData & { pin?: string; is_active?: boolean }>) {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to update user on backend:', err);
    return null;
  }
}

export async function studentLogin(studentName: string, pin: string): Promise<{ access_token: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: studentName, pin }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Student login failed:', err);
    return null;
  }
}

export async function fetchMiniGameConfigs(gameType: string): Promise<MiniGameConfigItem[]> {
  try {
    const res = await fetch(`${API_BASE}/minigames/config?game_type=${gameType}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch mini-game configs (offline?):', err);
    return [];
  }
}

export async function fetchMiniGameActivities(gameType: string): Promise<MiniGameActivityDetail[]> {
  try {
    const res = await fetch(`${API_BASE}/minigames/activities/${gameType}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch mini-game activities with items (offline?):', err);
    return [];
  }
}

export async function saveMiniGameScore(payload: {
  student_id: string;
  game_type: string;
  score: number;
  streak: number;
  rounds_completed: number;
}) {
  try {
    await fetch(`${API_BASE}/minigames/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Mini-game score save failed (offline?):', err);
  }
}

export async function saveScore(payload: {
  student_id: string;
  activity_type: string;
  stage_id: number;
  sign_id: number;
  attempt_number: number;
  tier_level: number;
  score_handshape: number;
  score_palm_orientation: number;
  score_location: number;
  score_movement: number;
  score_overall: number;
  passed: boolean;
  streak?: number;
  xp_earned?: number;
}) {
  try {
    const params = new URLSearchParams({
      student_id: payload.student_id,
      activity_type: payload.activity_type,
      stage_id: String(payload.stage_id),
      sign_id: String(payload.sign_id),
      attempt_number: String(payload.attempt_number),
      tier_level: String(payload.tier_level),
      score_handshape: String(payload.score_handshape),
      score_palm_orientation: String(payload.score_palm_orientation),
      score_location: String(payload.score_location),
      score_movement: String(payload.score_movement),
      score_overall: String(payload.score_overall),
      passed: String(payload.passed),
      streak: String(payload.streak ?? 0),
      xp_earned: String(payload.xp_earned ?? 0),
    });
    await fetch(`${API_BASE}/scores/save?${params}`, { method: 'POST' });
  } catch (err) {
    console.warn('Score save failed (offline?):', err);
  }
}

export interface StudentProgress {
  student_id: string;
  student_name: string;
  unlocked_stages: number[];
  stages: {
    stage_id: number;
    unlocked: boolean;
    passed: boolean;
    best_score: number;
    stars: number;
    completed_signs: number;
  }[];
  total_signs_mastered: number;
  current_streak: number;
  avg_score: number;
}

import type { Section } from '../data/curriculum';

export async function fetchCurriculum(gradeLevel?: number): Promise<Section[] | null> {
  try {
    const url = gradeLevel ? `${API_BASE}/curriculum?grade_level=${gradeLevel}` : `${API_BASE}/curriculum`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.sections || null;
  } catch (err) {
    console.warn('Failed to fetch curriculum from backend (using offline cache):', err);
    return null;
  }
}

export async function fetchStudentProgress(studentId: string): Promise<StudentProgress | null> {
  try {
    const res = await fetch(`${API_BASE}/users/${studentId}/progress`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch student progress (using offline cache):', err);
    return null;
  }
}

export interface PracticeItem {
  sign: string;
  stage_id: number;
  section_label: string;
  score: number;
  color: 'red' | 'orange' | 'green' | 'blue';
  reason?: string;
}

export async function fetchNeedsPractice(studentId?: string): Promise<PracticeItem[]> {
  const sid = studentId && String(studentId).trim() ? String(studentId).trim() : 'all';
  const colors: ('red' | 'orange' | 'green' | 'blue')[] = ['red', 'orange', 'green', 'blue'];

  const parseDrillResponse = (drill: any): PracticeItem[] => {
    if (!drill || !drill.active || !Array.isArray(drill.signs) || drill.signs.length === 0) return [];
    let stageId = drill.stage_number || drill.stage_id || 1;
    if (stageId === 43) stageId = 2;

    let sectionLabel = drill.section_label;
    const signsLower = drill.signs.map((s: any) => String(s).toLowerCase());
    const isColorSign = signsLower.some((s: string) => ['green', 'grey', 'red', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white'].includes(s));

    if (!sectionLabel || sectionLabel.includes('Stage 43') || (isColorSign && sectionLabel.startsWith('Section 1'))) {
      if (isColorSign) {
        sectionLabel = `Section 3, Stage ${stageId}`;
      } else {
        sectionLabel = `Stage ${stageId}`;
      }
    } else {
      sectionLabel = sectionLabel.replace('Stage 43', 'Stage 2');
    }

    return drill.signs.map((sign: string, idx: number) => ({
      sign: String(sign),
      stage_id: stageId,
      section_label: sectionLabel,
      score: 50.0,
      color: colors[idx % colors.length],
      reason: drill.notes || 'Teacher Assigned Focus Drill',
    }));
  };

  const tryFetchUrl = async (baseUrl: string): Promise<PracticeItem[] | null> => {
    try {
      // 1. Check drills endpoint for student ID
      if (sid !== 'all') {
        const drillRes = await fetch(`${baseUrl}/analytics/drills/student/${sid}`);
        if (drillRes.ok) {
          const data = await drillRes.json();
          const items = parseDrillResponse(data.drill);
          if (items.length > 0) return items;
        }
      }

      // 2. Check drills endpoint for broadcast ('all')
      const drillAllRes = await fetch(`${baseUrl}/analytics/drills/student/all`);
      if (drillAllRes.ok) {
        const data = await drillAllRes.json();
        const items = parseDrillResponse(data.drill);
        if (items.length > 0) return items;
      }

      // 3. Try needs-practice endpoint if sid is a valid UUID (avoids 422 error on Render)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid);
      if (isUuid) {
        const npRes = await fetch(`${baseUrl}/analytics/students/${sid}/needs-practice`);
        if (npRes.ok) {
          const data = await npRes.json();
          if (Array.isArray(data.practice_items) && data.practice_items.length > 0) {
            return (data.practice_items as PracticeItem[]).map((it) => {
              const cleanStage = it.stage_id === 43 ? 2 : it.stage_id;
              let label = it.section_label;
              const sLower = String(it.sign).toLowerCase();
              const isColor = ['green', 'grey', 'red', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white'].includes(sLower);
              if (!label || label.includes('Stage 43') || (isColor && label.startsWith('Section 1'))) {
                if (isColor) {
                  label = `Section 3, Stage ${cleanStage}`;
                } else {
                  label = `Stage ${cleanStage}`;
                }
              }
              return {
                ...it,
                stage_id: cleanStage,
                section_label: label,
              };
            });
          }
        }
      }
    } catch {}
    return null;
  };

  const primaryBase = String(API_BASE);
  const candidateBases = [primaryBase];
  if (!primaryBase.includes('localhost:8000') && !primaryBase.includes('127.0.0.1:8000')) {
    candidateBases.push('http://localhost:8000');
    candidateBases.push('http://127.0.0.1:8000');
  }

  for (const base of candidateBases) {
    const items = await tryFetchUrl(base);
    if (items && items.length > 0) {
      return items;
    }
  }

  return [];
}

export interface EducationalVideoItem {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade_level: number;
  duration_minutes: number;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export async function fetchEducationalVideos(gradeLevel?: number): Promise<EducationalVideoItem[]> {
  try {
    const url = gradeLevel ? `${API_BASE}/educational-videos/?grade_level=${gradeLevel}` : `${API_BASE}/educational-videos/`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch educational videos from backend:', err);
    return [];
  }
}

export interface FocusDrillItem {
  id: string;
  student_id: string;
  stage_id: number;
  signs: string[];
  notes?: string;
  active: boolean;
}

export async function fetchActiveFocusDrill(studentId: string): Promise<FocusDrillItem | null> {
  try {
    const res = await fetch(`${API_BASE}/analytics/drills/student/${studentId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.drill || null;
  } catch (err) {
    console.warn('Failed to fetch active focus drill:', err);
    return null;
  }
}

export async function completeFocusDrill(studentId: string, stageId?: number, signs?: string[]): Promise<void> {
  const bases = [String(API_BASE), 'http://localhost:8000', 'http://127.0.0.1:8000', 'https://elocia.onrender.com'];
  const payload = JSON.stringify({ stage_id: stageId, signs: signs || [] });
  for (const base of bases) {
    try {
      await fetch(`${base}/analytics/drills/student/${studentId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch {}
    try {
      await fetch(`${base}/analytics/drills/student/all/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch {}
  }
}

export async function removeFocusDrillSign(studentId: string, sign: string, stageId?: number): Promise<void> {
  const bases = [String(API_BASE), 'http://localhost:8000', 'http://127.0.0.1:8000', 'https://elocia.onrender.com'];
  const payload = JSON.stringify({ sign, stage_id: stageId });
  for (const base of bases) {
    try {
      await fetch(`${base}/analytics/drills/student/${studentId}/remove-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch {}
    try {
      await fetch(`${base}/analytics/drills/student/all/remove-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch {}
  }
}
