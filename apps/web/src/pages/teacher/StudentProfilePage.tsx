import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useGetStudentById } from "@/hooks/useStudents";

import { fetchStudentScores } from "@/services/parent-progress";

import { ArrowLeft, Flame, ChevronLeft, ChevronRight } from "lucide-react";

import { getStreakMessage } from "@/helpers/streak";

import type { EvaluationAttemptItem } from "@/interfaces/parent.interface";

import TopHeaderBar from "@/components/teacher/TopHeaderBar";
import StudentBanner from "@/components/teacher/StudentBanner";
import StatCard from "@/components/StatCard";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import UnitAnalyticsModal from "@/components/teacher/UnitAnalyticsModal";

export default function TeacherStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { student, loading, error, editStudent } = useGetStudentById(id || "");
  const [recentAttempts, setRecentAttempts] = useState<EvaluationAttemptItem[]>(
    [],
  );
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(false);
  const [selectedStage, setSelectedStage] = useState<{
    stageId: number;
    title?: string;
    relativeStageNum?: number;
    attemptNumber?: number;
  }>({ stageId: 1 });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const streakMessage = getStreakMessage(student?.streak || 0);

  // Group attempts into distinct Stage Evaluation Attempts (Playthrough Sessions)
  const stageGroupedAssignments = (() => {
    // 1. Group all raw attempts by stage number
    const byStage: Record<number, EvaluationAttemptItem[]> = {};
    recentAttempts.forEach((attempt) => {
      const sNum = attempt.stage_id_new || attempt.stage_number || attempt.stage_id || 1;
      if (!byStage[sNum]) byStage[sNum] = [];
      byStage[sNum].push(attempt);
    });

    const attemptRows: Array<{
      stageNum: number;
      relativeStageNum: number;
      stageId: number;
      title: string;
      unitNumber: number;
      attemptNumber: number;
      totalStageAttempts: number;
      latestDate: string;
      isFlagged: boolean;
      roundsCount: number;
      totalAttempts: number;
      signNames: string[];
      avgScore: number;
    }> = [];

    // 2. For each stage, segment chronologically into Stage Attempts (Playthroughs)
    Object.entries(byStage).forEach(([sNumStr, sAtts]) => {
      const sortedAsc = [...sAtts].sort(
        (a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
      );

      const runs: EvaluationAttemptItem[][] = [];
      let currentRun: EvaluationAttemptItem[] = [];
      const seenSigns = new Set<string>();
      let lastTime: number | null = null;

      sortedAsc.forEach((att) => {
        const signKey = `${att.sign_id || 1}`;
        const attTime = new Date(att.created_at || "").getTime();
        let isNewRun = false;

        if (currentRun.length > 0) {
          const diffSeconds = lastTime ? (attTime - lastTime) / 1000 : 0;
          if (diffSeconds > 120) {
            isNewRun = true;
          } else if (seenSigns.has(signKey) && `${currentRun[currentRun.length - 1].sign_id || 1}` !== signKey) {
            isNewRun = true;
          }
        }

        if (isNewRun) {
          runs.push(currentRun);
          currentRun = [att];
          seenSigns.clear();
          seenSigns.add(signKey);
        } else {
          currentRun.push(att);
          seenSigns.add(signKey);
        }
        lastTime = attTime;
      });

      if (currentRun.length > 0) {
        runs.push(currentRun);
      }

      const totalStageAttempts = runs.length;

      // 3. For each stage playthrough run, compute its culminating score and parameters:
      runs.forEach((runAtts, runIndex) => {
        const attemptNumber = runIndex + 1;
        const rep = runAtts[runAtts.length - 1];
        const sNum = Number(sNumStr);
        const stageId = rep.stage_id_new || rep.stage_id || rep.stage_number || sNum;
        const relStage = rep.relative_stage_number || 1;
        const secNum = rep.section_number || 1;
        const unitNum = rep.unit_number || 1;
        const formattedTitle = rep.assignment_name || `Section ${secNum}, Unit ${unitNum}, Stage ${relStage}`;

        // Group by sign within this run
        const signMap = new Map<string, { name: string; attempts: EvaluationAttemptItem[] }>();
        let isFlagged = false;
        runAtts.forEach((att) => {
          const sKey = `${att.sign_id || 1}`;
          const sName = att.sign_name || `Sign ${att.sign_id}`;
          if (!signMap.has(sKey)) {
            signMap.set(sKey, { name: sName, attempts: [att] });
          } else {
            signMap.get(sKey)!.attempts.push(att);
          }
          if (att.tier_level === 4) isFlagged = true;
        });

        // Compute culminating score per sign
        const recordedScores: number[] = [];
        const signNames: string[] = [];
        signMap.forEach(({ name, attempts }) => {
          signNames.push(name);
          const attsSorted = [...attempts].sort(
            (a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
          );
          const passedAtt = attsSorted.find((a) => a.passed && (!a.tier_level || a.tier_level < 4));
          if (passedAtt) {
            recordedScores.push(passedAtt.score_overall);
          } else {
            const lastAtt = attsSorted[attsSorted.length - 1];
            if (lastAtt && typeof lastAtt.score_overall === "number") {
              recordedScores.push(lastAtt.score_overall);
            }
          }
        });

        const avg = recordedScores.length > 0 ? recordedScores.reduce((a, b) => a + b, 0) / recordedScores.length : 0;
        const latestDate = rep.created_at || runAtts[0].created_at || "";

        attemptRows.push({
          stageNum: sNum,
          relativeStageNum: relStage,
          stageId,
          title: formattedTitle,
          unitNumber: unitNum,
          attemptNumber,
          totalStageAttempts,
          latestDate,
          isFlagged,
          roundsCount: signMap.size,
          totalAttempts: runAtts.length,
          signNames,
          avgScore: Math.round(avg),
        });
      });
    });

    // Sort by latest attempt date descending
    return attemptRows.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  })();

  useEffect(() => {
    if (id) {
      fetchStudentScores(id)
        .then((scores) => setRecentAttempts(scores || []))
        .catch(() => setRecentAttempts([]));
    }
  }, [id]);

  if (loading) return <LoadingState />;

  if (error || !student)
    return <ErrorState message={error || "Student not found."} />;

  return (
    <div className="flex flex-col gap-4">
      <TopHeaderBar />
      <section className="flex flex-col gap-8 p-4 max-w-7xl mx-auto w-full">
        <Link
          to="/teacher/students"
          className="bg-(--primary) w-fit p-2 rounded-full text-(--white) hover:bg-(--primary-hover)"
        >
          <ArrowLeft />
        </Link>
        <StudentBanner student={student} onSave={editStudent} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Signs Mastered Card */}
          <StatCard label="Signs Mastered">
            <h3 className="heading-2 text-(--primary)">
              {student.signs_mastered ?? 0}
            </h3>
          </StatCard>

          {/* Average Score Card */}
          <StatCard label="Average Score">
            <h3 className="heading-2 text-(--success)">
              {student.avg_score ?? 0}%
            </h3>
          </StatCard>

          {/* Stages Completed Card */}
          <StatCard label="Stages Completed">
            <h3 className="heading-2 text-[#b07311]">
              {student.stages_complete ?? 0}
            </h3>
          </StatCard>

          {/* Streak Card */}
          <StatCard label="Streak">
            <div className="flex items-center gap-2 text-(--danger)">
              <Flame className="size-6 fill-(--danger-light)" />
              <h3 className="heading-2">{student.streak ?? 0}</h3>
            </div>
            <p className="paragraph-3 text-center">{streakMessage}</p>
          </StatCard>
        </div>

        {/* Learning Path & Achievements Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Learning Path Progress */}
          <div className="lg:col-span-2 min-h-60 flex flex-col justify-between rounded-3xl border-3 border-(--border) bg-(--white) p-6 shadow-[0_6px_0_0_#BDC8D2]">
            <div className="w-full flex items-center justify-between">
              <h3 className="heading-3 text-(--primary)">
                Learning Path Progress
              </h3>
              <span className="text-sm font-semibold text-(--ghost)">
                {student.stages_complete ?? 0} Stages Completed
              </span>
            </div>

            <div className="flex items-center justify-around gap-3 py-6 overflow-x-auto">
              {[1, 2, 3, 4].map((stageNum) => {
                const isPassed = (student.stages_complete ?? 0) >= stageNum;
                const isCurrent =
                  (student.stages_complete ?? 0) === stageNum - 1;

                return (
                  <div
                    key={stageNum}
                    className={`flex flex-col items-center justify-center w-28 h-32 rounded-2xl border-2 transition-all ${
                      isPassed
                        ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm"
                        : isCurrent
                          ? "bg-orange-50 border-(--primary) text-(--primary) shadow-sm"
                          : "bg-gray-50 border-gray-200 text-gray-400"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Stage
                    </span>
                    <span className="text-3xl font-extrabold my-1">
                      {stageNum}
                    </span>
                    <span className="text-xs font-semibold">
                      {isPassed
                        ? "Completed"
                        : isCurrent
                          ? "Current"
                          : "Locked"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Achievements */}
          <div className="flex min-h-60 flex-col justify-between rounded-3xl border-3 border-(--border) bg-(--white) p-6 shadow-[0_6px_0_0_#BDC8D2]">
            <h3 className="heading-3 text-(--primary)">Achievements</h3>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  recentAttempts.length > 0
                    ? "bg-amber-50 border-amber-300 text-amber-800 shadow-xs"
                    : "bg-gray-50 border-gray-200 text-gray-400 opacity-60"
                }`}
              >
                <span className="text-2xl">⚡</span>
                <span className="text-xs font-bold mt-1">Fast Learner</span>
                <span className="text-[10px] font-medium">
                  {recentAttempts.length > 0 ? "Unlocked" : "Locked"}
                </span>
              </div>

              <div
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  (student.avg_score ?? 0) >= 80
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                    : "bg-gray-50 border-gray-200 text-gray-400 opacity-60"
                }`}
              >
                <span className="text-2xl">🏆</span>
                <span className="text-xs font-bold mt-1">Sign Master</span>
                <span className="text-[10px] font-medium">
                  {(student.avg_score ?? 0) >= 80 ? "Unlocked" : "Locked"}
                </span>
              </div>

              <div
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  (student.streak ?? 0) >= 3
                    ? "bg-orange-50 border-orange-300 text-orange-800 shadow-xs"
                    : "bg-gray-50 border-gray-200 text-gray-400 opacity-60"
                }`}
              >
                <span className="text-2xl">🔥</span>
                <span className="text-xs font-bold mt-1">Dedicated</span>
                <span className="text-[10px] font-medium">
                  {(student.streak ?? 0) >= 3 ? "Unlocked" : "Locked"}
                </span>
              </div>

              <div
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  (student.stages_complete ?? 0) >= 1
                    ? "bg-blue-50 border-blue-300 text-blue-800 shadow-xs"
                    : "bg-gray-50 border-gray-200 text-gray-400 opacity-60"
                }`}
              >
                <span className="text-2xl">🎖️</span>
                <span className="text-xs font-bold mt-1">Stage Champ</span>
                <span className="text-[10px] font-medium">
                  {(student.stages_complete ?? 0) >= 1 ? "Unlocked" : "Locked"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Assignments & Evaluation Sessions */}
        <div className="mb-12 w-full rounded-3xl border-3 border-(--border) bg-(--white) p-6 shadow-[0_6px_0_0_#BDC8D2]">
          <h3 className="heading-3 text-(--primary)">
            Recent Assignments & Evaluation Sessions
          </h3>

          <div className="mt-5 overflow-x-auto">
            {recentAttempts.length > 0 ? (
              <>
                <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      ASSIGNMENT NAME
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      DATE
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      SCORE
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 text-right">
                      ACTIONS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stageGroupedAssignments
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((stageGroup, index) => {
                      return (
                        <tr key={stageGroup.stageNum || index} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50 last:border-b-0">
                          {/* Assignment Name Column */}
                          <td className="border-b border-gray-100 px-4 py-4.5">
                            <div className="flex items-center gap-3.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF4E5] font-extrabold text-sm text-[#FF8A00] shadow-2xs">
                                {stageGroup.relativeStageNum}
                              </span>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800 text-[15px]">
                                    {stageGroup.title}
                                  </span>
                                  <span className="rounded-lg bg-orange-100/70 border border-orange-200 px-2 py-0.5 text-xs font-bold text-orange-700">
                                    Attempt {stageGroup.attemptNumber}
                                  </span>
                                  {stageGroup.isFlagged && (
                                    <span
                                      className="flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 animate-pulse"
                                      title="Flagged (Tier 4 / Needs Focus)"
                                    />
                                  )}
                                </div>
                                {stageGroup.signNames && stageGroup.signNames.length > 0 && (
                                  <span className="text-xs text-gray-500 font-medium mt-0.5">
                                    Signs: {stageGroup.signNames.join(", ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Date Column: formatted like "Oct 12, 2023" */}
                          <td className="border-b border-gray-100 px-4 py-4.5 font-medium text-gray-400 text-sm">
                            {stageGroup.latestDate
                              ? new Date(stageGroup.latestDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )
                              : "Recent"}
                          </td>

                          {/* Score Column: formatted like "75%" */}
                          <td className="border-b border-gray-100 px-4 py-4.5 font-extrabold text-gray-800 text-sm">
                            {stageGroup.avgScore}%
                          </td>

                          {/* Actions: Analytics button */}
                          <td className="border-b border-gray-100 px-4 py-4.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStage({
                                  stageId: stageGroup.stageId || stageGroup.stageNum,
                                  title: stageGroup.title,
                                  relativeStageNum: stageGroup.relativeStageNum,
                                  attemptNumber: stageGroup.attemptNumber,
                                });
                                setIsAnalyticsOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#FF8A00] border border-orange-200 hover:bg-[#FF8A00] hover:text-white transition-all shadow-2xs cursor-pointer"
                            >
                              <span>Analytics</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {Math.ceil(stageGroupedAssignments.length / itemsPerPage) > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 px-2">
                  <span className="text-xs text-gray-500 font-medium">
                    Showing{" "}
                    <span className="font-bold text-gray-700">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-bold text-gray-700">
                      {Math.min(currentPage * itemsPerPage, stageGroupedAssignments.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-gray-700">{stageGroupedAssignments.length}</span> stages
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

                    {Array.from({ length: Math.ceil(stageGroupedAssignments.length / itemsPerPage) }).map((_, i) => {
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
                          Math.min(Math.ceil(stageGroupedAssignments.length / itemsPerPage), p + 1)
                        )
                      }
                      disabled={currentPage >= Math.ceil(stageGroupedAssignments.length / itemsPerPage)}
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
            <p className="text-center py-8 paragraph-2 text-(--ghost)">
              No evaluation sessions or assignments recorded yet for this
              student.
            </p>
          )}
        </div>
      </div>
      </section>

      {/* Unit Analytics Modal */}
      {id && (
        <UnitAnalyticsModal
          studentId={id}
          studentName={student.name}
          stageId={selectedStage.stageId}
          stageTitle={selectedStage.title}
          relativeStageNum={selectedStage.relativeStageNum}
          attemptNumber={selectedStage.attemptNumber}
          isOpen={isAnalyticsOpen}
          onClose={() => setIsAnalyticsOpen(false)}
        />
      )}
    </div>
  );
}
