import type { LoginRequest, LoginResponse } from "@/interfaces/login.interface";
import { tokenManager } from "@/helpers/jwt";

import { API_BASE_URL } from "@/config/api";

export async function adultLogin({
  username,
  password,
}: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Login failed");
  }

  const data = await response.json();
  tokenManager.setAccessToken(data.access_token);

  return data;
}

export function adultLogout(): void {
  tokenManager.clearAccessToken();
}
