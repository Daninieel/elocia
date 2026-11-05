import { Navigate, Outlet } from "react-router-dom";
import { tokenManager, isTokenExpired, getRoleFromToken } from "@/helpers/jwt";
import { getActivePortal } from "@/config/portal";

interface AdminProtectedRouteProps {
  children?: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const token = tokenManager.getAccessToken();
  const portal = getActivePortal();

  if (!token || isTokenExpired(token)) {
    tokenManager.clearAccessToken();
    return <Navigate to={portal === "admin" ? "/" : "/admin/login"} replace />;
  }

  const role = getRoleFromToken(token);

  if (role !== "admin") {
    if (portal === "admin") {
      tokenManager.clearAccessToken();
      return <Navigate to="/" replace />;
    }
    if (role === "teacher") {
      return <Navigate to="/teacher/classes" replace />;
    }
    if (role === "parent") {
      return <Navigate to="/parent/home" replace />;
    }
    tokenManager.clearAccessToken();
    return <Navigate to="/admin/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
