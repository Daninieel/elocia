export interface ParentStudent {
  id: string;
  student_id: string;
  name: string;
  student_code?: string | null;
  student_number?: number | null;
  grade_level: number;
  color: string;
  emoji: string;
  relationship: string;
  total_xp: number;
  level: number;
  streak: number;
  has_tier4_flag?: boolean;
}

export interface PracticeCardItem {
  sign: string;
  stage_id: number;
  section_label?: string;
  score: number;
  color?: string;
  reason?: string;
}

export interface ParentProgressSummary {
  student_id: string;
  student_name: string;
  level: number;
  streak: number;
  avg_score: number;
  total_practice_sessions: number;
  strengths: string[];
  areas_to_practice: string[];
  home_practice_recommendation: string;
}

export interface EvaluationAttemptItem {
  id: string;
  activity_type: string;
  stage_id?: number | null;
  stage_id_new?: number | null;
  sign_id?: number | null;
  sign_name?: string | null;
  stage_number?: number | null;
  relative_stage_number?: number | null;
  stage_title?: string | null;
  unit_number?: number | null;
  unit_title?: string | null;
  section_number?: number | null;
  section_title?: string | null;
  assignment_name?: string | null;
  score_overall: number;
  score_handshape: number;
  score_palm_orientation: number;
  score_location: number;
  score_movement: number;
  passed: boolean;
  tier_level?: number | null;
  created_at: string;
}

export interface ParameterMasteryItem {
  name: string;
  key: "handshape" | "palm_orientation" | "location" | "movement";
  value: number; // 0 to 100
}

export interface PerformanceTrendItem {
  weekIndex?: number;
  label: string;
  score: number;
  isCurrent?: boolean;
  isUpcoming?: boolean;
  dateRange?: string;
  parameters?: ParameterMasteryItem[];
  attemptsCount?: number;
  passedSignsCount?: number;
}

export interface StagePathItem {
  stageId?: number;
  stageNumber: number;
  title: string;
  subtitle?: string;
  status: "completed" | "current" | "locked";
  progressPercentage?: number;
}

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  iconType: "lightning" | "snake" | "medal" | "trophy";
  unlocked: boolean;
  color: "orange" | "green" | "gray";
}

