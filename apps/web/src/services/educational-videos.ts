import type { EducationalVideo } from "@/interfaces/educational-video.interface";

import { API_BASE_URL } from "@/config/api";

export type CreateEducationalVideoPayload = {
  title: string;
  description: string;
  subject: string;
  grade_level: number;
  duration_minutes: number;
  video_url: string;
  thumbnail_url: string;
  created_by?: string;
};

export async function createEducationalVideo(
  payload: CreateEducationalVideoPayload,
): Promise<EducationalVideo> {
  const response = await fetch(`${API_BASE_URL}/educational-videos/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to upload educational video");
  }

  return response.json();
}

export async function fetchEducationalVideos(): Promise<EducationalVideo[]> {
  const response = await fetch(`${API_BASE_URL}/educational-videos/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to fetch educational videos");
  }

  const rawList = await response.json();
  return rawList.map((v: any) => ({
    id: String(v.id),
    title: v.title,
    description: v.description,
    subject: v.subject,
    gradeLevel: v.grade_level,
    durationMinutes: v.duration_minutes,
    videoUrl: v.video_url?.startsWith("http") ? v.video_url : `${API_BASE_URL}${v.video_url}`,
    thumbnailUrl: v.thumbnail_url
      ? (v.thumbnail_url.startsWith("http") ? v.thumbnail_url : `${API_BASE_URL}${v.thumbnail_url}`)
      : undefined,
    createdBy: v.created_by,
    createdAt: new Date(v.created_at || Date.now()),
  }));
}

export async function updateEducationalVideo(
  videoId: string,
  payload: Partial<CreateEducationalVideoPayload>
): Promise<EducationalVideo> {
  const response = await fetch(`${API_BASE_URL}/educational-videos/${videoId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to update educational video");
  }

  return response.json();
}

export async function deleteEducationalVideo(videoId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/educational-videos/${videoId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to delete educational video");
  }

  return response.json();
}

export async function uploadEducationalVideoFile(
  payload: {
    title: string;
    subject: string;
    grade_level: number;
    duration_minutes?: number;
    description?: string;
    thumbnail_url?: string;
    thumbnail?: File | null;
    video: File;
  },
  onProgress?: (percent: number) => void
): Promise<any> {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("subject", payload.subject);
  formData.append("grade_level", String(payload.grade_level));
  if (payload.duration_minutes !== undefined) {
    formData.append("duration_minutes", String(payload.duration_minutes));
  }
  if (payload.description) {
    formData.append("description", payload.description);
  }
  if (payload.thumbnail_url) {
    formData.append("thumbnail_url", payload.thumbnail_url);
  }
  if (payload.thumbnail) {
    formData.append("thumbnail", payload.thumbnail);
  }
  formData.append("video", payload.video);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/educational-videos/upload-file`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err?.detail ?? "Failed to upload educational video"));
        } catch {
          reject(new Error("Failed to upload educational video"));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during video upload"));
    xhr.send(formData);
  });
}

export async function uploadBaselineVideo(payload: {
  sign_name: string;
  grade_level: number;
  description?: string;
  video: File;
}): Promise<any> {
  const formData = new FormData();
  formData.append("sign_name", payload.sign_name);
  formData.append("grade_level", String(payload.grade_level));
  if (payload.description) {
    formData.append("description", payload.description);
  }
  formData.append("video", payload.video);

  const response = await fetch(`${API_BASE_URL}/baselines/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to upload video for evaluation");
  }

  return response.json();
}
