import type {
  ParentStudent,
  ParentProgressSummary,
  EvaluationAttemptItem,
} from "@/interfaces/parent.interface";
import { extractApiErrorMessage } from "@/helpers/error";

import { API_BASE_URL } from "@/config/api";

/**
 * Fetch all students linked to the authenticated parent.
 */
export async function fetchParentStudents(parentId: string): Promise<ParentStudent[]> {
  const response = await fetch(`${API_BASE_URL}/parents/${parentId}/students`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(error, "Failed to fetch linked children"));
  }

  return response.json();
}

/**
 * Fetch performance summary, strengths, and recommendations for a student.
 */
export async function fetchParentProgressSummary(
  studentId: string
): Promise<ParentProgressSummary> {
  const response = await fetch(`${API_BASE_URL}/analytics/parent/${studentId}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(error, "Failed to fetch student progress summary"));
  }

  return response.json();
}

/**
 * Fetch evaluation attempts and raw parameter scores for a student.
 */
export async function fetchStudentScores(
  studentId: string
): Promise<EvaluationAttemptItem[]> {
  const endpoints = [API_BASE_URL, "https://elocia.onrender.com"];
  for (const base of endpoints) {
    try {
      const response = await fetch(`${base}/scores/${studentId}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {}
  }

  throw new Error("Failed to fetch student evaluation scores from available endpoints");
}

const curriculumCache = new Map<string, any>();

/**
 * Fetch full curriculum structure to calculate overall student progress.
 * In-memory module cache guarantees instant 0ms responses on repeated calls.
 */
export async function fetchCurriculumStages(gradeLevel?: number): Promise<any> {
  const cacheKey = String(gradeLevel ?? "default");
  if (curriculumCache.has(cacheKey)) {
    return curriculumCache.get(cacheKey);
  }

  const url = gradeLevel
    ? `${API_BASE_URL}/curriculum?grade_level=${gradeLevel}`
    : `${API_BASE_URL}/curriculum`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  curriculumCache.set(cacheKey, data);
  return data;
}

/**
 * Fetch specific signs the student needs to focus on (active Tier 4 or low scores).
 */
export async function fetchStudentNeedsPractice(studentId: string): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/analytics/students/${studentId}/needs-practice`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.practice_items || [];
}

/**
 * Fetch official student stage progress (passed/unlocked per stage) from /users/{studentId}/progress.
 * Single source of truth across Student Desktop, Teacher, and Parent portals.
 */
export async function fetchStudentStageProgress(studentId: string): Promise<any | null> {
  const response = await fetch(`${API_BASE_URL}/users/${studentId}/progress`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}
