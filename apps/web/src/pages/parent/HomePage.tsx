import { useState, useMemo } from "react";
import TopHeaderBar from "@/components/parent/TopHeaderBar";
import StudentBanner from "@/components/parent/StudentBanner";
import ParentStageAnalyticsModal from "@/components/parent/ParentStageAnalyticsModal";
import { useParentDashboard } from "@/hooks/useParentDashboard";
import {
  Check,
  Lock,
  Zap,
  Award,
  Medal,
  Trophy,
  Flame,
  ChevronLeft,
  ChevronRight,
  BarChart2,
} from "lucide-react";

interface StageGroupedAssignment {
  stageNum: number;
  relativeStageNum: number;
  stageId: number;
  title: string;
  signCount: number;
  avgScore: number;
  latestDate: string;
  isFlagged: boolean;
}

export default function ParentHomePage() {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedStageForAnalytics, setSelectedStageForAnalytics] = useState<{
    stageId: number;
    title: string;
  } | null>(null);
  const itemsPerPage = 5;

  const {
    parentName,
    children,
    selectedChild,
    setSelectedChild,
    stats,
    stagePath,
    achievements,
    needsPractice,
    scores,
    sections,
    activeSectionIndex,
    setActiveSectionIndex,
    loading,
    error,
  } = useParentDashboard();

  // Group recent assignment scores by stage using culminating mastery per sign
  const stageGroupedScores = useMemo<StageGroupedAssignment[]>(() => {
    if (!scores || scores.length === 0) return [];

    const map = new Map<number, {
      stageNum: number;
      relativeStageNum: number;
      stageId: number;
      title: string;
      signMap: Map<string, { score: number; date: string }>;
      dates: string[];
      hasFlag: boolean;
    }>();

    scores.forEach((s) => {
      const stageNum = s.stage_number || s.stage_id || s.stage_id_new || 1;
      const stageId = s.stage_id || s.stage_id_new || stageNum;
      const relStage = s.relative_stage_number || stageNum;
      const secNum = s.section_number || (activeSectionIndex ?? 0) + 1;
      const unitNum = s.unit_number || 1;
      const title = s.assignment_name || `Section ${secNum}, Unit ${unitNum}, Stage ${relStage}`;
      const isFlag = s.tier_level === 4;
      const signKey = `${s.sign_id || 1}`;

      if (!map.has(stageNum)) {
        const signMap = new Map<string, { score: number; date: string }>();
        signMap.set(signKey, { score: s.score_overall, date: s.created_at || "" });
        map.set(stageNum, {
          stageNum,
          relativeStageNum: relStage,
          stageId,
          title,
          signMap,
          dates: s.created_at ? [s.created_at] : [],
          hasFlag: isFlag,
        });
      } else {
        const item = map.get(stageNum)!;
        if (s.created_at) item.dates.push(s.created_at);
        if (isFlag) item.hasFlag = true;

        if (!item.signMap.has(signKey)) {
          item.signMap.set(signKey, { score: s.score_overall, date: s.created_at || "" });
        } else {
          const existing = item.signMap.get(signKey)!;
          if (new Date(s.created_at || "").getTime() > new Date(existing.date).getTime()) {
            item.signMap.set(signKey, { score: s.score_overall, date: s.created_at || "" });
          }
        }
      }
    });

    return Array.from(map.values())
      .map((item) => {
        const culminatingScores = Array.from(item.signMap.values()).map((v) => v.score);
        const avg =
          culminatingScores.length > 0
            ? culminatingScores.reduce((a, b) => a + b, 0) / culminatingScores.length
            : 0;
        const sortedDates = item.dates.sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime()
        );
        return {
          stageNum: item.stageNum,
          relativeStageNum: item.relativeStageNum,
          stageId: item.stageId,
          title: item.title,
          signCount: item.signMap.size,
          avgScore: Math.round(avg),
          latestDate: sortedDates[0] || "",
          isFlagged: item.hasFlag,
        };
      })
      .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  }, [scores, activeSectionIndex]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopHeaderBar />
        <div className="p-8 flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-3">
            <div className="size-10 border-4 border-[#FF8A00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-500">Loading parent dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !selectedChild) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopHeaderBar />
        <div className="p-8 max-w-4xl mx-auto w-full">
          <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-800">No Student Linked</h2>
            <p className="text-sm text-gray-500 mt-2">
              {error || "There are no students linked to your parent account yet. Please ask your child's teacher to link your account."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentSection = sections[activeSectionIndex];
  const sectionTitle = currentSection?.title || `Section ${activeSectionIndex + 1}`;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <TopHeaderBar />

      <main className="px-8 py-6 space-y-6 max-w-7xl mx-auto">
        {/* Greeting with parent's real name */}
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Hello there, {parentName || "parent"}!
        </h1>

        {/* Student's Profile Banner */}
        <StudentBanner
          name={selectedChild.name}
          grade={selectedChild.grade_level}
          emoji={selectedChild.emoji}
          color={selectedChild.color}
          allChildren={children}
          selectedChildId={selectedChild.id}
          has_tier4_flag={selectedChild.has_tier4_flag}
          onSelectChild={(child) => setSelectedChild(child)}
        />

        {/* 4 Stat Cards Matching Figma */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: OVERALL PROGRESS */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              Overall Progress
            </span>
            <div className="mt-4 space-y-2">
              <span className="block text-center text-sm font-semibold text-gray-700">
                {stats.overallProgress}%
              </span>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF8A00] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, stats.overallProgress))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: AVG. SCORE */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              Avg. Score
            </span>
            <div className="mt-2 text-center">
              <span className="text-4xl font-extrabold text-[#16A34A] tracking-tight">
                {stats.avgScore}%
              </span>
            </div>
            <div className="h-2" />
          </div>

          {/* Card 3: UNITS COMPLETED */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              Units Completed
            </span>
            <div className="mt-2 text-center">
              <span className="text-4xl font-extrabold text-gray-800 tracking-tight">
                {stats.unitsCompleted}
              </span>
            </div>
            <div className="h-2" />
          </div>

          {/* Card 4: STREAK */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              Streak
            </span>
            <div className="mt-2 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-red-500">
                <Flame className="size-7 fill-red-500 text-red-500" />
                <span className="text-4xl font-extrabold tracking-tight">
                  {stats.streak}
                </span>
              </div>
              <span className="text-xs font-medium text-gray-400 mt-1">Keep it up!</span>
            </div>
          </div>
        </div>

        {/* Needs Practice / Focus Drill Signs Section (Syncs with Student & Teacher) */}
        {needsPractice.length > 0 && (
          <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                    Focus Signs for Home Practice
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                    {needsPractice.length} {needsPractice.length === 1 ? 'Sign' : 'Signs'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Signs where {selectedChild.name} encountered difficulty during recent evaluations. Try practicing these signs together at home!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-1">
              {needsPractice.map((item, idx) => {
                const borderColors = [
                  "border-[#FF7675] bg-[#FFEAEA]/60 text-[#D63031]",
                  "border-[#FDCB6E] bg-[#FFF9E6] text-[#D97706]",
                  "border-[#74B9FF] bg-[#EBF5FB] text-[#0984E3]",
                  "border-[#A29BFE] bg-[#F3F0FF] text-[#6C5CE7]"
                ];
                const cardStyle = borderColors[idx % borderColors.length];

                return (
                  <div
                    key={`${item.sign}-${idx}`}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all shadow-xs ${cardStyle}`}
                  >
                    <span className="text-3xl font-black tracking-tight mb-1">
                      {item.sign}
                    </span>
                    <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider">
                      {item.section_label || `Stage ${item.stage_id}`}
                    </span>
                    {item.reason && (
                      <span className="text-[10px] font-medium text-gray-500 text-center mt-1 truncate max-w-full" title={item.reason}>
                        {item.reason}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Lower Row: Learning Path Progress (Left) + Achievements (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Learning Path Progress */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-8">
              {/* Section selector with Left / Right arrows */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSectionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeSectionIndex === 0}
                  className="p-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Previous Section"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-xs font-bold tracking-widest text-[#FF8A00] uppercase">
                  {sectionTitle}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveSectionIndex((prev) =>
                      Math.min(sections.length - 1, prev + 1)
                    )
                  }
                  disabled={activeSectionIndex >= sections.length - 1}
                  className="p-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Next Section"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <span className="text-sm font-semibold text-gray-600">
                Learning Path Progress
              </span>
            </div>

            {/* Stages Flow */}
            <div className="flex items-center justify-between px-2 sm:px-4 py-6 overflow-x-auto min-w-full">
              {stagePath.map((stage, idx) => {
                const targetStageId = stage.stageId || stage.stageNumber;
                return (
                  <div key={stage.stageNumber} className="flex items-center flex-1 min-w-[100px] last:flex-none">
                    {/* Stage Card - Clickable to open mini window */}
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStageForAnalytics({
                            stageId: targetStageId,
                            title: `Stage ${stage.stageNumber}${stage.subtitle ? ` - ${stage.subtitle}` : ""}`,
                          });
                        }}
                        className={`flex flex-col items-center justify-center w-24 h-32 rounded-2xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95 focus:outline-none ${
                          stage.status === "completed"
                            ? "bg-[#E6F9EE] border border-[#A7F3D0] text-[#059669] hover:border-[#059669]"
                            : stage.status === "current"
                            ? "bg-white border-2 border-[#FF8A00] text-gray-800 shadow-md hover:shadow-lg"
                            : "bg-white border border-gray-200 text-gray-400 hover:border-gray-300"
                        }`}
                        title="Click to view round details and performance"
                      >
                        <span className="text-[11px] font-bold tracking-wider uppercase opacity-80">
                          Stage
                        </span>
                        <span
                          className={`text-2xl font-extrabold my-1 ${
                            stage.status === "completed"
                              ? "text-[#059669]"
                              : stage.status === "current"
                              ? "text-[#FF8A00]"
                              : "text-gray-400"
                          }`}
                        >
                          {stage.stageNumber}
                        </span>

                        {/* Status Icon or Mini Progress */}
                        {stage.status === "completed" ? (
                          <div className="size-6 rounded-full bg-[#10B981] text-white flex items-center justify-center shadow-xs mt-1">
                            <Check className="size-4 stroke-[3]" />
                          </div>
                        ) : stage.status === "current" ? (
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-[#FF8A00] rounded-full"
                              style={{ width: `${stage.progressPercentage ?? 50}%` }}
                            />
                          </div>
                        ) : (
                          <div className="size-6 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mt-1">
                            <Lock className="size-3.5" />
                          </div>
                        )}
                      </button>
                      {/* Subtitle below stage card e.g. Numbers (0-10) */}
                      <span className="text-[11px] font-semibold text-gray-500 mt-2 text-center max-w-[96px] leading-tight">
                        {stage.subtitle || `Stage ${stage.stageNumber}`}
                      </span>
                    </div>

                    {/* Connector line between stages */}
                    {idx < stagePath.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-2 -mt-6 rounded-full ${
                          stage.status === "completed" ? "bg-[#10B981]" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-2" />
          </div>

          {/* Right Column: Achievements Grid Matching Figma */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-700">Achievements</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2">
              {achievements.map((badge) => {
                const getBadgeIcon = () => {
                  switch (badge.iconType) {
                    case "lightning":
                      return <Zap className="size-5" />;
                    case "snake":
                      return <Award className="size-5" />;
                    case "medal":
                      return <Medal className="size-5" />;
                    case "trophy":
                      return <Trophy className="size-5" />;
                    default:
                      return <Award className="size-5" />;
                  }
                };

                return (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center justify-center text-center p-3 rounded-xl hover:bg-gray-50/80 transition-colors"
                  >
                    <div
                      className={`size-14 rounded-full flex items-center justify-center shadow-xs mb-2 ${
                        badge.unlocked && badge.color === "orange"
                          ? "bg-orange-100 text-[#FF8A00]"
                          : badge.unlocked && badge.color === "green"
                          ? "bg-green-100 text-[#10B981]"
                          : "bg-gray-100 text-gray-400 opacity-60"
                      }`}
                    >
                      {getBadgeIcon()}
                    </div>
                    <span
                      className={`text-xs font-semibold leading-tight ${
                        badge.unlocked ? "text-gray-700" : "text-gray-400"
                      }`}
                    >
                      {badge.name}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="h-1" />
          </div>
        </div>

        {/* Section: Recent Assignments (Grouped by Stage with Analytics Popup) */}
        <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-800">Recent Assignments</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Stages completed by {selectedChild.name}. Click Analytics to view rounds and parameter mastery.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {stageGroupedScores.length > 0 ? (
              <>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        STAGE / ASSIGNMENT
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        DATE
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        ROUNDS
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 text-right">
                        AVG SCORE
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 text-right">
                        ACTION
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {stageGroupedScores
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((stageItem) => {
                        return (
                          <tr
                            key={stageItem.stageNum}
                            className="hover:bg-gray-50/60 transition-colors border-b border-gray-50 last:border-b-0"
                          >
                            {/* Stage & Title Column */}
                            <td className="px-4 py-4.5">
                              <div className="flex items-center gap-3.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF4E5] font-extrabold text-sm text-[#FF8A00] shadow-2xs">
                                  {stageItem.relativeStageNum}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800 text-[15px]">
                                    {stageItem.title}
                                  </span>
                                  {stageItem.isFlagged && (
                                    <span
                                      className="flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 animate-pulse shrink-0"
                                      title="Needs practice / Tier 4 flagged"
                                    />
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Date Column */}
                            <td className="px-4 py-4.5 font-medium text-gray-400 text-sm">
                              {stageItem.latestDate
                                ? new Date(stageItem.latestDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "Recent"}
                            </td>

                            {/* Rounds Column */}
                            <td className="px-4 py-4.5 font-medium text-gray-600 text-sm">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-700">
                                {stageItem.signCount} {stageItem.signCount === 1 ? "round attempt" : "rounds attempt"}
                              </span>
                            </td>

                            {/* Score Column */}
                            <td className="px-4 py-4.5 font-extrabold text-gray-800 text-sm text-right">
                              {stageItem.avgScore}%
                            </td>

                            {/* Action Button: Opens Analytics Window */}
                            <td className="px-4 py-4.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedStageForAnalytics({
                                    stageId: stageItem.stageId,
                                    title: stageItem.title,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-xs font-bold text-[#FF8A00] hover:bg-[#FF8A00] hover:text-white transition-all shadow-xs"
                              >
                                <BarChart2 className="size-3.5" />
                                Analytics
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {Math.ceil(stageGroupedScores.length / itemsPerPage) > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 px-2">
                    <span className="text-xs text-gray-500 font-medium">
                      Showing{" "}
                      <span className="font-bold text-gray-700">
                        {(currentPage - 1) * itemsPerPage + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-bold text-gray-700">
                        {Math.min(currentPage * itemsPerPage, stageGroupedScores.length)}
                      </span>{" "}
                      of{" "}
                      <span className="font-bold text-gray-700">{stageGroupedScores.length}</span> stages
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Previous page"
                      >
                        <ChevronLeft className="size-4" />
                      </button>

                      {Array.from({ length: Math.ceil(stageGroupedScores.length / itemsPerPage) }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                              currentPage === pageNum
                                ? "bg-[#FF8A00] text-white shadow-xs"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(Math.ceil(stageGroupedScores.length / itemsPerPage), p + 1)
                          )
                        }
                        disabled={currentPage >= Math.ceil(stageGroupedScores.length / itemsPerPage)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Next page"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-sm font-medium text-gray-400">
                No assignments or evaluation sessions completed yet.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Parent Stage Analytics Modal */}
      {selectedStageForAnalytics && (
        <ParentStageAnalyticsModal
          studentId={selectedChild.id}
          studentName={selectedChild.name}
          stageId={selectedStageForAnalytics.stageId}
          stageTitle={selectedStageForAnalytics.title}
          isOpen={true}
          onClose={() => setSelectedStageForAnalytics(null)}
        />
      )}
    </div>
  );
}
