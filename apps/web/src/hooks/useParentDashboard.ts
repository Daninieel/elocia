"use client";
import { useState, useEffect, useCallback } from "react";
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

export function useParentDashboard() {
  const token = tokenManager.getAccessToken();
  const parentName = token ? getNameFromToken(token) : null;

  const [children, setChildren] = useState<ParentStudent[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentStudent | null>(null);
  const [summary, setSummary] = useState<ParentProgressSummary | null>(null);
  const [scores, setScores] = useState<EvaluationAttemptItem[]>([]);
  
  const [stats, setStats] = useState<DashboardStats>({
    overallProgress: 0,
    avgScore: 0,
    unitsCompleted: 0,
    streak: 0,
  });

  const [rawCurriculum, setRawCurriculum] = useState<any>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);

  const [stagePath, setStagePath] = useState<StagePathItem[]>([
    { stageId: 1, stageNumber: 1, title: "Stage 1", status: "current", progressPercentage: 0 },
    { stageId: 2, stageNumber: 2, title: "Stage 2", status: "locked" },
    { stageId: 3, stageNumber: 3, title: "Stage 3", status: "locked" },
    { stageId: 4, stageNumber: 4, title: "Stage 4", status: "locked" },
  ]);

  const [parameterMastery, setParameterMastery] = useState<ParameterMasteryItem[]>([
    { name: "Handshape", key: "handshape", value: 0 },
    { name: "Palm Orientation", key: "palm_orientation", value: 0 },
    { name: "Location", key: "location", value: 0 },
    { name: "Movement", key: "movement", value: 0 },
  ]);

  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrendItem[]>([]);
  const [needsPractice, setNeedsPractice] = useState<PracticeCardItem[]>([]);

  const [achievements, setAchievements] = useState<AchievementItem[]>([
    {
      id: "fast_learner",
      name: "Fast Learner",
      description: "Quick mastery of initial signs",
      iconType: "lightning",
      unlocked: false,
      color: "gray",
    },
    {
      id: "sign_master",
      name: "Sign Master",
      description: "Achieved >80% average score",
      iconType: "snake",
      unlocked: false,
      color: "gray",
    },
    {
      id: "consistent",
      name: "Dedicated Signer",
      description: "Maintained a 3+ day practice streak",
      iconType: "medal",
      unlocked: false,
      color: "gray",
    },
    {
      id: "stage_champ",
      name: "Stage Champion",
      description: "Completed full section evaluation",
      iconType: "trophy",
      unlocked: false,
      color: "gray",
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load: Fetch Parent's Children
  const loadParentChildren = useCallback(async (isSilent: boolean = false) => {
    try {
      if (!isSilent) {
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

      if (kids.length > 0) {
        setSelectedChild((prev) => (prev ? kids.find((k) => k.id === prev.id) || kids[0] : kids[0]));
      }
    } catch (err: any) {
      console.error("Error loading parent children:", err);
      setError(err?.message || "Failed to load children");
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch (shows initial loader)
    loadParentChildren(false);

    // Auto-refresh silently when tab gains focus so Admin changes appear immediately without locking the screen
    const onFocus = () => {
      loadParentChildren(true);
    };
    window.addEventListener("focus", onFocus);

    // Silent background poll every 30 seconds
    const interval = setInterval(() => {
      loadParentChildren(true);
    }, 30000);

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [loadParentChildren]);

  // 2. Load Child Performance Data when selectedChild changes
  useEffect(() => {
    if (!selectedChild) return;

    let isMounted = true;

    async function loadChildMetrics() {
      try {
        const studentId = selectedChild?.id || selectedChild?.student_id;
        if (!studentId) return;

        const [summaryData, attemptsData, curriculumData, needsPracticeData, stageProgressData] = await Promise.all([
          fetchParentProgressSummary(studentId).catch(() => null),
          fetchStudentScores(studentId).catch(() => []),
          fetchCurriculumStages(selectedChild?.grade_level).catch(() => null),
          fetchStudentNeedsPractice(studentId).catch(() => []),
          fetchStudentStageProgress(studentId).catch(() => null),
        ]);

        if (!isMounted) return;

        setSummary(summaryData);
        setScores(attemptsData || []);
        setNeedsPractice(needsPracticeData || []);

        // Compute Live Stats
        const validAttempts = (attemptsData || []).filter((a: EvaluationAttemptItem) => a.score_overall > 0);

        // Official Stage Progression (from backend /users/{studentId}/progress)
        // Check which stages the student has genuinely completed / passed
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

        // Total curriculum stages available
        let totalStages = 10;
        if (curriculumData?.sections) {
          const allStages = curriculumData.sections.flatMap((s: any) => s.units.flatMap((u: any) => u.stages));
          if (allStages.length > 0) totalStages = allStages.length;
        }

        const calculatedOverall = distinctStagesPassed > 0
          ? Math.min(100, Math.round((distinctStagesPassed / totalStages) * 100))
          : 0;

        // Group attempts by distinct sign (stage_id + sign_id) to calculate culminating mastery per sign:
        // Ensures overall parameter mastery reflects true student competence rather than dragging in early struggle attempts!
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

        const realStreak = selectedChild?.streak ?? summaryData?.streak ?? 0;
        const realCompleted = distinctStagesPassed;

        setStats({
          overallProgress: calculatedOverall,
          avgScore: realAvg,
          unitsCompleted: realCompleted,
          streak: realStreak,
        });

        // Compute Live 4-Parameter Mastery across culminating performance per sign
        if (targetList.length > 0) {
          const avgH = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_handshape || 0), 0) / targetList.length);
          const avgP = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_palm_orientation || 0), 0) / targetList.length);
          const avgL = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_location || 0), 0) / targetList.length);
          const avgM = Math.round(targetList.reduce((acc: number, a: EvaluationAttemptItem) => acc + (a.score_movement || 0), 0) / targetList.length);

          setParameterMastery([
            { name: "Handshape", key: "handshape", value: avgH },
            { name: "Palm Orientation", key: "palm_orientation", value: avgP },
            { name: "Location", key: "location", value: avgL },
            { name: "Movement", key: "movement", value: avgM },
          ]);
        } else {
          setParameterMastery([
            { name: "Handshape", key: "handshape", value: 0 },
            { name: "Palm Orientation", key: "palm_orientation", value: 0 },
            { name: "Location", key: "location", value: 0 },
            { name: "Movement", key: "movement", value: 0 },
          ]);
        }

        // Compute Performance Trend (Transparent Calendar Weeks: Option A)
        // Group attempts by calendar week difference from student's first attempt
        if (validAttempts.length > 0) {
          const chronological = [...validAttempts].sort(
            (a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
          );

          const firstDate = new Date(chronological[0].created_at || "").getTime();
          const msPerWeek = 7 * 24 * 60 * 60 * 1000;

          // Group scores into weeks (0 = Week 1, 1 = Week 2, etc.)
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

          // Determine current active week index
          const activeWeeksCount = Object.keys(weekBuckets).filter(
            (w) => weekBuckets[Number(w)].length > 0
          ).length;

          const trendItems: PerformanceTrendItem[] = [0, 1, 2, 3].map((wIdx) => {
            const scoresInWeek = weekBuckets[wIdx];
            const hasData = scoresInWeek.length > 0;
            const avgScore = hasData
              ? Math.round(scoresInWeek.reduce((acc, s) => acc + s, 0) / scoresInWeek.length)
              : 0;

            const isCurrent = wIdx === activeWeeksCount - 1 || (wIdx === 0 && activeWeeksCount === 0);
            const isUpcoming = !hasData;

            return {
              label: `Week ${wIdx + 1}`,
              score: avgScore,
              isCurrent: hasData && isCurrent,
              isUpcoming,
            };
          });

          setPerformanceTrend(trendItems);
        } else {
          setPerformanceTrend([
            { label: "Week 1", score: 0, isCurrent: true, isUpcoming: true },
            { label: "Week 2", score: 0, isUpcoming: true },
            { label: "Week 3", score: 0, isUpcoming: true },
            { label: "Week 4", score: 0, isUpcoming: true },
          ]);
        }

        setRawCurriculum(curriculumData);

        // Live Stage Path Status with Titles & Subtitles matching Figma
        const currentSec = curriculumData?.sections?.[activeSectionIndex] || curriculumData?.sections?.[0];
        const stagesList = (currentSec?.units?.[0]?.stages) || (curriculumData?.sections?.[0]?.units?.[0]?.stages) || [];

        const defaultSubtitles = [
          "Numbers (0-10)",
          "Numbers (11-20)",
          "Numbers (21-30)",
          "Numbers (31-40)"
        ];

        const targetCount = stagesList.length > 0 ? stagesList.length : 4;
        setStagePath(Array.from({ length: targetCount }).map((_, sIdx) => {
          const sNum = sIdx + 1;
          const dynStage = stagesList[sIdx];
          const dynStageId = dynStage?.id ?? sNum;
          
          // Check if passed/unlocked by stage_number or database ID
          const isPassed = officialPassedStages.has(sNum) || officialPassedStages.has(dynStageId);
          const isUnlocked = officialUnlockedStages.has(sNum) || officialUnlockedStages.has(dynStageId) || (sNum === 1 && activeSectionIndex === 0);
          const isCurrent = !isPassed && isUnlocked;

          const title = dynStage?.title || `Stage ${sNum}`;
          const subtitle = dynStage?.description || defaultSubtitles[sIdx] || `Numbers (${(sNum-1)*10+1}-${sNum*10})`;

          return {
            stageId: dynStageId,
            stageNumber: sNum,
            title,
            subtitle,
            status: isPassed ? "completed" : isCurrent ? "current" : "locked",
            progressPercentage: isPassed ? 100 : isCurrent ? 50 : 0,
          };
        }));

        // Live Achievements
        const hasHighAvg = realAvg >= 80 && validAttempts.length > 0;
        const hasStreak = realStreak >= 3;
        const hasCompletedStage = distinctStagesPassed >= 1;

        setAchievements([
          {
            id: "fast_learner",
            name: "Fast Learner",
            description: "Quick mastery of initial signs",
            iconType: "lightning",
            unlocked: validAttempts.length > 0,
            color: validAttempts.length > 0 ? "orange" : "gray",
          },
          {
            id: "sign_master",
            name: "Sign Master",
            description: "Achieved >80% average score",
            iconType: "snake",
            unlocked: hasHighAvg,
            color: hasHighAvg ? "green" : "gray",
          },
          {
            id: "consistent",
            name: "Dedicated Signer",
            description: "Maintained a 3+ day practice streak",
            iconType: "medal",
            unlocked: hasStreak,
            color: hasStreak ? "orange" : "gray",
          },
          {
            id: "stage_champ",
            name: "Stage Champion",
            description: "Completed full section evaluation",
            iconType: "trophy",
            unlocked: hasCompletedStage,
            color: hasCompletedStage ? "green" : "gray",
          },
        ]);
      } catch (e) {
        console.error("Error computing child metrics:", e);
      }
    }

    loadChildMetrics();

    return () => {
      isMounted = false;
    };
  }, [selectedChild, activeSectionIndex]);

  const sections = rawCurriculum?.sections || [];

  return {
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
  };
}

