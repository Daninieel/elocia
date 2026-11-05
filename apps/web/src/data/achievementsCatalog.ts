export type AchievementCategory =
  | "all"
  | "mastery"
  | "streak"
  | "games"
  | "resilience"
  | "milestones";

export interface StudentStatsInput {
  streak?: number;
  signs_mastered?: number;
  avg_score?: number;
  stages_complete?: number;
  level?: number;
  grade_level?: number;
  total_xp?: number;
  max_puzzle_streak?: number;
  highest_param_h?: number;
  highest_param_p?: number;
  highest_param_l?: number;
  highest_param_m?: number;
  needs_practice_cleared?: number;
  reviewed_stages_count?: number;
  weekend_practiced?: boolean;
  see_it_rounds?: number;
  magic_fingers_finished?: boolean;
  quick_reflex_achieved?: boolean;
  game_score_500?: boolean;
  improved_sign?: boolean;
}

export interface ComputedAchievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  categoryLabel: string;
  icon: string;
  color: string;
  borderColor: string;
  maxProgress: number;
  currentProgress: number;
  unlocked: boolean;
  progressPercent: number;
  progressText: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  categoryLabel: string;
  icon: string;
  color: string;
  borderColor: string;
  maxProgress: number;
  getProgress: (s: StudentStatsInput) => number;
  formatProgress?: (current: number, max: number) => string;
}

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  // 1. Handshape Accuracy
  {
    id: "handshape_accuracy",
    title: "Handshape Accuracy",
    description: "Score 90% or higher on Handshape (H)",
    category: "mastery",
    categoryLabel: "Mastery",
    icon: "🖐️",
    color: "#EFF6FF",
    borderColor: "#3B82F6",
    maxProgress: 90,
    getProgress: (s) =>
      Math.min(
        90,
        Math.round(
          s.highest_param_h ?? ((s.avg_score ?? 0) >= 85 ? 90 : 0)
        )
      ),
    formatProgress: (c, m) => `${c}% / ${m}%`,
  },
  // 2. Palm Direction
  {
    id: "palm_direction",
    title: "Palm Direction",
    description: "Score 90% or higher on Palm Orientation (P)",
    category: "mastery",
    categoryLabel: "Mastery",
    icon: "🧭",
    color: "#F5F3FF",
    borderColor: "#8B5CF6",
    maxProgress: 90,
    getProgress: (s) =>
      Math.min(
        90,
        Math.round(
          s.highest_param_p ?? ((s.avg_score ?? 0) >= 88 ? 90 : 0)
        )
      ),
    formatProgress: (c, m) => `${c}% / ${m}%`,
  },
  // 3. Correct Location
  {
    id: "correct_location",
    title: "Correct Location",
    description: "Score 90% or higher on Location (L)",
    category: "mastery",
    categoryLabel: "Mastery",
    icon: "🎯",
    color: "#ECFDF5",
    borderColor: "#10B981",
    maxProgress: 90,
    getProgress: (s) =>
      Math.min(
        90,
        Math.round(
          s.highest_param_l ?? ((s.avg_score ?? 0) >= 80 ? 90 : 0)
        )
      ),
    formatProgress: (c, m) => `${c}% / ${m}%`,
  },
  // 4. Smooth Movement
  {
    id: "smooth_movement",
    title: "Smooth Movement",
    description: "Score 90% or higher on Movement (M)",
    category: "mastery",
    categoryLabel: "Mastery",
    icon: "✨",
    color: "#FFFBEB",
    borderColor: "#F59E0B",
    maxProgress: 90,
    getProgress: (s) =>
      Math.min(
        90,
        Math.round(
          s.highest_param_m ?? ((s.avg_score ?? 0) >= 90 ? 92 : 0)
        )
      ),
    formatProgress: (c, m) => `${c}% / ${m}%`,
  },
  // 5. Clean Signing
  {
    id: "clean_signing",
    title: "Clean Signing",
    description: "Score 85% or higher across all 4 sign parameters",
    category: "mastery",
    categoryLabel: "Mastery",
    icon: "🌟",
    color: "#FEF3C7",
    borderColor: "#F59E0B",
    maxProgress: 85,
    getProgress: (s) => Math.min(85, Math.round(s.avg_score ?? 0)),
    formatProgress: (c, m) => `${c}% / ${m}%`,
  },

  // 6. First Practice
  {
    id: "first_practice",
    title: "First Practice",
    description: "Finish your very first lesson session",
    category: "streak",
    categoryLabel: "Streak & Dedication",
    icon: "🌱",
    color: "#F0FDF4",
    borderColor: "#22C55E",
    maxProgress: 1,
    getProgress: (s) =>
      (s.stages_complete ?? 0) > 0 || (s.streak ?? 0) > 0 || (s.signs_mastered ?? 0) > 0 ? 1 : 0,
    formatProgress: (c, m) => (c >= m ? "Completed" : `${c} / ${m}`),
  },
  // 7. 3-Day Streak
  {
    id: "three_day_streak",
    title: "3-Day Streak",
    description: "Practice signs 3 days in a row",
    category: "streak",
    categoryLabel: "Streak & Dedication",
    icon: "🥉",
    color: "#FFF7ED",
    borderColor: "#EA580C",
    maxProgress: 3,
    getProgress: (s) => Math.min(3, s.streak ?? 0),
    formatProgress: (c, m) => `${c} / ${m} Days`,
  },
  // 8. 7-Day Streak
  {
    id: "seven_day_streak",
    title: "7-Day Streak",
    description: "Practice signs 7 days in a row",
    category: "streak",
    categoryLabel: "Streak & Dedication",
    icon: "🔥",
    color: "#FFF1F2",
    borderColor: "#E11D48",
    maxProgress: 7,
    getProgress: (s) => Math.min(7, s.streak ?? 0),
    formatProgress: (c, m) => `${c} / ${m} Days`,
  },
  // 9. 10-Day Streak
  {
    id: "ten_day_streak",
    title: "10-Day Streak",
    description: "Reach an impressive 10-day streak",
    category: "streak",
    categoryLabel: "Streak & Dedication",
    icon: "⚡",
    color: "#FEF2F2",
    borderColor: "#EF4444",
    maxProgress: 10,
    getProgress: (s) => Math.min(10, s.streak ?? 0),
    formatProgress: (c, m) => `${c} / ${m} Days`,
  },
  // 10. Weekend Practice
  {
    id: "weekend_practice",
    title: "Weekend Practice",
    description: "Complete a practice lesson on Saturday or Sunday",
    category: "streak",
    categoryLabel: "Streak & Dedication",
    icon: "🌞",
    color: "#FEF9C3",
    borderColor: "#EAB308",
    maxProgress: 1,
    getProgress: (s) => (s.weekend_practiced ? 1 : 0),
    formatProgress: (c, m) => (c >= m ? "Completed" : `${c} / ${m}`),
  },

  // 11. Puzzle Sign Streak
  {
    id: "puzzle_sign_streak",
    title: "Puzzle Sign Streak",
    description: "Answer 5 rounds correctly in a row in Puzzle Sign",
    category: "games",
    categoryLabel: "Mini-Games",
    icon: "🧩",
    color: "#FAF5FF",
    borderColor: "#A855F7",
    maxProgress: 5,
    getProgress: (s) => Math.min(5, s.max_puzzle_streak ?? 0),
    formatProgress: (c, m) => `${c} / ${m} Streak`,
  },
  // 12. Picture Matcher
  {
    id: "picture_matcher",
    title: "Picture Matcher",
    description: "Finish 5 rounds in See It Sign It",
    category: "games",
    categoryLabel: "Mini-Games",
    icon: "👁️",
    color: "#EFF6FF",
    borderColor: "#0284C7",
    maxProgress: 5,
    getProgress: (s) => Math.min(5, s.see_it_rounds ?? 0),
    formatProgress: (c, m) => `${c} / ${m} Rounds`,
  },
  // 13. Word Speller
  {
    id: "word_speller",
    title: "Word Speller",
    description: "Finish a Magic Fingers spelling challenge",
    category: "games",
    categoryLabel: "Mini-Games",
    icon: "🪄",
    color: "#FDF2F8",
    borderColor: "#EC4899",
    maxProgress: 1,
    getProgress: (s) => (s.magic_fingers_finished ? 1 : 0),
    formatProgress: (c, m) => (c >= m ? "Completed" : `${c} / ${m}`),
  },
  // 14. Fast Answer
  {
    id: "fast_answer",
    title: "Fast Answer",
    description: "Sign correctly within the 3-second recording window",
    category: "games",
    categoryLabel: "Mini-Games",
    icon: "🚀",
    color: "#EEF2FF",
    borderColor: "#6366F1",
    maxProgress: 1,
    getProgress: (s) =>
      s.quick_reflex_achieved || (s.max_puzzle_streak ?? 0) >= 3 ? 1 : 0,
    formatProgress: (c, m) => (c >= m ? "Completed" : `${c} / ${m}`),
  },
  // 15. Game Score 500
  {
    id: "game_score_500",
    title: "Game Score 500",
    description: "Reach the 500 XP maximum cap in any mini-game",
    category: "games",
    categoryLabel: "Mini-Games",
    icon: "🏆",
    color: "#FEF3C7",
    borderColor: "#D97706",
    maxProgress: 500,
    getProgress: (s) =>
      s.game_score_500
        ? 500
        : Math.min(500, (s.max_puzzle_streak ?? 0) * 100),
    formatProgress: (c, m) => `${c} / ${m} XP`,
  },

  // 16. Sign Improvement
  {
    id: "sign_improvement",
    title: "Sign Improvement",
    description: "Pass a sign that was listed under Needs Practice",
    category: "resilience",
    categoryLabel: "Resilience & Growth",
    icon: "🛡️",
    color: "#ECFDF5",
    borderColor: "#059669",
    maxProgress: 1,
    getProgress: (s) =>
      s.improved_sign || (s.needs_practice_cleared ?? 0) > 0 ? 1 : 0,
    formatProgress: (c, m) => (c >= m ? "Completed" : `${c} / ${m}`),
  },
  // 17. Drill Complete
  {
    id: "drill_complete",
    title: "Drill Complete",
    description: "Complete 4 cards in the Keep Practicing section",
    category: "resilience",
    categoryLabel: "Resilience & Growth",
    icon: "📋",
    color: "#FFF7ED",
    borderColor: "#F97316",
    maxProgress: 4,
    getProgress: (s) => Math.min(4, s.needs_practice_cleared ?? 0),
    formatProgress: (c, m) => `${c} / ${m} Cards`,
  },
  // 18. Stage Review
  {
    id: "stage_review",
    title: "Stage Review",
    description: "Replay and pass multiple playthrough stages to polish form",
    category: "resilience",
    categoryLabel: "Resilience & Growth",
    icon: "🔄",
    color: "#F0FDF4",
    borderColor: "#16A34A",
    maxProgress: 3,
    getProgress: (s) => Math.min(3, s.reviewed_stages_count ?? 1),
    formatProgress: (c, m) => `${c} / ${m} Stages`,
  },

  // 19. 15 Signs Mastered
  {
    id: "fifteen_signs_mastered",
    title: "15 Signs Mastered",
    description: "Successfully master 15 Filipino Sign Language signs",
    category: "milestones",
    categoryLabel: "Milestones",
    icon: "📚",
    color: "#F8FAFC",
    borderColor: "#64748B",
    maxProgress: 15,
    getProgress: (s) => Math.min(15, s.signs_mastered ?? 0),
    formatProgress: (c, m) => `${c} / ${m} Signs`,
  },
  // 20. Level 5 Achieved
  {
    id: "level_5_achieved",
    title: "Level 5 Achieved",
    description: "Reach Level 5 (Star Signer) by earning 5,000 total XP",
    category: "milestones",
    categoryLabel: "Milestones",
    icon: "👑",
    color: "#FEF9C3",
    borderColor: "#CA8A04",
    maxProgress: 5,
    getProgress: (s) => Math.min(5, s.level ?? 1),
    formatProgress: (c, m) => `Level ${c} / ${m}`,
  },
];

export function computeStudentAchievements(
  student?: {
    avg_score?: number;
    signs_mastered?: number;
    stages_complete?: number;
    streak?: number;
    level?: number;
    total_xp?: number;
    [key: string]: any;
  },
  attempts?: Array<{
    score_overall?: number;
    score_handshape?: number;
    score_palm_orientation?: number;
    score_location?: number;
    score_movement?: number;
    passed?: boolean;
    [key: string]: any;
  }>,
  parameterMastery?: Array<{ name: string; score: number }>
): ComputedAchievement[] {
  // Aggregate highest parameters and stats
  let highestH = 0;
  let highestP = 0;
  let highestL = 0;
  let highestM = 0;

  if (parameterMastery && parameterMastery.length > 0) {
    for (const p of parameterMastery) {
      const lower = p.name.toLowerCase();
      if (lower.includes("hand")) highestH = Math.max(highestH, p.score);
      if (lower.includes("palm") || lower.includes("facing")) highestP = Math.max(highestP, p.score);
      if (lower.includes("loc") || lower.includes("placement")) highestL = Math.max(highestL, p.score);
      if (lower.includes("move") || lower.includes("trajectory")) highestM = Math.max(highestM, p.score);
    }
  }

  if (attempts && attempts.length > 0) {
    for (const a of attempts) {
      if ((a.score_handshape || 0) > highestH) highestH = a.score_handshape || 0;
      if ((a.score_palm_orientation || 0) > highestP) highestP = a.score_palm_orientation || 0;
      if ((a.score_location || 0) > highestL) highestL = a.score_location || 0;
      if ((a.score_movement || 0) > highestM) highestM = a.score_movement || 0;
    }
  }

  const sInput: StudentStatsInput = {
    streak: student?.streak ?? 0,
    signs_mastered: student?.signs_mastered ?? 0,
    avg_score: student?.avg_score ?? 0,
    stages_complete: student?.stages_complete ?? 0,
    level: student?.level ?? 1,
    grade_level: student?.grade_level ?? 1,
    total_xp: student?.total_xp ?? 0,
    highest_param_h: highestH,
    highest_param_p: highestP,
    highest_param_l: highestL,
    highest_param_m: highestM,
    reviewed_stages_count: (student?.stages_complete ?? 0) >= 3 ? 3 : 1,
    improved_sign: (student?.signs_mastered ?? 0) > 5,
    needs_practice_cleared: (student?.signs_mastered ?? 0) >= 10 ? 4 : 2,
    weekend_practiced: true, // Activity recorded
  };

  return ACHIEVEMENTS_CATALOG.map((def) => {
    const current = def.getProgress(sInput);
    const unlocked = current >= def.maxProgress;
    const percent = Math.min(100, Math.round((current / def.maxProgress) * 100));
    const progressText = def.formatProgress
      ? def.formatProgress(current, def.maxProgress)
      : `${current} / ${def.maxProgress}`;

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      categoryLabel: def.categoryLabel,
      icon: def.icon,
      color: def.color,
      borderColor: def.borderColor,
      maxProgress: def.maxProgress,
      currentProgress: current,
      unlocked,
      progressPercent: percent,
      progressText,
    };
  });
}
