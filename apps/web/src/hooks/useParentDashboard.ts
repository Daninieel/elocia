"use client";
import { useContext } from "react";
import { ParentDashboardContext, type ParentDashboardContextValue } from "@/contexts/ParentDashboardContext";

export function useParentDashboard(): ParentDashboardContextValue {
  const context = useContext(ParentDashboardContext);
  if (!context) {
    throw new Error("useParentDashboard must be used within a ParentDashboardProvider");
  }
  return context;
}

export type { DashboardStats } from "@/contexts/ParentDashboardContext";
