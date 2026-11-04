// src/App.tsx
import { useState, useEffect } from 'react';
import './App.css';
import Login from './pages/Login/Login';
import LessonNavigation from './pages/Lessons/LessonNavigation';
import CameraSetup from './pages/Setup/CameraSetup';
import EvaluationSession from './pages/Evaluation/EvaluationSession';
import StageComplete from './pages/StageComplete/StageComplete';
import Profile from './pages/Profile/Profile';
import Help from './pages/Help/Help';
import Settings from './pages/Settings/Settings';
import Achievements from './pages/Achievements/Achievements';
import Practice from './pages/Practice/Practice';
import PuzzleSign from './pages/Mini Games/Puzzle Sign';
import SeeItSignIt from './pages/Mini Games/SeeItSignIt';
import MagicFingers from './pages/Mini Games/MagicFingers';
import { fetchStudentProgress, fetchCurriculum } from './utils/api';
import { stopAllActiveCameraStreams } from './utils/cameraManager';
import type { Section } from './data/curriculum';
import { CURRICULUM } from './data/curriculum';

function App() {
  const [currentView, setCurrentView] = useState<'login' | 'navigation' | 'setup' | 'evaluation' | 'stageComplete' | 'profile' | 'help' | 'settings' | 'achievements' | 'practice' | 'puzzle-sign' | 'see-it-sign-it' | 'magic-fingers'>('login');
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [completedStage, setCompletedStage] = useState<number | null>(null);
  const [curriculumData, setCurriculumData] = useState<Section[]>(CURRICULUM);
  const [unlockedStages, setUnlockedStages] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('elocia_unlocked_stages');
      return stored ? JSON.parse(stored) : [1];
    } catch {
      return [1];
    }
  });

  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [focusDrillSigns, setFocusDrillSigns] = useState<string[] | null>(null);

  // Sync curriculum dynamically from database
  useEffect(() => {
    const rawStudent = localStorage.getItem('elocia_current_student');
    let grade: number | undefined;
    if (rawStudent) {
      try {
        const student = JSON.parse(rawStudent);
        if (student.grade_level) grade = Number(student.grade_level);
      } catch {}
    }
    fetchCurriculum(grade).then(sections => {
      if (sections !== null) {
        setCurriculumData(sections);
      }
    });
  }, []);

  // Sync unlocked stages and curriculum from database when entering navigation or login
  const refreshProgress = () => {
    const rawStudent = localStorage.getItem('elocia_current_student');
    if (rawStudent) {
      try {
        const student = JSON.parse(rawStudent);
        if (student.grade_level) {
          fetchCurriculum(Number(student.grade_level)).then(sections => {
            if (sections !== null) {
              setCurriculumData(sections);
            }
          });
        }
        if (student.id) {
          fetchStudentProgress(student.id).then(prog => {
            if (prog && prog.unlocked_stages && prog.unlocked_stages.length > 0) {
              setUnlockedStages(prog.unlocked_stages);
              localStorage.setItem('elocia_unlocked_stages', JSON.stringify(prog.unlocked_stages));
            }
          });
        }
      } catch (e) {
        console.error('Failed to sync student progress:', e);
      }
    }
  };

  useEffect(() => {
    refreshProgress();
  }, [currentView]);

  // Camera Safety Watchdog: Ensure camera is completely killed when entering any non-camera view
  useEffect(() => {
    const cameraViews = ['evaluation', 'setup', 'puzzle-sign', 'see-it-sign-it', 'magic-fingers', 'settings'];
    if (!cameraViews.includes(currentView)) {
      stopAllActiveCameraStreams();
    }
  }, [currentView]);

  // Global window unmount/close failsafe
  useEffect(() => {
    const handleUnload = () => {
      stopAllActiveCameraStreams();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // This function handles transitioning from Module 3 to Module 4
  const handleStartLesson = (stageId: number, practiceMode: boolean = false, drillSigns: string[] | null = null) => {
    setActiveStage(stageId);
    setIsPracticeMode(practiceMode);
    setFocusDrillSigns(drillSigns);
    setCurrentView('setup'); // Goes to Camera Setup first
  };

  return (
    <div onClick={(e) => {
      const el = e.target as HTMLElement;
      // Logout button (sidebar, available on every page) -> back to Login
      if (el.closest('.nav-logout-btn')) {
        stopAllActiveCameraStreams();
        setCurrentView('login');
        return;
      }
      const target = el.closest('.start-lesson-btn');
      if (target) {
        // Find which stage was selected in LessonNavigation and start it
        // We will manage this directly from inside LessonNavigation instead of event delegation
      }
    }}>
      {currentView === 'login' && (
        <Login onStart={() => setCurrentView('navigation')} />
      )}

      {currentView === 'navigation' && (
        <LessonNavigation 
          onNavigate={setCurrentView} 
          unlockedStages={unlockedStages} 
          onStartLesson={handleStartLesson} 
        />
      )}

      {currentView === 'practice' && (
        <Practice onNavigate={setCurrentView} onStartLesson={handleStartLesson} cachedCurriculum={curriculumData} />
      )}

      {currentView === 'puzzle-sign' && (
        <PuzzleSign onNavigate={setCurrentView} />
      )}

      {currentView === 'see-it-sign-it' && (
        <SeeItSignIt onNavigate={setCurrentView} />
      )}

      {currentView === 'magic-fingers' && (
        <MagicFingers onNavigate={setCurrentView} />
      )}

      {currentView === 'profile' && (
        <Profile onNavigate={setCurrentView} />
      )}

      {currentView === 'achievements' && (
        <Achievements onNavigate={setCurrentView} />
      )}

      {currentView === 'help' && (
        <Help onNavigate={setCurrentView} />
      )}

      {currentView === 'settings' && (
        <Settings onNavigate={setCurrentView} />
      )}

      {currentView === 'setup' && (
        <CameraSetup
          onDone={() => setCurrentView('evaluation')}
          onCancel={() => setCurrentView(isPracticeMode ? 'practice' : 'navigation')}
        />
      )}

      {currentView === 'evaluation' && (
        <EvaluationSession
          stageId={activeStage}
          dynamicCurriculum={curriculumData}
          isPracticeMode={isPracticeMode}
          focusDrillSigns={focusDrillSigns}
          onExit={() => {
            setFocusDrillSigns(null);
            setCurrentView(isPracticeMode ? 'practice' : 'navigation');
          }}
          onComplete={(completedStageId) => {
            setFocusDrillSigns(null);
            if (isPracticeMode) {
              // In practice mode, return back to the Practice page smoothly
              setCurrentView('practice');
              return;
            }

            // In official Learn mode: Query authoritative backend progress
            const rawStudent = localStorage.getItem('elocia_current_student');
            if (rawStudent) {
              try {
                const student = JSON.parse(rawStudent);
                if (student.id) {
                  fetchStudentProgress(student.id).then(prog => {
                    if (prog && prog.unlocked_stages && prog.unlocked_stages.length > 0) {
                      setUnlockedStages(prog.unlocked_stages);
                      localStorage.setItem('elocia_unlocked_stages', JSON.stringify(prog.unlocked_stages));
                    }
                  });
                }
              } catch (e) {
                console.warn('Could not sync progress on stage complete:', e);
              }
            }

            // Persist completed stage locally for instantaneous unlock in Review Past Stages
            try {
              const currentCompleted: number[] = JSON.parse(localStorage.getItem('elocia_completed_stages') || '[]');
              if (!currentCompleted.includes(completedStageId)) {
                currentCompleted.push(completedStageId);
                localStorage.setItem('elocia_completed_stages', JSON.stringify(currentCompleted));
              }
            } catch (e) {
              console.warn('Failed to update local completed stages:', e);
            }

            // Celebrate with the Stage Complete milestone screen
            setCompletedStage(completedStageId);
            setCurrentView('stageComplete');
          }}
          onNavigate={setCurrentView}
        />
      )}

      {currentView === 'stageComplete' && (
        <StageComplete
          stageId={completedStage}
          dynamicCurriculum={curriculumData}
          onBackToLearn={() => setCurrentView('navigation')}
          onNavigate={setCurrentView}
        />
      )}
    </div>
  );
}

export default App;
