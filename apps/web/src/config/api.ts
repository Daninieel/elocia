const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Ensure trailing slash is removed so URL paths can be appended reliably
export const API_BASE_URL = rawUrl.replace(/\/+$/, "");
