import type {
  Curriculum,
  Section,
  Stage,
  Unit,
} from "@/interfaces/curriculum.interface";

import { API_BASE_URL } from "@/config/api";

export async function fetchCurriculums(): Promise<Curriculum[]> {
  const response: Response = await fetch(`${API_BASE_URL}/curriculums`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to fetch curriculums");
  }

  const data: Curriculum[] = await response.json();

  return data;
}

export async function fetchCurriculumById(
  curriculumId: string,
): Promise<Curriculum> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculums/${curriculumId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to fetch curriculum");
  }

  const data: Curriculum = await response.json();

  return data;
}

export async function createCurriculum(
  curriculum: Omit<Curriculum, "id" | "created_at" | "updated_at">,
): Promise<Curriculum> {
  const response: Response = await fetch(`${API_BASE_URL}/curriculums`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(curriculum),
  });

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to create curriculum");
  }

  const data: Curriculum = await response.json();

  return data;
}

export async function updateCurriculum(
  curriculumId: string,
  updatedCurriculum: Partial<Curriculum>,
): Promise<Curriculum> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculums/${curriculumId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(updatedCurriculum),
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to update curriculum");
  }

  const data: Curriculum = await response.json();

  return data;
}

export async function fetchSectionsByCurriculumId(
  curriculumId: string,
): Promise<Section[]> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculums/${curriculumId}/sections`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to fetch sections");
  }

  const data: Section[] = await response.json();

  return data;
}

export async function createSection(
  curriculumId: string,
  section: Omit<Section, "id" | "curriculum_id" | "created_at" | "updated_at">,
): Promise<Section> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculums/${curriculumId}/sections`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(section),
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to create section");
  }

  const data: Section = await response.json();

  return data;
}

export async function fetchUnitsBySectionId(
  sectionId: string,
): Promise<Unit[]> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculum-sections/${sectionId}/units`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to fetch units");
  }

  const data: Unit[] = await response.json();

  return data;
}

export async function createUnit(
  sectionId: string,
  unit: Omit<Unit, "id" | "section_id" | "created_at" | "updated_at">,
): Promise<Unit> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculum-sections/${sectionId}/units`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(unit),
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to create unit");
  }

  const data: Unit = await response.json();

  return data;
}

export async function updateSection(
  sectionId: string,
  payload: { title?: string; section_number?: number }
): Promise<Section> {
  const response = await fetch(`${API_BASE_URL}/curriculum-sections/${sectionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to update section");
  }

  return response.json();
}

export async function deleteSection(sectionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/curriculum-sections/${sectionId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to delete section");
  }
}

export async function updateUnit(
  unitId: string,
  payload: { title?: string; unit_number?: number }
): Promise<Unit> {
  const response = await fetch(`${API_BASE_URL}/curriculum-units/${unitId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to update unit");
  }

  return response.json();
}

export async function deleteUnit(unitId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/curriculum-units/${unitId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to delete unit");
  }
}

export async function fetchStagesByUnitId(unitId: string): Promise<Stage[]> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculum-units/${unitId}/stages`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to fetch stages");
  }

  const data: Stage[] = await response.json();

  return data;
}

export async function fetchStageById(stageId: string | number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/curriculum-stages/${stageId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to fetch stage details");
  }

  return response.json();
}

export async function createStage(
  unitId: string,
  stage: {
    stage_number: number;
    title: string;
    description?: string;
  },
): Promise<Stage> {
  const response: Response = await fetch(
    `${API_BASE_URL}/curriculum-units/${unitId}/stages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(stage),
    },
  );

  if (!response.ok) {
    const error: { detail?: string } | null = await response
      .json()
      .catch(() => null);

    throw new Error(error?.detail ?? "Failed to create stage");
  }

  const data: Stage = await response.json();

  return data;
}

export async function uploadStageBaseline(
  stageId: number,
  signName: string,
  video: File,
  gradeLevel: number,
  description?: string,
  photoOrProgress?: File | null | ((percent: number) => void),
  onProgress?: (percent: number) => void
): Promise<void> {
  let photo: File | null = null;
  let progressCb: ((percent: number) => void) | undefined = onProgress;

  if (typeof photoOrProgress === "function") {
    progressCb = photoOrProgress;
  } else if (photoOrProgress) {
    photo = photoOrProgress;
  }

  const formData = new FormData();
  formData.append("video", video);
  formData.append("sign_name", signName);
  formData.append("stage_id_new", String(stageId));
  formData.append("grade_level", String(gradeLevel));
  if (description) {
    formData.append("description", description);
  }
  if (photo) {
    formData.append("photo", photo);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/baselines/upload`);

    if (xhr.upload && progressCb) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          progressCb(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error?.detail ?? "Failed to upload stage video"));
        } catch {
          reject(new Error("Failed to upload stage video"));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during stage video upload"));
    xhr.send(formData);
  });
}

export async function updateStage(
  stageId: number | string,
  payload: { title?: string; description?: string; stage_number?: number }
): Promise<Stage> {
  const response = await fetch(`${API_BASE_URL}/curriculum-stages/${stageId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to update stage");
  }

  return response.json();
}

export async function deleteStage(stageId: number | string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/curriculum-stages/${stageId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to delete stage");
  }
}

export async function updateSign(
  signId: number | string,
  payload: { sign_name?: string; is_active?: boolean }
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/curriculum-signs/${signId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to update sign");
  }

  return response.json();
}

export async function deleteSign(signId: number | string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/curriculum-signs/${signId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to delete sign");
  }
}

export async function uploadSignPhoto(
  signId: number | string,
  photoFile: File
): Promise<{ status: string; sign_id: number; photo_url: string }> {
  const formData = new FormData();
  formData.append("photo", photoFile);

  const response = await fetch(`${API_BASE_URL}/curriculum-signs/${signId}/photo`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to upload sign visual aid picture");
  }

  return response.json();
}
