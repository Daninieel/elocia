import { Navigate, Outlet } from "react-router-dom";
import { tokenManager, isTokenExpired, getRoleFromToken } from "@/helpers/jwt";
import { getActivePortal } from "@/config/portal";

interface TeacherProtectedRouteProps {
  children?: React.ReactNode;
}

export default function TeacherProtectedRoute({ children }: TeacherProtectedRouteProps) {
  const token = tokenManager.getAccessToken();
  const portal = getActivePortal();

  if (!token || isTokenExpired(token)) {
    tokenManager.clearAccessToken();
    return <Navigate to={portal === "teacher" ? "/" : "/teacher/login"} replace />;
  }

  const role = getRoleFromToken(token);

  if (role !== "teacher") {
    if (portal === "teacher") {
      tokenManager.clearAccessToken();
      return <Navigate to="/" replace />;
    }
    if (role === "parent") {
      return <Navigate to="/parent/home" replace />;
    }
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    tokenManager.clearAccessToken();
    return <Navigate to="/teacher/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
