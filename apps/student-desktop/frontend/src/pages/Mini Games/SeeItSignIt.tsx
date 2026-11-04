import { useState, useRef, useEffect } from 'react';

import Sidebar from '../../components/Sidebar/Sidebar';
import CameraSetup from '../Setup/CameraSetup';
import MiniGameComplete from '../MiniGameComplete/MiniGameComplete';
import {
  fetchMiniGameConfigs,
  fetchMiniGameActivities,
  saveMiniGameScore,
  resolveMediaUrl,
  type MiniGameConfigItem
} from '../../utils/api';
import { requestCameraStream, stopMediaStream } from '../../utils/cameraManager';

import './SeeItSignIt.css';

import './Puzzle Sign.css';

import '../../pages/Evaluation/EvaluationSession.css';

import { startSeeItSignItTour, stopCurrentTour } from '../../utils/activityTours';



interface SeeItSignItProps {

  onNavigate: (view: 'navigation' | 'setup' | 'evaluation' | 'stageComplete' | 'profile' | 'help' | 'settings' | 'achievements' | 'practice' | 'puzzle-sign' | 'see-it-sign-it' | 'magic-fingers') => void;

}



const seeItSignItLogo = '/images/See it, Sign it!.png';

const wonderMascot = '/images/Wonder.png';

const amazingMascot = '/images/Amazing.png';

const backButtonImg = '/images/Back Button.png';

const confettiImg = '/images/Confetti.png';



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



const HAND_CONNECTIONS = [

  [0, 1], [1, 2], [2, 3], [3, 4],

  [0, 5], [5, 6], [6, 7], [7, 8],

  [5, 9], [9, 10], [10, 11], [11, 12],

  [9, 13], [13, 14], [14, 15], [15, 16],

  [13, 17], [17, 18], [18, 19], [19, 20],

  [0, 17]

];



interface SeeItSignItRound {

  image: string;

  item: string;

  targetSign: number | string;

  referenceVideoUrl?: string | null;

}



interface SeeItSignItGroup {

  id: number;

  title: string;

  rounds: SeeItSignItRound[];

}



const PASS_THRESHOLD = 60;



function getDesktopStudent() {

  try {

    const s = JSON.parse(localStorage.getItem('elocia_current_student') || '{}');

    return {

      id: s.id || s.student_code || '',

      name: s.name || s.username || 'Student'

    };

  } catch {

    return { id: '', name: 'Student' };

  }

}



export default function SeeItSignIt({ onNavigate }: SeeItSignItProps) {

  const [view, setView] = useState<'menu' | 'camera-check' | 'game' | 'results'>('menu');

  const [activityGroups, setActivityGroups] = useState<SeeItSignItGroup[]>([]);

  const [activeGroupId, setActiveGroupId] = useState<number>(1);

  const [searchQuery, setSearchQuery] = useState('');



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



  // Game state

  const [roundIndex, setRoundIndex] = useState(0);

  const [score, setScore] = useState(0);

  const [highScore, setHighScore] = useState(300);

  const [streak, setStreak] = useState(0);

  const [isEvaluating, setIsEvaluating] = useState(false);

  const [roundPassed, setRoundPassed] = useState(false);

  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [showDemoVideo, setShowDemoVideo] = useState(false);

  const [attempts, setAttempts] = useState(0);



  // Auto-evaluation engine state matching EvaluationSession

  type AutoState = 'idle' | 'ready' | 'signing' | 'grading' | 'cooldown' | 'passed';

  const [autoState, setAutoState] = useState<AutoState>('idle');

  const autoStateRef = useRef<AutoState>('idle');

  const holdStartRef = useRef<number | null>(null);

  const [holdProgress, setHoldProgress] = useState(0);

  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const cooldownTimerRef = useRef<number | null>(null);

  const consecutiveMissRef = useRef(0);

  const hasPassedRef = useRef(false);

  const [isCameraDisconnected, setIsCameraDisconnected] = useState<boolean>(false);



  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  const isEvaluatingRef = useRef(false);

  const recordingTimerRef = useRef<number | null>(null);

  const autoNextTimerRef = useRef<number | null>(null);



  // Fetch dynamic game configurations and items from the backend

  useEffect(() => {

    async function loadConfigs() {

      // 1. Try relational activities with items first

      const remoteActivities = await fetchMiniGameActivities('see_it_sign_it');

      if (remoteActivities && remoteActivities.length > 0) {

        const groups: SeeItSignItGroup[] = [];

        remoteActivities.forEach((act, actIdx) => {

          if (act.see_it_sign_it_items && act.see_it_sign_it_items.length > 0) {

            const rounds: SeeItSignItRound[] = act.see_it_sign_it_items.map((item) => {

              const signNum = parseInt(item.objective_answer, 10);

              const resolvedImage = resolveMediaUrl(item.objective_image_url) || `/images/${item.objective_answer}.png`;

              const resolvedVideo = resolveMediaUrl(item.reference_video_url);



              return {

                image: resolvedImage,

                item: item.objective_answer,

                targetSign: !isNaN(signNum) ? signNum : item.objective_answer,

                referenceVideoUrl: resolvedVideo,

              };

            });



            groups.push({

              id: actIdx + 1,

              title: act.title,

              rounds,

            });

          }

        });



        if (groups.length > 0) {

          setActivityGroups(groups);

          return;

        }

      }



      // 2. Fallback to basic configs

      const remoteConfigs = await fetchMiniGameConfigs('see_it_sign_it');

      if (remoteConfigs && remoteConfigs.length > 0) {

        const rounds: SeeItSignItRound[] = remoteConfigs.map((cfg: MiniGameConfigItem) => {

          const signNum = parseInt(cfg.target_sign || '1', 10);

          return {

            image: cfg.prompt_image || `/images/${cfg.target_sign || '1'}.png`,

            item: cfg.hint_text || cfg.title,

            targetSign: !isNaN(signNum) ? signNum : 1,

          };

        });

        setActivityGroups([{

          id: 1,

          title: 'See It Sign It Practice',

          rounds,

        }]);

      }

    }

    loadConfigs();

  }, []);



  const currentGroup = activityGroups.find(g => g.id === activeGroupId) || activityGroups[0] || { id: 0, title: 'No Activity', rounds: [] };

  const rounds = currentGroup.rounds || [];

  const totalRounds = rounds.length;

  const currentActivity = rounds[roundIndex] || rounds[0];



  // Filter activities for menu

  const filteredActivities = activityGroups.filter(grp => {

    return grp.title.toLowerCase().includes(searchQuery.toLowerCase()) || 

           `activity ${grp.id}`.includes(searchQuery.toLowerCase());

  });



  // Handle start activity

  const handleStartActivity = (id: number) => {

    setActiveGroupId(id);

    setRoundIndex(0);

    setScore(0);

    setStreak(0);

    setRoundPassed(false);

    setFeedbackError(null);

    setView('camera-check');

  };



  const streakRef = useRef(streak);

  const scoreRef = useRef(score);

  const currentActivityRef = useRef(currentActivity);

  const roundIndexRef = useRef(roundIndex);

  const totalRoundsRef = useRef(totalRounds);



  useEffect(() => { streakRef.current = streak; }, [streak]);

  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => { currentActivityRef.current = currentActivity; }, [currentActivity]);

  useEffect(() => { isEvaluatingRef.current = isEvaluating; }, [isEvaluating]);

  useEffect(() => { roundIndexRef.current = roundIndex; }, [roundIndex]);

  useEffect(() => { totalRoundsRef.current = totalRounds; }, [totalRounds]);



  useEffect(() => {

    diagRef.current = diagOn;

    if (diagOn && wsRef.current?.readyState === WebSocket.OPEN && currentActivity) {

      const stageNum = typeof currentActivity.targetSign === 'number' ? currentActivity.targetSign : 1;

      wsRef.current.send(JSON.stringify({ 

        action: 'start_diagnostic', 

        stageId: stageNum,

        activityType: 'see_it_sign_it'

      }));

    }

  }, [currentActivity, diagOn]);



  const toggleDiagnostic = () => {

    const next = !diagOn;

    setDiagOn(next);

    diagRef.current = next;

    if (next) {

      trailRef.current = [];

      if (wsRef.current?.readyState === WebSocket.OPEN && currentActivity) {

        const stageNum = typeof currentActivity.targetSign === 'number' ? currentActivity.targetSign : 1;

        wsRef.current.send(JSON.stringify({ 

          action: 'start_diagnostic', 

          stageId: stageNum,

          activityType: 'see_it_sign_it'

        }));

      }

    } else {

      if (wsRef.current?.readyState === WebSocket.OPEN) {

        wsRef.current.send(JSON.stringify({ action: 'stop_diagnostic' }));

      }

      setDiagData(null);

    }

  };



  const triggerDevEvaluation = () => {

    setIsEvaluating(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentActivity) {

      const stageNum = typeof currentActivity.targetSign === 'number' ? currentActivity.targetSign : 1;

      const stu = getDesktopStudent();

      wsRef.current.send(JSON.stringify({ 

        action: 'evaluate', 

        stageId: stageNum,

        stageName: currentActivity.item || `Sign ${stageNum}`,

        studentId: stu.id,

        studentName: stu.name,

        activityType: 'see_it_sign_it'

      }));

    }

  };



  // Diagnostic Canvas Render Loop

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



      const X = (x: number) => x * w;

      const Y = (y: number) => y * h;



      // Draw Pose (Shoulders & Nose)

      const locOk = lm.scores.location >= 60;

      const bodyLineColor = locOk ? '#E02EE0' : '#E5484D';

      const bodyDotColor = locOk ? '#4A90E2' : '#8B0000';

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

          pt.a *= 0.95;

        }

        ctx.strokeStyle = `rgba(245, 158, 11, 0.8)`;

        ctx.lineWidth = 3;

        ctx.stroke();

      }



      // Draw Hand(s): Render both hands if student uses a two-handed sign

      const handOk = Math.min(lm.scores.handshape, lm.scores.palmOrientation) >= 60;

      const handLineColor = handOk ? '#39FF14' : '#E5484D';

      const handDotColor = handOk ? '#FF0000' : '#8B0000';



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

        drawSingleHand(lm.hand);

      }

    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);

  }, []);



  useEffect(() => {

    if (view === 'game') {

      startSeeItSignItTour();

    }

    return () => {

      stopCurrentTour();

    };

  }, [view]);



  // Real Computer Vision WebSocket & Webcam streaming

  useEffect(() => {

    if (view !== 'game') return;



    let stream: MediaStream | null = null;

    let cancelled = false;



    async function enableCamera() {

      try {

        setIsCameraDisconnected(false);

        stream = await requestCameraStream({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 24 } },
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



        const videoTrack = stream.getVideoTracks()[0];

        if (videoTrack) {

          videoTrack.onended = () => {

            console.warn('[CAMERA] SeeItSignIt video track ended unexpectedly (unplugged or disabled).');

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



    const ws = new WebSocket('ws://127.0.0.1:8001/ws/evaluate');

    wsRef.current = ws;



    ws.onopen = () => {

      if (diagRef.current && currentActivityRef.current) {

        const curAct = currentActivityRef.current;

        const stageNum = typeof curAct.targetSign === 'number' ? curAct.targetSign : 1;

        ws.send(JSON.stringify({

          action: 'start_diagnostic',

          stageId: stageNum,

          activityType: 'see_it_sign_it'

        }));

      }

    };



    let isSending = false;
    let fallbackTimeout: any | null = null;
    let heartbeat: any | null = null;
    let rafNextFrame: number | null = null;

    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
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
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const base64Data = canvas.toDataURL('image/jpeg', 0.4);
        activeWs.send(JSON.stringify({ image: base64Data }));

        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        fallbackTimeout = setTimeout(() => {
          isSending = false;
        }, 250);
      }
    };

    ws.onmessage = (event) => {
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

      try {

        const data = JSON.parse(event.data);

        if (data.action === 'error' || data.error) {

          setIsEvaluating(false);

          setAutoState('idle');

          autoStateRef.current = 'idle';

          setHoldProgress(0);

          holdStartRef.current = null;

          setFeedbackError(data.error || "Sign baseline reference not found for this round.");

          return;

        }



        if (data.action === 'result') {

          setIsEvaluating(false);

          const scores = data.scores;

          const overall = data.overall;

          const passed =

            overall >= PASS_THRESHOLD &&

            scores.handshape >= PASS_THRESHOLD &&

            scores.palmOrientation >= PASS_THRESHOLD &&

            scores.location >= PASS_THRESHOLD &&

            scores.movement >= PASS_THRESHOLD;



          if (passed) {

            hasPassedRef.current = true;

            setAutoState('passed');

            autoStateRef.current = 'passed';

            setRoundPassed(true);

            setFeedbackError(null);

            const currentStreak = streakRef.current;

            const currentScore = scoreRef.current;

            const multiplier = 1 + (currentStreak * 0.2);

            const pointsEarned = Math.round(overall * multiplier);

            const newScore = currentScore + pointsEarned;

            setScore(newScore);

            setHighScore(prev => Math.max(prev, newScore));

            setStreak(prev => prev + 1);



            try {

              if (newScore >= 500) {

                localStorage.setItem('elocia_game_score_500', 'true');

              }

              const roundsDone = parseInt(localStorage.getItem('elocia_see_it_rounds') || '0', 10) + 1;

              localStorage.setItem('elocia_see_it_rounds', roundsDone.toString());

            } catch (err) {

              console.warn('Failed to save see-it-sign-it rounds:', err);

            }



            // Automatically advance to the next round after celebration (2.5s)

            if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);

            autoNextTimerRef.current = window.setTimeout(() => {

              handleNextRoundRef.current();

            }, 2500);

          } else {

            hasPassedRef.current = false;

            setRoundPassed(false);

            setAttempts(prev => prev + 1);

            setStreak(0); // V4.1 rule: Reset streak on incorrect answer

            setFeedbackError("Keep trying! Make sure your hand shape matches the sign.");

            setAutoState('cooldown');

            autoStateRef.current = 'cooldown';

            setHoldProgress(0);

            holdStartRef.current = null;

            setCooldownRemaining(2);



            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);

            let rem = 2;

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

          }

        } else if (data.action === 'landmarks' || data.action === 'hand_status') {

          if (data.action === 'landmarks') {

            landmarksRef.current = data;

            // Direct DOM update eliminates component re-renders (30 FPS smooth!)
            if (diagFramesRef.current) diagFramesRef.current.textContent = String(data.frames);
            if (diagHandRef.current) {
              diagHandRef.current.textContent = String(data.scores.handshape);
              diagHandRef.current.className = `diag-stat-value ${data.scores.handshape >= 60 ? 'diag-good' : 'diag-bad'}`;
            }
            if (diagPalmRef.current) {
              diagPalmRef.current.textContent = String(data.scores.palmOrientation);
              diagPalmRef.current.className = `diag-stat-value ${data.scores.palmOrientation >= 60 ? 'diag-good' : 'diag-bad'}`;
            }
            if (diagLocRef.current) {
              diagLocRef.current.textContent = String(data.scores.location);
              diagLocRef.current.className = `diag-stat-value ${data.scores.location >= 60 ? 'diag-good' : 'diag-bad'}`;
            }

          }

          // Update wrist trail

          if (data.hand && data.hand[0] && data.hand[0].x !== 0) {

            trailRef.current.push({ x: data.hand[0].x, y: data.hand[0].y, a: 1.0 });

            if (trailRef.current.length > 40) trailRef.current.shift();

          }



          // Automatic hand detection engine identical to Lesson Proper

          const isHandDetected = Boolean(

            data.hand_detected ||

            (data.hand && data.hand[0] && data.hand[0].x !== 0)

          );



          if (hasPassedRef.current || autoStateRef.current === 'grading' || autoStateRef.current === 'cooldown' || autoStateRef.current === 'passed') {

            return;

          }



          if (isHandDetected) {

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

                if (ws.readyState === WebSocket.OPEN) {

                  ws.send(JSON.stringify({ action: 'clear' }));
                  if (diagFramesRef.current) diagFramesRef.current.textContent = '0';

                }

              }

            } else if (autoStateRef.current === 'signing') {

              const elapsed = Date.now() - (holdStartRef.current || Date.now());

              const SIGN_DURATION = 2800; // 2.8 seconds active movement recording window

              const progress = Math.min(100, Math.round((elapsed / SIGN_DURATION) * 100));

              setHoldProgress((prev) => (Math.abs(prev - progress) >= 4 || progress === 100 || progress === 0 ? progress : prev));



              if (elapsed >= SIGN_DURATION) {

                setAutoState('grading');

                autoStateRef.current = 'grading';

                setIsEvaluating(true);

                holdStartRef.current = null;



                const curAct = currentActivityRef.current;

                if (ws.readyState === WebSocket.OPEN && curAct) {

                  const stageNum = typeof curAct.targetSign === 'number' ? curAct.targetSign : 1;

                  const stu = getDesktopStudent();

                  ws.send(JSON.stringify({ 

                    action: 'evaluate', 

                    stageId: stageNum,

                    stageName: curAct.item || `Sign ${stageNum}`,

                    studentId: stu.id,

                    studentName: stu.name,

                    activityType: 'see_it_sign_it'

                  }));

                }

              }

            }

          } else {

            if (autoStateRef.current === 'ready') {

              consecutiveMissRef.current += 1;

              if (consecutiveMissRef.current >= 3) {

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



    // Adaptive real-time frame heartbeat (acts as safety backup to reactive rAF)
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

      if (recordingTimerRef.current) {

        clearTimeout(recordingTimerRef.current);

        recordingTimerRef.current = null;

      }

      if (autoNextTimerRef.current) {

        clearTimeout(autoNextTimerRef.current);

        autoNextTimerRef.current = null;

      }

      cancelled = true;
      stopMediaStream(streamRef.current, videoRef.current);
      streamRef.current = null;

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {

        ws.close();

      }

      setIsEvaluating(false);

    };

  }, [view]);



  const handleNextRound = () => {

    if (autoNextTimerRef.current) {

      clearTimeout(autoNextTimerRef.current);

      autoNextTimerRef.current = null;

    }

    hasPassedRef.current = false;

    setAutoState('idle');

    autoStateRef.current = 'idle';

    setHoldProgress(0);

    holdStartRef.current = null;

    setAttempts(0);

    setShowDemoVideo(false);

    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);



    const currentIdx = roundIndexRef.current;

    const totalCount = totalRoundsRef.current;



    if (currentIdx < totalCount - 1) {

      setRoundIndex(prev => prev + 1);

      setRoundPassed(false);

      setFeedbackError(null);

    } else {

      // Game Complete - save score to backend (capped at 500 XP max for mini-games)

      const student = JSON.parse(localStorage.getItem('elocia_current_student') || '{}');

      const latestScore = scoreRef.current;

      const latestStreak = streakRef.current;



      if (student.id) {

        const finalXp = Math.min(500, latestScore);

        saveMiniGameScore({

          student_id: student.id,

          game_type: 'see_it_sign_it',

          score: finalXp,

          streak: latestStreak,

          rounds_completed: totalCount

        });

      }

      setView('results');

    }

  };



  const handleNextRoundRef = useRef(handleNextRound);

  useEffect(() => { handleNextRoundRef.current = handleNextRound; }, [handleNextRound]);



  const giveUpReveal = () => {

    setShowDemoVideo(true);

    setFeedbackError(null);

    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);

    autoNextTimerRef.current = window.setTimeout(() => {

      handleNextRoundRef.current();

    }, 3500);

  };



  // Menu Render

  const renderMenu = () => (

    <div className="sisi-layout">

      <Sidebar activeTab="practice" onNavigate={onNavigate} />

      <main className="sisi-main-menu">

        <div className="sisi-bg-watermark"></div>

        <div className="sisi-menu-content">

          <img src={seeItSignItLogo} alt="See it, Sign it!" className="sisi-logo" onError={(e) => {

            (e.target as HTMLElement).style.display = 'none';

          }} />



          <div className="sisi-activity-box">

            <div className="sisi-search-bar">

              <span className="search-icon">🔍</span>

              <input

                type="text"

                placeholder="Search activities"

                value={searchQuery}

                onChange={(e) => setSearchQuery(e.target.value)}

              />

            </div>



            <div className="sisi-activities">

              {filteredActivities.map((grp) => (

                <button

                  key={grp.id}

                  className="sisi-activity-btn"

                  onClick={() => handleStartActivity(grp.id)}

                >

                  <div className="sisi-activity-number">{grp.id}</div>

                  <div className="sisi-activity-text-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>

                    <span className="sisi-activity-text">{grp.title}</span>

                    <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 500 }}>

                      {grp.rounds.length} {grp.rounds.length === 1 ? 'Round' : 'Rounds'}

                    </span>

                  </div>

                  <span className="sisi-activity-arrow">→</span>

                </button>

              ))}

              {filteredActivities.length === 0 && (

                <div className="sisi-no-results">No activities found</div>

              )}

            </div>

          </div>



          <button className="sisi-back-btn" onClick={() => onNavigate('practice')}>

            &lt; Back to Practice

          </button>

        </div>

      </main>

    </div>

  );



  const renderGame = () => {

    const itemShown = currentActivity.item;

    const itemImage = currentActivity.image;



    return (

      <div className="evaluation-layout-1920">

        {roundPassed && (

          <img src={confettiImg} alt="Confetti" className="global-confetti-overlay" />

        )}



        <header className="eval-header-bar">

          <button className="eval-back-btn" onClick={() => { stopMediaStream(streamRef.current, videoRef.current); streamRef.current = null; setView('menu'); }} type="button" aria-label="Back">

            <img src={backButtonImg} alt="Back" />

          </button>

          

          <div className="eval-title-block">

            <div className="eval-main-title">

              Activity {activeGroupId} - {currentGroup.title}

            </div>

            <div className="eval-progress-track">

              {Array.from({ length: totalRounds }).map((_, index) => (

                <div key={index} className={`eval-progress-pill ${index <= roundIndex ? 'done' : ''}`} />

              ))}

            </div>

          </div>



          <div className="eval-header-right">

            <span className="eval-counter-text">{roundIndex + 1} of {totalRounds}</span>

            <button 

              className="eval-tour-toggle" 

              type="button" 

              title="Start Activity Guide"

              onClick={() => startSeeItSignItTour()}

            >

              {"\u2753"} Guide

            </button>

            <button 

              className={`eval-diag-toggle ${diagOn ? 'active' : ''}`} 

              type="button" 

              title="Toggle Diagnostics (Dev Mode)"

              onClick={toggleDiagnostic}

            >

              {"\uD83D\uDD2C"}

            </button>

            <button className="eval-settings-btn" type="button" aria-label="Settings" onClick={() => { 
              stopMediaStream(streamRef.current, videoRef.current);
              streamRef.current = null;
              sessionStorage.setItem('scrollToBug', 'true'); 
              onNavigate('settings'); 
            }}>{"\u2699\uFE0F"}</button>

          </div>

        </header>



        <main className="eval-main-row" style={{ backgroundImage: `url('/images/Grass.png')`, backgroundPosition: 'bottom', backgroundRepeat: 'no-repeat', backgroundSize: '100% 20%' }}>

          {/* Left Column */}

          <section className="eval-left-col">

            <div className="eval-instruction-card">

              <span className="eval-instruction-tag">Target Sign:</span>

              <h2 className="sisi-item-name">{itemShown}</h2>

            </div>



            <div className="eval-camera-wrapper">

              <div className={`eval-camera-card eval-camera-card--${autoState}`} style={{ position: 'relative' }}>

                <div className="eval-live-badge">

                  <span className={`eval-live-dot ${isCameraDisconnected ? 'eval-live-dot--offline' : ''}`} />

                  {isCameraDisconnected ? 'CAMERA OFF' : 'LIVE FEED'}

                </div>

                <video ref={videoRef} autoPlay playsInline muted className="eval-webcam-stream" />



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
                            .then((s) => {
                              if (!s) {
                                setIsCameraDisconnected(true);
                                return;
                              }
                              streamRef.current = s;
                              if (videoRef.current) {
                                videoRef.current.srcObject = s;
                              }
                              const track = s.getVideoTracks()[0];
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



                <div className="ps-crosshair">

                  <div className="ch-line ch-h"></div>

                  <div className="ch-line ch-v"></div>

                  <div className="ch-circle"></div>

                </div>



                {/* Real-time automatic grading HUD - Child-friendly, identical to Lesson Proper */}

                {!roundPassed && (

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

                          <span className="hud-main-text">🎬 Sign "{itemShown}" now!</span>

                          <span className="hud-sub-text">Move your hand clearly in frame... ✨</span>

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



                    {feedbackError && (

                      <div className="hud-error-banner">

                        <span>⚠️ {feedbackError}</span>

                      </div>

                    )}

                  </div>

                )}



                {/* Diagnostic Skeleton Canvas Overlay */}

                <canvas ref={overlayRef} className="eval-overlay-canvas" />



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

                      onClick={triggerDevEvaluation}

                      disabled={isEvaluating}

                      style={{ margin: 0, padding: '4px 10px', background: '#334155', color: '#fff', border: '1px solid #64748b', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}

                    >

                      🔬 Dev Grade

                    </button>

                  </div>

                )}

              </div>



              {/* Large Friendly Mascot sitting at bottom-left */}

              {!(roundPassed || showDemoVideo) && (

                <div className="mg-mascot-wrap">

                  <img 

                    src={wonderMascot} 

                    alt="Mascot" 

                    className="mg-mascot-img"

                  />

                </div>

              )}



              {/* Celebration Mascot on passing */}

              {(roundPassed || showDemoVideo) && (

                <div className="correct-mascot-container">

                  <img src={amazingMascot} alt="Amazing!" className="correct-mascot-img" />

                </div>

              )}



              {/* Floating Bottom Action Bar */}

              {attempts >= 3 && !roundPassed && (

                <div className="mg-bottom-actions">

                  <button className="ps-give-up-btn" type="button" onClick={giveUpReveal}>

                    💡 Show Answer

                  </button>

                </div>

              )}

            </div>

          </section>



          {/* Right Column */}

          <section className="eval-right-col-container sisi-right-col">

            <div className="sisi-puzzle-card sisi-image-card-container">

              {showDemoVideo && currentActivity.referenceVideoUrl ? (

                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>

                  <video

                    src={currentActivity.referenceVideoUrl}

                    controls

                    autoPlay

                    loop

                    className="max-h-full max-w-full rounded-2xl bg-black"

                    style={{ maxHeight: '220px', width: 'auto', borderRadius: '16px' }}

                  />

                  <button

                    type="button"

                    onClick={() => setShowDemoVideo(false)}

                    style={{

                      marginTop: '10px',

                      padding: '6px 14px',

                      borderRadius: '12px',

                      background: '#4B5563',

                      color: '#fff',

                      fontSize: '0.85rem',

                      fontWeight: '600',

                      cursor: 'pointer',

                      border: 'none',

                    }}

                  >

                    Back to Picture

                  </button>

                </div>

              ) : (

                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                  <img src={itemImage} alt={itemShown} className="sisi-target-image" onError={(e) => {

                      (e.target as HTMLElement).style.display = 'none';

                      e.currentTarget.parentElement!.innerHTML = '<span class="sisi-fallback-emoji">🖐️</span>';

                  }}/>

                </div>

              )}

            </div>

            

            <div className="sisi-score-card">

              <div className="sisi-score-row highest">

                <span className="score-label">Highest Score:</span>

                <span className="score-value">{highScore} XP</span>

              </div>

              <div className="sisi-score-row current">

                <span className="score-label">Score:</span>

                <span className="score-value">

                  {score} XP

                  {streak > 0 && <span style={{fontSize: '1.2rem', color: '#E85D04', marginLeft: '10px', background: '#FFD6A5', padding: '4px 10px', borderRadius: '12px', verticalAlign: 'middle'}}>🔥 {(1 + (streak * 0.2)).toFixed(1)}x Bonus Active</span>}

                </span>

              </div>

            </div>

          </section>



        </main>

      </div>

    );

  };



  // Results Render

  const renderResults = () => {

    const playedRounds = rounds.map(r => ({

      answerText: r.item

    }));



    return (

      <MiniGameComplete 

        score={score} 

        playedRounds={playedRounds} 

        onBackToPractice={() => onNavigate('practice')} 

        onNavigate={onNavigate} 

      />

    );

  };



  switch (view) {

    case 'menu': return renderMenu();

    case 'camera-check': return <CameraSetup onDone={() => setView('game')} onCancel={() => setView('menu')} />;

    case 'game': return renderGame();

    case 'results': return renderResults();

    default: return renderMenu();

  }

}

