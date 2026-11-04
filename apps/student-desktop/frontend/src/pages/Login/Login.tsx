import { useState, useEffect } from 'react';
import './Login.css';
import ProfileSelect from './Profile Select';
import PinEntry from './Student Pin';
import { fetchStudents, getApiBase, setApiBase, type StudentProfileData } from '../../utils/api';

export type StudentProfile = StudentProfileData;

interface LoginProps {
  onStart: () => void;
}

export default function Login({ onStart }: LoginProps) {
  const [view, setView] = useState<'welcome' | 'select' | 'pin'>('welcome');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [serverInput, setServerInput] = useState<string>(getApiBase());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const loadStudents = () => {
    setConnectionStatus('connecting');
    fetchStudents()
      .then(data => {
        setStudents(data);
        setConnectionStatus(data && data.length > 0 ? 'connected' : 'error');
      })
      .catch(err => {
        console.error('Failed to load students:', err);
        setConnectionStatus('error');
      });
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleSaveServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverInput.trim()) {
      setApiBase(serverInput.trim());
      setShowServerModal(false);
      setTimeout(loadStudents, 200);
    }
  };

  const handleSelectStudent = (student: StudentProfile) => {
    setSelectedStudent(student);
    setView('pin');
  };

  const handleBack = () => {
    setView('select');
    setSelectedStudent(null);
  };

  const handlePinSuccess = (token: string) => {
    if (selectedStudent) {
      localStorage.setItem('elocia_current_student', JSON.stringify(selectedStudent));
      localStorage.setItem('elocia_access_token', token);
    }
    onStart();
  };

  if (view === 'welcome') {
    return (
      <div className="login-welcome-screen" style={{ position: 'relative' }}>
        <div className="login-welcome-content">
          <div className="login-logo-badge">
            <img src="/images/logo-icon.png" alt="ELOCIA logo" className="login-logo-image" />
          </div>

          <h1 className="login-welcome-title">Welcome Back!</h1>

          <p className="login-welcome-subtitle">
            Dive back into your learning adventure with ELOCIA.
            <br />
            Exciting new challenges await!
          </p>

          <button type="button" className="login-start-btn" onClick={() => setView('select')}>
            START
          </button>

          {/* Server Connection Badge */}
          <div style={{ marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => {
                setServerInput(getApiBase());
                setShowServerModal(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: connectionStatus === 'error' ? '#E11D48' : '#64748B',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s',
              }}
              title="Click to configure server connection IP"
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: connectionStatus === 'connected' ? '#10B981' : connectionStatus === 'connecting' ? '#F59E0B' : '#EF4444',
                }}
              />
              Server: {getApiBase()} ⚙️
            </button>
          </div>
        </div>

        {/* Server Config Modal */}
        {showServerModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                maxWidth: '420px',
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#1E293B' }}>
                Server Connection
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
                Enter the backend server IP (e.g. teacher's laptop IP: <code>http://192.168.1.50:8000</code>):
              </p>
              <form onSubmit={handleSaveServer}>
                <input
                  type="text"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  placeholder="http://192.168.1.50:8000"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '14px',
                    marginBottom: '16px',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowServerModal(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#64748B',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#FF8A00',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    Save & Connect
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'pin' && selectedStudent) {
    return (
      <PinEntry
        student={selectedStudent}
        onBack={handleBack}
        onSuccess={handlePinSuccess}
      />
    );
  }

  return (
    <ProfileSelect
      students={students}
      onSelectStudent={handleSelectStudent}
    />
  );
}
