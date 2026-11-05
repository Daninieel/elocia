import { useState, useEffect } from 'react';
import './Practice.css';
import Sidebar from '../../components/Sidebar/Sidebar';
import { CURRICULUM } from '../../data/curriculum';
import type { Section } from '../../data/curriculum';
import { fetchCurriculum, fetchStudentProgress, fetchEducationalVideos, fetchNeedsPractice, API_BASE } from '../../utils/api';
import type { StudentProgress, EducationalVideoItem, PracticeItem } from '../../utils/api';

// Assuming images are in public/images
const seeItSignItImg = '/images/See it, Sign it!.png';
const magicFingersImg = '/images/Magic fingers.png';
const puzzleSignImg = '/images/Puzzle Sign.png';
const viewAllBtnImg = '/images/View all Button.png';

interface PracticeProps {
  onNavigate: (view: 'navigation' | 'setup' | 'evaluation' | 'profile' | 'help' | 'settings' | 'achievements' | 'practice' | 'puzzle-sign' | 'see-it-sign-it' | 'magic-fingers') => void;
  onStartLesson?: (stageId: number, practiceMode?: boolean, drillSigns?: string[] | null) => void;
  cachedCurriculum?: Section[];
}

export default function Practice({ onNavigate, onStartLesson, cachedCurriculum }: PracticeProps) {
  const [educationalVideos, setEducationalVideos] = useState<EducationalVideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<EducationalVideoItem | null>(null);
  const [showAllVideos, setShowAllVideos] = useState<boolean>(false);
  const [showAllPractice, setShowAllPractice] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);

  // Instant optimistic cache for curriculum
  const [curriculumData, setCurriculumData] = useState<Section[]>(() => {
    if (cachedCurriculum && cachedCurriculum.length > 0) return cachedCurriculum;
    try {
      const stored = localStorage.getItem('elocia_cached_curriculum');
      return stored ? JSON.parse(stored) : CURRICULUM;
    } catch {
      return CURRICULUM;
    }
  });

  // Instant optimistic cache for student progress
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(() => {
    try {
      const stored = localStorage.getItem('elocia_cached_progress');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [practiceItems, setPracticeItems] = useState<PracticeItem[]>(() => {
    try {
      const stored = localStorage.getItem('elocia_cached_needs_practice');
      if (!stored) return [];
      const parsed: PracticeItem[] = JSON.parse(stored);
      return parsed.map((it) => {
        const cleanStage = it.stage_id === 43 ? 2 : it.stage_id;
        let label = it.section_label;
        const sLower = String(it.sign).toLowerCase();
        const isColor = ['green', 'grey', 'red', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white'].includes(sLower);
        if (!label || label.includes('Stage 43') || (isColor && label.startsWith('Section 1'))) {
          if (isColor) {
            label = `Section 3, Stage ${cleanStage}`;
          } else {
            label = `Stage ${cleanStage}`;
          }
        } else {
          label = label.replace('Stage 43', 'Stage 2');
        }
        return { ...it, stage_id: cleanStage, section_label: label };
      });
    } catch {
      return [];
    }
  });

  const [reviewPages, setReviewPages] = useState<Record<string, number>>({});
  const [isRefreshingDrills, setIsRefreshingDrills] = useState(false);

  const loadNeedsPractice = async () => {
    try {
      const rawStudent = localStorage.getItem('elocia_current_student');
      let studentId: string | undefined;
      if (rawStudent) {
        try {
          const parsed = JSON.parse(rawStudent);
          if (parsed?.id) studentId = parsed.id;
          else if (parsed?.student_id) studentId = parsed.student_id;
        } catch {}
      }
      const items = await fetchNeedsPractice(studentId || 'all');
      if (Array.isArray(items)) {
        const cleaned = items.map((it) => {
          const cleanStage = it.stage_id === 43 ? 2 : it.stage_id;
          let label = it.section_label;
          if (!label || label.includes('Stage 43') || label === 'Section 1, Stage 43') {
            const sLower = String(it.sign).toLowerCase();
            if (['green', 'grey', 'red', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white'].includes(sLower)) {
              label = `Section 3, Stage ${cleanStage}`;
            } else {
              label = `Stage ${cleanStage}`;
            }
          } else {
            label = label.replace('Stage 43', 'Stage 2');
          }
          return { ...it, stage_id: cleanStage, section_label: label };
        });
        setPracticeItems(cleaned);
        try {
          localStorage.setItem('elocia_cached_needs_practice', JSON.stringify(cleaned));
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to load focus drills:', e);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    }
    return url;
  };

  useEffect(() => {
    // 1. Get student grade level if logged in
    const rawStudent = localStorage.getItem('elocia_current_student');
    let studentGrade: number | undefined;
    let studentId: string | undefined;

    if (rawStudent) {
      try {
        const student = JSON.parse(rawStudent);
        if (student.grade_level) studentGrade = Number(student.grade_level);
        if (student.id) studentId = student.id;
      } catch (e) {
        console.error('Failed to parse current student for practice:', e);
      }
    }

    // 2. Load dynamic curriculum in background & cache
    fetchCurriculum(studentGrade).then(sections => {
      if (sections && sections.length > 0) {
        setCurriculumData(sections);
        try {
          localStorage.setItem('elocia_cached_curriculum', JSON.stringify(sections));
        } catch {}
      }
    });

    // 3. Load educational videos in background
    fetchEducationalVideos(studentGrade).then(videos => {
      if (videos) {
        setEducationalVideos(videos);
      }
    });

    // 4. Load student progress in background
    if (studentId) {
      fetchStudentProgress(studentId).then((prog) => {
        if (prog) {
          setStudentProgress(prog);
          try {
            localStorage.setItem('elocia_cached_progress', JSON.stringify(prog));
          } catch {}
        }
      });
    }

    // 5. Initial fetch of focus drills & auto-poll every 3 seconds for instant sync with Teacher Portal
    loadNeedsPractice();
    const pollInterval = setInterval(loadNeedsPractice, 3000);
    window.addEventListener('focus', loadNeedsPractice);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', loadNeedsPractice);
    };
  }, []);

  return (
    <div className="practice-layout">
      <Sidebar activeTab="practice" onNavigate={onNavigate} />
      
      <main className="practice-main-content">
        <div className="practice-scroll-container">
          {/* Header */}
          <header className="practice-header">
            <div className="practice-header-content">
              <h1 className="practice-title">Time to Practice</h1>
              <p className="practice-subtitle">Keep your hands flexible and streak alive!</p>
            </div>
          </header>


          {/* Section: Keep Practicing (Focus Drill Cards from user screenshot) */}
          <section className="practice-section keep-practicing">
            <div className="section-header kp-section-header">
              <div className="section-title-group">
                <h2>Keep Practicing</h2>
                <p>Signs to help you build your skills</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    setIsRefreshingDrills(true);
                    await loadNeedsPractice();
                    setTimeout(() => setIsRefreshingDrills(false), 500);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Check for newly assigned teacher focus drills"
                >
                  <span style={{ display: 'inline-block', transform: isRefreshingDrills ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
                  <span>{isRefreshingDrills ? 'Checking...' : 'Refresh'}</span>
                </button>
                <button 
                  className="view-all-pill-btn"
                  onClick={() => setShowAllPractice(true)}
                  title="View all practice signs"
                >
                  <span>View all</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            <div className="kp-cards-row">
              {practiceItems.length > 0 ? (
                practiceItems.slice(0, 4).map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`kp-card ${item.color}`}
                    onClick={() => {
                      if (onStartLesson) {
                        onStartLesson(item.stage_id, true, [item.sign]);
                      } else {
                        onNavigate('setup');
                      }
                    }}
                    title={item.reason || `Practice sign: ${item.sign}`}
                  >
                    {/* Badge ribbon if flagged or low accuracy */}
                    {item.score < 60 && (
                      <div className="kp-card-badge" title="Flagged for practice">
                        !
                      </div>
                    )}
                    <div className="kp-number">{item.sign}</div>
                    <div className="kp-stage">{item.section_label}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', width: '100%', borderRadius: '16px', background: '#f8fafc', border: '2px dashed #cbd5e1', fontSize: '14px', fontWeight: 500 }}>
                  ✨ All caught up! Focus drills assigned by your teacher will appear here.
                </div>
              )}
            </div>
          </section>

          {/* Section 1: Educational Videos */}
          <section className="practice-section educational-videos">
            <div className="section-header">
              <div className="section-title-group">
                <h2>Educational Videos</h2>
                <p>Learn new signs with videos</p>
              </div>
              <button 
                className="view-all-btn"
                onClick={() => setShowAllVideos(true)}
                title="View all educational videos"
              >
                <img src={viewAllBtnImg} alt="View all" />
              </button>
            </div>

            <div className="video-cards-row">
              {educationalVideos.length > 0 ? (
                <>
                  {educationalVideos.slice(0, 4).map((video) => (
                    <div 
                      key={video.id} 
                      className="video-card" 
                      onClick={() => {
                        setVideoError(false);
                        setSelectedVideo(video);
                      }}
                      style={{ cursor: 'pointer' }}
                      title={`Click to watch: ${video.title}`}
                    >
                      <div className="video-thumbnail">
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url.startsWith('http') ? video.thumbnail_url : `${API_BASE}${video.thumbnail_url}`} 
                            alt={video.title} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div className="science-placeholder-art">
                            <div className="science-doodle dna"></div>
                            <div className="science-doodle stars"></div>
                            <div className="science-doodle molecules"></div>
                            <div className="science-text-container">
                              <span className="science-text">{video.subject.toUpperCase()}</span>
                              <span className="science-sub">{video.title.toUpperCase()}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="video-info">
                        <span className="grade-badge">Grade {video.grade_level}</span>
                        <h3 className="video-title">{video.title}</h3>
                        <p className="video-desc">{video.description || `Learn ${video.subject} concepts with Filipino Sign Language.`}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', gridColumn: '1 / -1', borderRadius: '16px', background: '#f8fafc', border: '2px dashed #cbd5e1', fontSize: '14px', fontWeight: 500 }}>
                  📹 No educational videos uploaded yet. Videos uploaded by teachers will appear here!
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Mini Games */}
          <section className="practice-section mini-games">
            <div className="section-header centered">
              <h2>Mini Games</h2>
              <p>Try playing mini games that is fun to play!</p>
            </div>

            <div className="games-row">
              <img 
                src={seeItSignItImg} 
                alt="See it, Sign it!" 
                className="game-img" 
                onClick={() => onNavigate('see-it-sign-it')}
              />
              <img 
                src={puzzleSignImg} 
                alt="Puzzle sign" 
                className="game-img" 
                onClick={() => onNavigate('puzzle-sign')}
              />
              <img 
                src={magicFingersImg} 
                alt="Magic Fingers" 
                className="game-img" 
                onClick={() => onNavigate('magic-fingers')}
              />
            </div>
          </section>

          {/* Section 4: Review Past Stages (Synchronized with Lesson Proper Map) */}
          <section className="practice-section review-stages">
            <div className="section-header centered">
              <h2>Review Past Stages</h2>
              <p>You can practice your completed stages here!</p>
            </div>

            {(() => {
              // Authoritative list of stages strictly completed/passed in Lesson Proper
              const localCompleted: number[] = (() => {
                try {
                  const raw = localStorage.getItem('elocia_completed_stages');
                  return raw ? JSON.parse(raw) : [];
                } catch {
                  return [];
                }
              })();

              const completedFromBackend = (studentProgress?.stages || [])
                .filter(s => s.passed)
                .map(s => s.stage_id);

              const allCompletedStageIds = Array.from(new Set([...completedFromBackend, ...localCompleted]));

              // Filter curriculum to sections containing stages
              const validSections = curriculumData.filter(section => 
                section.units && section.units.some(u => u.stages && u.stages.length > 0)
              );

              if (curriculumData.length === 0 || validSections.length === 0) {
                return (
                  <div style={{
                    padding: '36px 32px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '24px',
                    border: '3px dashed #F59E0B',
                    maxWidth: '520px',
                    margin: '24px auto',
                    color: '#92400E',
                    fontWeight: 600
                  }}>
                    <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📚</span>
                    Lessons are being prepared by your teacher. Check back soon!
                  </div>
                );
              }

              // FRESH START: Student has not completed any stages yet in Lesson Proper!
              // Anti-spoiler guard: Do not display review stages until completed in Learn mode.
              if (allCompletedStageIds.length === 0) {
                return (
                  <div className="review-empty-state">
                    <div className="review-empty-icon-bubble">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                    <h3 className="review-empty-title">No Stages Completed Yet</h3>
                    <p className="review-empty-subtitle">
                      Complete lessons in the <strong>Learn</strong> tab first! Once you finish a stage in Lesson Proper, it will automatically unlock here for free practice anytime.
                    </p>
                    <button
                      type="button"
                      className="review-empty-learn-btn"
                      onClick={() => onNavigate('navigation')}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      </svg>
                      Go to Learn Lessons
                    </button>
                  </div>
                );
              }

              return validSections.map((section, secIdx) => {
                const stages = section.units
                  .flatMap(u => u.stages)
                  .sort((a, b) => a.id - b.id);

                const sectionKey = `review-${section.id}-${secIdx}`;
                const currentPage = reviewPages[sectionKey] || 0;
                const itemsPerPage = 3;
                const totalPages = Math.ceil(stages.length / itemsPerPage);
                const startIndex = currentPage * itemsPerPage;
                const visibleStages = stages.slice(startIndex, startIndex + itemsPerPage);

                const handlePrev = () => {
                  setReviewPages(prev => ({
                    ...prev,
                    [sectionKey]: Math.max(0, (prev[sectionKey] || 0) - 1)
                  }));
                };

                const handleNext = () => {
                  setReviewPages(prev => ({
                    ...prev,
                    [sectionKey]: Math.min(totalPages - 1, (prev[sectionKey] || 0) + 1)
                  }));
                };

                return (
                  <div key={sectionKey} className="review-section-group" style={{ width: '100%', marginBottom: '40px' }}>
                    <div className="section-banner" style={{ margin: '0 auto 28px auto' }}>
                      {section.title}
                    </div>

                    <div className="stages-carousel-wrapper">
                      {stages.length > itemsPerPage && currentPage > 0 && (
                        <button
                          className="carousel-arrow-btn arrow-prev"
                          onClick={handlePrev}
                          title="Previous Stages"
                          aria-label="Previous Stages"
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}

                      <div className="stages-path">
                        <div className="path-line"></div>

                        {visibleStages.map((stage) => {
                          const originalStageIdx = stages.findIndex(s => s.id === stage.id);
                          // Match stageInfo strictly by global stage.id from backend/curriculum
                          const stageInfo = studentProgress?.stages.find(s => s.stage_id === stage.id);
                          
                          // A stage is only completed if it was actually passed in Lesson Proper
                          const isCompleted = allCompletedStageIds.includes(stage.id) || 
                                              Boolean(stageInfo?.passed);

                          // Anti-spoiler: If not completed in Lesson Proper, it stays locked!
                          const isLocked = !isCompleted;
                          const cardStateClass = isLocked ? 'locked-card' : 'completed-card';
                          const xpPoints = (stage.items?.length || 1) * 10;

                          return (
                            <div
                              key={stage.id}
                              className={`stage-card ${cardStateClass}`}
                              onClick={() => {
                                if (isLocked) return;
                                try {
                                  const reviewed: number[] = JSON.parse(localStorage.getItem('elocia_reviewed_stages') || '[]');
                                  if (!reviewed.includes(stage.id)) {
                                    reviewed.push(stage.id);
                                    localStorage.setItem('elocia_reviewed_stages', JSON.stringify(reviewed));
                                  }
                                } catch (err) {
                                  console.warn('Failed to update reviewed stages:', err);
                                }

                                if (onStartLesson) {
                                  onStartLesson(stage.id, true);
                                } else {
                                  onNavigate('setup');
                                }
                              }}
                              role="button"
                              tabIndex={isLocked ? -1 : 0}
                              title={isLocked ? 'Complete this stage in Learn mode first to review it here!' : `Practice ${stage.title}`}
                            >
                              {isLocked ? (
                                <>
                                  <div className="stage-text-group">
                                    <span className="stage-label">Stage</span>
                                    <span className="stage-number">{originalStageIdx + 1}</span>
                                  </div>
                                  <div className="icon-container" title="Locked - Finish in Learn first">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7f8c8d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                      <path d="M7 11V7a5 5 0 0110 0v4" />
                                    </svg>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="card-top-badge-row">
                                    <span className="status-pill pill-completed">
                                      Completed
                                    </span>
                                    <div className="card-mini-icon">
                                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="10" fill="#2ECC71"/>
                                        <path d="M8 12.5L10.5 15L16 9.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </div>
                                  </div>

                                  <div className="card-body-text">
                                    <h4 className="card-stage-title">{stage.title}</h4>
                                    <p className="card-stage-subtitle">
                                      {stage.items?.length ? `${stage.items.length} signs to review` : (stage.description || 'Fun review activities')}
                                    </p>
                                  </div>

                                  <div className="card-footer-row">
                                    <span className="card-reward-pts">⭐ {xpPoints} pts</span>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {stages.length > itemsPerPage && currentPage < totalPages - 1 && (
                        <button
                          className="carousel-arrow-btn arrow-next"
                          onClick={handleNext}
                          title="Next Stages"
                          aria-label="Next Stages"
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </section>

        </div>
      </main>

      {/* Educational Video Player Modal */}
      {selectedVideo && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '28px',
              maxWidth: '840px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '3px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '2px solid #F1F5F9' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {selectedVideo.subject}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', background: '#fef3c7', color: '#b45309' }}>
                    Grade {selectedVideo.grade_level}
                  </span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 0 0', color: '#0f172a' }}>
                  {selectedVideo.title}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedVideo(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#64748b',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                title="Close Video"
              >
                ✕
              </button>
            </div>

            {/* Video Player */}
            <div style={{ width: '100%', aspectRatio: '16/9', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {videoError ? (
                <div style={{ color: '#f87171', textAlign: 'center', padding: '24px' }}>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0' }}>⚠️ Video Not Available</p>
                  <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>The video file could not be loaded or the URL is unreachable.</p>
                </div>
              ) : selectedVideo.video_url.includes('youtube.com') || selectedVideo.video_url.includes('youtu.be') ? (
                <iframe
                  src={getEmbedUrl(selectedVideo.video_url)}
                  title={selectedVideo.title}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video 
                  key={selectedVideo.id}
                  controls 
                  autoPlay
                  loop
                  playsInline
                  onError={() => setVideoError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                >
                  <source src={selectedVideo.video_url} type="video/mp4" />
                  <source src={`http://127.0.0.1:8000${selectedVideo.video_url}`} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>

            {/* Description Footer */}
            {selectedVideo.description && (
              <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                  {selectedVideo.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View All Educational Videos Full Screen View */}
      {showAllVideos && (
        <div 
          className="practice-layout"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#F8F9CC',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Quicksand', sans-serif"
          }}
        >
          {/* Top Navigation Bar with System Theme */}
          <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.2rem 2.5rem',
            borderBottom: '3px solid rgba(0,0,0,0.06)',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                onClick={() => setShowAllVideos(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#ff9f43',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '10px 22px',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(255, 159, 67, 0.35)',
                  transition: 'transform 0.15s, background-color 0.15s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f39c12';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff9f43';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                ← Back to Practice
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#38b6ff', letterSpacing: '-0.5px' }}>
                  Educational Videos
                </h1>
                <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#4a4a4a' }}>
                  Showing all {educationalVideos.length} educational videos for your grade
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAllVideos(false)}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                border: '2px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 900,
                color: '#475569',
                boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s, background-color 0.15s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.color = '#475569';
              }}
              title="Close Full Screen"
            >
              ✕
            </button>
          </header>

          {/* Full Screen Scrollable Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 3.5rem 5rem 3.5rem' }}>
            {educationalVideos.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px'
              }}>
                {educationalVideos.map((video) => (
                  <div 
                    key={video.id} 
                    className="video-card" 
                    onClick={() => {
                      setVideoError(false);
                      setSelectedVideo(video);
                    }}
                    style={{ cursor: 'pointer' }}
                    title={`Click to watch: ${video.title}`}
                  >
                    <div className="video-thumbnail">
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url.startsWith('http') ? video.thumbnail_url : `${API_BASE}${video.thumbnail_url}`} 
                          alt={video.title} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <div className="science-placeholder-art">
                          <div className="science-doodle dna"></div>
                          <div className="science-doodle stars"></div>
                          <div className="science-doodle molecules"></div>
                          <div className="science-text-container">
                            <span className="science-text">{video.subject.toUpperCase()}</span>
                            <span className="science-sub">{video.title.toUpperCase()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="video-info">
                      <span className="grade-badge">Grade {video.grade_level}</span>
                      <h3 className="video-title">{video.title}</h3>
                      <p className="video-desc">{video.description || `Learn ${video.subject} concepts with Filipino Sign Language.`}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '64px 32px',
                textAlign: 'center',
                color: '#64748b',
                borderRadius: '24px',
                background: '#ffffff',
                border: '2px dashed #cbd5e1',
                fontSize: '16px',
                maxWidth: '600px',
                margin: '40px auto',
                boxShadow: '0 6px 15px rgba(0,0,0,0.04)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📹</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>No Videos Uploaded Yet</h3>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#64748b' }}>
                  Educational videos uploaded by teachers will appear here for practice!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View All Keep Practicing Full Screen / Modal View */}
      {showAllPractice && (
        <div 
          className="practice-layout"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#F8F9CC',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Quicksand', sans-serif"
          }}
        >
          {/* Top Navigation Bar with System Theme */}
          <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.2rem 2.5rem',
            borderBottom: '3px solid rgba(0,0,0,0.06)',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                onClick={() => setShowAllPractice(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#ff922b',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '10px 22px',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(255, 146, 43, 0.35)',
                  transition: 'transform 0.15s, background-color 0.15s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f76707';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff922b';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                ← Back to Practice
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#38b6ff', letterSpacing: '-0.5px' }}>
                  Keep Practicing (All Signs)
                </h1>
                <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#4a4a4a' }}>
                  Targeted signs assigned by your teacher ({practiceItems.length} signs)
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAllPractice(false)}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                border: '2px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 900,
                color: '#475569',
                boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s, background-color 0.15s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.color = '#475569';
              }}
              title="Close Full Screen"
            >
              ✕
            </button>
          </header>

          {/* Full Screen Scrollable Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 3.5rem 5rem 3.5rem' }}>
            {practiceItems.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '24px'
              }}>
                {practiceItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`kp-card ${item.color}`}
                    onClick={() => {
                      setShowAllPractice(false);
                      if (onStartLesson) {
                        onStartLesson(item.stage_id, true, [item.sign]);
                      } else {
                        onNavigate('setup');
                      }
                    }}
                    title={item.reason || `Practice sign: ${item.sign}`}
                  >
                    {item.score < 60 && (
                      <div className="kp-card-badge" title="Flagged for practice">
                        !
                      </div>
                    )}
                    <div className="kp-number">{item.sign}</div>
                    <div className="kp-stage">{item.section_label}</div>
                    <span style={{ fontSize: '12px', fontWeight: 700, marginTop: '8px', opacity: 0.85 }}>
                      Accuracy: {item.score}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '64px 32px',
                textAlign: 'center',
                color: '#64748b',
                borderRadius: '24px',
                background: '#ffffff',
                border: '2px dashed #cbd5e1',
                fontSize: '16px',
                maxWidth: '600px',
                margin: '40px auto',
                boxShadow: '0 6px 15px rgba(0,0,0,0.04)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>All Signs Mastered!</h3>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#64748b' }}>
                  You have no low-scoring signs flagged for practice. Awesome job!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
