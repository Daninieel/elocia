import { API_BASE_URL } from "@/config/api";

import type {
  MiniGameConfig,
  SeeItSignItItem,
  PuzzleSignItem,
  MagicFingersItem
} from "@/interfaces/mini-game.interface";

export type CreateMiniGamePayload = {
  game_type: "see_it_sign_it" | "puzzle_sign" | "magic_fingers" | string;
  title: string;
  description?: string;
  difficulty?: number;
  // Optional legacy fields
  target_sign?: string;
  prompt_image?: string;
  reference_video_url?: string;
  hint_text?: string;
  options?: string;
  // Relational round items
  see_it_sign_it_items?: SeeItSignItItem[];
  puzzle_sign_items?: PuzzleSignItem[];
  magic_fingers_items?: MagicFingersItem[];
};

export type MediaUploadResponse = {
  status: string;
  type: "image" | "video";
  url: string;
};

/**
 * Upload an image or video asset for a mini-game.
 */
export async function uploadMiniGameMedia(
  file: File,
  onProgress?: (percent: number) => void
): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/minigames/upload/media`);

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
          reject(new Error("Invalid server response format"));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error?.detail ?? "Failed to upload media file"));
        } catch {
          reject(new Error("Failed to upload media file"));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during media upload"));
    xhr.send(formData);
  });
}

/**
 * Create a new mini-game activity with its child items.
 */
export async function createMiniGame(
  payload: CreateMiniGamePayload,
): Promise<MiniGameConfig> {
  const response = await fetch(`${API_BASE_URL}/minigames/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to create mini-game");
  }

  return response.json() as Promise<MiniGameConfig>;
}

/**
 * Fetch all mini-game configs (with optional game_type filter).
 */
export async function fetchMiniGames(gameType?: string): Promise<MiniGameConfig[]> {
  const url = gameType
    ? `${API_BASE_URL}/minigames/config?game_type=${encodeURIComponent(gameType)}`
    : `${API_BASE_URL}/minigames/config`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to fetch mini-games");
  }

  return response.json() as Promise<MiniGameConfig[]>;
}

/**
 * Fetch a single mini-game configuration with all nested items.
 */
export async function fetchMiniGameDetails(configId: string): Promise<MiniGameConfig> {
  const response = await fetch(`${API_BASE_URL}/minigames/config/${configId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to fetch mini-game details");
  }

  return response.json() as Promise<MiniGameConfig>;
}

/**
 * Create a See It Sign It activity using dedicated endpoint.
 */
export async function createSeeItSignItActivity(payload: {
  title: string;
  description?: string;
  difficulty?: number;
  items: SeeItSignItItem[];
}): Promise<MiniGameConfig> {
  const response = await fetch(`${API_BASE_URL}/minigames/see-it-sign-it`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to create See It Sign It activity");
  }
  return response.json();
}

/**
 * Create a Puzzle Sign activity using dedicated endpoint.
 */
export async function createPuzzleSignActivity(payload: {
  title: string;
  description?: string;
  difficulty?: number;
  items: PuzzleSignItem[];
}): Promise<MiniGameConfig> {
  const response = await fetch(`${API_BASE_URL}/minigames/puzzle-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to create Puzzle Sign activity");
  }
  return response.json();
}

/**
 * Create a Magic Fingers activity using dedicated endpoint.
 */
export async function createMagicFingersActivity(payload: {
  title: string;
  description?: string;
  difficulty?: number;
  items: MagicFingersItem[];
}): Promise<MiniGameConfig> {
  const response = await fetch(`${API_BASE_URL}/minigames/magic-fingers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to create Magic Fingers activity");
  }
  return response.json();
}
export type UpdateMiniGamePayload = {
  title?: string;
  description?: string;
  difficulty?: number;
  is_active?: boolean;
  see_it_sign_it_items?: SeeItSignItItem[];
  puzzle_sign_items?: PuzzleSignItem[];
  magic_fingers_items?: MagicFingersItem[];
};

const SUPABASE_CDN = "https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media";

/**
 * Resolve media URL with smart dual-mode:
 * - On Localhost: loads from local backend (fast offline demo, zero latency)
 * - On Live Web (Vercel): routes directly to Supabase CDN (avoids mixed-content errors and ephemeral storage issues)
 * - Also sanitizes legacy database entries containing 'http://localhost:8000'
 */
export function resolveMediaUrl(url?: string): string {
  if (!url) return "";
  let clean = url.trim();

  // 1. Strip accidental localhost:8000 / 127.0.0.1:8000 saved in database
  if (clean.includes("localhost:8000") || clean.includes("127.0.0.1:8000")) {
    clean = clean.replace(/^https?:\/\/(localhost|127\.0\.0\.1):8000/, "");
  }

  // 2. Direct external HTTPS, blob, or base64 data URLs
  if (clean.startsWith("blob:") || clean.startsWith("data:")) return clean;
  if (clean.startsWith("https://") && !clean.includes("localhost")) return clean;

  // 3. Normalize leading slash
  if (!clean.startsWith("/")) clean = "/" + clean;

  // 4. ENVIRONMENT DETECTION:
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]");

  if (isLocalhost) {
    // 🌟 LOCALHOST SHOWCASE MODE: Load directly from local backend
    return `${API_BASE_URL}${clean}`;
  } else {
    // 🌐 LIVE WEB SHOWCASE MODE (Vercel / Cloud):
    // Map static assets directly to Supabase CDN
    if (clean.startsWith("/videos/") || clean.startsWith("/minigames/videos/")) {
      const filename = clean.split("?")[0].split("/").pop();
      return `${SUPABASE_CDN}/videos/${filename}`;
    }
    if (clean.startsWith("/thumbnails/") || clean.startsWith("/minigames/images/")) {
      const filename = clean.split("?")[0].split("/").pop();
      return `${SUPABASE_CDN}/thumbnails/${filename}`;
    }
    return `${SUPABASE_CDN}${clean}`;
  }
}

/**
 * Update an existing mini-game configuration and its nested items.
 */
export async function updateMiniGame(
  configId: string,
  payload: UpdateMiniGamePayload,
): Promise<MiniGameConfig> {
  const response = await fetch(`${API_BASE_URL}/minigames/config/${configId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to update mini-game");
  }

  return response.json() as Promise<MiniGameConfig>;
}

/**
 * Delete / deactivate a mini-game configuration.
 */
export async function deleteMiniGame(
  configId: string,
  hardDelete: boolean = false,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/minigames/config/${configId}?hard_delete=${hardDelete}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Failed to delete mini-game");
  }
}
