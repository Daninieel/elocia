"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getIdFromToken, getNameFromToken, tokenManager } from "@/helpers/jwt";
import type {
  ParentStudent,
  ParentProgressSummary,
  EvaluationAttemptItem,
  ParameterMasteryItem,
  PerformanceTrendItem,
  StagePathItem,
  AchievementItem,
  PracticeCardItem,
} from "@/interfaces/parent.interface";
import {
  fetchParentStudents,
  fetchParentProgressSummary,
  fetchStudentScores,
  fetchCurriculumStages,
  fetchStudentNeedsPractice,
  fetchStudentStageProgress,
} from "@/services/parent-progress";

export interface DashboardStats {
  overallProgress: number; // e.g. 78
  avgScore: number;        // e.g. 94
  unitsCompleted: number;  // e.g. 12
  streak: number;          // e.g. 7
}

export interface ParentDashboardContextValue {
  parentName: string | null;
  children: ParentStudent[];
  selectedChild: ParentStudent | null;
  setSelectedChild: (child: ParentStudent) => void;
  summary: ParentProgressSummary | null;
  scores: EvaluationAttemptItem[];
  stats: DashboardStats;
  stagePath: StagePathItem[];
  parameterMastery: ParameterMasteryItem[];
  performanceTrend: PerformanceTrendItem[];
  needsPractice: PracticeCardItem[];
  achievements: AchievementItem[];
  sections: any[];
  activeSectionIndex: number;
  setActiveSectionIndex: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;
  error: string | null;
  refetch: (isSilent?: boolean) => Promise<void>;
  refresh: (isSilent?: boolean) => Promise<void>;
}

export const ParentDashboardContext = createContext<ParentDashboardContextValue | null>(null);

// In-memory module cache across page transitions for true 0ms tab navigation
const _cache: {
  children: ParentStudent[];
  selectedChildId: string | null;
  metricsByChildId: Record<string, {
    summary: ParentProgressSummary | null;
    scores: EvaluationAttemptItem[];
    needsPractice: PracticeCardItem[];
    stats: DashboardStats;
    parameterMastery: ParameterMasteryItem[];
    performanceTrend: PerformanceTrendItem[];
    stagePath: StagePathItem[];
    rawCurriculum: any;
    achievements: AchievementItem[];
    timestamp: number;
  }>;
} = {
  children: [],
  selectedChildId: null,
  metricsByChildId: {},
};

export const ParentDashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children: componentChildren }) => {
  const token = tokenManager.getAccessToken();
  const parentName = token ? getNameFromToken(token) : null;

  // Initial local state from in-memory cache if available (0ms instant render)
  const [children, setChildren] = useState<ParentStudent[]>(() => _cache.children);
  const [selectedChild, setSelectedChildState] = useState<ParentStudent | null>(() => {
    if (_cache.selectedChildId && _cache.children.length > 0) {
      return _cache.children.find((c) => (c.id || c.student_id) === _cache.selectedChildId) || _cache.children[0];
    }
    return _cache.children[0] || null;
  });

  const [summary, setSummary] = useState<ParentProgressSummary | null>(() => {
    const cid = _cache.selectedChildId;
    return cid ? _cache.metricsByChildId[cid]?.summary || null : null;
  });
  const [scores, setScores] = useState<EvaluationAttemptItem[]>(() => {
    const cid = _cache.selectedChildId;
    return cid ? _cache.metricsByChildId[cid]?.scores || [] : [];
  });
  const [stats, setStats] = useState<DashboardStats>(() => {
    const cid = _cache.selectedChildId;
    return cid ? _cache.metricsByChildId[cid]?.stats || { overallProgress: 0, avgScore: 0, unitsCompleted: 0, streak: 0 } : { overallProgress: 0, avgScore: 0, unitsCompleted: 0, streak: 0 };
  });

  const [rawCurriculum, setRawCurriculum] = useState<any>(() => {
    const cid = _cache.selectedChildId;
    return cid ? _cache.metricsByChildId[cid]?.rawCurriculum || null : null;
  });
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);

  const [stagePath, setStagePath] = useState<StagePathItem[]>(() => {
    const cid = _cache.selectedChildId;
    return cid && _cache.metricsByChildId[cid]?.stagePath?.length
      ? _cache.metricsByChildId[cid].stagePath
      : [
          { stageId: 1, stageNumber: 1, title: "Stage 1", status: "current", progressPercentage: 0 },
          { stageId: 2, stageNumber: 2, title: "Stage 2", status: "locked" },
          { stageId: 3, stageNumber: 3, title: "Stage 3", status: "locked" },
          { stageId: 4, stageNumber: 4, title: "Stage 4", status: "locked" },
        ];
  });

  const [parameterMastery, setParameterMastery] = useState<ParameterMasteryItem[]>(() => {
    const cid = _cache.selectedChildId;
    return cid && _cache.metricsByChildId[cid]?.parameterMastery?.length
      ? _cache.metricsByChildId[cid].parameterMastery
      : [
          { name: "Handshape", key: "handshape", value: 0 },
          { name: "Palm Orientation", key: "palm_orientation", value: 0 },
          { name: "Location", key: "location", value: 0 },
          { name: "Movement", key: "movement", value: 0 },
        ];
  });

  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrendItem[]>(() => {
    const cid = _cache.selectedChildId;
    return cid && _cache.metricsByChildId[cid]?.performanceTrend?.length
      ? _cache.metricsByChildId[cid].performanceTrend
      : [];
  });

  const [needsPractice, setNeedsPractice] = useState<PracticeCardItem[]>(() => {
    const cid = _cache.selectedChildId;
    return cid ? _cache.metricsByChildId[cid]?.needsPractice || [] : [];
  });

  const [achievements, setAchievements] = useState<AchievementItem[]>(() => {
    const cid = _cache.selectedChildId;
    return cid && _cache.metricsByChildId[cid]?.achievements?.length
      ? _cache.metricsByChildId[cid].achievements
      : [
          { id: "fast_learner", name: "Fast Learner", description: "Quick mastery of initial signs", iconType: "lightning", unlocked: false, color: "gray" },
          { id: "sign_master", name: "Sign Master", description: "Achieved >80% average score", iconType: "snake", unlocked: false, color: "gray" },
          { id: "consistent", name: "Dedicated Signer", description: "Maintained a 3+ day practice streak", iconType: "medal", unlocked: false, color: "gray" },
          { id: "stage_champ", name: "Stage Champion", description: "Completed full section evaluation", iconType: "trophy", unlocked: false, color: "gray" },
        ];
  });

  // If memory cache already has children, initial render is 0ms (loading = false)
  const [loading, setLoading] = useState<boolean>(() => _cache.children.length === 0);
  const [error, setError] = useState<string | null>(null);

  const setSelectedChild = useCallback((child: ParentStudent) => {
    setSelectedChildState(child);
    const cid = child?.id || child?.student_id;
    if (cid) {
      _cache.selectedChildId = cid;
      try {
        localStorage.setItem("elocia_parent_selected_child", cid);
      } catch {}
    }
  }, []);

  // Fetch Parent's Children
  const loadParentChildren = useCallback(async (isSilent: boolean = false) => {
    try {
      if (!isSilent && _cache.children.length === 0) {
        setLoading(true);
      }
      setError(null);
      const token = tokenManager.getAccessToken();
      const parentId = token ? getIdFromToken(token) : null;

      if (!parentId) {
        throw new Error("Parent session not found. Please log in again.");
      }

      const kids = await fetchParentStudents(parentId);
      setChildren(kids);
      _cache.children = kids;

      if (kids.length > 0) {
        const savedChildId = typeof window !== "undefined" ? localStorage.getItem("elocia_parent_selected_child") : null;
        setSelectedChildState((prev) => {
          const matched = prev
            ? kids.find((k) => (k.id || k.student_id) === (prev.id || prev.student_id))
            : savedChildId
            ? kids.find((k) => (k.id || k.student_id) === savedChildId)
            : kids[0];
          const finalChild = matched || kids[0];
          _cache.selectedChildId = finalChild.id || finalChild.student_id;
          return finalChild;
        });
      }
    } catch (err: any) {
      console.error("Error loading parent children:", err);
      setError(err?.message || "Failed to load children");
    } finally {
      if (!isSilent && _cache.children.length === 0) {
        setLoading(false);
      }
    }
  }, []);

  // Compute metrics for the active child
  const loadChildMetrics = useCallback(async (child: ParentStudent, sectionIdx: number) => {
    const studentId = child?.id || child?.student_id;
    if (!studentId) return;

    try {
      const [summaryData, attemptsData, curriculumData, needsPracticeData, stageProgressData] = await Promise.all([
        fetchParentProgressSummary(studentId).catch(() => null),
        fetchStudentScores(studentId).catch(() => []),
        fetchCurriculumStages(child?.grade_level).catch(() => null),
        fetchStudentNeedsPractice(studentId).catch(() => []),
        fetchStudentStageProgress(studentId).catch(() => null),
      ]);

      setSummary(summaryData);
      setScores(attemptsData || []);
      setNeedsPractice(needsPracticeData || []);

      const validAttempts = (attemptsData || []).filter((a: EvaluationAttemptItem) => a.score_overall > 0);

      // Official Stage Progression
      const officialPassedStages = new Set<number>();
      const officialUnlockedStages = new Set<number>();
      if (stageProgressData?.stages) {
        for (const st of stageProgressData.stages) {
          if (st.passed) officialPassedStages.add(st.stage_id);
          if (st.unlocked) officialUnlockedStages.add(st.stage_id);
        }
      }
      if (stageProgressData?.unlocked_stages) {
        for (const u of stageProgressData.unlocked_stages) {
          officialUnlockedStages.add(u);
        }
      }

      const distinctStagesPassed = officialPassedStages.size;

      let totalStages = stageProgressData?.stages?.length || 10;
      if (curriculumData?.sections) {
        const allStages = curriculumData.sections.flatMap((s: any) => s.units.flatMap((u: any) => u.stages));
        if (allStages.length > 0) totalStages = allStages.length;
      }

      const calculatedOverall = distinctStagesPassed > 0
        ? Math.min(100, Math.round((distinctStagesPassed / totalStages) * 100))
        : 0;

      // Group attempts by distinct sign (stage_id + sign_id) for culminating mastery
      const latestAttemptBySign = new Map<string, EvaluationAttemptItem>();
      for (const a of validAttempts) {
        const key = `${a.stage_id || 1}_${a.sign_id || 1}`;
        if (!latestAttemptBySign.has(key)) {
          latestAttemptBySign.set(key, a);
        } else {
          const existing = latestAttemptBySign.get(key)!;
          const existingTime = new Date(existing.created_at || "").getTime();
          const currTime = new Date(a.created_at || "").getTime();
          if (currTime > existingTime) {
            latestAttemptBySign.set(key, a);
          }
        }
      }

      const masteryAttempts = Array.from(latestAttemptBySign.values());
      const targetList = masteryAttempts.length > 0 ? masteryAttempts : validAttempts;

      const realAvg = summaryData?.avg_score
        ? Math.round(summaryData.avg_score)
        : targetList.length > 0
        ? Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + a.score_overall, 0) / targetList.length)
        : 0;

      const realStreak = child?.streak ?? summaryData?.streak ?? 0;
      const realCompleted = distinctStagesPassed;

      const newStats: DashboardStats = {
        overallProgress: calculatedOverall,
        avgScore: realAvg,
        unitsCompleted: realCompleted,
        streak: realStreak,
      };
      setStats(newStats);

      // 4-Parameter Mastery across culminating performance
      let newParams: ParameterMasteryItem[] = [];
      if (targetList.length > 0) {
        const avgH = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_handshape || 0), 0) / targetList.length);
        const avgP = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_palm_orientation || 0), 0) / targetList.length);
        const avgL = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_location || 0), 0) / targetList.length);
        const avgM = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_movement || 0), 0) / targetList.length);

        newParams = [
          { name: "Handshape", key: "handshape", value: avgH },
          { name: "Palm Orientation", key: "palm_orientation", value: avgP },
          { name: "Location", key: "location", value: avgL },
          { name: "Movement", key: "movement", value: avgM },
        ];
      } else {
        newParams = [
          { name: "Handshape", key: "handshape", value: 0 },
          { name: "Palm Orientation", key: "palm_orientation", value: 0 },
          { name: "Location", key: "location", value: 0 },
          { name: "Movement", key: "movement", value: 0 },
        ];
      }
      setParameterMastery(newParams);

      // Performance Trend
      let trendItems: PerformanceTrendItem[] = [];
      if (validAttempts.length > 0) {
        const chronological = [...validAttempts].sort(
          (a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
        );
        const firstDate = new Date(chronological[0].created_at || "").getTime();
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weekBuckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [] };

        chronological.forEach((att) => {
          const attDate = new Date(att.created_at || "").getTime();
          const weekDiff = Math.max(0, Math.floor((attDate - firstDate) / msPerWeek));
          if (weekDiff < 4) {
            weekBuckets[weekDiff].push(att.score_overall);
          } else {
            weekBuckets[3].push(att.score_overall);
          }
        });

        const activeWeeksCount = Object.keys(weekBuckets).filter(
          (w) => weekBuckets[Number(w)].length > 0
        ).length;

        trendItems = [0, 1, 2, 3].map((wIdx) => {
          const scoresInWeek = weekBuckets[wIdx];
          const hasData = scoresInWeek.length > 0;
          const avgScore = hasData
            ? Math.round(scoresInWeek.reduce((acc, s) => acc + s, 0) / scoresInWeek.length)
            : 0;
          const isCurrent = wIdx === activeWeeksCount - 1 || (wIdx === 0 && activeWeeksCount === 0);
          return {
            label: `Week ${wIdx + 1}`,
            score: avgScore,
            isCurrent: hasData && isCurrent,
            isUpcoming: !hasData,
          };
        });
      } else {
        trendItems = [
          { label: "Week 1", score: 0, isCurrent: true, isUpcoming: true },
          { label: "Week 2", score: 0, isUpcoming: true },
          { label: "Week 3", score: 0, isUpcoming: true },
          { label: "Week 4", score: 0, isUpcoming: true },
        ];
      }
      setPerformanceTrend(trendItems);

      setRawCurriculum(curriculumData);

      // Learning Path Stages
      const currentSec = curriculumData?.sections?.[sectionIdx] || curriculumData?.sections?.[0];
      const stagesList = (currentSec?.units?.[0]?.stages) || (curriculumData?.sections?.[0]?.units?.[0]?.stages) || [];
      const defaultSubtitles = ["Numbers (0-10)", "Numbers (11-20)", "Numbers (21-30)", "Numbers (31-40)"];
      const targetCount = stagesList.length > 0 ? stagesList.length : 4;

      const newStagePath: StagePathItem[] = Array.from({ length: targetCount }).map((_, sIdx) => {
        const sNum = sIdx + 1;
        const dynStage = stagesList[sIdx];
        const dynStageId = dynStage?.id ?? sNum;
        const isPassed = officialPassedStages.has(sNum) || officialPassedStages.has(dynStageId);
        const isUnlocked = officialUnlockedStages.has(sNum) || officialUnlockedStages.has(dynStageId) || (sNum === 1 && sectionIdx === 0);
        const isCurrent = !isPassed && isUnlocked;
        const title = dynStage?.title || `Stage ${sNum}`;
        const subtitle = dynStage?.description || defaultSubtitles[sIdx] || `Numbers (${(sNum - 1) * 10 + 1}-${sNum * 10})`;

        return {
          stageId: dynStageId,
          stageNumber: sNum,
          title,
          subtitle,
          status: isPassed ? "completed" : isCurrent ? "current" : "locked",
          progressPercentage: isPassed ? 100 : isCurrent ? 50 : 0,
        };
      });
      setStagePath(newStagePath);

      // Achievements
      const hasHighAvg = realAvg >= 80 && validAttempts.length > 0;
      const hasStreak = realStreak >= 3;
      const hasCompletedStage = distinctStagesPassed >= 1;

      const newAchievements: AchievementItem[] = [
        { id: "fast_learner", name: "Fast Learner", description: "Quick mastery of initial signs", iconType: "lightning", unlocked: validAttempts.length > 0, color: validAttempts.length > 0 ? "orange" : "gray" },
        { id: "sign_master", name: "Sign Master", description: "Achieved >80% average score", iconType: "snake", unlocked: hasHighAvg, color: hasHighAvg ? "green" : "gray" },
        { id: "consistent", name: "Dedicated Signer", description: "Maintained a 3+ day practice streak", iconType: "medal", unlocked: hasStreak, color: hasStreak ? "orange" : "gray" },
        { id: "stage_champ", name: "Stage Champion", description: "Completed full section evaluation", iconType: "trophy", unlocked: hasCompletedStage, color: hasCompletedStage ? "green" : "gray" },
      ];
      setAchievements(newAchievements);

      // Update module in-memory cache
      _cache.metricsByChildId[studentId] = {
        summary: summaryData,
        scores: attemptsData || [],
        needsPractice: needsPracticeData || [],
        stats: newStats,
        parameterMastery: newParams,
        performanceTrend: trendItems,
        stagePath: newStagePath,
        rawCurriculum: curriculumData,
        achievements: newAchievements,
        timestamp: Date.now(),
      };
    } catch (e) {
      console.error("Error computing child metrics:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadParentChildren(_cache.children.length > 0);

    const onFocus = () => {
      loadParentChildren(true);
    };
    window.addEventListener("focus", onFocus);

    const interval = setInterval(() => {
      loadParentChildren(true);
    }, 60000); // 60s background refresh

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [loadParentChildren]);

  // Load Child Metrics when child or section changes
  useEffect(() => {
    if (!selectedChild) return;
    loadChildMetrics(selectedChild, activeSectionIndex);
  }, [selectedChild, activeSectionIndex, loadChildMetrics]);

  const sections = rawCurriculum?.sections || [];

  const value = useMemo<ParentDashboardContextValue>(
    () => ({
      parentName,
      children,
      selectedChild,
      setSelectedChild,
      summary,
      scores,
      stats,
      stagePath,
      parameterMastery,
      performanceTrend,
      needsPractice,
      achievements,
      sections,
      activeSectionIndex,
      setActiveSectionIndex,
      loading,
      error,
      refetch: loadParentChildren,
      refresh: loadParentChildren,
    }),
    [
      parentName,
      children,
      selectedChild,
      setSelectedChild,
      summary,
      scores,
      stats,
      stagePath,
      parameterMastery,
      performanceTrend,
      needsPractice,
      achievements,
      sections,
      activeSectionIndex,
      loading,
      error,
      loadParentChildren,
    ]
  );

  return (
    <ParentDashboardContext.Provider value={value}>
      {componentChildren}
    </ParentDashboardContext.Provider>
  );
};

export function useParentDashboardContext(): ParentDashboardContextValue {
  const ctx = useContext(ParentDashboardContext);
  if (!ctx) {
    throw new Error("useParentDashboardContext must be used within a ParentDashboardProvider");
  }
  return ctx;
}
