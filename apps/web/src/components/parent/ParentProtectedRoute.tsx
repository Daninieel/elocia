import { Navigate, Outlet } from "react-router-dom";
import { tokenManager, isTokenExpired, getRoleFromToken } from "@/helpers/jwt";
import { getActivePortal } from "@/config/portal";

interface ParentProtectedRouteProps {
  children?: React.ReactNode;
}

export default function ParentProtectedRoute({ children }: ParentProtectedRouteProps) {
  const token = tokenManager.getAccessToken();
  const portal = getActivePortal();

  if (!token || isTokenExpired(token)) {
    tokenManager.clearAccessToken();
    return <Navigate to={portal === "parent" ? "/" : "/parent/login"} replace />;
  }

  const role = getRoleFromToken(token);

  if (role !== "parent") {
    if (portal === "parent") {
      tokenManager.clearAccessToken();
      return <Navigate to="/" replace />;
    }
    if (role === "teacher") {
      return <Navigate to="/teacher/classes" replace />;
    }
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    tokenManager.clearAccessToken();
    return <Navigate to="/parent/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
