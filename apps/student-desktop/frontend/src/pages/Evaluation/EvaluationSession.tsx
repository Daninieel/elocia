import { useState, useEffect, useRef } from 'react';
import './EvaluationSession.css';
import { getStageData, getStageNumber } from '../../data/curriculum';
import { saveScore, removeFocusDrillSign, completeFocusDrill, resolveMediaUrl } from '../../utils/api';
import { startEvaluationTour, stopCurrentTour } from '../../utils/activityTours';
import { requestCameraStream, stopMediaStream } from '../../utils/cameraManager';

const moveAwayMascot = '/images/Move away.png';
const thinkingHandshape = '/images/Tier handshape thinking.png';
const thinkingOrientation = '/images/tier palm-orientation thinking.png';
const thinkingLocation = '/images/tier location thinking.png';
const thinkingMovement = '/images/tier movement thinking.png';
const dialogueKeepGoing = '/images/Keep Going.png';
const dialogueGiveBest = '/images/Give your Best.png';
const tier4Popup = '/images/Pop up Tier 4.png';
const okayButton = '/images/Okay Button.png';
const backButtonImg = '/images/Back Button.png';
const star1 = '/images/1 star.png';
const star2 = '/images/2 star.png';
const star3 = '/images/3 star.png';
const star4 = '/images/4 star.png';
const star5 = '/images/5 star.png';
const confettiImg = '/images/Confetti.png';
const amazingMascot = '/images/Amazing.png';

import type { Section, StageItem } from '../../data/curriculum';

interface EvaluationSessionProps {
  stageId: number | null;
  dynamicCurriculum?: Section[] | null;
  isPracticeMode?: boolean;
  focusDrillSigns?: string[] | null;
  onExit: () => void;
  onComplete: (stageId: number) => void;
  onNavigate?: (view: 'navigation' | 'setup' | 'evaluation' | 'profile' | 'help' | 'settings' | 'achievements' | 'practice') => void;
}

interface ScoreSet {
  handshape: number;
  palmOrientation: number;
  location: number;
  movement: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface LandmarksData {
  hand: Point3D[];
  right_hand?: Point3D[] | null;
  left_hand?: Point3D[] | null;
  pose: {
    nose: Point3D;
    leftShoulder: Point3D;
    rightShoulder: Point3D;
  };
  scores: ScoreSet;
  frames: number;
}

const passScores: ScoreSet = { handshape: 88, palmOrientation: 92, location: 90, movement: 85 };
const failScores: ScoreSet = { handshape: 35, palmOrientation: 65, location: 80, movement: 95 };

const getStarImage = (score: number): string => {
  if (score >= 90) return star5;
  if (score >= 75) return star4;
  if (score >= 60) return star3;
  if (score >= 40) return star2;
  return star1;
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export default function EvaluationSession({ stageId, dynamicCurriculum, isPracticeMode = false, focusDrillSigns = null, onExit, onComplete, onNavigate }: EvaluationSessionProps) {
  const currentStageId = stageId ?? 1;
  const stageData = getStageData(currentStageId, dynamicCurriculum);
  const rawItems = stageData?.items || [];

  const KNOWN_SIGN_IDS: Record<string, number> = {
    "1": 101, "2": 102, "3": 103, "4": 104, "5": 105,
    "6": 106, "7": 107, "8": 108, "9": 109, "10": 110,
    "11": 121, "12": 122, "13": 123, "14": 124, "15": 125,
    "16": 126, "17": 127, "18": 128, "19": 129, "20": 130,
    "a": 170, "b": 171, "c": 113, "d": 114, "e": 115,
    "f": 116, "g": 117, "h": 118, "i": 119, "j": 120,
    "brown": 140, "green": 175, "grey": 176, "gray": 176,
    "orange": 143, "pink": 144, "purple": 145, "red": 146,
    "violet": 147, "white": 148, "yellow": 149, "black": 172, "blue": 173,
    "apple": 150, "avocado": 151, "banana": 152, "cherry": 153, "coconut": 154,
    "grapes": 155, "lemon": 156, "mango": 157, "melon": 158, "papaya": 160,
    "pineapple": 161, "strawberry": 162, "watermelon": 163,
    "bear": 131, "cat": 133,
    "circle": 178, "diamond": 179, "heart": 180, "oval": 181, "rectangle": 182, "square": 183,
  };

  // Helper to map known standard baseline signs if not in currently loaded stage
  const getFallbackGlobalId = (name: string): number => {
    const clean = name.trim().toLowerCase();
    if (KNOWN_SIGN_IDS[clean]) return KNOWN_SIGN_IDS[clean];
    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 10) return 100 + num; // 1->101, 5->105
      if (num >= 11 && num <= 20) return 110 + num; // 11->121, 16->126
      return num;
    }
    if (clean.length === 1 && clean >= 'a' && clean <= 'j') {
      return 111 + (clean.charCodeAt(0) - 97); // a->111, b->112, etc.
    }
    return 101;
  };

  // If focus drill is active, prioritize exactly the requested signs!
  let activeItems: StageItem[] = [];
  if (focusDrillSigns && focusDrillSigns.length > 0) {
    // 1. Look in the current stage items
    const fromStage = rawItems.filter(it => 
      focusDrillSigns.some(s => s.toLowerCase() === it.name.toLowerCase() || String(it.globalId) === s)
    );

    // 2. Look across all stages in dynamicCurriculum
    const allCurriculumItems: StageItem[] = [];
    if (dynamicCurriculum) {
      for (const sec of dynamicCurriculum) {
        for (const un of sec.units) {
          for (const st of un.stages) {
            allCurriculumItems.push(...st.items);
          }
        }
      }
    }
    const fromAll = allCurriculumItems.filter(it =>
      focusDrillSigns.some(s => s.toLowerCase() === it.name.toLowerCase() || String(it.globalId) === s)
    );

    // Combine or construct exact StageItem for every requested sign
    const resolved: StageItem[] = [];
    const seen = new Set<string>();

    for (const reqSign of focusDrillSigns) {
      const match = fromStage.find(it => it.name.toLowerCase() === reqSign.toLowerCase() || String(it.globalId) === reqSign)
        || fromAll.find(it => it.name.toLowerCase() === reqSign.toLowerCase() || String(it.globalId) === reqSign);

      if (match && !seen.has(match.name)) {
        seen.add(match.name);
        resolved.push(match);
      } else if (!seen.has(reqSign)) {
        seen.add(reqSign);
        const gId = getFallbackGlobalId(reqSign);
        resolved.push({
          globalId: gId,
          name: reqSign,
          videoUrl: `/videos/${gId}.mp4`,
          photoUrl: `/thumbnails/${gId}.png`
        });
      }
    }

    activeItems = resolved.length > 0 ? resolved : rawItems;
  } else {
    activeItems = rawItems.length > 0 ? rawItems : [{ globalId: 101, name: "1" }];
  }

  const totalQuestions = activeItems.length;

  const [questionIndex, setQuestionIndex] = useState(0);
  const currentItem = activeItems[questionIndex] || { globalId: 101, name: "1" };
  const [photoFailed, setPhotoFailed] = useState<boolean>(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [questionIndex, currentItem?.globalId, currentItem?.name]);

  const [currentTier, setCurrentTier] = useState<1 | 2 | 3 | 4>(1);
  const [failCount, setFailCount] = useState<number>(0);
  const [scores, setScores] = useState<ScoreSet>(failScores); // Start with failing so UI isn't passed
  const latestScoresRef = useRef<ScoreSet>(failScores);
  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const isEvaluatingRef = useRef<boolean>(false);

  // Auto-grading state (hands-free dynamic motion capture for SPED)
  const [autoState, setAutoState] = useState<'idle' | 'ready' | 'signing' | 'grading' | 'cooldown' | 'passed'>('idle');
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoStateRef = useRef(autoState);
  const holdStartRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const consecutiveMissRef = useRef<number>(0);
  const hasPassedRef = useRef<boolean>(false);

  // Auto-launch Guided Feature Tour every time an activity/stage opens
  useEffect(() => {
    startEvaluationTour();
    return () => {
      stopCurrentTour();
    };
  }, [stageId]);

  // Diagnostic Mode State & Refs
  const [diagOn, setDiagOn] = useState<boolean>(false);
  const [, setDiagData] = useState<{ scores: ScoreSet, frames: number } | null>(null);
  const diagRef = useRef(diagOn);
  const diagHandRef = useRef<HTMLSpanElement>(null);
  const diagPalmRef = useRef<HTMLSpanElement>(null);
  const diagLocRef = useRef<HTMLSpanElement>(null);
  const diagFramesRef = useRef<HTMLSpanElement>(null);
  const landmarksRef = useRef<LandmarksData | null>(null);
  const trailRef = useRef<{ x: number, y: number, a: number }[]>([]);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const currentItemRef = useRef(currentItem);
  const currentTierRef = useRef(currentTier);
  const failCountRef = useRef(failCount);
  const isPracticeModeRef = useRef(isPracticeMode);

  useEffect(() => {
    currentItemRef.current = currentItem;
    if (diagOn && wsRef.current?.readyState === WebSocket.OPEN && currentItem?.globalId) {
      wsRef.current.send(JSON.stringify({
        action: 'start_diagnostic',
        stageId: currentItem.globalId,
        stageName: currentItem.name,
        activityType: isPracticeModeRef.current ? 'practice' : 'evaluation'
      }));
    }
  }, [currentItem, diagOn]);

  useEffect(() => {
    currentTierRef.current = currentTier;
  }, [currentTier]);

  useEffect(() => {
    failCountRef.current = failCount;
  }, [failCount]);

  useEffect(() => {
    isPracticeModeRef.current = isPracticeMode;
  }, [isPracticeMode]);

  // Sync state to ref so setInterval can access latest value without re-triggering useEffect
  useEffect(() => {
    isEvaluatingRef.current = isEvaluating;
  }, [isEvaluating]);

  useEffect(() => {
    autoStateRef.current = autoState;
  }, [autoState]);

  useEffect(() => {
    diagRef.current = diagOn;
  }, [diagOn]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const [isCameraDisconnected, setIsCameraDisconnected] = useState<boolean>(false);

  const stopCameraTracks = () => {
    stopMediaStream(streamRef.current, videoRef.current);
    streamRef.current = null;
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function enableCamera() {
      try {
        setIsCameraDisconnected(false);
        stream = await requestCameraStream({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, min: 24 }
          },
          audio: false,
        }, () => cancelled);

        if (cancelled || !stream) {
          if (stream) stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Listen for track disconnect / unplug event
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            console.warn('[CAMERA] Video track ended unexpectedly (unplugged or disabled).');
            setIsCameraDisconnected(true);
          };
        }
      } catch (err) {
        console.error('Webcam access failed:', err);
        if (!cancelled) {
          setIsCameraDisconnected(true);
        }
      }
    }
    enableCamera();

    // Setup WebSocket
    const ws = new WebSocket('ws://127.0.0.1:8001/ws/evaluate');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'error' || data.error) {
          setIsEvaluating(false);
          setIsRecording(false);
          setAutoState('idle');
          autoStateRef.current = 'idle';
          setHoldProgress(0);
          holdStartRef.current = null;
          setErrorMessage(data.error || "Could not evaluate sign. Please check camera or ask teacher.");
          return;
        }

        if (data.action === 'result') {
          setErrorMessage(null);
          setScores(data.scores);
          latestScoresRef.current = data.scores;
          setHasEvaluated(true);
          setIsEvaluating(false);

          const overall = data.overall;

          // Multi-parameter passing standard per Thesis Manuscript (pp. 70, 80, 99):
          // Both overall composite score >= 60.0 AND all four phonological parameters >= 60.0 required to pass.
          const hasFailedParameter =
            data.scores.handshape < 60 ||
            data.scores.palmOrientation < 60 ||
            data.scores.location < 60 ||
            data.scores.movement < 60;

          const isPassed = overall >= 60 && !hasFailedParameter;

          if (!isPassed) {
            setFailCount(prev => {
              const newCount = prev + 1;
              if (newCount >= 4) setCurrentTier(4);
              else if (newCount >= 3) setCurrentTier(3);
              else if (newCount >= 2) setCurrentTier(2);
              else setCurrentTier(1);
              return newCount;
            });
            hasPassedRef.current = false;
            setAutoState('cooldown');
            autoStateRef.current = 'cooldown';
            setHoldProgress(0);
            holdStartRef.current = null;
            setCooldownRemaining(3);

            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
            let rem = 3;
            cooldownTimerRef.current = window.setInterval(() => {
              rem -= 1;
              setCooldownRemaining(rem);
              if (rem <= 0) {
                if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
                if (!hasPassedRef.current) {
                  setAutoState('idle');
                  autoStateRef.current = 'idle';
                }
              }
            }, 1000);
          } else {
            // Pass!
            setFailCount(0);
            setCurrentTier(1);
            hasPassedRef.current = true;
            setAutoState('passed');
            autoStateRef.current = 'passed';
            setHoldProgress(0);
            holdStartRef.current = null;
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          }

          // Save score to database with max 50 XP for proper learn signing
          const student = JSON.parse(localStorage.getItem('elocia_current_student') || '{}');
          const xpEarned = isPassed ? Math.min(50, Math.round((overall / 100) * 50)) : 0;

          // Track highest parameters in localStorage for achievements
          try {
            const curH = parseFloat(localStorage.getItem('elocia_highest_h') || '0');
            if (data.scores.handshape > curH) localStorage.setItem('elocia_highest_h', data.scores.handshape.toString());

            const curP = parseFloat(localStorage.getItem('elocia_highest_p') || '0');
            if (data.scores.palmOrientation > curP) localStorage.setItem('elocia_highest_p', data.scores.palmOrientation.toString());

            const curL = parseFloat(localStorage.getItem('elocia_highest_l') || '0');
            if (data.scores.location > curL) localStorage.setItem('elocia_highest_l', data.scores.location.toString());

            const curM = parseFloat(localStorage.getItem('elocia_highest_m') || '0');
            if (data.scores.movement > curM) localStorage.setItem('elocia_highest_m', data.scores.movement.toString());

            if (isPassed) {
              const day = new Date().getDay();
              if (day === 0 || day === 6) {
                localStorage.setItem('elocia_weekend_practiced', 'true');
              }
            }
          } catch (e) {
            console.warn('Could not update evaluation parameters localStorage:', e);
          }

          // If in practice / focus drill mode and the sign is passed, remove it from active focus drill!
          if (isPassed && currentItemRef.current?.name) {
            const sid = student.id || 'all';
            removeFocusDrillSign(sid, currentItemRef.current.name, currentStageId);
            try {
              const finishedSigns = JSON.parse(localStorage.getItem('elocia_finished_drills') || '[]');
              if (!finishedSigns.includes(currentItemRef.current.name)) {
                finishedSigns.push(currentItemRef.current.name);
                localStorage.setItem('elocia_finished_drills', JSON.stringify(finishedSigns));
              }
            } catch (err) {
              console.warn('Failed to update elocia_finished_drills:', err);
            }
          }

          // Save score to database (awards XP in Learn mode; updates streak in both Learn and Practice mode when passed)
          saveScore({
            student_id: student.id,
            activity_type: isPracticeModeRef.current ? 'practice' : 'evaluation',
            stage_id: currentStageId,
            sign_id: currentItemRef.current?.globalId ?? 1,
            attempt_number: failCountRef.current + 1,
            tier_level: currentTierRef.current,
            score_handshape: data.scores.handshape,
            score_palm_orientation: data.scores.palmOrientation,
            score_location: data.scores.location,
            score_movement: data.scores.movement,
            score_overall: overall,
            passed: isPassed,
            xp_earned: isPracticeModeRef.current ? 0 : xpEarned,
          });
        } else if (data.action === 'landmarks' || data.action === 'hand_status') {
          isSending = false;
          if (fallbackTimeout) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
          }

          if (!isEvaluatingRef.current && !cancelled) {
            if (rafNextFrame) cancelAnimationFrame(rafNextFrame);
            rafNextFrame = requestAnimationFrame(() => {
              sendNextFrame();
            });
          }

          if (data.action === 'landmarks') {
            landmarksRef.current = data;
            // Direct DOM update eliminates full-component React re-renders on every frame (30 FPS smooth!)
            if (diagFramesRef.current) diagFramesRef.current.textContent = String(data.frames ?? 0);
            if (diagHandRef.current) {
              diagHandRef.current.textContent = String(data.scores?.handshape ?? 0);
              diagHandRef.current.className = `diag-stat-value ${(data.scores?.handshape ?? 0) >= 60 ? 'diag-good' : 'diag-bad'}`;
            }
            if (diagPalmRef.current) {
              diagPalmRef.current.textContent = String(data.scores?.palmOrientation ?? 0);
              diagPalmRef.current.className = `diag-stat-value ${(data.scores?.palmOrientation ?? 0) >= 60 ? 'diag-good' : 'diag-bad'}`;
            }
            if (diagLocRef.current) {
              diagLocRef.current.textContent = String(data.scores?.location ?? 0);
              diagLocRef.current.className = `diag-stat-value ${(data.scores?.location ?? 0) >= 60 ? 'diag-good' : 'diag-bad'}`;
            }
          } else if (data.action === 'hand_status') {
            if (data.frames !== undefined && diagFramesRef.current) {
              diagFramesRef.current.textContent = String(data.frames);
            }
            if (data.pose && data.hand) {
              landmarksRef.current = {
                hand: data.hand,
                right_hand: data.right_hand,
                left_hand: data.left_hand,
                pose: data.pose,
                scores: { handshape: 0, palmOrientation: 0, location: 0, movement: 0 },
                frames: data.frames ?? 0
              };
            }
          }
          // Update wrist trail
          if (data.hand && data.hand[0] && data.hand[0].x !== 0) {
            trailRef.current.push({ x: data.hand[0].x, y: data.hand[0].y, a: 1.0 });
            if (trailRef.current.length > 40) trailRef.current.shift();
          }

          // Automatic grading when system sees a hand:
          const isHandDetected = Boolean(
            data.hand_detected ||
            (data.hand && data.hand[0] && data.hand[0].x !== 0)
          );

          if (hasPassedRef.current || autoStateRef.current === 'grading' || autoStateRef.current === 'cooldown' || autoStateRef.current === 'passed') {
            return;
          }

          // Active signing window runs on wall-clock time:
          // Completes reliably even if the student finishes early and lowers their hand to their lap
          if (autoStateRef.current === 'signing') {
            const elapsed = Date.now() - (holdStartRef.current || Date.now());
            const SIGN_DURATION = 2800; // 2.8 seconds active movement recording window
            const progress = Math.min(100, Math.round((elapsed / SIGN_DURATION) * 100));
            setHoldProgress((prev) => (Math.abs(prev - progress) >= 4 || progress === 100 || progress === 0 ? progress : prev));

            if (elapsed >= SIGN_DURATION) {
              setAutoState('grading');
              autoStateRef.current = 'grading';
              setIsRecording(false);
              setIsEvaluating(true);
              holdStartRef.current = null;

              const student = JSON.parse(localStorage.getItem('elocia_current_student') || '{}');
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  action: 'evaluate',
                  stageId: currentItemRef.current.globalId,
                  stageName: currentItemRef.current.name,
                  studentId: student.id || '',
                  studentName: student.name || 'Student',
                  attemptNumber: failCountRef.current + 1,
                  tierLevel: currentTierRef.current,
                  activityType: isPracticeModeRef.current ? 'practice' : 'evaluation'
                }));
              }
            }
          } else if (isHandDetected) {
            consecutiveMissRef.current = 0;
            if (autoStateRef.current === 'idle') {
              setAutoState('ready');
              autoStateRef.current = 'ready';
              holdStartRef.current = Date.now();
              setHoldProgress(0);
            } else if (autoStateRef.current === 'ready') {
              const elapsed = Date.now() - (holdStartRef.current || Date.now());
              const READY_DURATION = 1000; // 1s ready countdown
              const progress = Math.min(100, Math.round((elapsed / READY_DURATION) * 100));
              setHoldProgress((prev) => (Math.abs(prev - progress) >= 4 || progress === 100 || progress === 0 ? progress : prev));

              if (elapsed >= READY_DURATION) {
                // Transition into active dynamic signing window!
                setAutoState('signing');
                autoStateRef.current = 'signing';
                holdStartRef.current = Date.now();
                setHoldProgress(0);
                setIsRecording(true);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ action: 'clear' }));
                  if (diagFramesRef.current) diagFramesRef.current.textContent = '0';
                }
              }
            }
          } else {
            if (autoStateRef.current === 'ready') {
              consecutiveMissRef.current += 1;
              if (consecutiveMissRef.current >= 12) {
                setAutoState('idle');
                autoStateRef.current = 'idle';
                setHoldProgress(0);
                holdStartRef.current = null;
              }
            }
          }
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    let isSending = false;
    let fallbackTimeout: any | null = null;
    let heartbeat: any | null = null;
    let rafNextFrame: number | null = null;

    const canvas = canvasRef.current;
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const sendNextFrame = () => {
      if (
        cancelled ||
        isSending ||
        isEvaluatingRef.current ||
        !videoRef.current ||
        videoRef.current.videoWidth === 0
      ) {
        return;
      }
      const activeWs = wsRef.current;
      if (!activeWs || activeWs.readyState !== WebSocket.OPEN || activeWs.bufferedAmount > 0) {
        return;
      }

      if (ctx) {
        isSending = true;
        ctx.drawImage(videoRef.current, 0, 0, 480, 360);
        const base64Data = canvas.toDataURL('image/jpeg', 0.65);
        activeWs.send(JSON.stringify({ image: base64Data }));

        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        fallbackTimeout = setTimeout(() => {
          isSending = false;
        }, 250);
      }
    };

    // Adaptive frame heartbeat (safety net alongside reactive rAF)
    heartbeat = setInterval(() => {
      if (!isSending && !isEvaluatingRef.current) {
        sendNextFrame();
      }
    }, 40);

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (rafNextFrame) cancelAnimationFrame(rafNextFrame);
      stopCameraTracks();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(isRecording);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Diagnostic Render Loop
  useEffect(() => {
    let raf: number;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = overlayRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      if (!diagRef.current) return;

      const lm = landmarksRef.current;
      if (!lm || !lm.pose || !lm.hand) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 16px Quicksand';
        ctx.fillText('Waiting for skeleton...', 10, 24);
        return;
      }

      // X coordinate is NOT mirrored here because the canvas CSS uses transform: scaleX(-1)
      // to match the video. We draw raw coordinates, and CSS mirrors them both together.
      const X = (x: number) => x * w;
      const Y = (y: number) => y * h;

      // Draw Pose (Shoulders & Nose)
      const locOk = lm.scores.location >= 60;
      const bodyLineColor = locOk ? '#E02EE0' : '#E5484D'; // Purple / Magenta for good
      const bodyDotColor = locOk ? '#4A90E2' : '#8B0000'; // Blue for good
      const nose = lm.pose.nose;
      const ls = lm.pose.leftShoulder;
      const rs = lm.pose.rightShoulder;

      ctx.strokeStyle = bodyLineColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (ls && rs && ls.x !== 0 && rs.x !== 0) {
        ctx.beginPath();
        ctx.moveTo(X(ls.x), Y(ls.y));
        ctx.lineTo(X(rs.x), Y(rs.y));
        ctx.stroke();

        if (nose && nose.x !== 0) {
          ctx.beginPath();
          ctx.moveTo(X(nose.x), Y(nose.y));
          ctx.lineTo(X(ls.x), Y(ls.y));
          ctx.moveTo(X(nose.x), Y(nose.y));
          ctx.lineTo(X(rs.x), Y(rs.y));
          ctx.stroke();
          
          // Draw pose dots
          ctx.fillStyle = bodyDotColor;
          for (const p of [nose, ls, rs]) {
            ctx.beginPath();
            ctx.arc(X(p.x), Y(p.y), 6, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }

      // Draw Wrist Trail
      if (trailRef.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(X(trailRef.current[0].x), Y(trailRef.current[0].y));
        for (let i = 1; i < trailRef.current.length; i++) {
          const pt = trailRef.current[i];
          ctx.lineTo(X(pt.x), Y(pt.y));
          pt.a *= 0.95; // fade over time
        }
        ctx.strokeStyle = `rgba(245, 158, 11, 0.8)`; // Orange trail
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw Hand(s): Render both hands if student uses a two-handed sign
      const handOk = Math.min(lm.scores.handshape, lm.scores.palmOrientation) >= 60;
      const handLineColor = handOk ? '#39FF14' : '#E5484D'; // Bright green for good
      const handDotColor = handOk ? '#FF0000' : '#8B0000'; // Bright red dots for good

      const drawSingleHand = (handPoints: Point3D[]) => {
        if (!handPoints || !handPoints[0] || (handPoints[0].x === 0 && handPoints[0].y === 0)) return;
        ctx.strokeStyle = handLineColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (const [a, b] of HAND_CONNECTIONS) {
          const p1 = handPoints[a];
          const p2 = handPoints[b];
          if (p1 && p2) {
            ctx.moveTo(X(p1.x), Y(p1.y));
            ctx.lineTo(X(p2.x), Y(p2.y));
          }
        }
        ctx.stroke();

        ctx.fillStyle = handDotColor;
        for (const p of handPoints) {
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      };

      const hasRight = Boolean(lm.right_hand && lm.right_hand[0] && lm.right_hand[0].x !== 0);
      const hasLeft = Boolean(lm.left_hand && lm.left_hand[0] && lm.left_hand[0].x !== 0);

      if (hasRight || hasLeft) {
        if (hasRight && lm.right_hand) drawSingleHand(lm.right_hand);
        if (hasLeft && lm.left_hand) drawSingleHand(lm.left_hand);
      } else if (lm.hand && lm.hand[0] && lm.hand[0].x !== 0) {
        // Fallback to primary hand
        drawSingleHand(lm.hand);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleDiagnostic = () => {
    const next = !diagOn;
    setDiagOn(next);
    if (next) {
      trailRef.current = [];
      wsRef.current?.send(JSON.stringify({
        action: 'start_diagnostic',
        stageId: currentItem.globalId,
        stageName: currentItem.name,
        activityType: isPracticeModeRef.current ? 'practice' : 'evaluation'
      }));
    } else {
      wsRef.current?.send(JSON.stringify({ action: 'stop_diagnostic' }));
      setDiagData(null);
    }
  };

  const triggerEvaluation = () => {
    setIsRecording(true);
    // Tell backend to clear previous frames
    if (diagFramesRef.current) diagFramesRef.current.textContent = '0';
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'clear' }));
    }

    // Give the student 3 seconds to perform the sign while frames are sent
    setTimeout(() => {
      setIsRecording(false);
      setIsEvaluating(true);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const student = JSON.parse(localStorage.getItem('elocia_current_student') || '{}');
        wsRef.current.send(JSON.stringify({
          action: 'evaluate',
          stageId: currentItem.globalId,
          stageName: currentItem.name,
          studentId: student.id || '',
          studentName: student.name || 'Student',
          attemptNumber: failCountRef.current + 1,
          tierLevel: currentTierRef.current,
          activityType: isPracticeModeRef.current ? 'practice' : 'evaluation'
        }));
      }
    }, 3000);
  };

  const handleTier4PassAndFlag = () => {
    // Tier 4 Pass and Flag:
    // Mark sign as completed with tier 4 flag so learner is never blocked or frustrated,
    // and record in backend so stage progression advances while teachers can see the flag.
    const student = JSON.parse(localStorage.getItem('elocia_current_student') || '{}');
    const signName = currentItemRef.current?.name;
    const signGlobalId = currentItemRef.current?.globalId ?? 1;

    // Use authentic raw AI scores from latest evaluation attempt (no artificial 60% clamping)
    const currentScores = latestScoresRef.current || scores;
    const rawHandshape = Math.round(currentScores.handshape ?? 0);
    const rawPalm = Math.round(currentScores.palmOrientation ?? 0);
    const rawLocation = Math.round(currentScores.location ?? 0);
    const rawMovement = Math.round(currentScores.movement ?? 0);
    const rawOverall = Math.round(
      ((rawHandshape + rawPalm + rawLocation + rawMovement) / 4) * 100
    ) / 100;

    saveScore({
      student_id: student.id,
      activity_type: isPracticeModeRef.current ? 'practice' : 'evaluation',
      stage_id: currentStageId,
      sign_id: signGlobalId,
      attempt_number: Math.max(failCountRef.current, 4),
      tier_level: 4,
      score_handshape: rawHandshape,
      score_palm_orientation: rawPalm,
      score_location: rawLocation,
      score_movement: rawMovement,
      score_overall: rawOverall,
      passed: true,
      xp_earned: isPracticeModeRef.current ? 0 : 25, // Award partial XP for Tier 4 compassionate pass
    });

    // Add to focus drill list in localStorage so teacher and drill practice know it was flagged
    if (signName) {
      try {
        const storedFlags = JSON.parse(localStorage.getItem('elocia_focus_drill_signs') || '[]');
        if (!storedFlags.includes(signName)) {
          storedFlags.push(signName);
          localStorage.setItem('elocia_focus_drill_signs', JSON.stringify(storedFlags));
        }
      } catch (err) {
        console.warn('Failed to update flagged focus drill signs:', err);
      }
    }

    // Now advance to the next sign or stage completion
    handleNext();
  };

  const handleNext = () => {
    if (questionIndex < totalQuestions - 1) {
      setQuestionIndex(prev => prev + 1);
      setCurrentTier(1);
      setFailCount(0);
      setScores(failScores); // Reset scores so it's not instantly passed
      setHasEvaluated(false);
      hasPassedRef.current = false;
      setAutoState('idle');
      autoStateRef.current = 'idle';
      setHoldProgress(0);
      holdStartRef.current = null;
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    } else {
      stopCameraTracks();
      if (isPracticeModeRef.current || (focusDrillSigns && focusDrillSigns.length > 0)) {
        try {
          const student = JSON.parse(localStorage.getItem('elocia_current_student') || '{}');
          completeFocusDrill(student.id || 'all', currentStageId, focusDrillSigns || []);
        } catch {
          completeFocusDrill('all', currentStageId, focusDrillSigns || []);
        }
      }
      onComplete(currentStageId);
    }
  };

  const getGradeLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Great';
    if (score >= 60) return 'Good';
    return 'Keep Trying';
  };

  const parameters = [
    { name: 'Handshape',       cssClass: 'param-handshape',   mascot: thinkingHandshape,   score: scores.handshape },
    { name: 'Palm Orientation', cssClass: 'param-orientation',  mascot: thinkingOrientation, score: scores.palmOrientation },
    { name: 'Location',        cssClass: 'param-location',     mascot: thinkingLocation,    score: scores.location },
    { name: 'Movement',        cssClass: 'param-movement',     mascot: thinkingMovement,    score: scores.movement },
  ];

  const showFeedback = currentTier >= 2;

  const getDialogueImage = () => {
    if (currentTier === 1) return dialogueKeepGoing;
    return dialogueGiveBest;
  };

  const getLowestParameter = () => {
    const params = [
      { name: 'Handshape', score: scores.handshape },
      { name: 'Palm Orientation', score: scores.palmOrientation },
      { name: 'Location', score: scores.location },
      { name: 'Movement', score: scores.movement },
    ];
    let lowest = params[0];
    for (let i = 1; i < params.length; i++) {
      if (params[i].score < lowest.score) {
        lowest = params[i];
      }
    }
    return lowest;
  };

  const getTier2FeedbackMessage = () => {
    const lowest = getLowestParameter();
    if (lowest.name === 'Handshape') return "Check your fingers!\nMake sure the shape matches.";
    if (lowest.name === 'Palm Orientation') return "Turn your hand!\nCheck which way your palm faces.";
    if (lowest.name === 'Location') return "Move your hand!\nMake sure it's in the right spot.";
    if (lowest.name === 'Movement') return "Check your motion!\nFollow the exact path.";
    return "Give it your best!";
  };

  // Dev helpers for quickly previewing tiers — callable from the browser console:
  // forceTier1() ... forceTier4()
  const forceTier1 = () => { setCurrentTier(1); setScores(passScores); };
  const forceTier2 = () => { setCurrentTier(2); setScores(failScores); };
  const forceTier3 = () => { setCurrentTier(3); setScores(failScores); };
  const forceTier4 = () => { setCurrentTier(4); setScores(failScores); };
  Object.assign(window, { forceTier1, forceTier2, forceTier3, forceTier4 });

  const overallScore = (scores.handshape + scores.palmOrientation + scores.location + scores.movement) / 4;
  const allParametersPassed =
    scores.handshape >= 60 &&
    scores.palmOrientation >= 60 &&
    scores.location >= 60 &&
    scores.movement >= 60;
    
  // Passing condition requires BOTH a passing average AND no failing parameters
  const hasPassed = hasEvaluated && overallScore >= 60 && allParametersPassed && currentTier !== 4;

  return (
    <div className="evaluation-layout-1920">
      {hasPassed && (
        <img src={confettiImg} alt="Confetti" className="global-confetti-overlay" />
      )}

      <header className="eval-header-bar">
        <button className="eval-back-btn" onClick={(e) => { e.preventDefault(); stopCameraTracks(); onExit(); }} type="button" aria-label="Back">
          <img src={backButtonImg} alt="Back" />
        </button>

        <div className="eval-title-block">
          <div className="eval-main-title">
            {isPracticeMode && <span style={{ background: '#F59E0B', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', marginRight: '8px', verticalAlign: 'middle', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Practice Mode</span>}
            Stage {getStageNumber(currentStageId, dynamicCurriculum)}: {stageData?.title}
          </div>
          <div className="eval-progress-track">
            {Array.from({ length: totalQuestions }, (_, index) => (
              <div key={index} className={`eval-progress-pill ${index < questionIndex + 1 ? 'done' : ''}`} />
            ))}
          </div>
        </div>
        <div className="eval-header-right">
          <span className="eval-counter-text">{questionIndex + 1} of {totalQuestions}</span>
          <button 
            className="eval-tour-toggle" 
            type="button" 
            title="Start Activity Guide"
            onClick={() => startEvaluationTour()}
          >
            {"\u2753"} Guide
          </button>
          <button 
            className={`eval-diag-toggle ${diagOn ? 'active' : ''}`} 
            type="button" 
            title="Toggle Diagnostics"
            onClick={toggleDiagnostic}
          >
            {"\uD83D\uDD2C"}
          </button>
          <button className="eval-settings-btn" type="button" aria-label="Settings" onClick={() => { stopCameraTracks(); sessionStorage.setItem('scrollToBug', 'true'); onNavigate?.('settings'); }}>{"\u2699\uFE0F"}</button>
        </div>
      </header>

      {!isPracticeMode && currentTier === 4 && (
        <div className="eval-tier4-overlay">
          <div className="tier4-modal">
            <div className="tier4-popup-wrap">
              <img src={tier4Popup} alt="Pass and Flag" className="tier4-popup-img" />
              <button onClick={handleTier4PassAndFlag} className="tier4-ok-btn" type="button" aria-label="OK">
                <img src={okayButton} alt="OK" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="eval-main-row">
        <section className="eval-left-col">
          <div className="eval-instruction-card">
            <span className="eval-instruction-tag">Target Sign</span>
            <h2 className="eval-instruction-text">
              Make the sign for <span className="eval-instruction-highlight">{currentItem.name}</span>! ✨
            </h2>
          </div>

          <div className="eval-camera-wrapper">
            <div className={`eval-camera-card eval-camera-card--${autoState}`} style={{ position: 'relative' }}>
              <div className="eval-live-badge">
                <span className={`eval-live-dot ${isCameraDisconnected ? 'eval-live-dot--offline' : ''}`} />
                {isCameraDisconnected ? 'CAMERA OFF' : 'LIVE FEED'}
              </div>
              <video ref={videoRef} autoPlay playsInline muted className="eval-webcam-stream" />
              <canvas ref={overlayRef} className="eval-overlay-canvas" />
              <div className="eval-camera-tier-tag">Tier {currentTier}</div>

              {/* Camera Disconnect Warning Guard */}
              {isCameraDisconnected && (
                <div className="eval-camera-disconnect-overlay">
                  <div className="eval-camera-disconnect-card">
                    <span className="eval-camera-disconnect-icon">📷⚠️</span>
                    <h3 className="eval-camera-disconnect-title">Camera Disconnected!</h3>
                    <p className="eval-camera-disconnect-text">
                      Please check if your camera is plugged in or turned on. Ask your teacher or parent for help! 🐵
                    </p>
                    <button
                      type="button"
                      className="eval-camera-reconnect-btn"
                      onClick={() => {
                        setIsCameraDisconnected(false);
                        stopMediaStream(streamRef.current, videoRef.current);
                        requestCameraStream({
                          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 24 } },
                          audio: false,
                        })
                          .then((stream) => {
                            if (!stream) {
                              setIsCameraDisconnected(true);
                              return;
                            }
                            streamRef.current = stream;
                            if (videoRef.current) {
                              videoRef.current.srcObject = stream;
                            }
                            const track = stream.getVideoTracks()[0];
                            if (track) {
                              track.onended = () => setIsCameraDisconnected(true);
                            }
                          })
                          .catch(() => setIsCameraDisconnected(true));
                      }}
                    >
                      🔄 Reconnect Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Real-time automatic grading HUD - Child-friendly, playful for Grade 1-3 */}
              {!hasPassed && (
                <div className={`eval-grading-hud hud-${autoState}`}>
                  {autoState === 'idle' && (
                    <div className="hud-badge hud-idle-badge">
                      <span className="hud-icon pulse-hand">✋</span>
                      <div className="hud-text-group">
                        <span className="hud-main-text">Show your hand to begin!</span>
                        <span className="hud-sub-text">Hold it up high so the camera can see!</span>
                      </div>
                    </div>
                  )}

                  {autoState === 'ready' && (
                    <div className="hud-badge hud-ready-badge">
                      <span className="hud-icon pulse-target">🎯</span>
                      <div className="hud-text-group">
                        <span className="hud-main-text">Get Ready!</span>
                        <span className="hud-sub-text">Starting in 1... 🎬</span>
                      </div>
                    </div>
                  )}

                  {autoState === 'signing' && (
                    <div className="hud-badge hud-signing-badge">
                      <div className="hud-countdown-ring">
                        <svg viewBox="0 0 36 36" className="circular-chart">
                          <path className="circle-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path className="circle circle-signing"
                            strokeDasharray={`${holdProgress}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="countdown-number">
                          {Math.max(1, Math.ceil((100 - holdProgress) / 35))}
                        </span>
                      </div>
                      <div className="hud-text-group">
                        <span className="hud-main-text">🎬 Sign Now! Move your hand!</span>
                        <span className="hud-sub-text">Perform the sign or trace the shape... ✨</span>
                      </div>
                    </div>
                  )}

                  {autoState === 'grading' && (
                    <div className="hud-badge hud-grading-badge">
                      <span className="hud-icon rotating-star">✨</span>
                      <div className="hud-text-group">
                        <span className="hud-main-text">Checking your sign!</span>
                        <span className="hud-sub-text">Looking at your fingers and palm... 🔍</span>
                      </div>
                    </div>
                  )}

                  {autoState === 'cooldown' && (
                    <div className="hud-badge hud-cooldown-badge">
                      <span className="hud-icon">⏱️</span>
                      <div className="hud-text-group">
                        <span className="hud-main-text">Try again in {cooldownRemaining}s!</span>
                        <span className="hud-sub-text">Shake your hands and get ready!</span>
                      </div>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="hud-error-banner">
                      <span>⚠️ {errorMessage}</span>
                    </div>
                  )}
                </div>
              )}

              {diagOn && (
                <div className="eval-diag-panel">
                  <div className="diag-stat">
                    <span ref={diagHandRef} className="diag-stat-value diag-bad">--</span>
                    <span className="diag-stat-label">Hand</span>
                  </div>
                  <div className="diag-stat">
                    <span ref={diagPalmRef} className="diag-stat-value diag-bad">--</span>
                    <span className="diag-stat-label">Palm</span>
                  </div>
                  <div className="diag-stat">
                    <span ref={diagLocRef} className="diag-stat-value diag-bad">--</span>
                    <span className="diag-stat-label">Loc</span>
                  </div>
                  <div className="diag-stat">
                    <span ref={diagFramesRef} className="diag-stat-value" style={{ color: '#F59E0B' }}>0</span>
                    <span className="diag-stat-label">Frames</span>
                  </div>
                  <button
                    className="eval-dev-btn"
                    type="button"
                    onClick={triggerEvaluation}
                    disabled={isEvaluating}
                    style={{ margin: 0, padding: '4px 10px', background: '#334155', color: '#fff', border: '1px solid #64748b', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🔬 Dev Grade
                  </button>
                </div>
              )}
            </div>

            {hasPassed && (
              <div className="eval-success-controls">
                <div className="correct-mascot-container">
                  <img src={amazingMascot} alt="Amazing!" className="correct-mascot-img" />
                </div>
                <button className="eval-next-btn" type="button" onClick={handleNext}>
                  Next →
                </button>
              </div>
            )}

          </div>
        </section>

        <section className="eval-right-col-container">
          <div className="eval-visual-aid-card eval-number-card">
            {photoFailed ? (
              <div className="eval-visual-aid-fallback">
                <span className="eval-visual-aid-fallback-icon">🎯</span>
                <span className="eval-visual-aid-fallback-text">{currentItem.name}</span>
                <span className="eval-visual-aid-hint">Sign Target</span>
              </div>
            ) : (
              <div className="eval-visual-aid-wrapper">
                <img 
                  key={`photo-${currentItem.globalId}-${currentItem.name}`}
                  src={
                    (currentItem as any)?.photoUrl 
                      ? (resolveMediaUrl((currentItem as any).photoUrl) || undefined) 
                      : `/thumbnails/${currentItem.globalId}.png`
                  }
                  alt={currentItem.name}
                  className="eval-visual-aid-img"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.dataset.triedLocalId) {
                      target.dataset.triedLocalId = 'true';
                      target.src = `/thumbnails/${currentItem.globalId}.png`;
                    } else if (!target.dataset.triedName) {
                      target.dataset.triedName = 'true';
                      target.src = `/thumbnails/${currentItem.name}.png`;
                    } else if (!target.dataset.triedThumbId) {
                      target.dataset.triedThumbId = 'true';
                      target.src = `/thumbnails/thumb_${currentItem.globalId}.png`;
                    } else if (!target.dataset.triedThumbName) {
                      target.dataset.triedThumbName = 'true';
                      target.src = `/thumbnails/thumb_${currentItem.name}.png`;
                    } else {
                      setPhotoFailed(true);
                    }
                  }}
                />
                <div className="eval-visual-aid-badge">
                  <span className="eval-visual-aid-badge-label">Target:</span>
                  <span className="eval-visual-aid-badge-name">{currentItem.name}</span>
                </div>
              </div>
            )}
          </div>

          <div className="eval-mascot-feedback-card">
            {isPracticeMode || (focusDrillSigns && focusDrillSigns.length > 0) || currentTier === 3 ? (
              <div className="eval-tier3-panel">
                <span className="eval-tier3-badge" style={isPracticeMode ? { background: '#FF8A00', color: '#ffffff' } : undefined}>
                  {isPracticeMode ? 'Teacher Demo (Focus Drill)' : 'Teacher Demo'}
                </span>
                <div className="eval-teacher-video-box" style={{ overflow: 'hidden', position: 'relative', borderRadius: '12px', background: '#000000', minHeight: '220px' }}>
                  <span className="eval-watch-pill" style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
                    {isPracticeMode ? 'Follow teacher to practice!' : 'Watch carefully!'}
                  </span>
                  <video
                    key={`teacher-video-${currentItem.globalId}-${currentItem.name}`}
                    src={resolveMediaUrl(currentItem.videoUrl) || `/videos/${currentItem.globalId}.mp4`}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000000' }}
                    onError={(e) => {
                      const v = e.currentTarget;
                      if (!v.dataset.triedId && currentItem.globalId) {
                        v.dataset.triedId = 'true';
                        v.src = `/videos/${currentItem.globalId}.mp4`;
                        v.play().catch(() => {});
                      } else if (!v.dataset.triedName && currentItem.name) {
                        v.dataset.triedName = 'true';
                        v.src = `/videos/${currentItem.name.toLowerCase()}.mp4`;
                        v.play().catch(() => {});
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                {currentTier === 2 && hasEvaluated ? (
                  <div className="eval-css-speech-bubble">
                    {getTier2FeedbackMessage()}
                  </div>
                ) : (
                  <img src={getDialogueImage()} alt="Mascot dialogue" className="eval-dialogue-img" />
                )}
                <div className="eval-mascot-wrap">
                  <img src={moveAwayMascot} alt="Learning Mascot" className="eval-feedback-mascot-img" />
                </div>
              </>
            )}
          </div>

          {!isPracticeMode && (
            <div className="eval-parameters-grid">
              {parameters.map((param) => {
                const needsWork = param.score < 60;
                const label = getGradeLabel(param.score);
                const starImg = getStarImage(param.score);
                return (
                  <div key={param.name} className={`eval-param-card ${param.cssClass} ${needsWork ? 'needs-work' : ''} ${showFeedback ? 'show-feedback' : 'hide-feedback'}`}>
                    <div className="eval-param-title">{param.name}</div>
                    <img src={param.mascot} alt={`${param.name} mascot`} className="eval-param-mascot" />
                    <div className={`eval-param-label ${needsWork ? 'label-warn' : 'label-good'}`}>{label}</div>
                    <div className="eval-param-stars">
                      <img src={starImg} alt={`${label} stars`} className="param-star-icon" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isPracticeMode && (
            <div className="eval-practice-helper-box" style={{
              marginTop: '16px',
              padding: '16px 20px',
              background: '#FFFBEB',
              border: '2px dashed #F59E0B',
              borderRadius: '20px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#B45309', display: 'block' }}>
                🎯 Focus Drill: Practice Mode
              </span>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', fontWeight: 600, color: '#92400E' }}>
                No grades or pressure here! Try the sign as many times as you need. When you get it right, it will automatically clear from your practice list! ✨
              </p>
            </div>
          )}
        </section>
      </main>

    </div>
  );
}
