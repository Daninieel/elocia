import { tokenManager } from "@/helpers/jwt";
import { extractApiErrorMessage } from "@/helpers/error";

import { API_BASE_URL } from "@/config/api";

function getAuthHeaders(): HeadersInit {
  const token = tokenManager.getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface ParentItem {
  id: string;
  name: string;
  username?: string;
  relationship?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  role: "admin" | "teacher" | "parent" | "student";
  username?: string;
  is_active: boolean;
  color?: string;
  emoji?: string;
  grade_level?: number;
  student_number?: number;
  student_code?: string;
  parent_id?: string;
  parent_name?: string;
  parents?: ParentItem[];
  parent_summary?: string;
  children_summary?: string;
  class_name?: string;
  level?: number;
  streak?: number;
  avg_score?: number;
  total_xp?: number;
  created_at: string;
}

export interface AdminSummaryMetrics {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalClasses: number;
}

export interface CreateAdultPayload {
  name: string;
  username: string;
  password: string;
  role: "teacher" | "parent" | "admin";
}

export interface CreateStudentPayload {
  name: string;
  pin: string;
  grade_level: number;
  color?: string;
  emoji?: string;
  parent_id?: string;
}

export async function fetchAllUsers(
  role?: string,
  status: "all" | "active" | "inactive" = "all"
): Promise<AdminUser[]> {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (status) params.set("status", status);

  const url = `${API_BASE_URL}/users?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  return response.json();
}

export async function fetchAdminMetrics(): Promise<AdminSummaryMetrics> {
  try {
    const [students, teachers, parents, classroomsRes] = await Promise.all([
      fetchAllUsers("student", "active"),
      fetchAllUsers("teacher", "active"),
      fetchAllUsers("parent", "active"),
      fetch(`${API_BASE_URL}/classes/`, {
        headers: getAuthHeaders(),
      }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);

    return {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalParents: parents.length,
      totalClasses: Array.isArray(classroomsRes) ? classroomsRes.length : 0,
    };
  } catch (err) {
    console.error("Error fetching admin metrics:", err);
    return {
      totalStudents: 0,
      totalTeachers: 0,
      totalParents: 0,
      totalClasses: 0,
    };
  }
}

export async function createAdultAccount(payload: CreateAdultPayload): Promise<AdminUser> {
  const response = await fetch(`${API_BASE_URL}/users/adults`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, "Failed to create user account"));
  }

  return response.json();
}

export async function createStudentAccount(payload: CreateStudentPayload): Promise<AdminUser> {
  const response = await fetch(`${API_BASE_URL}/users/students`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, "Failed to create student account"));
  }

  return response.json();
}

export async function deactivateUserAccount(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to deactivate user");
  }
}

export async function deleteUserPermanently(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/permanent`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, "Failed to permanently delete user"));
  }
}

export async function reactivateUserAccount(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/reactivate`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to reactivate user");
  }
}

export interface UpdateUserPayload {
  name?: string;
  password?: string;
  pin?: string;
  color?: string;
  emoji?: string;
  grade_level?: number;
  student_code?: string;
  parent_id?: string;
  parent_ids?: string[];
  remove_parent?: boolean;
  is_active?: boolean;
}

export async function updateUserAccount(
  userId: string,
  payload: UpdateUserPayload
): Promise<AdminUser> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, "Failed to update user account"));
  }

  return response.json();
}
export interface AdminClassroom {
  id: string;
  name: string;
  grade_level: number;
  school_year: string;
  teacher_id: string;
  teacher_name?: string;
  student_count?: number;
  created_at?: string;
}

export interface CreateClassPayload {
  name: string;
  teacher_id: string;
  grade_level: number;
  school_year?: string;
}

export interface UpdateClassPayload {
  name?: string;
  teacher_id?: string;
  grade_level?: number;
  school_year?: string;
}

export interface EnrolledStudent {
  id: string;
  name: string;
  student_code?: string;
  student_number?: number;
  grade_level?: number;
  color?: string;
  emoji?: string;
  enrolled_at?: string;
}

export async function fetchClassroomsList(): Promise<AdminClassroom[]> {
  const response = await fetch(`${API_BASE_URL}/classes/`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch classrooms");
  }

  return response.json();
}

export async function createClassroom(payload: CreateClassPayload): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/classes/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, "Failed to create classroom"));
  }

  return response.json();
}

export async function updateClassroom(classId: string, payload: UpdateClassPayload): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/classes/${classId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, "Failed to update classroom"));
  }

  return response.json();
}

export async function deleteClassroom(classId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/classes/${classId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to delete classroom");
  }
}

export async function fetchClassRoster(classId: string): Promise<EnrolledStudent[]> {
  const response = await fetch(`${API_BASE_URL}/classes/${classId}/students`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch class roster");
  }

  const data = await response.json();
  return data?.students || [];
}
