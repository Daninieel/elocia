export type PortalType = "admin" | "teacher" | "parent" | "all";

export function getActivePortal(): PortalType {
  // 1. Explicit environment variable setting (e.g. Vercel Project Env Var)
  const envPortal = (import.meta.env.VITE_PORTAL || "").trim().toLowerCase();
  if (["admin", "teacher", "parent", "all"].includes(envPortal)) {
    return envPortal as PortalType;
  }

  // 2. Subdomain / Hostname automatic detection (e.g. for custom subdomains)
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith("admin.") || host.includes("-admin.")) {
      return "admin";
    }
    if (host.startsWith("teacher.") || host.includes("-teacher.")) {
      return "teacher";
    }
    if (host.startsWith("parent.") || host.includes("-parent.")) {
      return "parent";
    }
  }

  // 3. Default to 'all' (local development with landing page selector)
  return "all";
}

export const activePortal = getActivePortal();
export const isTeacherPortal = () => activePortal === "teacher";
export const isParentPortal = () => activePortal === "parent";
export const isAdminPortal = () => activePortal === "admin";
export const isAllPortals = () => activePortal === "all";
