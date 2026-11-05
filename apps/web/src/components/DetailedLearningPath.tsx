import React from "react";
import { ChevronLeft, ChevronRight, Check, Lock } from "lucide-react";

export interface CurriculumStageItem {
  stageId?: number;
  stageNumber: number;
  title: string;
  subtitle?: string;
  status: "completed" | "current" | "locked";
  progressPercentage?: number;
}

export interface CurriculumSectionItem {
  id: number;
  title: string;
}

interface DetailedLearningPathProps {
  sections: CurriculumSectionItem[];
  activeSectionIndex: number;
  onSectionChange: (index: number) => void;
  stages: CurriculumStageItem[];
  onSelectStage?: (stageId: number, stageTitle: string, stageNumber: number) => void;
  completedStagesCount?: number;
  className?: string;
}

export const DetailedLearningPath: React.FC<DetailedLearningPathProps> = ({
  sections = [],
  activeSectionIndex = 0,
  onSectionChange,
  stages = [],
  onSelectStage,
  completedStagesCount,
  className = "",
}) => {
  const currentSection = sections[activeSectionIndex] || sections[0];
  const sectionTitle = currentSection?.title || `Section ${activeSectionIndex + 1}`;

  return (
    <div
      className={`bg-white rounded-3xl p-6 border-3 border-(--border) shadow-[0_6px_0_0_#BDC8D2] flex flex-col justify-between h-full ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        {/* Section selector with Left / Right arrows */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSectionChange(Math.max(0, activeSectionIndex - 1))}
            disabled={activeSectionIndex === 0}
            className="p-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
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
              onSectionChange(Math.min(sections.length - 1, activeSectionIndex + 1))
            }
            disabled={activeSectionIndex >= sections.length - 1}
            className="p-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Next Section"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-600">
            Learning Path Progress
          </span>
          {typeof completedStagesCount === "number" && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {completedStagesCount} Stages Completed
            </span>
          )}
        </div>
      </div>

      {/* Pure Curriculum Stages Flow */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-4 overflow-x-auto min-w-full flex-1">
        {stages.map((stage, idx) => {
          const isCompleted = stage.status === "completed";
          const isCurrent = stage.status === "current";

          return (
            <div
              key={stage.stageId || stage.stageNumber}
              className="flex items-center flex-1 min-w-[100px] last:flex-none"
            >
              {/* Stage Card */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectStage) {
                      onSelectStage(
                        stage.stageId ?? stage.stageNumber,
                        `${sectionTitle} • Stage ${stage.stageNumber} (${stage.subtitle})`,
                        stage.stageNumber
                      );
                    }
                  }}
                  className={`flex flex-col items-center justify-center w-24 h-32 rounded-2xl transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95 focus:outline-hidden ${
                    isCompleted
                      ? "bg-[#E6F9EE] border border-[#A7F3D0] text-[#059669] hover:border-[#059669]"
                      : isCurrent
                      ? "bg-white border-2 border-[#FF8A00] text-gray-800 shadow-md hover:shadow-lg"
                      : "bg-white border border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                  title={`${stage.subtitle} (${isCompleted ? "Completed" : isCurrent ? "Current stage" : "Locked"})`}
                >
                  <span className="text-[11px] font-bold tracking-wider uppercase opacity-80">
                    Stage
                  </span>
                  <span
                    className={`text-2xl font-extrabold my-1 ${
                      isCompleted
                        ? "text-[#059669]"
                        : isCurrent
                        ? "text-[#FF8A00]"
                        : "text-gray-400"
                    }`}
                  >
                    {stage.stageNumber}
                  </span>

                  {/* Status Icon / Progress Bar */}
                  {isCompleted ? (
                    <div className="size-6 rounded-full bg-[#10B981] text-white flex items-center justify-center shadow-2xs mt-1">
                      <Check className="size-4 stroke-[3]" />
                    </div>
                  ) : isCurrent ? (
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

                {/* Subtitle directly from pure curriculum title e.g. Numbers 1-5 */}
                <span className="text-[11px] font-semibold text-gray-500 mt-2 text-center max-w-[96px] leading-tight">
                  {stage.subtitle || `Stage ${stage.stageNumber}`}
                </span>
              </div>

              {/* Connecting line between stages */}
              {idx < stages.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 -mt-6 rounded-full ${
                    isCompleted ? "bg-[#10B981]" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
