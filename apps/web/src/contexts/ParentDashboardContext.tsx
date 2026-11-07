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
  cumulativeParameterMastery: ParameterMasteryItem[];
  performanceTrend: PerformanceTrendItem[];
  selectedWeekIndex: number | null;
  setSelectedWeekIndex: (idx: number | null) => void;
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
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);

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
        ? Number(Number(summaryData.avg_score).toFixed(1))
        : targetList.length > 0
        ? Number((targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + a.score_overall, 0) / targetList.length).toFixed(1))
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

      // Performance Trend (Dynamic Incrementing Weeks & Weekly Parameters)
      let trendItems: PerformanceTrendItem[] = [];
      if (validAttempts.length > 0) {
        const chronological = [...validAttempts].sort(
          (a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
        );
        const firstDate = new Date(chronological[0].created_at || "").getTime();
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weekBuckets: Record<number, EvaluationAttemptItem[]> = {};

        chronological.forEach((att) => {
          const attDate = new Date(att.created_at || "").getTime();
          const weekDiff = Math.max(0, Math.floor((attDate - firstDate) / msPerWeek));
          weekBuckets[weekDiff] = weekBuckets[weekDiff] || [];
          weekBuckets[weekDiff].push(att);
        });

        const activeWeekIndices = Object.keys(weekBuckets)
          .map(Number)
          .filter((w) => weekBuckets[w].length > 0);
        const highestActiveWeek = activeWeekIndices.length > 0 ? Math.max(...activeWeekIndices) : 0;
        
        // Dynamic Horizon: at least 4 weeks, and at least current calendar week + 2 upcoming
        const nowMs = Date.now();
        const currentCalWeek = Math.max(0, Math.floor((nowMs - firstDate) / msPerWeek));
        const totalWeeks = Math.max(4, highestActiveWeek + 2, currentCalWeek + 2);

        trendItems = Array.from({ length: totalWeeks }, (_, wIdx) => {
          const attsInWeek = weekBuckets[wIdx] || [];
          const hasData = attsInWeek.length > 0;
          let avgScore = 0;

          const wStart = new Date(firstDate + wIdx * msPerWeek);
          const wEnd = new Date(firstDate + (wIdx + 1) * msPerWeek - 1000);
          const startMonth = wStart.toLocaleString("en-US", { month: "short" });
          const endMonth = wEnd.toLocaleString("en-US", { month: "short" });
          const dateRange = startMonth === endMonth
            ? `${startMonth} ${wStart.getDate()} - ${wEnd.getDate()}`
            : `${startMonth} ${wStart.getDate()} - ${endMonth} ${wEnd.getDate()}`;

          let weekParams: ParameterMasteryItem[] = [];

          if (hasData) {
            const bySign: Record<string, EvaluationAttemptItem[]> = {};
            attsInWeek.forEach((a) => {
              const key = `${a.stage_id_new || a.stage_id || 1}_${a.sign_id || 1}`;
              bySign[key] = bySign[key] || [];
              bySign[key].push(a);
            });

            const passedScores: number[] = [];
            const paramH: number[] = [];
            const paramP: number[] = [];
            const paramL: number[] = [];
            const paramM: number[] = [];

            Object.values(bySign).forEach((list) => {
              const passed = list.filter((x) => x.passed && (x.tier_level || 1) < 4);
              const chosen = passed.length > 0 ? passed[passed.length - 1] : list[list.length - 1];
              passedScores.push(chosen.score_overall);
              if (chosen.score_handshape != null) paramH.push(chosen.score_handshape);
              if (chosen.score_palm_orientation != null) paramP.push(chosen.score_palm_orientation);
              if (chosen.score_location != null) paramL.push(chosen.score_location);
              if (chosen.score_movement != null) paramM.push(chosen.score_movement);
            });

            avgScore = passedScores.length > 0
              ? Math.round(passedScores.reduce((acc, s) => acc + s, 0) / passedScores.length)
              : 0;

            weekParams = [
              { name: "Handshape", key: "handshape", value: paramH.length ? Math.round(paramH.reduce((a, b) => a + b, 0) / paramH.length) : 0 },
              { name: "Palm Orientation", key: "palm_orientation", value: paramP.length ? Math.round(paramP.reduce((a, b) => a + b, 0) / paramP.length) : 0 },
              { name: "Location", key: "location", value: paramL.length ? Math.round(paramL.reduce((a, b) => a + b, 0) / paramL.length) : 0 },
              { name: "Movement", key: "movement", value: paramM.length ? Math.round(paramM.reduce((a, b) => a + b, 0) / paramM.length) : 0 },
            ];
          }

          const isCurrent = (wIdx === highestActiveWeek) && hasData;
          return {
            weekIndex: wIdx,
            label: `Week ${wIdx + 1}`,
            score: avgScore,
            isCurrent,
            isUpcoming: !hasData,
            dateRange,
            parameters: weekParams,
            attemptsCount: attsInWeek.length,
          };
        });
      } else {
        trendItems = [
          { weekIndex: 0, label: "Week 1", score: 0, isCurrent: true, isUpcoming: true, parameters: [] },
          { weekIndex: 1, label: "Week 2", score: 0, isUpcoming: true, parameters: [] },
          { weekIndex: 2, label: "Week 3", score: 0, isUpcoming: true, parameters: [] },
          { weekIndex: 3, label: "Week 4", score: 0, isUpcoming: true, parameters: [] },
        ];
      }
      setPerformanceTrend(trendItems);

      setRawCurriculum(curriculumData);

      // Deduplicate sections by title so Numbers, Alphabet, Colors, Shapes are distinct
      const rawSecs = curriculumData?.sections || [];
      const seenTitles = new Set<string>();
      const uniqueSecs: any[] = [];
      for (const s of rawSecs) {
        if (s.title && !seenTitles.has(s.title)) {
          seenTitles.add(s.title);
          uniqueSecs.push(s);
        }
      }

      const currentSec = uniqueSecs[sectionIdx] || uniqueSecs[0];
      const stagesList = currentSec?.units?.[0]?.stages || [];

      const newStagePath: StagePathItem[] = stagesList.map((dynStage: any, sIdx: number) => {
        const sNum = sIdx + 1;
        const dynStageId = dynStage?.id ?? sNum;
        const isPassed = officialPassedStages.has(dynStageId);
        const isUnlocked = officialUnlockedStages.has(dynStageId) || (sNum === 1);
        const isCurrent = !isPassed && isUnlocked;
        const title = `Stage ${sNum}`;
        const subtitle = dynStage?.title || `Stage ${sNum}`;

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

  const sections = useMemo(() => {
    const rawSecs = rawCurriculum?.sections || [];
    const seenTitles = new Set<string>();
    const uniqueSecs: any[] = [];
    for (const s of rawSecs) {
      if (s.title && !seenTitles.has(s.title)) {
        seenTitles.add(s.title);
        uniqueSecs.push(s);
      }
    }
    return uniqueSecs;
  }, [rawCurriculum]);

  const activeParameterMastery = useMemo(() => {
    if (selectedWeekIndex !== null) {
      const matched = performanceTrend.find((item) => item.weekIndex === selectedWeekIndex);
      if (matched && matched.parameters && matched.parameters.length > 0) {
        return matched.parameters;
      }
    }
    return parameterMastery;
  }, [selectedWeekIndex, performanceTrend, parameterMastery]);

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
      parameterMastery: activeParameterMastery,
      cumulativeParameterMastery: parameterMastery,
      performanceTrend,
      selectedWeekIndex,
      setSelectedWeekIndex,
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
      activeParameterMastery,
      parameterMastery,
      performanceTrend,
      selectedWeekIndex,
      setSelectedWeekIndex,
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
