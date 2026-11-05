import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getActivePortal } from "./config/portal.ts";
import { tokenManager, isTokenExpired, getRoleFromToken } from "./helpers/jwt.ts";

import LandingPage from "./pages/LandingPage.tsx";

// Teacher Pages
import TeacherLayout from "./layouts/TeacherLayout.tsx";
import TeacherAddLessonLayout from "./layouts/TeacherAddLessonLayout.tsx";
import TeacherLoginPage from "./pages/teacher/LoginPage.tsx";
import TeacherClassesPage from "./pages/teacher/ClassesPage.tsx";
import TeacherClassPage from "./pages/teacher/ClassPage.tsx";
import TeacherStudentsPage from "./pages/teacher/StudentsPage.tsx";
import TeacherStudentProfilePage from "./pages/teacher/StudentProfilePage.tsx";
import TeacherLessonsPage from "./pages/teacher/LessonsPage.tsx";
import TeacherSectionListPage from "./pages/teacher/SectionListPage.tsx";
import TeacherUnitListPage from "./pages/teacher/UnitListPage.tsx";
import TeacherStageListPage from "./pages/teacher/StageListPage.tsx";
import {
  TeacherStageCreatePage,
  TeacherStagePreviewPage,
} from "./pages/teacher/StageCreationPage.tsx";
import TeacherStageItemPage from "./pages/teacher/StageItemPage.tsx";
import {
  TeacherAddLessonStepOnePage,
  TeacherAddLessonStepTwoPage,
  TeacherAddLessonStepThreePage,
} from "./pages/teacher/AddLessonPage.tsx";
import TeacherTasksPage from "./pages/teacher/TasksPage.tsx";
import TeacherAddGameActivityLayout from "./layouts/TeacherAddGameActivityLayout.tsx";
import {
  TeacherAddGameActivityStepOnePage,
  TeacherAddGameActivityStepTwoPage,
  TeacherAddGameActivityStepThreePage,
} from "./pages/teacher/AddGameActivityPage.tsx";
import TeacherUploadVideoLayout from "./layouts/TeacherUploadVideoLayout.tsx";
import {
  TeacherUploadVideoStepOnePage,
  TeacherUploadVideoStepTwoPage,
  TeacherUploadVideoStepThreePage,
} from "./pages/teacher/UploadVideoPage.tsx";
import TeacherSettingsPage from "./pages/teacher/SettingsPage.tsx";
import TeacherHelpPage from "./pages/teacher/HelpPage.tsx";
import TeacherViewMiniGamePage from "./pages/teacher/ViewMiniGamePage.tsx";

// Parent Pages
import ParentLoginPage from "./pages/parent/LoginPage.tsx";
import ParentLayout from "./layouts/ParentLayout.tsx";
import ParentHomePage from "@/pages/parent/HomePage.tsx";
import ParentStudentProfilePage from "./pages/parent/StudentProfilePage.tsx";
import ParentProgressPage from "./pages/parent/ProgressPage.tsx";
import ParentSettingsPage from "./pages/parent/SettingsPage.tsx";
import ParentHelpPage from "./pages/parent/HelpPage.tsx";

import TeacherProtectedRoute from "./components/teacher/TeacherProtectedRoute.tsx";
import ParentProtectedRoute from "./components/parent/ParentProtectedRoute.tsx";

// Admin Pages
import AdminLoginPage from "./pages/admin/LoginPage.tsx";
import AdminLayout from "./layouts/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/Dashboard.tsx";
import AdminUsersPage from "./pages/admin/UsersPage.tsx";
import AdminClassesPage from "./pages/admin/ClassesPage.tsx";
import AdminSettingsPage from "./pages/admin/SettingsPage.tsx";
import AdminHelpPage from "./pages/admin/HelpPage.tsx";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute.tsx";

function PortalRootRedirect({
  targetRole,
  defaultPath,
  loginElement,
}: {
  targetRole: "teacher" | "parent" | "admin";
  defaultPath: string;
  loginElement: React.ReactElement;
}) {
  const token = tokenManager.getAccessToken();
  if (token && !isTokenExpired(token)) {
    const role = getRoleFromToken(token);
    if (role === targetRole) {
      return <Navigate to={defaultPath} replace />;
    }
  }
  return loginElement;
}

const renderTeacherRoutes = () => (
  <Route
    path="/teacher"
    element={
      <TeacherProtectedRoute>
        <TeacherLayout />
      </TeacherProtectedRoute>
    }
  >
    {/* Classes */}
    <Route path="classes" index element={<TeacherClassesPage />} />
    <Route path="classes/:classId" element={<TeacherClassPage />} />
    {/* Students */}
    <Route path="students" index element={<TeacherStudentsPage />} />
    <Route path="students/:id" element={<TeacherStudentProfilePage />} />

    {/* Lessons */}
    <Route path="lessons" element={<TeacherLessonsPage />} />

    {/* /lessons/curriculum/:curriculumId */}
    <Route
      path="lessons/curriculum/:curriculumId"
      element={<TeacherSectionListPage />}
    />

    {/* /lessons/curriculum/:curriculumId/sections/:sectionId */}
    <Route
      path="lessons/curriculum/:curriculumId/sections/:sectionId"
      element={<TeacherUnitListPage />}
    />

    {/* /lessons/curriculum/:curriculumId/sections/:sectionId/units/:unitId */}
    <Route
      path="lessons/curriculum/:curriculumId/sections/:sectionId/units/:unitId"
      element={<TeacherStageListPage />}
    />
    <Route
      path="lessons/:curriculumId/sections/:sectionId/units/:unitId"
      element={<TeacherStageListPage />}
    />
    <Route
      path="lessons/curriculum/:curriculumId/sections/:sectionId/units/:unitId/new"
      element={<TeacherStageCreatePage />}
    />
    <Route
      path="lessons/curriculum/:curriculumId/sections/:sectionId/units/:unitId/preview"
      element={<TeacherStagePreviewPage />}
    />

    {/* /lessons/curriculum/:curriculumId/sections/:sectionId/units/:unitId/stages/:stageId */}
    <Route
      path="lessons/curriculum/:curriculumId/sections/:sectionId/units/:unitId/stages/:stageId"
      element={<TeacherStageItemPage />}
    />
    <Route
      path="lessons/:curriculumId/sections/:sectionId/units/:unitId/stages/:stageId"
      element={<TeacherStageItemPage />}
    />

    {/* Add lesson */}
    <Route path="lessons/new" element={<TeacherAddLessonLayout />}>
      <Route path="step-1" element={<TeacherAddLessonStepOnePage />} />
      <Route path="step-2" element={<TeacherAddLessonStepTwoPage />} />
      <Route path="step-3" element={<TeacherAddLessonStepThreePage />} />
    </Route>

    {/* Tasks */}
    <Route path="tasks" element={<TeacherTasksPage />} />
    <Route
      path="tasks/:gameTitle"
      element={<TeacherAddGameActivityLayout />}
    >
      <Route
        index
        path="step-1"
        element={<TeacherAddGameActivityStepOnePage />}
      />
      <Route
        path="step-2"
        element={<TeacherAddGameActivityStepTwoPage />}
      />
      <Route
        path="step-3"
        element={<TeacherAddGameActivityStepThreePage />}
      />
    </Route>
    <Route path="tasks/upload" element={<TeacherUploadVideoLayout />}>
      <Route
        index
        path="step-1"
        element={<TeacherUploadVideoStepOnePage />}
      />
      <Route path="step-2" element={<TeacherUploadVideoStepTwoPage />} />
      <Route
        path="step-3"
        element={<TeacherUploadVideoStepThreePage />}
      />
    </Route>
    {/* Mini Games Detail & Management */}
    <Route path="mini-games/:id" element={<TeacherViewMiniGamePage />} />

    <Route path="settings" element={<TeacherSettingsPage />} />
    <Route path="help" element={<TeacherHelpPage />} />
  </Route>
);

const renderParentRoutes = () => (
  <Route
    path="/parent"
    element={
      <ParentProtectedRoute>
        <ParentLayout />
      </ParentProtectedRoute>
    }
  >
    <Route path="home" index element={<ParentHomePage />} />
    <Route
      path="home/student/:username"
      element={<ParentStudentProfilePage />}
    />
    <Route path="progress" element={<ParentProgressPage />} />
    <Route path="settings" element={<ParentSettingsPage />} />
    <Route path="help" element={<ParentHelpPage />} />
  </Route>
);

const renderAdminRoutes = () => (
  <Route
    path="/admin"
    element={
      <AdminProtectedRoute>
        <AdminLayout />
      </AdminProtectedRoute>
    }
  >
    <Route index element={<AdminDashboard />} />
    <Route path="users" element={<AdminUsersPage />} />
    <Route path="classes" element={<AdminClassesPage />} />
    <Route path="settings" element={<AdminSettingsPage />} />
    <Route path="help" element={<AdminHelpPage />} />
  </Route>
);

function App() {
  const portal = getActivePortal();

  return (
    <BrowserRouter>
      <Routes>
        {/* TEACHER DEDICATED PORTAL */}
        {portal === "teacher" && (
          <>
            <Route
              path="/"
              element={
                <PortalRootRedirect
                  targetRole="teacher"
                  defaultPath="/teacher/classes"
                  loginElement={<TeacherLoginPage />}
                />
              }
            />
            <Route
              path="/teacher/login"
              element={
                <PortalRootRedirect
                  targetRole="teacher"
                  defaultPath="/teacher/classes"
                  loginElement={<TeacherLoginPage />}
                />
              }
            />
            {renderTeacherRoutes()}
            {/* Direct fallback aliases inside teacher deployment */}
            <Route path="/classes" element={<Navigate to="/teacher/classes" replace />} />
            <Route path="/students" element={<Navigate to="/teacher/students" replace />} />
            <Route path="/lessons" element={<Navigate to="/teacher/lessons" replace />} />
            <Route path="/tasks" element={<Navigate to="/teacher/tasks" replace />} />
            <Route path="/settings" element={<Navigate to="/teacher/settings" replace />} />
            <Route path="/help" element={<Navigate to="/teacher/help" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}

        {/* PARENT DEDICATED PORTAL */}
        {portal === "parent" && (
          <>
            <Route
              path="/"
              element={
                <PortalRootRedirect
                  targetRole="parent"
                  defaultPath="/parent/home"
                  loginElement={<ParentLoginPage />}
                />
              }
            />
            <Route
              path="/parent/login"
              element={
                <PortalRootRedirect
                  targetRole="parent"
                  defaultPath="/parent/home"
                  loginElement={<ParentLoginPage />}
                />
              }
            />
            {renderParentRoutes()}
            {/* Direct fallback aliases inside parent deployment */}
            <Route path="/home" element={<Navigate to="/parent/home" replace />} />
            <Route path="/progress" element={<Navigate to="/parent/progress" replace />} />
            <Route path="/settings" element={<Navigate to="/parent/settings" replace />} />
            <Route path="/help" element={<Navigate to="/parent/help" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}

        {/* ADMIN DEDICATED PORTAL */}
        {portal === "admin" && (
          <>
            <Route
              path="/"
              element={
                <PortalRootRedirect
                  targetRole="admin"
                  defaultPath="/admin"
                  loginElement={<AdminLoginPage />}
                />
              }
            />
            <Route
              path="/admin/login"
              element={
                <PortalRootRedirect
                  targetRole="admin"
                  defaultPath="/admin"
                  loginElement={<AdminLoginPage />}
                />
              }
            />
            {renderAdminRoutes()}
            {/* Direct fallback aliases inside admin deployment */}
            <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/users" element={<Navigate to="/admin/users" replace />} />
            <Route path="/classes" element={<Navigate to="/admin/classes" replace />} />
            <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
            <Route path="/help" element={<Navigate to="/admin/help" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}

        {/* ALL PORTALS (DEFAULT / LOCAL DEVELOPMENT) */}
        {portal === "all" && (
          <>
            <Route path="/" element={<LandingPage />} />
            <Route path="/teacher/login" element={<TeacherLoginPage />} />
            <Route path="/parent/login" element={<ParentLoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            {renderTeacherRoutes()}
            {renderParentRoutes()}
            {renderAdminRoutes()}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
