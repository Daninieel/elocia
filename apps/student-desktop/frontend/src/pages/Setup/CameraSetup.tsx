import { useRef, useEffect, useState } from 'react';
import Navbar from '../../components/Sidebar/Sidebar';
import { requestCameraStream, stopMediaStream } from '../../utils/cameraManager';
import './CameraSetup.css';

const sunImg = '/images/Sun.png';
const cloud1Img = '/images/Cloud 1.png';
const cloud2Img = '/images/Cloud 2.png';
const cloud3Img = '/images/Cloud 3.png';
const cloud5Img = '/images/Cloud 5.png';
const cloud6Img = '/images/Cloud 6.png';
const grassImg = '/images/Grass.png';

const setupDialogueBubble = '/images/setup dialogue.png';
const tooFarDialogueBubble = '/images/too far dialogue.png';
const tooCloseDialogueBubble = '/images/too close dialogue.png';
const perfectDialogueBubble = '/images/perfect dialogue.png';

const preparingMonkey = '/images/preparing camera.png';
const moveAwayMonkey = '/images/Move away.png';
const moveCloserMonkey = '/images/Move closer.png';
const perfectMonkey = '/images/Perfect range camera.png';

interface CameraSetupProps {
  onDone: () => void;
  onCancel: () => void;
}

type SetupStep = 'setup' | 'not-detected' | 'too-close' | 'too-far' | 'perfect';

const LeftArrowIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
    <line x1="21" y1="12" x2="4" y2="12" />
    <polyline points="10 5 3 12 10 19" />
  </svg>
);

const RightArrowIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '8px' }}>
    <line x1="3" y1="12" x2="20" y2="12" />
    <polyline points="14 5 21 12 14 19" />
  </svg>
);

export default function CameraSetup({ onDone, onCancel }: CameraSetupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [step, setStep] = useState<SetupStep>('setup');
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const isCameraActive = step !== 'setup';

  useEffect(() => {
    let cancelled = false;

    if (isCameraActive) {
      async function enableCamera() {
        try {
          const stream = await requestCameraStream(
            { video: { width: 640, height: 480 }, audio: false },
            () => cancelled
          );

          if (cancelled || !stream) {
            if (stream) stopMediaStream(stream);
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('Webcam access failed:', err);
        }
      }
      enableCamera();
    } else {
      stopMediaStream(streamRef.current, videoRef.current);
      streamRef.current = null;
    }

    return () => {
      cancelled = true;
      stopMediaStream(streamRef.current, videoRef.current);
      streamRef.current = null;
    };
  }, [isCameraActive]);

  useEffect(() => {
    if (!isCameraActive) return;

    let cancelled = false;
    let retryTimer: number | null = null;
    let ws: WebSocket | null = null;

    function connectWs() {
      try {
        ws = new WebSocket('ws://127.0.0.1:8001/ws/camera-check');
        wsRef.current = ws;

        ws.onopen = () => {
          if (!cancelled) setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.status && !cancelled) {
              setStep((prev) => (prev === 'setup' ? prev : (data.status as SetupStep)));
            }
          } catch (err) {
            console.error('WebSocket parse error:', err);
          }
        };

        ws.onerror = () => {
          if (!cancelled) setWsConnected(false);
        };

        ws.onclose = () => {
          if (!cancelled) {
            setWsConnected(false);
            retryTimer = window.setTimeout(connectWs, 2000);
          }
        };
      } catch {
        if (!cancelled) {
          setWsConnected(false);
          retryTimer = window.setTimeout(connectWs, 2000);
        }
      }
    }

    connectWs();

    const interval = setInterval(() => {
      const activeWs = wsRef.current;
      if (
        activeWs &&
        activeWs.readyState === WebSocket.OPEN &&
        videoRef.current &&
        videoRef.current.videoWidth > 0
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvasRef.current = canvas;
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Data = canvas.toDataURL('image/jpeg', 0.5);
          activeWs.send(JSON.stringify({ image: base64Data }));
        }
      }
    }, 140);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
    };
  }, [isCameraActive]);

  const getDialogueBubble = () => {
    switch (step) {
      case 'not-detected': return tooFarDialogueBubble;
      case 'too-close':    return tooCloseDialogueBubble;
      case 'too-far':      return tooFarDialogueBubble;
      case 'perfect':      return perfectDialogueBubble;
      default:             return setupDialogueBubble;
    }
  };

  const getMascot = () => {
    switch (step) {
      case 'not-detected': return moveCloserMonkey;
      case 'too-close':    return moveAwayMonkey;
      case 'too-far':      return moveCloserMonkey;
      case 'perfect':      return perfectMonkey;
      default:             return preparingMonkey;
    }
  };

  const isNextActive = step === 'setup' || (step === 'perfect' && wsConnected);

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content-area">

        <div className="clouds-wrapper">
          <img src={sunImg} alt="" className="bg-decor sun" />
          <img src={cloud1Img} alt="" className="bg-decor cloud-1" />
          <img src={cloud2Img} alt="" className="bg-decor cloud-2" />
          <img src={cloud3Img} alt="" className="bg-decor cloud-3" />
          <img src={cloud5Img} alt="" className="bg-decor cloud-5" />
          <img src={cloud6Img} alt="" className="bg-decor cloud-6" />
        </div>

        <img src={grassImg} alt="" className="grass-strip" />

        <div className={`camera-setup-content-wrapper ${step === 'setup' ? 'setup-tips-wrapper' : ''}`}>
          {step === 'setup' ? (
            <div className="tips-card-box-large">
              <h3>Tips to get higher chances to perfectly passed</h3>
              <ul>
                <li><span style={{ color: '#FF662E' }}>●</span> Sit in a well-lit area so your gestures are clear.</li>
                <li><span style={{ color: '#2EABFF' }}>●</span> Make sure you have a clean, uncluttered background.</li>
                <li><span style={{ color: '#6DD62C' }}>●</span> Position yourself so your hands and upper body are fully visible.</li>
              </ul>
            </div>
          ) : (
            <div className="live-camera-feed-card">

              {!wsConnected ? (
                <div className="top-warning-tag" style={{ backgroundColor: '#EF4444', color: '#FFFFFF', fontWeight: 600 }}>
                  {"\u26A0\uFE0F"} Connecting to AI Vision Server (port 8001)... (Check Terminal 2)
                </div>
              ) : (
                <>
                  {step === 'not-detected' && (
                    <div className="top-warning-tag">{"\u26A0\uFE0F"} No person detected! Please step into the frame.</div>
                  )}
                  {step === 'too-close' && (
                    <div className="top-warning-tag">{"\u26A0\uFE0F"} You're too close! Please step back a bit.</div>
                  )}
                  {step === 'too-far' && (
                    <div className="top-warning-tag">{"\u26A0\uFE0F"} You're too far! Please come closer.</div>
                  )}
                  {step === 'perfect' && (
                    <div className="top-warning-tag tag-perfect">
                      {"\u2728"} Perfect distance! You're ready.
                    </div>
                  )}
                </>
              )}
              <div className="live-badge-tag">LIVE FEED</div>
              <video ref={videoRef} autoPlay playsInline muted className="actual-webcam-stream" />
              <div className="crosshair-guide" />
            </div>
          )}
        </div>

        <div className={`stage-mascot-column mascot-step-${step}`}>
          <img
            src={getDialogueBubble()}
            alt=""
            className={`stage-speech-bubble bubble-step-${step}`}
          />
          <img
            src={getMascot()}
            alt=""
            className={`stage-monkey-img monkey-step-${step}`}
          />
        </div>

        <div className="bottom-split-nav-bar">
          <button
            className="split-btn back-btn-side"
            onClick={() => {
              stopMediaStream(streamRef.current, videoRef.current);
              streamRef.current = null;
              onCancel();
            }}
          >
            <LeftArrowIcon /> Back
          </button>
          <button
            className={`split-btn okay-btn-side ${isNextActive ? 'active-green' : 'disabled-state'}`}
            onClick={() => {
              if (step === 'setup') {
                setStep('not-detected');
              } else if (step === 'perfect') {
                stopMediaStream(streamRef.current, videoRef.current);
                streamRef.current = null;
                onDone();
              }
            }}
            disabled={!isNextActive}
          >
            {step === 'setup' ? 'Okay' : 'Start'} <RightArrowIcon />
          </button>
        </div>

      </div>
    </div>
  );
}
