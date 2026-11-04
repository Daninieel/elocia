import { useState, useRef, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import { updateUser } from '../../utils/api';
import { requestCameraStream, stopMediaStream } from '../../utils/cameraManager';
import './Settings.css';

type View = 'navigation' | 'setup' | 'evaluation' | 'profile' | 'help' | 'settings' | 'achievements' | 'practice';

const PRESET_AVATARS = [
  '🐱', '🐶', '🦊', '🐼', '🐸', '🦁', '🐯', '🐨',
  '🐰', '🐻', '🐵', '🦄', '🐧', '🦉', '🐙', '🐬',
  '🦖', '🐢', '🦋', '🐝', '🚀', '⭐', '🌈', '🎨'
];

const getStoredAvatar = (): string => {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  return window.localStorage.getItem('elocia_avatar') || '';
};

export default function Settings({ onNavigate }: { onNavigate?: (view: View) => void }) {
  // ── Avatar state ──────────────────────────────────────────────────────────
  const [savedAvatar, setSavedAvatar] = useState<string>(getStoredAvatar);
  const [pendingAvatar, setPendingAvatar] = useState<string>('');

  const isDirty = pendingAvatar !== '' && pendingAvatar !== savedAvatar;

  // Auto-scroll to bug report section if triggered from a mini-game / evaluation gear icon
  useEffect(() => {
    if (sessionStorage.getItem('scrollToBug') === 'true') {
      setTimeout(() => {
        const el = document.getElementById('bug-report-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      sessionStorage.removeItem('scrollToBug');
    }
  }, []);

  function selectEmoji(emoji: string) { setPendingAvatar(emoji); }

  async function saveAvatar() {
    if (!pendingAvatar) return;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('elocia_avatar', pendingAvatar);
      
      const currentStudentRaw = window.localStorage.getItem('elocia_current_student');
      if (currentStudentRaw) {
        try {
          const currentStudent = JSON.parse(currentStudentRaw);
          currentStudent.emoji = pendingAvatar;
          window.localStorage.setItem('elocia_current_student', JSON.stringify(currentStudent));

          // Save to backend database
          if (currentStudent.id) {
            await updateUser(currentStudent.id, { emoji: pendingAvatar });
          }
        } catch (err) {
          console.warn('Failed to sync avatar with student database profile:', err);
        }
      }
    }
    setSavedAvatar(pendingAvatar);
    setPendingAvatar('');
  }

  const displayAvatar = pendingAvatar || savedAvatar;

  // ── Camera Stream ─────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function enableCamera() {
      try {
        const cameraStream = await requestCameraStream(
          { video: { width: 640, height: 480 }, audio: false },
          () => cancelled
        );
        if (cancelled || !cameraStream) {
          if (cameraStream) stopMediaStream(cameraStream);
          return;
        }
        streamRef.current = cameraStream;
        if (videoRef.current) videoRef.current.srcObject = cameraStream;
      } catch (err) {
        console.error('Webcam access failed in Settings sandbox:', err);
      }
    }
    enableCamera();
    return () => {
      cancelled = true;
      stopMediaStream(streamRef.current, videoRef.current);
      streamRef.current = null;
    };
  }, []);

  // ── Feedback Form State ───────────────────────────────────────────────────
  const EMAILJS_SERVICE_ID  = 'service_mlr8x0l';
  const EMAILJS_TEMPLATE_ID = 'template_on0ihwr';
  const EMAILJS_PUBLIC_KEY  = 'W_bEYnn5Ji5UnwzX5';
  const COOLDOWN_MS = 5 * 60 * 1000;

  const [feedbackText, setFeedbackText] = useState('');
  const [sendStatus, setSendStatus]     = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [cooldownLeft, setCooldownLeft] = useState<number>(() => {
    const lastSent = Number(localStorage.getItem('elocia_feedback_last_sent') || '0');
    const elapsed  = Date.now() - lastSent;
    return elapsed < COOLDOWN_MS ? Math.ceil((COOLDOWN_MS - elapsed) / 1000) : 0;
  });

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => {
      setCooldownLeft(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  async function handleSendFeedback() {
    if (!feedbackText.trim() || feedbackText.trim().length < 10) return;
    if (cooldownLeft > 0) return;
    setSendStatus('sending');
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: EMAILJS_SERVICE_ID, template_id: EMAILJS_TEMPLATE_ID, user_id: EMAILJS_PUBLIC_KEY, template_params: { message: feedbackText.trim() } }),
      });
      if (res.ok) {
        setSendStatus('sent'); setFeedbackText('');
        localStorage.setItem('elocia_feedback_last_sent', String(Date.now()));
        setCooldownLeft(COOLDOWN_MS / 1000);
      } else { setSendStatus('error'); }
    } catch { setSendStatus('error'); }
  }

  const canSend = feedbackText.trim().length >= 10 && cooldownLeft === 0 && sendStatus !== 'sending';
  const minutesLeft = Math.ceil(cooldownLeft / 60);

  return (
    <div className="settings-page-container">
      <Sidebar activeTab="settings" onNavigate={onNavigate} />

      <main className="settings-main">
        {/* Background Decorative Pattern */}
        <div className="settings-bg-pattern">
          <span className="bg-icon icon-1">{"\u2699\uFE0F"}</span>
          <span className="bg-icon icon-2">{"\uD83C\uDF1F"}</span>
          <span className="bg-icon icon-3">{"\uD83C\uDFA8"}</span>
          <span className="bg-icon icon-4">{"\u2699\uFE0F"}</span>
          <span className="bg-icon icon-5">{"\u2728"}</span>
          <span className="bg-icon icon-6">{"\uD83C\uDFAF"}</span>
          <span className="bg-icon icon-7">{"\u2699\uFE0F"}</span>
        </div>

        <div className="settings-content-scroll">

          {/* Hero Banner */}
          <section className="settings-hero-card">
            <h1 className="settings-title">My Settings</h1>
            <p className="settings-subtitle">Make Elocia feel just right for you!</p>
          </section>

          {/* ── Avatar ──────────────────────────────────────────────────── */}
          <section className="settings-section">
            <h2 className="settings-section-heading">{"\uD83D\uDDBC\uFE0F"} Choose Your Avatar</h2>
            <div className="settings-card avatar-card">

              {/* Current avatar preview */}
              <div className="avatar-preview-area">
                <div className="avatar-preview-circle">
                  {displayAvatar.startsWith('data:') ? (
                    <img src={displayAvatar} alt="Your avatar" className="avatar-preview-img" />
                  ) : (
                    <span className="avatar-preview-emoji">{displayAvatar || "\uD83D\uDE0A"}</span>
                  )}
                </div>
                <p className="avatar-preview-label">
                  {isDirty ? '👆 Tap Save to apply!' : 'Your current avatar'}
                </p>
              </div>

              {/* Emoji grid */}
              <div className="avatar-emoji-grid">
                {PRESET_AVATARS.map(emoji => (
                  <button
                    key={emoji}
                    className={`avatar-emoji-btn ${(pendingAvatar || savedAvatar) === emoji ? 'selected' : ''}`}
                    onClick={() => selectEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Save button — only shown when there's an unsaved change */}
              {isDirty && (
                <button className="save-avatar-btn" onClick={saveAvatar}>
                  {"\u2705"} Save Avatar
                </button>
              )}
            </div>
          </section>

          {/* ── Camera ──────────────────────────────────────────────────── */}
          <section className="settings-section">
            <h2 className="settings-section-heading">{"\uD83D\uDCF7"} Check Your Camera</h2>
            <div className="sandbox-container">
              <div className="sandbox-video-wrapper">
                <div className="sandbox-live-badge"><span className="live-dot"></span> LIVE VIDEO</div>
                <video ref={videoRef} autoPlay playsInline muted className="sandbox-video" />
              </div>
              <div className="sandbox-checklist">
                <h3>Before we play, make sure:</h3>
                <ul>
                  <li><span className="check-icon">{"\u2705"}</span> <span><strong>We can see you!</strong> Stay inside the video frame.</span></li>
                  <li><span className="check-icon">{"\u2705"}</span> <span><strong>Not too close.</strong> Leave space for your hands.</span></li>
                  <li><span className="check-icon">{"\u2705"}</span> <span><strong>Lots of light.</strong> Turn on the lights in your room.</span></li>
                  <li><span className="check-icon">{"\u2705"}</span> <span><strong>Clean background.</strong> A blank wall works best!</span></li>
                </ul>
                <div className="sandbox-tip">
                  <strong>Teacher Tip: If your camera is a mirror, raise your right hand and make sure the video does exactly what you do!</strong>
                </div>
              </div>
            </div>
          </section>

          {/* ── FEEDBACK PANEL ── */}
          <section id="bug-report-section" className="settings-section">
            <h2 className="settings-section-heading">🐛 Found a Pesky Bug?</h2>
            {cooldownLeft > 0 ? (
              <div className="feedback-sent-box">
                <span className="feedback-sent-emoji">🎉</span>
                <p className="feedback-sent-title">Yay! Your message was sent!</p>
                <p className="feedback-sent-sub">
                  Thank you so much for helping us make Elocia better!{' '}
                  You can send another message in{' '}
                  <strong>{minutesLeft} {minutesLeft === 1 ? 'minute' : 'minutes'}</strong>. 🕐
                </p>
              </div>
            ) : (
              <div className="feedback-card">
                <p className="feedback-intro">
                  Did the app do something silly? 🤔 Or maybe you have a super cool idea to make Elocia even more awesome?{' '}
                  <strong>Ask your teacher or parent to help you type a message below our builders would love to hear from you! 💌</strong>
                </p>
                <textarea
                  className="feedback-textarea"
                  placeholder="Type your message here... (e.g. 'The camera was not working!' or 'I think there should be more animals!')"
                  value={feedbackText}
                  onChange={e => { setFeedbackText(e.target.value); setSendStatus('idle'); }}
                  rows={5}
                  maxLength={500}
                />
                <div className="feedback-footer">
                  <span className="feedback-char-count">
                    {feedbackText.length}/500{feedbackText.trim().length < 10 && feedbackText.length > 0 && (
                      <span className="feedback-hint"> (need at least 10 letters!)</span>
                    )}
                  </span>
                  <button
                    className={`feedback-send-btn ${!canSend ? 'feedback-send-btn--disabled' : ''}`}
                    onClick={handleSendFeedback}
                    disabled={!canSend}
                  >
                    {sendStatus === 'sending' ? '📤 Sending...' : '✉️ Send to the Builders!'}
                  </button>
                </div>
                {sendStatus === 'error' && (
                  <p className="feedback-error">😟 Oops! Something went wrong. Please ask your teacher to try again later.</p>
                )}
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}





