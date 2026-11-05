import { getIdFromToken, tokenManager } from "@/helpers/jwt";
import type { Class, Roster } from "@/interfaces/class.interface";

import { API_BASE_URL } from "@/config/api";

export type CreateClassPayload = {
  name: string;
  grade_level: number;
  school_year: string;
};

export async function fetchClassRoster(
  classId: string | undefined,
): Promise<Roster> {
  const token = tokenManager.getAccessToken();
  if (!token) {
    throw new Error("No access token found");
  }
  if (!classId) {
    throw new Error("No class ID provided");
  }

  const response = await fetch(`${API_BASE_URL}/classes/${classId}/students/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching students for class ${classId}: ${response.statusText}`,
    );
  }

  return response.json();
}

export async function fetchTeacherClasses(): Promise<Class[]> {
  const token = tokenManager.getAccessToken();
  const teacherId = token ? getIdFromToken(token) : null;
  const url = teacherId
    ? `${API_BASE_URL}/classes/?teacher_id=${teacherId}`
    : `${API_BASE_URL}/classes/`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? `Error fetching classes: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchClassById(classId: string): Promise<Class> {
  const token = tokenManager.getAccessToken();
  if (!token) {
    throw new Error("No access token found");
  }

  const response = await fetch(`${API_BASE_URL}/classes/${classId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching class with ID ${classId}: ${response.statusText}`,
    );
  }

  return response.json();
}

export async function createClass(payload: CreateClassPayload): Promise<Class> {
  const token = tokenManager.getAccessToken();
  if (!token) {
    throw new Error("No access token found");
  }

  const teacherId = getIdFromToken(token);
  if (!teacherId) {
    throw new Error("Could not identify the logged-in teacher");
  }

  const response = await fetch(`${API_BASE_URL}/classes/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      teacher_id: teacherId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail ?? `Error creating class: ${response.statusText}`,
    );
  }

  const created = await response.json();
  return {
    id: created.class_id,
    teacher_id: teacherId,
    ...payload,
    created_at: new Date().toISOString(),
  };
}

export async function enrollStudentInClass(
  classId: string | undefined,
  studentId: string,
): Promise<void> {
  const token = tokenManager.getAccessToken();
  if (!token) {
    throw new Error("No access token found");
  }
  if (!classId) {
    throw new Error("No class ID provided");
  }

  const response = await fetch(`${API_BASE_URL}/classes/${classId}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ student_id: studentId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail ?? `Error enrolling student: ${response.statusText}`,
    );
  }
}
