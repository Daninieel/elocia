import React, { useState, useMemo } from "react";
import { X, Trophy, Sparkles, Check, Lock, Award, Flame, Zap, ShieldCheck } from "lucide-react";
import type {
  AchievementCategory,
  ComputedAchievement,
} from "@/data/achievementsCatalog";

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  gradeLevel?: number | string;
  level?: number;
  avgScore?: number;
  signsMastered?: number;
  stagesComplete?: number;
  streak?: number;
  achievements: ComputedAchievement[];
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  studentName,
  gradeLevel = 1,
  level = 1,
  avgScore = 0,
  signsMastered = 0,
  stagesComplete = 0,
  streak = 0,
  achievements,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unlocked" | "locked">("all");

  const unlockedCount = useMemo(
    () => achievements.filter((a) => a.unlocked).length,
    [achievements]
  );

  const filteredAchievements = useMemo(() => {
    return achievements.filter((a) => {
      // Category filter
      if (selectedCategory !== "all" && a.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter === "unlocked" && !a.unlocked) return false;
      if (statusFilter === "locked" && a.unlocked) return false;
      return true;
    });
  }, [achievements, selectedCategory, statusFilter]);

  if (!isOpen) return null;

  const categories: Array<{ id: AchievementCategory; label: string; icon: any }> = [
    { id: "all", label: "All Badges", icon: Sparkles },
    { id: "mastery", label: "Mastery", icon: Award },
    { id: "streak", label: "Streaks", icon: Flame },
    { id: "games", label: "Mini-Games", icon: Zap },
    { id: "resilience", label: "Resilience", icon: ShieldCheck },
    { id: "milestones", label: "Milestones", icon: Trophy },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border-4 border-orange-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30">
              <Trophy className="size-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-xs">
                  {studentName}&apos;s Achievements
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white text-orange-600 shadow-xs">
                  Grade {gradeLevel}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-orange-100 font-medium">
                Comprehensive Sign Language Milestones, Streaks & Mastery Badges
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer focus:outline-hidden"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick Stats Banner */}
        <div className="bg-orange-50/70 border-b border-orange-100 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-gray-700">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[11px]">Unlocked:</span>
              <span className="text-sm font-black text-emerald-600">
                {unlockedCount} / {achievements.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[11px]">Avg Score:</span>
              <span className="text-sm font-black text-gray-800">
                {typeof avgScore === "number" ? avgScore.toFixed(1) : avgScore}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[11px]">Signs Mastered:</span>
              <span className="text-sm font-black text-gray-800">{signsMastered}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[11px]">Stages:</span>
              <span className="text-sm font-black text-gray-800">{stagesComplete}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[11px]">Level:</span>
              <span className="text-sm font-black text-orange-600">{level}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[11px]">Streak:</span>
              <span className="text-sm font-black text-rose-600">{streak}</span>
            </div>
          </div>

          {/* Status Filter Toggle */}
          <div className="inline-flex rounded-xl bg-orange-100/70 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === "all"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({achievements.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("unlocked")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === "unlocked"
                  ? "bg-white text-emerald-600 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Unlocked ({unlockedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("locked")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === "locked"
                  ? "bg-white text-gray-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              In Progress ({achievements.length - unlockedCount})
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-100 overflow-x-auto flex items-center gap-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const count =
              cat.id === "all"
                ? achievements.length
                : achievements.filter((a) => a.category === cat.id).length;
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-gray-100/80 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-white/30 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Badges Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAchievements.map((badge) => {
              return (
                <div
                  key={badge.id}
                  className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                    badge.unlocked
                      ? "bg-white border-emerald-300 shadow-sm hover:shadow-md"
                      : "bg-gray-50/80 border-gray-200/80 opacity-80 hover:opacity-100"
                  }`}
                >
                  {/* Category Pill & Status Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: badge.color,
                        color: badge.borderColor,
                      }}
                    >
                      {badge.categoryLabel}
                    </span>

                    {badge.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check className="size-3 stroke-[3]" /> Unlocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Lock className="size-3" /> In Progress
                      </span>
                    )}
                  </div>

                  {/* Badge Icon & Information */}
                  <div className="flex items-start gap-3 my-2">
                    <div
                      className={`size-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border shadow-xs transition-transform ${
                        badge.unlocked
                          ? "bg-amber-50 border-amber-300 shadow-2xs"
                          : "bg-gray-100 border-gray-200 grayscale opacity-50"
                      }`}
                    >
                      {badge.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-gray-900 leading-snug truncate">
                        {badge.title}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {badge.description}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar & Counter */}
                  <div className="mt-3 pt-3 border-t border-gray-100/80">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 mb-1">
                      <span>Progress</span>
                      <span className={badge.unlocked ? "text-emerald-600 font-extrabold" : "text-gray-700"}>
                        {badge.progressText}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          badge.unlocked
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-orange-400 to-amber-500"
                        }`}
                        style={{ width: `${badge.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAchievements.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <Trophy className="size-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold">No achievements found in this filter.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium">
            Badges update dynamically as {studentName} completes evaluation sessions and games.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
