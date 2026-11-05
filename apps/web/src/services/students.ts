import type { Student } from "@/interfaces/student.interface";
import { extractApiErrorMessage } from "@/helpers/error";

import { API_BASE_URL } from "@/config/api";

export type CreateStudentPayload = {
  name: string;
  pin: string;
  color?: string;
  emoji?: string;
  grade_level?: number;
  parent_id?: string;
};

export type UpdateStudentPayload = {
  name?: string;
  pin?: string;
  color?: string;
  emoji?: string;
  grade_level?: number;
  student_code?: string;
  is_active?: boolean;
};

export async function fetchStudents(
  status: "all" | "active" | "inactive" = "all"
): Promise<Student[]> {
  const response = await fetch(`${API_BASE_URL}/students?status=${status}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to fetch students");
  }

  const data = await response.json();
  return data;
}

export async function deactivateStudent(studentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${studentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(error, "Failed to deactivate student"));
  }
}

export async function reactivateStudent(studentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${studentId}/reactivate`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(error, "Failed to reactivate student"));
  }
}

export async function createStudent(
  payload: CreateStudentPayload,
): Promise<Student> {
  const response = await fetch(`${API_BASE_URL}/users/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(error, "Failed to create student"));
  }

  return response.json();
}

export async function fetchStudentById(id: string): Promise<Student> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? `Failed to fetch student with ID: ${id}`);
  }

  const data = await response.json();
  return data;
}

export async function updateStudent(
  id: string,
  payload: UpdateStudentPayload,
): Promise<Student> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? `Failed to update student with ID: ${id}`);
  }

  return response.json();
}

export interface ParentUser {
  id: string;
  name: string;
  username?: string;
}

export async function fetchParents(search?: string): Promise<ParentUser[]> {
  const url = search
    ? `${API_BASE_URL}/parents?search=${encodeURIComponent(search)}`
    : `${API_BASE_URL}/parents`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(error, "Failed to fetch parents"));
  }

  return response.json();
}
