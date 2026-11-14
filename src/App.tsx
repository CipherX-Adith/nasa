import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Atom,
  BadgeCheck,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FilePlus,
  FileText,
  Heart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wind,
  XCircle,
} from 'lucide-react';
import type { OrganKey } from './components/DigitalTwinViewer';
import {
  isFirebaseEnabled,
  subscribeToAssessments,
  saveAssessmentToFirebase,
  firebaseRegisterUser,
  subscribeToFirebaseUsers,
  firebaseApproveUser,
  firebaseRejectUser,
  firebaseDirectCreateAstronaut,
  subscribeToMedicalRecords,
  saveMedicalRecordToFirebase,
  firebaseGetAstronauts,
  subscribeToAstronauts,
  firebaseGetMeasurements,
  subscribeToMeasurements,
  firebaseGetAssessments,
  firebaseGetMedicalRecords,
  firebaseGetAlerts,
  subscribeToAlerts,
  firebaseAcknowledgeAlert,
  firebaseGetUsers,
  type FirebaseUserRecord,
  type FirebaseMedicalRecord,
} from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');
const API = API_BASE.replace(/\/+$/, '');
type Any = Record<string, any>;

const fmt = (s: string) =>
  new Date(s).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Clear legacy browser assessment caches; records now come from the authenticated API.
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('orbitcare_assessments_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch { }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const isLight = theme === 'light';

  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState<Any | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  const [astronauts, setAstronauts] = useState<Any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [measurements, setMeasurements] = useState<Any[]>([]);
  const [baselines, setBaselines] = useState<Any[]>([]);
  const [alerts, setAlerts] = useState<Any[]>([]);
  const [timeline, setTimeline] = useState<Any[]>([]);
  const [docs, setDocs] = useState<Any[]>([]);
  const [observationEdits, setObservationEdits] = useState<Record<number, Any>>({});
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [assistantResult, setAssistantResult] = useState<Any | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<Any | null>(null);
  const [assessment, setAssessment] = useState({
    sleep_hours: 7.5,
    sleep_quality: 7,
    stress: 3,
    mood: 7,
    fatigue: 2,
    symptoms: 'None reported',
  });
  const [assessmentsList, setAssessmentsList] = useState<Any[]>([]);
  const [behaviouralMetric, setBehaviouralMetric] = useState('Sleep Duration');
  const [assessmentFeedback, setAssessmentFeedback] = useState('');
  const [assessmentError, setAssessmentError] = useState('');

  // Interactive Digital Twin active organ state (synchronized with telemetry graphs)
  const [selectedOrgan, setSelectedOrgan] = useState<OrganKey>('heart');

  // Collapsible navigation popup menu triggered by arrow mark under the logo
  const [navPopupOpen, setNavPopupOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavPopupOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time synchronization & live telemetry state
  const [liveStreaming, setLiveStreaming] = useState(true);
  const [packetCount, setPacketCount] = useState(0);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [realtimeClock, setRealtimeClock] = useState(() => {
    const d = new Date();
    return {
      utc: d.toISOString().slice(11, 19) + ' UTC',
      met: `042:${d.toISOString().slice(11, 19)}`,
    };
  });

  // API responses are authoritative. Optional Firebase sync is backend-only.
  const firebaseActive = false;

  // Telemetry view mode: hourly or stored mission history
  const [telemetryMode, setTelemetryMode] = useState<'hourly' | 'mission'>('hourly');
  const [hourlyTelemetry, setHourlyTelemetry] = useState<Any | null>(null);

  // Health Model Analysis, Daily Reports & Abnormal Behaviour Warnings
  const [activeWarnings, setActiveWarnings] = useState<Any[]>([]);
  const [flightReadinessScore, setFlightReadinessScore] = useState<number>(100);
  const [overallStatus, setOverallStatus] = useState<string>('NOMINAL');
  const [dailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const [dailyReportData, setDailyReportData] = useState<Any | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportSavedSuccess, setReportSavedSuccess] = useState(false);

  const [usernameInput, setUsernameInput] = useState('medical');
  const [passwordInput, setPasswordInput] = useState('orbitcare-demo');

  // Authentication & Registration mode
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [loginClearancePending, setLoginClearancePending] = useState(false);

  // Astronaut Registration Form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('orbitcare-demo');
  const [regCallSign, setRegCallSign] = useState('');
  const [regMission, setRegMission] = useState('Mars Transit');
  const [regSpecialization, setRegSpecialization] = useState('Mission Specialist');
  const [regBusy, setRegBusy] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regMessage, setRegMessage] = useState('');
  const [regError, setRegError] = useState('');

  // Admin User & Crew Clearance Management state
  const [systemUsers, setSystemUsers] = useState<Any[]>([]);
  const [adminActionBusy, setAdminActionBusy] = useState(false);

  // Core Demo Accounts: 1 Flight Surgeon Admin + 3 Demo Astronauts
  const demoAccounts = useMemo(() => {
    const baseCore = [
      {
        username: 'medical',
        name: 'Dr. Robert Vance',
        callSign: 'FLIGHT SURGEON',
        role: 'medical',
        isAdmin: true,
        specialization: 'Chief Medical Officer (Admin Clearance)',
      },
      {
        username: 'maya',
        name: 'Maya Chen',
        callSign: 'ORION-1',
        role: 'astronaut',
        isAdmin: false,
        specialization: 'Commander / Mission Specialist',
      },
      {
        username: 'elena',
        name: 'Elena Rossi',
        callSign: 'VEGA-2',
        role: 'astronaut',
        isAdmin: false,
        specialization: 'Flight Engineer / Systems Lead',
      },
      {
        username: 'david',
        name: 'David Okafor',
        callSign: 'NOVA-3',
        role: 'astronaut',
        isAdmin: false,
        specialization: 'Science & Payload Specialist',
      },
    ];

    if (!systemUsers || !systemUsers.length) return baseCore;

    // Merge attributes from live database users
    return baseCore.map((core) => {
      const match = systemUsers.find(
        (u) => u.username?.toLowerCase() === core.username.toLowerCase()
      );
      if (match) {
        return {
          ...core,
          name: match.full_name || match.name || core.name,
          callSign: match.call_sign || core.callSign,
          specialization: match.specialization || core.specialization,
        };
      }
      return core;
    });
  }, [systemUsers]);

  // Direct Astronaut Provisioning state (Admin only)
  const [directName, setDirectName] = useState('');
  const [directUsername, setDirectUsername] = useState('');
  const [directPassword, setDirectPassword] = useState('orbitcare-demo');
  const [directCallSign, setDirectCallSign] = useState('');
  const [directMission, setDirectMission] = useState('Mars Transit');
  const [directSpecialization, setDirectSpecialization] = useState('Mission Specialist');
  const [directBusy, setDirectBusy] = useState(false);
  const [directSuccess, setDirectSuccess] = useState('');
  const [directError, setDirectError] = useState('');

  // Medical records returned by the authenticated API
  const [medicalRecords, setMedicalRecords] = useState<Any[]>([]);
  const [showAddMedRecordModal, setShowAddMedRecordModal] = useState(false);
  const [newMedRecord, setNewMedRecord] = useState({
    record_type: 'Clinical Evaluation',
    title: '',
    physician: 'Dr. Robert Vance, Flight Surgeon',
    findings: '',
    countermeasures: '',
    status: 'Pending clinician review',
    date: new Date().toISOString().split('T')[0],
  });
  const [medRecordSubmitting, setMedRecordSubmitting] = useState(false);

  // Selected pill in the Mission Telemetry Trend card
  const [selectedMetric, setSelectedMetric] = useState('Heart Rate');

  // Interactive Digital Twin: Handle organ selection & switch telemetry graph
  const handleSelectOrgan = (organ: OrganKey) => {
    setSelectedOrgan(organ);
    if (organ === 'heart') {
      setSelectedMetric('Heart Rate');
    } else if (organ === 'lungs') {
      setSelectedMetric('Cabin CO2');
    } else if (organ === 'brain') {
      setSelectedMetric('Sleep duration');
    } else if (organ === 'muscles') {
      setSelectedMetric('Grip');
    } else if (organ === 'immune') {
      setSelectedMetric('Radiation dose rate');
    }
  };

  // Bidirectional sync: keep organ highlight in sync when user clicks any metric pill
  useEffect(() => {
    if (['Heart Rate', 'HRV', 'Systolic BP'].includes(selectedMetric)) {
      setSelectedOrgan('heart');
    } else if (['Cabin CO2'].includes(selectedMetric)) {
      setSelectedOrgan('lungs');
    } else if (['Sleep duration', 'Fatigue', 'Sleep quality', 'Stress', 'Mood'].includes(selectedMetric)) {
      setSelectedOrgan('brain');
    } else if (['Grip'].includes(selectedMetric)) {
      setSelectedOrgan('muscles');
    } else if (['Radiation dose rate', 'Core Temp'].includes(selectedMetric)) {
      setSelectedOrgan('immune');
    }
  }, [selectedMetric]);

  // Role detection
  const isAdmin = user?.role === 'medical';
  const isUser = !isAdmin && !!user;

  // Admin Fleet Triage & Clearance Authority state
  const [fleetData, setFleetData] = useState<Any[]>([]);
  const [clearanceUpdating, setClearanceUpdating] = useState(false);

  // Astronaut Role: Daily Countermeasure Adherence state
  const [adherenceChecks, setAdherenceChecks] = useState<Record<string, boolean>>({});
  const [adherenceDate, setAdherenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [adherenceLoading, setAdherenceLoading] = useState(false);
  const [adherenceError, setAdherenceError] = useState('');

  // Astronaut Role: Telemedicine Consult state
  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [consultNote, setConsultNote] = useState('');
  const [consultSubmitting, setConsultSubmitting] = useState(false);
  const [consultFeedback, setConsultFeedback] = useState('');

  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(API + path, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({ detail: 'Request failed' }));
      const msg = typeof d.detail === 'string'
        ? d.detail
        : Array.isArray(d.detail)
          ? d.detail.map((x: any) => `${x.loc ? x.loc.slice(-1) + ': ' : ''}${x.msg}`).join(', ')
          : 'Request failed';
      throw Error(msg);
    }
    return res.json();
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const trimmedUser = usernameInput.trim().toLowerCase();
    const enteredPass = passwordInput.trim();

    try {
      // 1. Try Backend API login with 6-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const d = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: trimmedUser, password: enteredPass }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setToken(d.access_token);
        setUser(d);
        localStorage.setItem('token', d.access_token);
        localStorage.setItem('user', JSON.stringify(d));
        if (d.role !== 'medical' && d.astronaut_id) {
          setSelected(d.astronaut_id);
        } else {
          setSelected(null);
        }
        setError('');
        setLoginClearancePending(false);
        return;
      } catch (apiErr: any) {
        clearTimeout(timeoutId);
        // If it's a specific clearance decline or pending approval, display it directly
        if (apiErr.message?.toLowerCase().includes('pending') || apiErr.message?.toLowerCase().includes('clearance') || apiErr.message?.toLowerCase().includes('rejected')) {
          throw apiErr;
        }

        throw apiErr;
      }
    } catch (x: any) {
      const msg = x.name === 'AbortError' ? 'Verification timed out. Reconnecting…' : (x.message || 'Login failed');
      if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('clearance')) {
        setLoginClearancePending(true);
      } else {
        setLoginClearancePending(false);
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function registerAstronaut(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRegBusy(true);
    setRegError('');
    setRegSuccess(false);

    try {
      const payload = {
        username: regUsername.trim().toLowerCase(),
        password: regPassword,
        full_name: regFullName.trim(),
        call_sign: regCallSign.trim() || `CREW-${Math.floor(10 + Math.random() * 90)}`,
        mission: regMission.trim() || 'Mars Transit',
        specialization: regSpecialization.trim() || 'Mission Specialist',
      };

      // 1. Submit to Backend API
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setRegSuccess(true);
      setRegMessage(
        `Application submitted for ${payload.full_name} (${payload.call_sign})! Status: PENDING FLIGHT SURGEON APPROVAL. Your credentials have been entered into the mission database. For flight safety, the Medical Officer (Admin) must evaluate and approve your flight clearance before login access is granted.`
      );
    } catch (err: any) {
      setRegError(err.message || 'Registration failed');
    } finally {
      setRegBusy(false);
    }
  }

  async function loadAdminUsers() {
    if (!token || user?.role !== 'medical') return;
    try {
      const u = await api('/admin/users');
      if (Array.isArray(u)) {
        setSystemUsers(u);
      }
    } catch (e) {
      console.warn('Could not load admin users:', e);
    }
  }

  async function handleApproveUser(targetUser: Any) {
    try {
      setAdminActionBusy(true);
      await api(`/admin/users/${targetUser.id}/approve`, { method: 'POST' });

      await load();
      await loadAdminUsers();
    } catch (e: any) {
      alert(`Approval error: ${e.message}`);
    } finally {
      setAdminActionBusy(false);
    }
  }

  async function handleRejectUser(targetUser: Any) {
    try {
      setAdminActionBusy(true);
      await api(`/admin/users/${targetUser.id}/reject`, { method: 'POST' });
      await loadAdminUsers();
    } catch (e: any) {
      alert(`Rejection error: ${e.message}`);
    } finally {
      setAdminActionBusy(false);
    }
  }

  async function handleDirectCreateAstronaut(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDirectBusy(true);
    setDirectError('');
    setDirectSuccess('');

    try {
      const payload = {
        name: directName.trim(),
        username: directUsername.trim().toLowerCase(),
        password: directPassword || 'orbitcare-demo',
        call_sign: directCallSign.trim() || `ASTRO-${Math.floor(10 + Math.random() * 90)}`,
        mission: directMission.trim() || 'Mars Transit',
        specialization: directSpecialization.trim() || 'Mission Specialist',
      };

      const res = await api('/admin/astronauts/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setDirectSuccess(`Astronaut ${payload.name} (${payload.call_sign}) created in the mission database.`);
      setDirectName('');
      setDirectUsername('');
      setDirectCallSign('');
      await load();
      await loadAdminUsers();
    } catch (e: any) {
      setDirectError(e.message || 'Failed to create astronaut');
    } finally {
      setDirectBusy(false);
    }
  }

  async function handleAddMedicalRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setMedRecordSubmitting(true);

    try {
      const payload = {
        record_type: newMedRecord.record_type,
        title: newMedRecord.title,
        physician: newMedRecord.physician || `Dr. ${user?.username?.toUpperCase() || 'VANCE'}, Flight Surgeon`,
        findings: newMedRecord.findings,
        countermeasures: newMedRecord.countermeasures,
        status: 'Pending clinician review',
        date: newMedRecord.date || new Date().toISOString().split('T')[0],
      };

      await api(`/astronauts/${selected}/medical-records`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await load();
      setShowAddMedRecordModal(false);
      setNewMedRecord({
        record_type: 'Clinical Evaluation',
        title: '',
        physician: 'Dr. Robert Vance, Flight Surgeon',
        findings: '',
        countermeasures: '',
        status: 'Pending clinician review',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (e: any) {
      alert(`Could not save medical record: ${e.message}`);
    } finally {
      setMedRecordSubmitting(false);
    }
  }

  async function load() {
    if (!token) return;
    try {
      const a = await api('/astronauts');
      if (a && a.length) {
        setAstronauts(a);
      }

      const id = (user?.role !== 'medical' && user?.astronaut_id)
        ? user.astronaut_id
        : (selected || a[0]?.id || 1);

      setSelected(id);

      if (id) {
        const [m, ass, recs, l] = await Promise.all([
          api(`/astronauts/${id}/measurements`),
          api(`/astronauts/${id}/assessments`),
          api(`/astronauts/${id}/medical-records`),
          api(`/alerts?astronaut_id=${id}`),
        ]);
        setMeasurements(Array.isArray(m) ? m : []);
        setPacketCount(Array.isArray(m) ? m.length : 0);
        setAssessmentsList(Array.isArray(ass) ? ass : []);
        setMedicalRecords(Array.isArray(recs) ? recs : []);
        setAlerts(Array.isArray(l) ? l : []);

        const [b, t, d, hourly, warn] = await Promise.all([
          api(`/astronauts/${id}/baselines`).catch(() => []),
          api(`/timeline/${id}`).catch(() => []),
          api(`/astronauts/${id}/documents`).catch(() => []),
          api(`/astronauts/${id}/telemetry/hourly?metric=Resting%20heart%20rate`).catch(() => null),
          api(`/astronauts/${id}/warnings`).catch(() => null),
        ]);
        setBaselines(Array.isArray(b) ? b : []);
        setTimeline(Array.isArray(t) ? t : []);
        setDocs(Array.isArray(d) ? d : []);
        if (hourly) setHourlyTelemetry(hourly);
        if (warn) {
          setActiveWarnings(warn.abnormal_behaviours || []);
          setFlightReadinessScore(warn.flight_readiness_score ?? 100);
          setOverallStatus(warn.overall_status ?? 'NOMINAL');
        }
      }

      if (user?.role === 'medical') await loadAdminUsers();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function askAssistant(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy || !selected) return;
    setBusy(true);
    setError('');
    setAnswer('');
    setAssistantResult(null);
    try {
      const result = await api('/assistant/ask', {
        method: 'POST',
        body: JSON.stringify({ question: prompt, astronaut_id: selected }),
      });
      setAnswer(result.answer || 'No answer was returned. Please try again.');
      setAssistantResult(result);
    } catch (e: any) {
      setError(e.message || 'The assistant request failed. Check the backend connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  // Firebase Real-time Astronauts Subscription
  useEffect(() => {
    if (!firebaseActive) return;
    const unsub = subscribeToAstronauts((fbA) => {
      if (fbA && fbA.length) setAstronauts(fbA);
    });
    return () => unsub();
  }, [firebaseActive]);

  const astronaut = astronauts.find((a: Any) => a.id === selected) || astronauts[0];

  // Firebase Real-time Measurements Subscription
  useEffect(() => {
    const aid =
      user?.role !== 'medical' && user?.astronaut_id
        ? user.astronaut_id
        : selected || astronaut?.id || astronauts[0]?.id || 1;
    if (!aid || !firebaseActive) return;

    const unsub = subscribeToMeasurements(aid, (fbM) => {
      if (fbM && fbM.length) {
        setMeasurements(fbM);
        setPacketCount(fbM.length);
      }
    });
    return () => unsub();
  }, [selected, user, astronaut, astronauts, firebaseActive]);

  // Firebase Real-time Alerts Subscription
  useEffect(() => {
    if (!firebaseActive) return;
    const unsub = subscribeToAlerts((fbL) => {
      if (fbL && fbL.length) setAlerts(fbL);
    });
    return () => unsub();
  }, [firebaseActive]);

  // Firebase Real-time Users Subscription
  useEffect(() => {
    if (!firebaseActive) return;
    const unsub = subscribeToFirebaseUsers((fbU) => {
      if (fbU && fbU.length) setSystemUsers(fbU);
    });
    return () => unsub();
  }, [firebaseActive]);

  // Firebase Real-time Medical Records Subscription
  useEffect(() => {
    const aid =
      user?.role !== 'medical' && user?.astronaut_id
        ? user.astronaut_id
        : selected || astronaut?.id || astronauts[0]?.id || 1;
    if (!aid || !firebaseActive) return;

    const unsub = subscribeToMedicalRecords(aid, (fbR) => {
      if (fbR && fbR.length) setMedicalRecords(fbR);
    });
    return () => unsub();
  }, [selected, user, astronaut, astronauts, firebaseActive]);

  useEffect(() => {
    load();
  }, [token, selected]);

  useEffect(() => {
    if (!token || tab !== 'AI assistant') return;
    let active = true;
    api('/assistant/status')
      .then((status) => { if (active) setAssistantStatus(status); })
      .catch(() => { if (active) setAssistantStatus(null); });
    return () => { active = false; };
  }, [token, tab]);

  const metrics = useMemo(
    () => Array.from(new Set(measurements.map((x: Any) => x.metric))),
    [measurements]
  );
  const latest = (metric: string) =>
    measurements.filter((x: Any) => x.metric === metric).at(-1);
  const baseline = (metric: string) =>
    baselines.find((x: Any) => x.metric === metric);

  // Real-time multi-domain vitals for the Digital Twin anatomical model
  const liveVitals = useMemo(() => {
    return {
      heartRate: latest('Resting heart rate')?.value ?? 84.9,
      hrv: latest('Heart rate variability')?.value ?? 42.1,
      systolicBp: latest('Systolic blood pressure')?.value ?? 130,
      diastolicBp: 85,
      coreTemp: latest('Core body temperature')?.value ?? 37.1,
      grip: latest('Grip strength')?.value ?? 44.2,
      sleepHours: latest('Sleep duration')?.value ?? 5.2,
      fatigue: latest('Fatigue')?.value ?? 7,
      cabinCo2: latest('Cabin CO2')?.value ?? 0.38,
      radiation: latest('Radiation dose rate')?.value ?? 0.42,
    };
  }, [measurements]);

  // Dynamic pill group depending on active sidebar tab
  const availablePills = useMemo(() => {
    if (tab === 'Cardiovascular') {
      return ['Heart Rate', 'HRV', 'Systolic BP'];
    }
    if (tab === 'Behavioural') {
      return ['Sleep duration', 'Fatigue', 'Sleep quality', 'Stress', 'Mood'];
    }
    // Overview tab: features all primary vital metrics from the reference screenshot
    return ['Heart Rate', 'HRV', 'Systolic BP', 'Core Temp', 'Grip', 'Sleep duration', 'Fatigue'];
  }, [tab]);

  // Handle switching tabs
  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    if (newTab === 'Cardiovascular') {
      setSelectedMetric('Heart Rate');
    } else if (newTab === 'Behavioural') {
      setSelectedMetric('Sleep duration');
    } else if (newTab === 'Overview') {
      setSelectedMetric('Heart Rate');
    }
  };

  // Ensure selectedMetric is always part of available pills
  useEffect(() => {
    if (!availablePills.includes(selectedMetric)) {
      setSelectedMetric(availablePills[0]);
    }
  }, [availablePills, selectedMetric]);

  // Real-time UTC and Mission Elapsed Time clock (1-second tick)
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setRealtimeClock({
        utc: d.toISOString().slice(11, 19) + ' UTC',
        met: `042:${d.toISOString().slice(11, 19)}`,
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Telemetry Downlink Stream (every 4 seconds)
  useEffect(() => {
    if (!token || !liveStreaming) return;

    const targetId =
      user?.role !== 'medical' && user?.astronaut_id
        ? user.astronaut_id
        : selected || astronaut?.id || astronauts[0]?.id || 1;

    const streamInterval = setInterval(async () => {
      try {
        setIsPulseActive(true);
        setTimeout(() => setIsPulseActive(false), 700);

        let tickData: Any | null = null;
        try {
          tickData = await api(`/astronauts/${targetId}/telemetry/live-tick`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
        } catch { tickData = null; }

        if (tickData && tickData.value !== undefined) {
          setMeasurements((prev) => {
            let lastIdx = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i]?.metric === 'Resting heart rate') {
                lastIdx = i;
                break;
              }
            }
            if (lastIdx === -1) return [...prev, tickData];
            const updated = [...prev];
            updated[lastIdx] = { ...updated[lastIdx], value: tickData.value };
            return updated;
          });

          // Also update active current hour in hourly telemetry (in-place)
          setHourlyTelemetry((prev: Any) => {
            if (!prev || !prev.hourly_points) return prev;
            const currentH = new Date().getUTCHours();
            const updatedPoints = prev.hourly_points.map((p: Any) => {
              if (p.hour_index === currentH || p.is_current) {
                return { ...p, value: tickData.value, is_current: true };
              }
              return p;
            });
            return {
              ...prev,
              current_value: tickData.value,
              hourly_points: updatedPoints,
            };
          });

          setLastSyncTime(new Date());

        }
      } catch (e) {
        console.warn('Real-time telemetry tick error:', e);
      }
    }, 4000);

    return () => clearInterval(streamInterval);
  }, [token, liveStreaming, selected, user, measurements, astronaut, astronauts, firebaseActive]);

  // Real-time background sync for alerts and assessments (every 8 seconds)
  useEffect(() => {
    if (!token || !liveStreaming) return;

    const targetId =
      user?.role !== 'medical' && user?.astronaut_id
        ? user.astronaut_id
        : selected || astronaut?.id || astronauts[0]?.id || 1;

    const syncInterval = setInterval(async () => {
      try {
        const [l, ass] = await Promise.all([
          api(`/alerts?astronaut_id=${targetId}`).catch(() => null),
          api(`/astronauts/${targetId}/assessments`).catch(() => null),
        ]);
        if (l && Array.isArray(l)) setAlerts(l);
        if (ass && Array.isArray(ass)) {
          const sorted = [...ass].sort(
            (x, y) =>
              new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime()
          );
          setAssessmentsList(sorted);
        }
      } catch (e) {
        console.warn('Background sync error:', e);
      }
    }, 8000);

    return () => clearInterval(syncInterval);
  }, [token, liveStreaming, selected, user, astronaut, astronauts]);

  // Real-time Firebase Firestore Subscription
  useEffect(() => {
    if (!firebaseActive) return;
    const targetId =
      user?.role !== 'medical' && user?.astronaut_id
        ? user.astronaut_id
        : selected || astronaut?.id || astronauts[0]?.id || 1;

    const unsubscribe = subscribeToAssessments(targetId, (cloudAssessments) => {
      if (cloudAssessments && cloudAssessments.length > 0) {
        setAssessmentsList((prev) => {
          const merged = [...prev];
          for (const item of cloudAssessments) {
            const exists = merged.some(
              (x: Any) =>
                x.id === item.id ||
                (x.timestamp === item.timestamp && x.symptoms === item.symptoms)
            );
            if (!exists) merged.push(item);
          }
          return merged.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
      }
    });

    return () => unsubscribe();
  }, [firebaseActive, selected, user, astronaut, astronauts]);

  // Firebase Real-time Users Subscription (for Admin approvals)
  useEffect(() => {
    if (!firebaseActive || !isAdmin) return;
    const unsub = subscribeToFirebaseUsers((fbUsers) => {
      if (fbUsers && fbUsers.length > 0) {
        setSystemUsers((prev) => {
          const map = new Map<string, Any>();
          for (const u of prev) map.set(u.username, u);
          for (const u of fbUsers) {
            const existing = map.get(u.username) || {};
            map.set(u.username, { ...existing, ...u });
          }
          return Array.from(map.values());
        });
      }
    });
    return () => unsub();
  }, [firebaseActive, isAdmin]);

  // Firebase Real-time Medical Records Subscription
  useEffect(() => {
    const aid =
      user?.role !== 'medical' && user?.astronaut_id
        ? user.astronaut_id
        : selected || astronaut?.id || astronauts[0]?.id || 1;
    if (!aid || !firebaseActive) return;

    const unsub = subscribeToMedicalRecords(aid, (fbRecs) => {
      if (fbRecs && fbRecs.length > 0) {
        setMedicalRecords((prev) => {
          const map = new Map<string, Any>();
          for (const r of prev) map.set(r.id || r.title, r);
          for (const r of fbRecs) map.set(r.id || r.title, r);
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });
      }
    });
    return () => unsub();
  }, [selected, user, astronaut, astronauts]);

  // Mapping from pill label to underlying measurement metric in database
  const metricMap: Record<string, string> = {
    'Heart Rate': 'Resting heart rate',
    'HRV': 'HRV',
    'Systolic BP': 'Systolic BP',
    'Core Temp': 'Core Temp',
    'Grip': 'Grip',
    'Body mass': 'Body mass',
    'Sleep duration': 'Sleep duration',
    'Fatigue': 'Fatigue',
    'Sleep quality': 'Sleep quality',
    'Stress': 'Stress',
    'Mood': 'Mood',
    'Cabin CO2': 'Cabin CO2',
    'Radiation dose rate': 'Radiation dose rate',
  };

  const backendMetric = useMemo(() => {
    const target = metricMap[selectedMetric] || selectedMetric;
    const available = measurements.map((m: Any) => m.metric);
    if (available.includes(target)) return target;
    if (selectedMetric === 'Core Temp' && available.includes('Temperature')) return 'Temperature';
    if (selectedMetric === 'Grip' && available.includes('Body mass')) return 'Body mass';
    return target;
  }, [selectedMetric, measurements]);

  // Fetch Hourly Telemetry and Warnings on astronaut or metric change
  useEffect(() => {
    if (!token) return;
    const targetId =
      user?.role !== 'medical' && user?.astronaut_id
        ? user.astronaut_id
        : selected || astronaut?.id || astronauts[0]?.id || 1;
    if (!targetId) return;

    let isMounted = true;
    Promise.all([
      api(`/astronauts/${targetId}/telemetry/hourly?metric=${encodeURIComponent(backendMetric)}`).catch(() => null),
      api(`/astronauts/${targetId}/warnings`).catch(() => null),
    ]).then(([hourly, warn]) => {
      if (!isMounted) return;
      if (hourly) setHourlyTelemetry(hourly);
      if (warn) {
        setActiveWarnings(warn.abnormal_behaviours || []);
        setFlightReadinessScore(warn.flight_readiness_score ?? 100);
        setOverallStatus(warn.overall_status ?? 'NOMINAL');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [token, selected, user, astronaut, astronauts, backendMetric]);

  // Compute the stored mission-history curve and robust comparison band.
  const telemetryData = useMemo(() => {
    const filtered = measurements
      .filter((m: Any) => m.metric === backendMetric && !['poor', 'invalid', 'unverified'].includes(String(m.quality || 'good').toLowerCase()))
      .sort((a: Any, b: Any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (!filtered.length) {
      return {
        points: [],
        unit: 'BPM',
        median: 0,
        upper: 0,
        lower: 0,
        domain: [0, 100] as [number, number],
        ticks: [0, 25, 50, 75, 100],
      };
    }

    const rawUnit = filtered[0].unit;
    const unit = rawUnit === 'bpm' ? 'BPM' : rawUnit;

    // Match backend baseline selection: exclude the latest three readings when
    // there is enough history so recent drift does not redefine the baseline.
    const calSlice = filtered.length >= 9 ? filtered.slice(0, -3) : filtered;
    const calValues = calSlice.map((m: Any) => Number(m.value)).sort((a: number, b: number) => a - b);
    const mid = Math.floor(calValues.length / 2);
    const calculatedMedian =
      calValues.length % 2 === 0
        ? (calValues[mid - 1] + calValues[mid]) / 2
        : calValues[mid];

    const diffs = calValues.map((v: number) => Math.abs(v - calculatedMedian)).sort((a: number, b: number) => a - b);
    const calculatedMad =
      diffs.length % 2 === 0
        ? (diffs[mid - 1] + diffs[mid]) / 2
        : diffs[mid];

    const median = Number(calculatedMedian.toFixed(1));
    const scale = 2.5 * Math.max(1.4826 * calculatedMad, Math.abs(median) * 0.05, 0.01);
    const lower = Number((median - scale).toFixed(2));
    const upper = Number((median + scale).toFixed(2));

    const points = filtered.map((m: Any, idx: number) => {
      const dayNum = idx + 1;
      const isDrift = m.value > upper || m.value < lower;
      return {
        day: `D${dayNum}`,
        dayLabel: `D${dayNum}`,
        dayFull: `Day ${dayNum}`,
        value: m.value,
        unit,
        isDrift,
        baselineMedian: median,
        baselineLower: lower,
        baselineUpper: upper,
      };
    });

    const allVals = points.map((p: any) => p.value);
    const minVal = Math.min(...allVals, lower);
    const maxVal = Math.max(...allVals, upper);
    const span = maxVal - minVal;
    const pad = span > 0 ? span * 0.15 : Math.max(Math.abs(minVal) * 0.1, 1);
    const rawLow = minVal - pad;
    const rawHigh = maxVal + pad;
    const isDecimal = ['Core Temp', 'Cabin CO2', 'Radiation dose rate'].includes(selectedMetric) || span < 5;

    let yDomain: [number, number];
    let yTicks: number[];

    if (isDecimal) {
      const low = Number(rawLow.toFixed(1));
      const high = Number(rawHigh.toFixed(1));
      yDomain = [low, high];
      const step = (high - low) / 4;
      yTicks = [low, Number((low + step).toFixed(2)), Number((low + step * 2).toFixed(2)), Number((low + step * 3).toFixed(2)), high];
    } else {
      const low = Math.floor(rawLow);
      const high = Math.ceil(rawHigh);
      yDomain = [low, high];
      const step = Math.max(1, Math.round((high - low) / 4));
      yTicks = [low, low + step, low + step * 2, low + step * 3, low + step * 4];
    }

    return {
      points,
      unit,
      median,
      lower,
      upper,
      domain: yDomain,
      ticks: yTicks,
    };
  }, [measurements, backendMetric, selectedMetric]);

  // Custom dot to render distinct red circular markers with dark border on drift points
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.isDrift || cx === undefined || cy === undefined) {
      return null;
    }
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill="#ef4444"
        stroke="#1e222d"
        strokeWidth={1.5}
      />
    );
  };

  // Compute 24-hour hourly telemetry profile
  const hourlyChartData = useMemo(() => {
    const aid = selected || astronaut?.id || 1;
    const isMaya = aid === 1;

    let points: Any[] = [];
    if (hourlyTelemetry && hourlyTelemetry.hourly_points && hourlyTelemetry.hourly_points.length) {
      points = hourlyTelemetry.hourly_points.map((p: Any) => ({
        hour: p.hour,
        hour_code: p.hour_code || `H${String(p.hour_index).padStart(2, '0')}`,
        hour_index: p.hour_index,
        dayLabel: `Hour ${p.hour}`,
        value: p.value,
        unit: p.unit || telemetryData.unit,
        is_current: p.is_current,
        isDrift: p.is_drift,
        baselineMedian: telemetryData.median,
        baselineLower: telemetryData.lower,
        baselineUpper: telemetryData.upper,
      }));
    } else {
      // Fallback 24-hour circadian curve
      const currentH = new Date().getUTCHours();
      const base = isMaya ? 84.0 : 66.0;
      const nadir = isMaya ? 68.0 : 56.0;
      for (let h = 0; h < 24; h++) {
        const angle = ((h - 3) / 24.0) * 2.0 * Math.PI;
        const factor = (1.0 - Math.cos(angle)) / 2.0;
        const val = Math.round((nadir + (base - nadir) * factor + ((h * 7 + aid * 13) % 9 - 4) * 0.35) * 10) / 10;
        points.push({
          hour: `${String(h).padStart(2, '0')}:00`,
          hour_code: `H${String(h).padStart(2, '0')}`,
          hour_index: h,
          dayLabel: `Hour ${h}:00`,
          value: val,
          unit: telemetryData.unit,
          is_current: h === currentH,
          isDrift: isMaya ? val > 75.0 : val > 80.0,
          baselineMedian: telemetryData.median,
          baselineLower: telemetryData.lower,
          baselineUpper: telemetryData.upper,
        });
      }
    }

    const allVals = points.map((p: Any) => p.value);
    const minVal = Math.min(...allVals, telemetryData.lower);
    const maxVal = Math.max(...allVals, telemetryData.upper);
    const span = maxVal - minVal;
    const pad = span > 0 ? span * 0.15 : 2;
    const low = Math.floor(minVal - pad);
    const high = Math.ceil(maxVal + pad);
    const step = Math.max(1, Math.round((high - low) / 4));

    return {
      points,
      domain: [low, high] as [number, number],
      ticks: [low, low + step, low + step * 2, low + step * 3, low + step * 4],
    };
  }, [hourlyTelemetry, telemetryData, selected, astronaut]);

  // Custom Hourly Dot: pulses radar ring on the current live hour, red on drift
  const CustomHourlyDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || cx === undefined || cy === undefined) return null;
    if (payload.is_current) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={8} fill="none" stroke="#0284c7" strokeWidth={2} opacity={0.6}>
            <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r={4.5} fill="#0284c7" stroke="#ffffff" strokeWidth={2} />
        </g>
      );
    }
    if (payload.isDrift) {
      return (
        <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#1e222d" strokeWidth={1.2} />
      );
    }
    return (
      <circle cx={cx} cy={cy} r={2.5} fill="#38bdf8" />
    );
  };

  // Custom active dot on hover
  const CustomActiveDot = (props: any) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill="#38bdf8"
        stroke="#ffffff"
        strokeWidth={2}
      />
    );
  };

  // Sleek dark floating tooltip matching the reference image
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const title = telemetryMode === 'hourly'
        ? `${data.hour || label} · Day 42 illustrative profile${data.is_current ? ' · latest stored reading' : ''}`
        : (data.dayFull || label);

      return (
        <div className="telemetry-tooltip">
          <div className="tooltip-day">{title}</div>
          <div className="tooltip-value">
            {data.value} <span className="tooltip-unit">{data.unit}</span>
          </div>
          <div className="tooltip-baseline">
            Baseline: {data.baselineMedian} {data.unit} ({data.baselineLower}-
            {data.baselineUpper})
          </div>
          {data.is_current && (
            <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#0284c7', fontWeight: 700 }}>
              ● Active LEO Downlink Signal
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Dynamic Behavioral Data & Statistics
  const latestAssessment = assessmentsList[assessmentsList.length - 1] || assessment;
  const recentAssessments = assessmentsList.slice(-7);
  const avgSleep7Days = recentAssessments.length
    ? (recentAssessments.reduce((acc, curr) => acc + (curr.sleep_hours || 0), 0) / recentAssessments.length).toFixed(1)
    : '--';

  const behaviouralChartPoints = useMemo(() => {
    if (!assessmentsList.length) {
      return [];
    }

    return assessmentsList.map((a: Any, idx: number) => {
      let val = a.sleep_hours;
      let isAnomaly = false;

      if (behaviouralMetric === 'Fatigue') {
        val = a.fatigue;
        isAnomaly = a.fatigue >= 5;
      } else if (behaviouralMetric === 'Stress') {
        val = a.stress;
        isAnomaly = a.stress >= 5;
      } else if (behaviouralMetric === 'Mood') {
        val = a.mood;
        isAnomaly = a.mood <= 4;
      } else if (behaviouralMetric === 'Sleep Quality') {
        val = a.sleep_quality;
        isAnomaly = a.sleep_quality <= 4;
      } else {
        val = a.sleep_hours;
        isAnomaly = a.sleep_hours < 6.0;
      }

      return {
        day: `D${idx + 1}`,
        dayNum: idx + 1,
        value: val,
        sleep_hours: a.sleep_hours,
        fatigue: a.fatigue,
        stress: a.stress,
        mood: a.mood,
        sleep_quality: a.sleep_quality,
        symptoms: a.symptoms,
        timestamp: a.timestamp,
        isAnomaly,
      };
    });
  }, [assessmentsList, behaviouralMetric]);

  const behaviouralMeta = useMemo(() => {
    const count = assessmentsList.length;
    const calcAvg = (key: string) =>
      count ? assessmentsList.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0) / count : 0;

    switch (behaviouralMetric) {
      case 'Fatigue': {
        const val = count ? Number(calcAvg('fatigue').toFixed(1)) : 0;
        return {
          unit: '/10',
          targetLabel: `Historical avg: ${val}/10 (Nominal: <= 3/10)`,
          baselineVal: val,
          color: '#ef4444',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      }
      case 'Stress': {
        const val = count ? Number(calcAvg('stress').toFixed(1)) : 0;
        return {
          unit: '/10',
          targetLabel: `Historical avg: ${val}/10 (Nominal: <= 4/10)`,
          baselineVal: val,
          color: '#f59e0b',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      }
      case 'Mood': {
        const val = count ? Number(calcAvg('mood').toFixed(1)) : 0;
        return {
          unit: '/10',
          targetLabel: `Historical avg: ${val}/10 (Nominal: >= 7/10)`,
          baselineVal: val,
          color: '#10b981',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      }
      case 'Sleep Quality': {
        const val = count ? Number(calcAvg('sleep_quality').toFixed(1)) : 0;
        return {
          unit: '/10',
          targetLabel: `Historical avg: ${val}/10 (Nominal: >= 7/10)`,
          baselineVal: val,
          color: '#8b5cf6',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      }
      case 'Sleep Duration':
      default: {
        const val = count ? Number(calcAvg('sleep_hours').toFixed(1)) : 0;
        return {
          unit: 'hrs',
          targetLabel: `Historical avg: ${val} hrs (Target: 7.0 – 8.5 hrs)`,
          baselineVal: val,
          color: '#0284c7',
          yDomain: [0, 12],
          yTicks: [0, 3, 6, 9, 12],
        };
      }
    }
  }, [behaviouralMetric, assessmentsList]);

  const BehaviouralDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.isAnomaly || cx === undefined || cy === undefined) {
      return null;
    }
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill="#ef4444"
        stroke="#1e222d"
        strokeWidth={1.5}
      />
    );
  };

  const CustomBehaviouralTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="telemetry-tooltip">
          <div className="tooltip-day">Day {data.dayNum} {data.timestamp ? `· ${fmt(data.timestamp)}` : ''}</div>
          <div className="tooltip-value">
            {data.value} <span className="tooltip-unit">{behaviouralMeta.unit}</span>
          </div>
          <div className="tooltip-baseline" style={{ marginTop: '4px' }}>
            Sleep: {data.sleep_hours} hrs (Quality: {data.sleep_quality}/10)
          </div>
          <div className="tooltip-baseline">
            Fatigue: {data.fatigue}/10 · Stress: {data.stress}/10 · Mood: {data.mood}/10
          </div>
          {data.symptoms && data.symptoms !== 'None reported' && (
            <div style={{ color: '#fca5a5', fontSize: '10px', marginTop: '4px', fontStyle: 'italic' }}>
              &ldquo;{data.symptoms}&rdquo;
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Handler to open Daily Clinical Health Report
  const handleOpenDailyReport = async (aid?: number) => {
    const targetId = aid || (user?.role !== 'medical' && user?.astronaut_id
      ? user.astronaut_id
      : selected || astronaut?.id || astronauts[0]?.id || 1);

    setIsGeneratingReport(true);
    setReportSavedSuccess(false);
    try {
      const rep = await api(`/astronauts/${targetId}/reports/daily?day=42`);
      setDailyReportData(rep);
      setDailyReportModalOpen(true);
    } catch (e: any) {
      setError(`Could not load the daily data summary: ${e.message || 'backend unavailable'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSaveDailyReport = async (aid: number) => {
    setIsGeneratingReport(true);
    try {
      await api(`/astronauts/${aid}/reports/daily/generate?day=42`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setReportSavedSuccess(true);
      const recs = await api(`/astronauts/${aid}/medical-records`).catch(() => []);
      if (recs && recs.length) setMedicalRecords(recs);
    } catch (e: any) {
      console.warn('Save report error:', e);
      setError(`Could not save summary: ${e.message || 'backend unavailable'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Fetch fleet-wide health status and clearances for Flight Surgeon Admin
  const loadFleetData = async () => {
    if (!isAdmin || !token) return;
    try {
      const fleet = await api('/fleet/readiness');
      if (fleet && Array.isArray(fleet)) {
        setFleetData(fleet);
      }
    } catch (e) {
      console.warn('Fleet data load error:', e);
    }
  };

  useEffect(() => {
    if (isAdmin && token) {
      loadFleetData();
    }
  }, [isAdmin, token, selected]);

  // Flight Clearance Authority: Flight Surgeon updates astronaut clearance
  const handleUpdateClearance = async (aid: number, newClearance: string) => {
    setClearanceUpdating(true);
    try {
      await api(`/astronauts/${aid}/clearance`, {
        method: 'POST',
        body: JSON.stringify({ clearance: newClearance }),
      });
      setAstronauts((prev) =>
        prev.map((a: Any) =>
          a.id === aid ? { ...a, status: newClearance, flight_clearance: newClearance } : a
        )
      );
      loadFleetData();
      const recs = await api(`/astronauts/${aid}/medical-records`).catch(() => []);
      if (recs && recs.length) setMedicalRecords(recs);
    } catch (e: any) {
      setError(e.message || 'Failed to update clearance');
    } finally {
      setClearanceUpdating(false);
    }
  };

  const loadCountermeasures = async () => {
    if (!token || !user?.astronaut_id) return;
    setAdherenceLoading(true);
    setAdherenceError('');
    try {
      const result = await api(`/astronauts/${user.astronaut_id}/countermeasures?date=${adherenceDate}`);
      setAdherenceChecks(Object.fromEntries((result.items || []).map((item: Any) => [item.key, !!item.check?.completed])));
    } catch (e: any) {
      setAdherenceError(e.message || 'Could not load checklist records.');
    } finally { setAdherenceLoading(false); }
  };

  useEffect(() => { loadCountermeasures(); }, [token, user?.astronaut_id, adherenceDate]);

  const toggleAdherence = async (key: string) => {
    if (!user?.astronaut_id) return;
    setAdherenceError('');
    try {
      await api(`/astronauts/${user.astronaut_id}/countermeasures/${key}?date=${adherenceDate}`, {
        method: 'PUT', body: JSON.stringify({ completed: !adherenceChecks[key] }),
      });
      setAdherenceChecks((prev) => ({ ...prev, [key]: !prev[key] }));
    } catch (e: any) { setAdherenceError(e.message || 'Could not save checklist update.'); }
  };

  const adherenceCompletedCount = Object.values(adherenceChecks).filter(Boolean).length;
  const adherencePercent = Math.round((adherenceCompletedCount / 4) * 100);

  // Astronaut Telemedicine Request transmission
  const handleSendConsult = async () => {
    if (!consultNote.trim()) return;
    setConsultSubmitting(true);
    setConsultFeedback('');
    try {
      const aid = user?.astronaut_id || selected || 1;
      await api(`/astronauts/${aid}/request-consult`, {
        method: 'POST',
        body: JSON.stringify({ note: consultNote.trim(), urgency: 'high' }),
      });
      setConsultFeedback('✓ Consultation request saved to the mission medical review queue.');
      setConsultNote('');
      setTimeout(() => {
        setConsultModalOpen(false);
        setConsultFeedback('');
      }, 2000);
    } catch (e: any) {
      setConsultFeedback(`Error: ${e.message || 'Failed to send request'}`);
    } finally {
      setConsultSubmitting(false);
    }
  };

  // Admin Ability: Fleet Operational Readiness Triage Grid
  const renderFleetTriage = () => {
    if (!isAdmin) return null;
    const items = fleetData;
    if (!items.length) return <div className="empty">Fleet analytics are unavailable. Check the backend connection.</div>;

    return (
      <div className="fleet-triage-container">
        <div className="fleet-triage-header">
          <span className="fleet-triage-title">
            <Users size={15} /> FLEET DATA COVERAGE & REVIEW QUEUE
          </span>
          <span style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: 'var(--text-muted)' }}>
            Prototype monitoring · select a crew member to inspect telemetry and records
          </span>
        </div>
        <div className="fleet-grid">
          {items.map((f: Any) => {
            const a = f.astronaut;
            const isCurrent = (selected || astronaut?.id || 1) === a.id;
            const scoreClass = 'nominal';
            const clearance = f.flight_clearance || a.flight_clearance || 'UNREVIEWED';
            const clearanceClass = clearance === 'FLIGHT READY' ? 'ready' : clearance === 'RESTRICTED WORKLOAD' ? 'restricted' : 'hold';

            return (
              <div
                key={a.id}
                className={`fleet-card ${isCurrent ? 'selected' : ''}`}
                onClick={() => setSelected(a.id)}
              >
                <div className="fleet-card-top">
                  <div className="fleet-astro-info">
                    <div className="fleet-avatar">
                      {a.call_sign?.slice(0, 2) || 'AS'}
                    </div>
                    <div className="fleet-astro-text">
                      <h4>{a.name}</h4>
                      <span>{a.call_sign} · {a.mission || 'Asteria-7'}</span>
                    </div>
                  </div>
                  <div className="fleet-score-dial">
                    <span className={`fleet-score-num ${scoreClass}`}>
                      {f.monitoring_coverage ?? f.flight_readiness_score}%
                    </span>
                    <span className="fleet-score-label">Data coverage</span>
                  </div>
                </div>

                <div className="fleet-card-body">
                  <span className={`clearance-pill ${clearanceClass}`}>
                    ● {clearance}
                  </span>
                  <span className="fleet-inspect-indicator">
                    {isCurrent ? '● Active View' : 'Inspect →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Astronaut Ability: Daily Spaceflight Countermeasure Adherence Tracker
  const renderAstronautDutyCard = () => {
    if (!isUser) return null;
    const protocols = [
      { key: 'aerobic', title: 'Assigned aerobic session', desc: 'Check completion against your individual flight plan.', icon: '🏃‍♂️' },
      { key: 'resistance', title: 'Assigned resistance session', desc: 'Check completion against your individual flight plan.', icon: '🏋️‍♂️' },
      { key: 'hydration', title: 'Hydration check-in', desc: 'Use the guidance in your individual flight plan.', icon: '💧' },
      { key: 'sleep', title: 'Sleep / circadian check-in', desc: 'Log the planned routine or any issue.', icon: '💡' },
    ];

    return (
      <div className="astronaut-duty-card">
        <div className="astronaut-duty-head">
          <div className="duty-title">
            <Activity size={18} color="#0284c7" />
            <div>
              <h3>Daily mission check-ins</h3>
              <p>Illustrative checklist for {astronaut?.name || 'astronaut'} · follow the individual flight plan.</p>
            </div>
          </div>
          <div className="adherence-bar-container">
            <div className="adherence-progress-track">
              <div className="adherence-progress-fill" style={{ width: `${adherencePercent}%` }} />
            </div>
            <span className="adherence-percent">{adherencePercent}% recorded ({adherenceCompletedCount}/4)</span>
          </div>
        </div>

        <div className="countermeasure-checklist">
          {protocols.map((p) => {
            const isDone = !!adherenceChecks[p.key];
            return (
              <div
                key={p.key}
                className={`checklist-item ${isDone ? 'completed' : ''}`}
                role="checkbox"
                aria-checked={isDone}
                tabIndex={0}
                onClick={() => toggleAdherence(p.key)}
                onKeyDown={(e) => { if (!adherenceLoading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleAdherence(p.key); } }}
                aria-disabled={adherenceLoading}
              >
                <div className="checklist-checkbox">
                  {isDone && <Check size={13} strokeWidth={3} />}
                </div>
                <div className="checklist-content">
                  <div className="checklist-title">
                    {p.icon} {p.title}
                  </div>
                  <div className="checklist-desc">{p.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="checklist-footer">
          <label>Checklist date <input type="date" value={adherenceDate} onChange={(e) => setAdherenceDate(e.target.value)} /></label>
          <small>Self-reported completion; these items do not prescribe duration, dose, or treatment.</small>
        </div>
        {adherenceError && <p className="error">{adherenceError}</p>}
      </div>
    );
  };

  // Reusable Abnormal Behaviour & Anomaly Warning Banner
  const renderAbnormalWarningBanner = () => {
    if (!activeWarnings || activeWarnings.length === 0) return null;
    const isCritical = activeWarnings.some((w: Any) => w.severity === 'PRIORITY REVIEW');
    const targetAstro = astronauts.find((a: Any) => a.id === (selected || astronaut?.id || 1)) || astronaut;

    return (
      <div className={`abnormal-warning-banner ${isCritical ? 'critical' : 'elevated'}`}>
        <div className="warning-banner-top">
          <div className="warning-banner-header">
            <div className="warning-icon-pill">
              <AlertTriangle size={18} />
            </div>
            <div className="warning-banner-title">
              <h3>
                {isCritical ? '⚠️ Priority review: baseline deviation detected' : '⚡ Baseline deviation for review'}
              </h3>
              <p>
                Prototype monitoring flagged {activeWarnings.length} illustrative personal-baseline deviation(s) for {targetAstro?.name || 'crew member'}.
              </p>
            </div>
          </div>
          <div className="warning-readiness-badge">
            <span className="readiness-score-tag">{flightReadinessScore}%</span>
            <span className="readiness-label-tag">Data coverage · not clearance</span>
          </div>
        </div>

        <div className="warning-items-grid">
          {activeWarnings.map((w: Any, idx: number) => (
            <div key={idx} className="warning-item-card">
              <div className="warning-item-header">
                <span className="warning-category">{w.category}</span>
                <span className={`warning-severity ${w.severity.toLowerCase()}`}>{w.severity} PRIORITY</span>
              </div>
              <div className="warning-item-title">{w.title}</div>
              <div className="warning-item-desc">{w.detail}</div>
            </div>
          ))}
        </div>

        <div className="warning-actions-row">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Review the underlying measurements and sources; this prototype does not recommend treatment.
          </span>
          <button
            type="button"
            className="btn-clinical-report"
            onClick={() => handleOpenDailyReport(targetAstro?.id)}
          >
            📋 Generate & Review Daily Clinical Health Report →
          </button>
        </div>
      </div>
    );
  };

  // Reusable Telemetry Trend Card with Hourly / Mission view switcher
  const renderTelemetryCard = () => {
    const isHourly = telemetryMode === 'hourly';
    const activePoints = isHourly ? hourlyChartData.points : telemetryData.points;
    const activeDomain = isHourly ? hourlyChartData.domain : telemetryData.domain;
    const activeTicks = isHourly ? hourlyChartData.ticks : telemetryData.ticks;

    return (
      <section className="telemetry-card">
        <div className="telemetry-head">
          <div className="telemetry-head-left">
            <div className="telemetry-title-row">
              <h2>Mission Telemetry Trend</h2>
              <div className="telemetry-mode-toggle">
                <button
                  type="button"
                  className={`mode-toggle-btn ${isHourly ? 'active' : ''}`}
                  onClick={() => setTelemetryMode('hourly')}
                  title="View 24-hour circadian telemetry readings"
                >
                  ⏱️ 24-Hour Hourly
                </button>
                <button
                  type="button"
                  className={`mode-toggle-btn ${!isHourly ? 'active' : ''}`}
                  onClick={() => setTelemetryMode('mission')}
                  title="View stored mission history"
                >
                  📅 Mission history
                </button>
              </div>
            </div>
            <p className="telemetry-subtitle">
              {isHourly
                ? `Illustrative generated hourly profile for ${astronaut?.name || 'astronaut'} · Mars Transit Day 42`
                : (isAdmin
                  ? `Tracking longitudinal adaptation for ${astronaut?.name || 'astronaut'} relative to calibrated normal range (${telemetryData.median} ${telemetryData.unit})`
                  : `Tracking your personal adaptation relative to calibrated normal range (${telemetryData.median} ${telemetryData.unit})`)}
            </p>
          </div>

          <div className="telemetry-pills">
            {availablePills.map((m) => (
              <button
                key={m}
                className={`telemetry-pill-btn ${selectedMetric === m ? 'active' : ''}`}
                onClick={() => setSelectedMetric(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* REAL-TIME TELEMETRY DOWNLINK STRIP */}
        <div className="telemetry-live-strip">
          <div className="live-strip-left">
            <span className={`live-pulse-indicator ${isPulseActive ? 'beat' : ''}`}>
              <HeartPulse size={15} />
            </span>
            <span className="live-strip-metric">
              Live {selectedMetric}: <b>{latest(backendMetric)?.value ?? activePoints.at(-1)?.value ?? '--'}</b> {telemetryData.unit}
            </span>
            <span className="live-strip-tag">
              LEO Downlink · 0.25 Hz
            </span>
          </div>
          <div className="live-strip-right">
            <span className="live-strip-packets">
              Stored readings: <b>{packetCount}</b>
            </span>
            <span className="live-strip-time">
              Last check: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              type="button"
              className="live-strip-toggle-btn"
              onClick={() => setLiveStreaming(!liveStreaming)}
            >
              {liveStreaming ? 'Pause Stream' : 'Resume Stream'}
            </button>
          </div>
        </div>

        <div className="telemetry-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={activePoints}
              margin={{ top: 15, right: 25, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="telemetryFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#38bdf8"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="85%"
                    stopColor="#e0f2fe"
                    stopOpacity={0.04}
                  />
                  <stop
                    offset="100%"
                    stopColor="#ffffff"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} horizontal={false} />

              <XAxis
                dataKey={isHourly ? 'hour' : 'day'}
                ticks={isHourly ? ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:00'] : ['D1', 'D10', 'D20', 'D30', 'D42']}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: '#94a3b8',
                  fontSize: 11,
                  fontFamily: "'DM Mono', monospace",
                }}
                dy={8}
              />

              <YAxis
                domain={activeDomain}
                ticks={activeTicks}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: '#94a3b8',
                  fontSize: 11,
                  fontFamily: "'DM Mono', monospace",
                }}
                width={35}
              />

              <ReferenceLine
                y={telemetryData.median}
                stroke="#7dd3fc"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <ReferenceLine
                y={telemetryData.upper}
                stroke="#bae6fd"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <ReferenceLine
                y={telemetryData.lower}
                stroke="#bae6fd"
                strokeDasharray="3 3"
                strokeWidth={1}
              />

              <Tooltip
                cursor={{
                  stroke: '#cbd5e1',
                  strokeWidth: 1,
                }}
                content={<CustomTooltip />}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#telemetryFill)"
                dot={isHourly ? <CustomHourlyDot /> : <CustomDot />}
                activeDot={<CustomActiveDot />}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="telemetry-footer">
          <div className="telemetry-legend">
            <span className="legend-item">
              <span className="legend-dot telemetry-dot" /> {isHourly ? 'Hourly Telemetry' : 'Daily Telemetry'}
            </span>
            <span className="legend-item">
              <span className="legend-line baseline-line" /> Baseline Median
            </span>
            {!isHourly && <span className="legend-item"><span className="legend-dot drift-dot" /> Baseline deviation</span>}
            {isHourly && (
              <span className="legend-item">
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0284c7', marginRight: 4 }} /> Current hour marker
              </span>
            )}
          </div>
          <div className="telemetry-calibration">
            {isHourly ? 'Illustrative generated hourly profile · not stored telemetry' : 'Stored samples · comparison baseline excludes latest 3 readings'}
          </div>
        </div>
      </section>
    );
  };

  // Full NASA Aerospace Medicine Daily Clinical Health Report Modal
  const renderDailyReportModal = () => {
    if (!dailyReportModalOpen || !dailyReportData) return null;
    const isCritical = dailyReportData.overall_status === 'CRITICAL';
    const isElevated = dailyReportData.overall_status === 'ELEVATED RISK';
    const statusClass = isCritical ? 'critical' : isElevated ? 'elevated' : 'nominal';

    return (
      <div className="clinical-modal-overlay" onClick={() => setDailyReportModalOpen(false)}>
        <div className="clinical-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="clinical-modal-head">
            <div>
              <div className="clinical-modal-brand">{dailyReportData.mission} · PROTOTYPE HEALTH MONITORING</div>
              <h2 className="clinical-modal-title">Daily Health Data Summary</h2>
              <p className="clinical-modal-sub">
                Report ID: <b>{dailyReportData.report_id}</b> · Mission Day {dailyReportData.mission_day} · Crew: <b>{dailyReportData.astronaut_name}</b> ({dailyReportData.call_sign})
              </p>
            </div>
            <button
              type="button"
              className="clinical-modal-close"
              onClick={() => setDailyReportModalOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="clinical-modal-body">
            {/* Prototype monitoring coverage */}
            <div className="report-score-banner">
              <div className={`score-dial ${statusClass}`}>
                <span className="score-num">{dailyReportData.flight_readiness_score}</span>
                <span className="score-unit">DATA COVERAGE</span>
              </div>
              <div className="score-narrative">
                <div className="score-badge-row">
                  <span className={`score-status-badge ${statusClass}`}>
                    {dailyReportData.overall_status}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#64748b' }}>
                    Generated: {dailyReportData.date_str}
                  </span>
                </div>
                <p>{dailyReportData.executive_summary}</p>
                <small>{dailyReportData.score_note}</small>
              </div>
            </div>

            {/* System-by-System Breakdown */}
            <div>
              <div className="report-section-title"><FileText size={16} color="#0284c7" /> Source measurements and self-reports</div>
              <div className="report-systems-grid">
                {(dailyReportData.evidence || []).map((item: Any, idx: number) => (
                  <div className="system-card" key={`${item.metric}-${idx}`}>
                    <div className="system-card-top"><span className="system-name">{item.metric}</span><span>{item.simulated ? 'SIMULATED' : item.source}</span></div>
                    <div>{item.value} {item.unit} · {item.timestamp ? fmt(item.timestamp) : 'time unavailable'}</div>
                    <small>Baseline: {item.baseline_available ? `${item.baseline} ${item.unit} (n=${item.baseline_count})` : 'unavailable'} · source: {item.source}</small>
                  </div>
                ))}
              </div>
              {dailyReportData.missing_metrics?.length > 0 && <p className="muted">Missing / insufficient history: {dailyReportData.missing_metrics.join('; ')}</p>}
            </div>

            <div>
              <div className="report-section-title">
                <Activity size={16} color="#0284c7" /> Recorded observations by domain
              </div>
              <div className="report-systems-grid">
                {dailyReportData.domain_assessments && Object.entries(dailyReportData.domain_assessments).map(([key, sys]: any) => (
                  <div key={key} className="system-card">
                    <div className="system-card-top">
                      <span className="system-name">{sys.title}</span>
                      <span className={`system-status-pill ${sys.status === 'Recorded observations' ? 'nominal' : 'risk'}`}>
                        {sys.status}
                      </span>
                    </div>
                    <ul className="system-findings-list">
                      {sys.findings.map((f: string, i: number) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Abnormal Behaviour Findings */}
            {dailyReportData.abnormal_behaviours && dailyReportData.abnormal_behaviours.length > 0 && (
              <div>
                <div className="report-section-title">
                  <AlertTriangle size={16} color="#ef4444" /> Illustrative baseline deviations for review ({dailyReportData.abnormal_behaviours.length})
                </div>
                <div className="warning-items-grid">
                  {dailyReportData.abnormal_behaviours.map((b: Any, idx: number) => (
                    <div key={idx} className="warning-item-card">
                      <div className="warning-item-header">
                        <span className="warning-category">{b.category}</span>
                        <span className={`warning-severity ${b.severity.toLowerCase()}`}>{b.severity} PRIORITY</span>
                      </div>
                      <div className="warning-item-title">{b.title}</div>
                      <div className="warning-item-desc">{b.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="notice"><ShieldCheck size={16} /> Prototype-derived indicators are illustrative, not clinically validated, and do not determine flight clearance. Review the source data and individual flight plan.</div>
          </div>

          <div className="clinical-modal-foot">
            <div className="physician-signoff">
              Summary status: <b>{dailyReportData.status || 'Generated · pending clinician review'}</b>
            </div>
            <div className="modal-actions-right">
              {!isAdmin ? (
                <span style={{ font: "500 12px 'DM Sans'", color: 'var(--text-muted)' }}>Medical officer review is required to save this summary.</span>
              ) : reportSavedSuccess ? (
                <span style={{ font: "700 12px 'DM Sans'", color: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={15} /> Saved as a draft summary for clinician review.
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-primary-action"
                  disabled={isGeneratingReport}
                  onClick={() => handleSaveDailyReport(dailyReportData.astronaut_id)}
                >
                  {isGeneratingReport ? 'Saving summary…' : 'Save summary for review'}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.print()}
              >
                🖨️ Export PDF / Print
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDailyReportModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Reusable Header Crew Controls: Crew Badge & Daily Clinical Report across every single page
  const renderHeaderCrewControls = (extraControls?: React.ReactNode) => {
    // Current crew member to display (the selected astronaut, or logged in astronaut, or fallback)
    const activeCrew = astronaut || (astronauts && astronauts.find((a: Any) => a.id === selected)) || astronauts[0] || {
      id: 1,
      name: user?.full_name || user?.username || 'Maya Chen',
      call_sign: user?.call_sign || 'ORION-1',
      mission: 'Asteria-7',
      flight_clearance: 'FLIGHT READY',
    };

    return (
      <div className="header-crew-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {extraControls}

        {/* LOGGED IN / ACTIVE CREW MEMBER BADGE CARD */}
        <div className="personal-badge-card">
          <div className="personal-badge-top-row">
            <span className="personal-badge-label">
              {isAdmin ? 'EVALUATING CREW MEMBER' : 'LOGGED IN CREW MEMBER'}
            </span>
            {isAdmin && astronauts.length > 1 && (
              <div className="admin-astro-quick-select">
                <select
                  value={selected || activeCrew.id || ''}
                  onChange={(e) => setSelected(+e.target.value)}
                  title="Switch Astronaut"
                >
                  {astronauts.map((a: Any) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.call_sign})
                    </option>
                  ))}
                </select>
                <ChevronDown size={11} className="select-arrow" />
              </div>
            )}
          </div>
          <div className="personal-badge-name">
            <span className="personal-avatar">
              {activeCrew.call_sign?.slice(0, 2) || 'OR'}
            </span>
            <strong>{activeCrew.name}</strong>
          </div>
          <div className="personal-badge-callsign">
            Call Sign: <b>{activeCrew.call_sign}</b> · Mission: <b>{activeCrew.mission || 'Asteria-7'}</b>
          </div>
        </div>

        {/* Flight Surgeon Authority: Direct Flight Clearance Assignment (Admin only) */}
        {isAdmin && (
          <div className="clearance-control-row" title="Flight Surgeon medical clearance sign-off">
            <span className="clearance-control-label">Clearance:</span>
            <select
              className="clearance-select"
              value={activeCrew.flight_clearance || 'FLIGHT READY'}
              disabled={clearanceUpdating}
              onChange={(e) => handleUpdateClearance(activeCrew.id || selected || 1, e.target.value)}
            >
              <option value="FLIGHT READY">🟢 FLIGHT READY (Nominal)</option>
              <option value="RESTRICTED WORKLOAD">🟡 RESTRICTED WORKLOAD (Light EVA)</option>
              <option value="MEDICAL HOLD">🔴 MEDICAL HOLD (Grounded / Rest)</option>
            </select>
          </div>
        )}

        {/* Astronaut Actions: Clearance Status & Consult Flight Surgeon */}
        {!isAdmin && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span className={`clearance-pill ${(activeCrew.flight_clearance || 'FLIGHT READY') === 'FLIGHT READY' ? 'ready' : (activeCrew.flight_clearance || '') === 'RESTRICTED WORKLOAD' ? 'restricted' : 'hold'}`}>
              ● CLEARANCE: {activeCrew.flight_clearance || 'FLIGHT READY'}
            </span>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: '7px' }}
              onClick={() => setConsultModalOpen(true)}
            >
              🩺 Consult Flight Surgeon
            </button>
          </div>
        )}

        {/* DAILY CLINICAL REPORT BUTTON */}
        <button
          type="button"
          className="btn-clinical-report"
          onClick={() => handleOpenDailyReport()}
          title="Open Daily Clinical Report"
        >
          📋 Daily Clinical Report
        </button>
      </div>
    );
  };

  const pendingUsers = systemUsers.filter((u: Any) => u.status === 'pending_approval');
  const pendingApplicantsCount = pendingUsers.length;

  if (!token) {
    return (
      <main className="login">
        <button
          className="theme-toggle theme-toggle-floating"
          onClick={toggleTheme}
          title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
        >
          {isLight ? <Moon size={15} /> : <Sun size={15} />}
          <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
        </button>

        <section className="login-card">
          <div className="brand">
            <div>
              <img className="brand-logo" src="/orbitcare-logo-transparent.png" alt="ORBITCARE" />
              <small>MISSION HEALTH INTELLIGENCE</small>
            </div>
          </div>
          <p className="eyebrow">ASTRONAUT HEALTH SYSTEM</p>
          <h1>
            Mission health,
            <br />
            in context.
          </h1>
          <p className="muted">
            Sign in as <b>Medical Officer (Admin)</b> to evaluate crew and grant flight clearances, or as an <b>Astronaut (User)</b> to submit assessments and view personal telemetry.
          </p>

          {/* Auth Mode Switcher */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${authMode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signin');
                setError('');
                setLoginClearancePending(false);
              }}
            >
              <Users size={14} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('register');
                setError('');
                setLoginClearancePending(false);
              }}
            >
              <UserPlus size={14} />
              <span>Request Astronaut Account</span>
            </button>
          </div>

          {/* SIGN IN FORM */}
          {authMode === 'signin' && (
            <>
              {loginClearancePending && (
                <div className="login-pending-alert">
                  <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Flight Clearance Pending Authorization</strong>
                    Your astronaut account has been created and registered in the mission database. For flight safety, the <b>Flight Surgeon / Medical Officer (Admin)</b> must verify your credentials and approve your account before you can log in.
                  </div>
                </div>
              )}

              <form onSubmit={login}>
                <label>
                  Username
                  <input
                    name="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                  />
                </label>
                {error && !loginClearancePending && <p className="error">{error}</p>}
                <button disabled={busy}>
                  {busy ? 'Verifying Flight Clearance…' : 'Sign in to Dashboard'} <span>→</span>
                </button>
              </form>

              {/* COMPACT AUTO-FILL DEMO ACCOUNT PILLS */}
              <div className="login-quick-accounts">
                <div className="login-quick-title">Quick Demo Sign-In (Click to Auto-Fill):</div>
                <div className="login-quick-pills">
                  {demoAccounts.map((account) => {
                    const isSelected = usernameInput.toLowerCase() === account.username.toLowerCase();
                    return (
                      <button
                        key={account.username}
                        type="button"
                        className={`quick-account-pill ${account.isAdmin ? 'admin' : ''} ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setUsernameInput(account.username);
                          setPasswordInput('orbitcare-demo');
                          setError('');
                          setLoginClearancePending(false);
                        }}
                      >
                        {account.isAdmin ? (
                          <ShieldCheck size={13} className="pill-icon admin" />
                        ) : (
                          <Users size={13} className="pill-icon astronaut" />
                        )}
                        <span className="pill-name">{account.name}</span>
                        <span className="pill-tag">@{account.username}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* REQUEST ASTRONAUT ACCOUNT FORM */}
          {authMode === 'register' && (
            <>
              {regSuccess ? (
                <div className="reg-success-card">
                  <div className="reg-success-head">
                    <CheckCircle2 size={16} />
                    <span>APPLICATION TRANSMITTED TO MISSION CONTROL</span>
                  </div>
                  <p>{regMessage}</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
                    <span className="status-pill pending_approval">PENDING FLIGHT CLEARANCE</span>
                    <button
                      type="button"
                      className="role-preset-btn"
                      style={{ marginLeft: 'auto', background: '#0d9488', color: '#fff', border: 'none' }}
                      onClick={() => {
                        setAuthMode('signin');
                        setUsernameInput(regUsername);
                        setPasswordInput(regPassword);
                        setRegSuccess(false);
                      }}
                    >
                      Return to Sign In →
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={registerAstronaut}>
                  <label>
                    Full Name
                    <input
                      name="fullName"
                      placeholder="e.g. Dr. Alexander Vance"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Desired Username
                    <input
                      name="regUsername"
                      placeholder="e.g. alex"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="regPassword"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label>
                      Mission Call Sign
                      <input
                        placeholder="e.g. ARES-9"
                        value={regCallSign}
                        onChange={(e) => setRegCallSign(e.target.value)}
                      />
                    </label>
                    <label>
                      Mission
                      <input
                        placeholder="e.g. Asteria-7"
                        value={regMission}
                        onChange={(e) => setRegMission(e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    Flight Specialization
                    <select
                      value={regSpecialization}
                      onChange={(e) => setRegSpecialization(e.target.value)}
                      style={{
                        padding: '9px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-input)',
                        background: 'var(--bg-panel)',
                        color: 'var(--text-main)',
                        font: '500 12.5px sans-serif',
                      }}
                    >
                      <option value="Mission Specialist">Mission Specialist</option>
                      <option value="EVA Lead & Systems Specialist">EVA Lead & Systems Specialist</option>
                      <option value="Flight Engineer">Flight Engineer</option>
                      <option value="Commander">Commander</option>
                      <option value="Payload Specialist">Payload Specialist</option>
                    </select>
                  </label>

                  <div style={{ font: '500 11px/1.4 sans-serif', color: 'var(--text-muted)', margin: '4px 0 10px' }}>
                    ℹ️ Note: Submitted credentials remain in <b>Pending Approval</b> status until approved by the Medical Officer (Admin).
                  </div>

                  {regError && <p className="error">{regError}</p>}
                  <button disabled={regBusy}>
                    {regBusy ? 'Transmitting Application…' : 'Submit Astronaut Application'} <span>→</span>
                  </button>
                </form>
              )}
            </>
          )}

          <div className="login-foot">
            <ShieldCheck size={14} /> Decision support prototype · Simulated mission telemetry
          </div>
        </section>

        <aside className="login-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="planet" />
          <div className="art-copy">
            <span>ASTERIA-7 / LEO</span>
            <h2>
              One mission.
              <br />A clearer picture.
            </h2>
            <p>Connecting astronaut health signals across time and domain.</p>
          </div>
        </aside>
      </main>
    );
  }

  return (
    <div className="shell">
      {/* FIXED LOGO & EXPANDABLE POPUP NAVIGATION IN UPPER SECTION */}
      <div className="fixed-brand-anchor">
        <div
          className="brand-logo-container"
          onClick={() => {
            handleTabChange('Overview');
            setNavPopupOpen(false);
          }}
          title="Return to Overview"
          role="button"
          tabIndex={0}
        >
          <img className="brand-logo-fixed" src="/orbitcare-logo-transparent.png" alt="ORBITCARE" />
        </div>
        <button
          type="button"
          className={`nav-arrow-trigger ${navPopupOpen ? 'open' : ''}`}
          onClick={() => setNavPopupOpen((prev) => !prev)}
          aria-expanded={navPopupOpen}
          aria-label="Toggle navigation menu"
          title={navPopupOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
        >
          <span className="arrow-trigger-text">
            {isAdmin ? 'MISSION CONTROL' : 'ASTRONAUT PORTAL'}
          </span>
          <ChevronDown
            size={14}
            className={`arrow-chevron-icon ${navPopupOpen ? 'rotated' : ''}`}
          />
        </button>

        {/* FLOATING LIQUID-GLASS POPUP DRAWER */}
        {navPopupOpen && (
          <>
            <div
              className="nav-popup-backdrop"
              onClick={() => setNavPopupOpen(false)}
              aria-hidden="true"
            />
            <div
              className="nav-popup-drawer liquid-glass-panel"
              role="dialog"
              aria-label="Navigation Menu"
            >
              <div className="mission-label">
                {isAdmin ? 'FLIGHT SURGEON' : 'PERSONAL CONSOLE'}
              </div>
              <nav>
                {[
                  [LayoutDashboard, 'Overview'],
                  [HeartPulse, 'Cardiovascular'],
                  [Wind, 'Behavioural'],
                  [Clock3, 'Mission timeline'],
                  [FileText, 'Medical records'],
                  [MessageCircle, 'AI assistant'],
                  ...(isAdmin ? [[UserCheck, 'Crew accounts']] : []),
                ].map(([Icon, label]: any) => (
                  <button
                    className={tab === label ? 'nav active' : 'nav'}
                    onClick={() => {
                      handleTabChange(label);
                      setNavPopupOpen(false);
                    }}
                    key={label}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {label === 'Crew accounts' && pendingApplicantsCount > 0 && (
                      <span className="nav-badge">{pendingApplicantsCount}</span>
                    )}
                  </button>
                ))}
              </nav>
              <div className="sidebar-bottom">
                <div className={`live ${isPulseActive ? 'pulse-tick' : ''}`}>
                  <i /> {liveStreaming ? 'TELEMETRY DOWNLINK ACTIVE' : 'TELEMETRY STREAM PAUSED'}
                </div>
                <div className="profile">
                  <div className="avatar">{isAdmin ? 'MO' : 'AS'}</div>
                  <div>
                    <b>{user?.username}</b>
                    <small>
                      {isAdmin ? 'Medical Officer (Admin)' : `${astronaut?.name || 'Astronaut'} (User)`}
                    </small>
                  </div>
                  <button
                    title="Sign out"
                    onClick={() => {
                      localStorage.clear();
                      setToken('');
                      setUser(null);
                      setNavPopupOpen(false);
                    }}
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <main className="main">
        <header className="topbar">
          <div className="crumb">
            ASTERIA-7 <span>/</span> {isAdmin ? 'MISSION CONTROL' : 'ASTRONAUT PORTAL'} <span>/</span> {tab.toUpperCase()}
          </div>
          <div className="top-right">
            {/* Dashboard Mode Indicator */}
            {isAdmin ? (
              <span className="role-pill admin">
                <ShieldCheck size={13} /> Admin
              </span>
            ) : (
              <span className="role-pill user">
                <UserCheck size={13} /> Astronaut
              </span>
            )}

            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
            >
              {isLight ? <Moon size={15} /> : <Sun size={15} />}
              <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
            </button>

            {/* Real-time UTC & Mission Clock */}
            <div className="topbar-clock" title="Mission Elapsed Time & UTC Clock">
              <Clock3 size={13} className="topbar-clock-icon" />
              <span className="topbar-clock-utc">{realtimeClock.utc}</span>
              <span className="topbar-clock-met">MET {realtimeClock.met}</span>
            </div>

            {/* Live Telemetry Downlink Sync Pill & Toggle */}
            <button
              type="button"
              className={`live-sync-pill ${liveStreaming ? 'active' : 'paused'} ${isPulseActive ? 'pulsing' : ''}`}
              onClick={() => setLiveStreaming(!liveStreaming)}
              title={`Click to ${liveStreaming ? 'Pause' : 'Resume'} Real-Time Telemetry Stream`}
            >
              <span className="radar-beacon-dot" />
              <span className="live-sync-label">{liveStreaming ? 'LIVE SYNC' : 'PAUSED'}</span>
              <span className="live-sync-cadence">4s</span>
            </button>

            <div className="avatar small">
              {isAdmin ? 'MO' : (astronaut?.call_sign?.slice(0, 2) || 'AS')}
            </div>
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError('')}>Dismiss</button>
            </div>
          )}

          {/* OVERVIEW TAB CONTENT */}
          {tab === 'Overview' && (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">
                    MARS TRANSIT · DAY 042 <span className="sep">·</span> SIMULATED SCENARIO <span className="sep">·</span>{' '}
                    {isAdmin ? 'FLIGHT SURGEON OVERVIEW' : 'ASTRONAUT TELEMETRY'}
                  </div>
                  <h1>
                    {isAdmin ? 'Crew Health Overview' : 'Personal Health Overview'}
                  </h1>
                  <p className="muted">
                    {isAdmin
                      ? `Prototype monitoring summary, data coverage, and personal-baseline comparisons across the Mars Transit crew.`
                      : `Personal health signals, baseline comparisons, and telemetry for ${astronaut?.name}.`}
                  </p>
                </div>

                {renderHeaderCrewControls()}
              </div>

              {/* ADMIN ABILITY: FLEET OPERATIONAL READINESS & CREW TRIAGE */}
              {renderFleetTriage()}

              {/* ASTRONAUT ABILITY: DAILY COUNTERMEASURE ADHERENCE TRACKER */}
              {renderAstronautDutyCard()}

              {/* STATS ROW: ONLY on Overview */}
              <div className="stats">
                <div className="stat">
                  <div className="stat-top">
                    <span>{isAdmin ? 'CREW MONITORED' : 'MY HEALTH STATUS'}</span>
                    <Users size={17} />
                  </div>
                  <strong>
                    {isAdmin ? (
                      <>
                        {astronauts.length.toString().padStart(2, '0')}{' '}
                        <small>astronauts</small>
                      </>
                    ) : (
                      <>
                        ACTIVE <small>flight ready</small>
                      </>
                    )}
                  </strong>
                  <div className="stat-foot">
                    <i /> {isAdmin ? `Active crew: ${astronaut?.name}` : 'Vital telemetry operational'}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-top">
                    <span>{isAdmin ? 'OPEN ALERTS' : 'MY ACTIVE ALERTS'}</span>
                    <AlertTriangle size={17} />
                  </div>
                  <strong>
                    {alerts
                      .filter((a: Any) => !a.acknowledged)
                      .length.toString()
                      .padStart(2, '0')}{' '}
                    <small>{isAdmin ? 'require review' : 'personal alerts'}</small>
                  </strong>
                  <div className="stat-foot amber">
                    {isAdmin ? 'Prioritized across crew' : 'Deterministic threshold check'}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-top">
                    <span>{isAdmin ? 'OBSERVATIONS' : 'MY BIOMETRICS'}</span>
                    <Activity size={17} />
                  </div>
                  <strong>
                    {measurements.length} <small>observations</small>
                  </strong>
                  <div className="stat-foot">
                    Across {metrics.length} tracked metrics
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-top">
                    <span>MISSION</span>
                    <Atom size={17} />
                  </div>
                  <strong>
                    DAY 42 <small>of 180 (demo)</small>
                  </strong>
                  <div className="stat-foot">ASTERIA-7 · Low Earth Orbit</div>
                </div>
              </div>

              {/* Abnormal Behaviour Warning Banner */}
              {renderAbnormalWarningBanner()}

              {/* Telemetry Trend Graph */}
              {renderTelemetryCard()}

              <div className="grid-main">
                <section className="panel alert-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">
                        {isAdmin ? 'CREW ATTENTION REQUIRED' : 'MY ACTIVE HEALTH ALERTS'}
                      </div>
                      <h2>
                        {isAdmin ? 'Priority alerts' : 'Personal alerts'}{' '}
                        <span className="count">{alerts.length}</span>
                      </h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => handleTabChange('Mission timeline')}
                    >
                      View timeline →
                    </button>
                  </div>
                  <div className="alert-list">
                    {alerts.slice(0, 4).map((a: Any) => (
                      <div className="alert-item" key={a.id}>
                        <div
                          className={
                            a.priority === 'high' ? 'alert-icon high' : 'alert-icon'
                          }
                        >
                          <AlertTriangle size={16} />
                        </div>
                        <div className="alert-body">
                          <div className="alert-title">
                            {a.metric}{' '}
                            <span
                              className={
                                a.priority === 'high'
                                  ? 'priority high-text'
                                  : 'priority'
                              }
                            >
                              {a.priority}
                            </span>
                          </div>
                          <p>{a.reason}</p>
                          <small>
                            {fmt(a.created_at)} ·{' '}
                            {a.acknowledged ? 'Acknowledged' : 'Open'}
                          </small>
                        </div>
                        {isAdmin && !a.acknowledged && (
                          <button
                            className="ack"
                            title="Acknowledge and add follow-up"
                            onClick={async () => {
                              const note = prompt('Follow-up action to record:');
                              if (note) {
                                await api(`/alerts/${a.id}/acknowledge`, {
                                  method: 'POST',
                                  body: JSON.stringify({ note }),
                                });
                                load();
                              }
                            }}
                          >
                            <Check size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                    {!alerts.length && (
                      <div className="empty">No alerts have been generated yet.</div>
                    )}
                  </div>
                </section>

                <section className="panel timeline-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">
                        {isAdmin ? 'RECENT CREW EVENTS' : 'MY MISSION EVENTS'}
                      </div>
                      <h2>Health timeline</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => handleTabChange('Mission timeline')}
                    >
                      Open timeline →
                    </button>
                  </div>
                  <div className="timeline">
                    {timeline.slice(0, 5).map((x: Any) => (
                      <div className="event" key={x.id}>
                        <div className={'event-dot ' + x.type} />
                        <div className="event-copy">
                          <b>{x.title}</b>
                          <p>{x.detail}</p>
                          <small>
                            {fmt(x.timestamp)}
                            {x.simulated ? ' · Simulated' : ''}
                          </small>
                        </div>
                      </div>
                    ))}
                    {!timeline.length && (
                      <div className="empty">Timeline events will appear here.</div>
                    )}
                  </div>
                </section>
              </div>

              <div className="grid-lower" style={{ marginTop: '16px' }}>
                <section className="panel domain-panel" style={{ gridColumn: 'span 2' }}>
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">FIVE-DOMAIN MONITORING</div>
                      <h2>
                        {isAdmin
                          ? `Health domains (${astronaut?.name || 'Selected astronaut'})`
                          : 'My health domains'}
                      </h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        const el = document.getElementById('measurements-table');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      All measurements ↓
                    </button>
                  </div>
                  <div className="domain-grid">
                    {[
                      ['Cardiovascular', 'HeartPulse', 'Resting heart rate', 'Heart Rate'],
                      ['Musculoskeletal', 'Activity', 'Grip', 'Grip'],
                      ['Immune', 'ShieldCheck', 'Core Temp', 'Core Temp'],
                      ['Behavioural', 'Wind', 'Sleep duration', 'Sleep duration'],
                      ['Radiation & environment', 'Atom', 'Cabin CO2', 'Cabin CO2'],
                    ].map(([name, icon, metric, pill]: any) => {
                      const Icon: any = ({
                        HeartPulse,
                        Activity,
                        ShieldCheck,
                        Wind,
                        Atom,
                      } as any)[icon];
                      const x =
                        latest(metric) ||
                        latest(
                          metric === 'Core Temp'
                            ? 'Temperature'
                            : metric === 'Grip'
                              ? 'Body mass'
                              : metric
                        );
                      const b =
                        baseline(metric) ||
                        baseline(
                          metric === 'Core Temp'
                            ? 'Temperature'
                            : metric === 'Grip'
                              ? 'Body mass'
                              : metric
                        );
                      return (
                        <button
                          className="domain"
                          key={name}
                          onClick={() => {
                            if (name === 'Cardiovascular') {
                              handleTabChange('Cardiovascular');
                            } else if (name === 'Behavioural') {
                              handleTabChange('Behavioural');
                            } else {
                              setSelectedMetric(pill);
                            }
                          }}
                        >
                          <div className="domain-icon">
                            <Icon size={18} />
                          </div>
                          <div className="domain-name">{name}</div>
                          <div className="domain-value">
                            {x ? `${x.value} ${x.unit}` : 'No data'}{' '}
                            <small>{metric}</small>
                          </div>
                          <div className="domain-base">
                            Personal median ·{' '}
                            {b?.available
                              ? `${b.median} ${b.unit}`
                              : 'building baseline'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Measurements & Baselines Table integrated into Overview */}
              <div id="measurements-table" style={{ marginTop: '16px' }}>
                <section className="panel table-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">
                        {isAdmin ? 'CREW TELEMETRY RECORDS' : 'MY BIOMETRIC RECORDS'}
                      </div>
                      <h2>
                        {isAdmin
                          ? `Measurements & Baselines · ${astronaut?.name}`
                          : 'My Measurements & Baselines'}
                      </h2>
                      <p className="muted">
                        Click a measurement row to compare its stored history with the personal baseline above.
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>DOMAIN</th>
                          <th>MEASUREMENT</th>
                          <th>VALUE</th>
                          <th>PERSONAL MEDIAN</th>
                          <th>OBSERVATIONS</th>
                          <th>SOURCE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baselines.map((b: Any) => {
                          const isSelected =
                            metricMap[selectedMetric] === b.metric ||
                            selectedMetric === b.metric;
                          return (
                            <tr
                              key={b.metric}
                              className={`table-row-clickable ${isSelected ? 'active' : ''
                                }`}
                              onClick={() => {
                                const pill =
                                  Object.keys(metricMap).find(
                                    (k) => metricMap[k] === b.metric
                                  ) || b.metric;
                                setSelectedMetric(pill);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              <td>{b.domain}</td>
                              <td>
                                <b>{b.metric}</b>
                              </td>
                              <td>
                                {latest(b.metric)?.value} {b.unit}
                              </td>
                              <td>
                                {b.available ? b.median : 'Insufficient history'}{' '}
                                {b.available ? b.unit : ''}
                              </td>
                              <td>{b.count}</td>
                              <td>Simulated mission telemetry</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}

          {/* CARDIOVASCULAR TAB CONTENT */}
          {tab === 'Cardiovascular' && (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">
                    HEMODYNAMICS & CARDIAC MONITORING <span className="sep">·</span>{' '}
                    {isAdmin ? `CREW MEMBER: ${astronaut?.name} (${astronaut?.call_sign})` : 'PERSONAL TELEMETRY'}
                  </div>
                  <h1>Cardiovascular Profile</h1>
                  <p className="muted">
                    {isAdmin
                      ? `Continuous hemodynamic telemetry, baseline drift, and cardiac parameters for ${astronaut?.name}.`
                      : 'Continuous hemodynamic telemetry, baseline drift, and cardiac parameters.'}
                  </p>
                </div>
                {renderHeaderCrewControls()}
              </div>

              {/* Abnormal Behaviour Warning Banner */}
              {renderAbnormalWarningBanner()}

              {/* Cardiovascular Telemetry Trend */}
              {renderTelemetryCard()}

              <div className="grid-main" style={{ marginTop: '16px' }}>
                <section className="panel" style={{ gridColumn: 'span 2' }}>
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">CARDIOVASCULAR PROFILE</div>
                      <h2>
                        {isAdmin
                          ? `Hemodynamic Summary & Drift · ${astronaut?.name}`
                          : 'My Hemodynamic Summary & Drift'}
                      </h2>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '12px',
                      marginTop: '16px',
                    }}
                  >
                    {[
                      ['Resting heart rate', 'Heart Rate', 'bpm'],
                      ['HRV', 'HRV', 'ms'],
                      ['Systolic BP', 'Systolic BP', 'mmHg'],
                    ].map(([mName, pillName, u]) => {
                      const lat = latest(mName);
                      const base = baseline(mName);
                      return (
                        <div
                          key={mName}
                          className={`domain ${selectedMetric === pillName ? 'active' : ''}`}
                          onClick={() => setSelectedMetric(pillName)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="domain-name">{pillName}</div>
                          <div className="domain-value">
                            {lat?.value ?? '--'} <small>{u}</small>
                          </div>
                          <div className="domain-base">
                            Median: {base?.available ? `${base.median} ${u}` : 'building'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* BEHAVIOURAL TAB CONTENT */}
          {tab === 'Behavioural' && (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">
                    NEUROCOGNITIVE & OPERATIONAL READINESS <span className="sep">·</span>{' '}
                    {isAdmin ? `CREW MEMBER: ${astronaut?.name} (${astronaut?.call_sign})` : 'DAILY LOGS'}
                  </div>
                  <h1>Behavioural & Neurocognitive Assessment</h1>
                  <p className="muted">
                    {isAdmin
                      ? `Review daily self-reported cognitive load, fatigue, sleep quality, and psychological adaptation for ${astronaut?.name}.`
                      : 'Log and monitor your daily sleep quality, stress levels, cognitive load, and fatigue.'}
                  </p>
                </div>
                {renderHeaderCrewControls()}
              </div>

              {/* BEHAVIOURAL KPI STATS ROW */}
              <div className="stats" style={{ marginBottom: '16px' }}>
                <div className="stat">
                  <div className="stat-top">
                    <span>7-DAY AVG SLEEP</span>
                    <Clock3 size={17} />
                  </div>
                  <strong>
                    {avgSleep7Days} <small>hrs/night</small>
                  </strong>
                  <div className={`stat-foot ${+avgSleep7Days < 6.5 ? 'amber' : ''}`}>
                    <i style={{ background: +avgSleep7Days < 6.5 ? '#f59e0b' : '#10b981' }} />
                    {+avgSleep7Days < 6.5 ? 'Rest deficit detected' : 'Target: >= 7.0 hrs'}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-top">
                    <span>FATIGUE INDEX</span>
                    <Activity size={17} />
                  </div>
                  <strong>
                    {latestAssessment.fatigue ?? 2} <small>/ 10</small>
                  </strong>
                  <div className={`stat-foot ${(latestAssessment.fatigue ?? 0) >= 5 ? 'amber' : ''}`}>
                    <i style={{ background: (latestAssessment.fatigue ?? 0) >= 5 ? '#ef4444' : '#10b981' }} />
                    {(latestAssessment.fatigue ?? 0) >= 5 ? 'Elevated cognitive strain' : 'Nominal operational level'}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-top">
                    <span>STRESS & WORKLOAD</span>
                    <Wind size={17} />
                  </div>
                  <strong>
                    {latestAssessment.stress ?? 3} <small>/ 10</small>
                  </strong>
                  <div className="stat-foot">
                    <i /> Operational limit: &lt;= 5/10
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-top">
                    <span>READINESS & MOOD</span>
                    <Check size={17} />
                  </div>
                  <strong>
                    {latestAssessment.mood ?? 7} <small>/ 10</small>
                  </strong>
                  <div className="stat-foot">
                    <i /> Self-reported readiness
                  </div>
                </div>
              </div>

              {/* DYNAMIC NEUROCOGNITIVE & SLEEP TREND CHART */}
              <section className="telemetry-card" style={{ marginBottom: '16px' }}>
                <div className="telemetry-head">
                  <div className="telemetry-head-left">
                    <div className="telemetry-title-row">
                      <h2>Neurocognitive & Sleep Adaptation Trend</h2>
                      <span className="telemetry-badge">
                        {assessmentsList.length || 42}-Day Longitudinal Self-Reports
                      </span>
                    </div>
                    <p className="telemetry-subtitle">
                      Tracking {behaviouralMetric} for {astronaut?.name || 'astronaut'} · {behaviouralMeta.targetLabel}
                    </p>
                  </div>

                  <div className="telemetry-pills">
                    {['Sleep Duration', 'Fatigue', 'Stress', 'Mood', 'Sleep Quality'].map((m) => (
                      <button
                        key={m}
                        className={`telemetry-pill-btn ${behaviouralMetric === m ? 'active' : ''
                          }`}
                        onClick={() => setBehaviouralMetric(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="telemetry-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={behaviouralChartPoints}
                      margin={{ top: 15, right: 25, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient
                          id="behaviouralFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={behaviouralMeta.color}
                            stopOpacity={0.22}
                          />
                          <stop
                            offset="85%"
                            stopColor={behaviouralMeta.color}
                            stopOpacity={0.04}
                          />
                          <stop
                            offset="100%"
                            stopColor="#ffffff"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid vertical={false} horizontal={false} />

                      <XAxis
                        dataKey="day"
                        ticks={
                          assessmentsList.length > 42
                            ? ['D1', 'D15', 'D30', 'D45', `D${assessmentsList.length}`]
                            : ['D1', 'D10', 'D20', 'D30', 'D42']
                        }
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: '#94a3b8',
                          fontSize: 11,
                          fontFamily: "'DM Mono', monospace",
                        }}
                        dy={8}
                      />

                      <YAxis
                        domain={behaviouralMeta.yDomain}
                        ticks={behaviouralMeta.yTicks}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: '#94a3b8',
                          fontSize: 11,
                          fontFamily: "'DM Mono', monospace",
                        }}
                        dx={-5}
                      />

                      <ReferenceLine
                        y={behaviouralMeta.baselineVal}
                        stroke={behaviouralMeta.color}
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                      />

                      <Tooltip content={<CustomBehaviouralTooltip />} />

                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={behaviouralMeta.color}
                        strokeWidth={2}
                        fill="url(#behaviouralFill)"
                        dot={<BehaviouralDot />}
                        activeDot={{
                          r: 5,
                          fill: behaviouralMeta.color,
                          stroke: '#ffffff',
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="telemetry-foot">
                  <div className="telemetry-legend">
                    <span className="legend-item">
                      <span
                        className="legend-line"
                        style={{ background: behaviouralMeta.color }}
                      />
                      <span>Reported {behaviouralMetric}</span>
                    </span>
                    <span className="legend-item">
                      <span
                        className="legend-line dashed"
                        style={{ borderColor: behaviouralMeta.color }}
                      />
                      <span>{behaviouralMeta.targetLabel}</span>
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot-red" />
                      <span>Elevated Strain / Alert</span>
                    </span>
                  </div>

                  <div className="telemetry-window-note">
                    Mission Timeline: D1–D{assessmentsList.length || 42} ({assessmentsList.length} logs recorded)
                  </div>
                </div>
              </section>

              {/* DAILY SELF-REPORT LOGGING FORM */}
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">ASTRONAUT SELF-REPORT</div>
                    <h2>
                      {isAdmin
                        ? `Daily health assessment · ${astronaut?.name}`
                        : 'Log daily health assessment'}
                    </h2>
                    <p className="muted">
                      Manual assessment values are self-reported and instantly update your neurocognitive trend above.
                    </p>
                  </div>
                </div>

                {assessmentFeedback && (
                  <div
                    style={{
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      margin: '14px 24px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#065f46',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <Check size={16} color="#059669" />
                    <span>{assessmentFeedback}</span>
                  </div>
                )}
                {assessmentError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      margin: '14px 24px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#991b1b',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <AlertTriangle size={16} color="#dc2626" />
                    <span>{assessmentError}</span>
                  </div>
                )}

                <div className="assessment-form">
                  {[
                    ['sleep_hours', 'Sleep duration (hours)', 0, 24, 0.5],
                    ['sleep_quality', 'Sleep quality (1–10)', 1, 10, 1],
                    ['stress', 'Stress (1–10)', 1, 10, 1],
                    ['mood', 'Mood (1–10)', 1, 10, 1],
                    ['fatigue', 'Fatigue (1–10)', 1, 10, 1],
                  ].map(([k, label, min, max, step]: any) => (
                    <label key={k}>
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={(assessment as any)[k]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAssessment({
                            ...assessment,
                            [k]: val === '' ? '' : (k === 'sleep_hours' ? parseFloat(val) : parseInt(val, 10)),
                          });
                        }}
                      />
                    </label>
                  ))}
                  <label className="wide">
                    Symptoms
                    <input
                      value={assessment.symptoms}
                      onChange={(e) =>
                        setAssessment({
                          ...assessment,
                          symptoms: e.target.value,
                        })
                      }
                      placeholder="e.g. Mild headache, elevated fatigue after EVA"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const targetId =
                        (user?.role !== 'medical' && user?.astronaut_id)
                          ? user.astronaut_id
                          : (selected || astronaut?.id || astronauts[0]?.id || 1);

                      setBusy(true);
                      setAssessmentFeedback('');
                      setAssessmentError('');

                      const sleepHrs = Math.max(0, Math.min(24, Number(assessment.sleep_hours) || 0));
                      const sleepQual = Math.max(1, Math.min(10, Math.round(Number(assessment.sleep_quality)) || 7));
                      const stressVal = Math.max(1, Math.min(10, Math.round(Number(assessment.stress)) || 3));
                      const moodVal = Math.max(1, Math.min(10, Math.round(Number(assessment.mood)) || 7));
                      const fatigueVal = Math.max(1, Math.min(10, Math.round(Number(assessment.fatigue)) || 2));
                      const symptomsVal = (assessment.symptoms || '').trim() || 'None reported';

                      const payload = {
                        sleep_hours: sleepHrs,
                        sleep_quality: sleepQual,
                        stress: stressVal,
                        mood: moodVal,
                        fatigue: fatigueVal,
                        symptoms: symptomsVal,
                      };

                      try {
                        const created = await api(`/astronauts/${targetId}/assessments`, {
                          method: 'POST', body: JSON.stringify(payload),
                        });
                        setAssessmentsList((prev) => [...prev, created]);

                        setAssessmentFeedback(
                          `Assessment saved to the mission database (${symptomsVal}).`
                        );
                        setTimeout(() => setAssessmentFeedback(''), 8000);

                        // Reset symptoms input for next log
                        setAssessment((prev) => ({
                          ...prev,
                          symptoms: '',
                        }));

                        // Trigger non-blocking background refresh
                        load().catch(() => { });
                      } catch (err: any) {
                        setAssessmentError(err.message || 'Failed to submit assessment');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Plus size={15} /> {busy ? 'Submitting…' : 'Submit assessment'}
                  </button>
                </div>
              </section>

              {/* RECENT HISTORICAL ASSESSMENT LOG TABLE */}
              <section className="panel table-panel" style={{ marginTop: '16px' }}>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">CHRONOLOGICAL ASSESSMENT LOGS</div>
                    <h2>Recent Daily Records · {astronaut?.name}</h2>
                    <p className="muted">
                      Chronological history of self-reported neurocognitive scores, sleep, and symptoms ({assessmentsList.length} total logs).
                    </p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mission Day</th>
                        <th>Recorded Date</th>
                        <th>Sleep</th>
                        <th>Quality</th>
                        <th>Fatigue</th>
                        <th>Stress</th>
                        <th>Mood</th>
                        <th>Reported Symptoms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessmentsList.slice(-15).reverse().map((a: Any, i: number) => {
                        const isLatest = i === 0;
                        const dayNum =
                          a.id && a.id >= 1 && a.id <= 42 && a.simulated
                            ? a.id
                            : !a.simulated
                              ? 42
                              : Math.min(42, Math.max(1, assessmentsList.length - i));
                        return (
                          <tr
                            key={a.id || i}
                            style={isLatest && !a.simulated ? { background: isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.08)' } : undefined}
                          >
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span className="type-pill assessment">
                                  Day {dayNum}
                                </span>
                                {!a.simulated && (
                                  <span className="assessment-badge-report">
                                    {isLatest ? 'NEW' : 'Check-in'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{fmt(a.timestamp)}</td>
                            <td>
                              <b className={a.sleep_hours < 6.0 ? 'priority high-text' : ''}>
                                {a.sleep_hours}
                              </b> hrs
                            </td>
                            <td>{a.sleep_quality} / 10</td>
                            <td>
                              <span
                                className={`priority ${a.fatigue >= 5 ? 'high-text' : ''
                                  }`}
                              >
                                {a.fatigue} / 10
                              </span>
                            </td>
                            <td>
                              <span className={`priority ${a.stress >= 5 ? 'high-text' : ''}`}>
                                {a.stress} / 10
                              </span>
                            </td>
                            <td>
                              <span className={`priority ${a.mood <= 4 ? 'high-text' : ''}`}>
                                {a.mood} / 10
                              </span>
                            </td>
                            <td>
                              <b>{a.symptoms || 'No symptoms reported'}</b>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* MISSION TIMELINE TAB CONTENT */}
          {tab === 'Mission timeline' && (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">
                    FLIGHT CHRONOLOGY & PHYSIOLOGICAL EVENTS <span className="sep">·</span>{' '}
                    {isAdmin ? `CREW MEMBER: ${astronaut?.name}` : 'PERSONAL TIMELINE'}
                  </div>
                  <h1>Mission Timeline</h1>
                  <p className="muted">
                    {isAdmin
                      ? `Chronological operational milestones, EVAs, sleep shifts, and health events for ${astronaut?.name}.`
                      : 'Chronological operational milestones, docking events, EVAs, and health markers.'}
                  </p>
                </div>
                {renderHeaderCrewControls()}
              </div>

              <section className="panel full-timeline">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">CHRONOLOGICAL RECORD</div>
                    <h2>{astronaut?.name} · Mission events</h2>
                  </div>
                  <span className="simulated-tag">SIMULATED DEMO</span>
                </div>
                {timeline.slice(0, 60).map((x: Any) => (
                  <div className="timeline-row" key={x.id}>
                    <time>{fmt(x.timestamp)}</time>
                    <span className={'type-pill ' + x.type}>{x.type}</span>
                    <div>
                      <b>{x.title}</b>
                      <p>{x.detail}</p>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {/* MEDICAL RECORDS TAB CONTENT */}
          {tab === 'Medical records' && (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">
                    CLINICAL REPOSITORY & COUNTERMEASURES <span className="sep">·</span>{' '}
                    {isAdmin ? `CREW MEMBER: ${astronaut?.name}` : 'MY MEDICAL RECORDS'}
                  </div>
                  <h1>Medical Records & Clinical Evaluations</h1>
                  <p className="muted">
                    {isAdmin
                      ? `Medical officer records, reviewable document extracts, and prototype summaries for ${astronaut?.name}.`
                      : 'Your medical records and extracted document observations, with review status shown.'}
                  </p>
                </div>
                {renderHeaderCrewControls(
                  isAdmin && (
                    <button
                      type="button"
                      className="btn-approve"
                      style={{ width: 'auto', padding: '9px 16px', display: 'inline-flex', gap: 6 }}
                      onClick={() => setShowAddMedRecordModal(!showAddMedRecordModal)}
                    >
                      <FilePlus size={15} />
                      {showAddMedRecordModal ? 'Close Form' : '+ Add Clinical Evaluation'}
                    </button>
                  )
                )}
              </div>

              {/* ADMIN: ADD CLINICAL EVALUATION FORM */}
              {isAdmin && showAddMedRecordModal && (
                <section className="panel" style={{ borderLeft: '4px solid #0d9488', marginBottom: 20 }}>
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">NEW CLINICAL ENTRY</div>
                      <h2>Record Clinical Evaluation · {astronaut?.name}</h2>
                      <p className="muted">
                        This evaluation and prescribed countermeasure will be stored persistently in the database and synced to the cloud.
                      </p>
                    </div>
                  </div>

                  <form className="direct-create-box" onSubmit={handleAddMedicalRecord} style={{ marginTop: 10 }}>
                    <div className="direct-create-grid">
                      <label>
                        Evaluation Type
                        <select
                          value={newMedRecord.record_type}
                          onChange={(e) => setNewMedRecord({ ...newMedRecord, record_type: e.target.value })}
                        >
                          <option value="Clinical Evaluation">Clinical Evaluation</option>
                          <option value="Countermeasure Prescription">Countermeasure Prescription</option>
                          <option value="EVA Medical Clearance">EVA Medical Clearance</option>
                          <option value="Radiation Dosimetry">Radiation Dosimetry</option>
                          <option value="Neurovestibular Check">Neurovestibular Check</option>
                        </select>
                      </label>
                      <label>
                        Record Title
                        <input
                          placeholder="e.g. Day 42 cardiovascular observations"
                          value={newMedRecord.title}
                          onChange={(e) => setNewMedRecord({ ...newMedRecord, title: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        Physician / Flight Surgeon
                        <input
                          placeholder="e.g. Dr. Robert Vance, Flight Surgeon"
                          value={newMedRecord.physician}
                          onChange={(e) => setNewMedRecord({ ...newMedRecord, physician: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        Evaluation Date
                        <input
                          type="date"
                          value={newMedRecord.date}
                          onChange={(e) => setNewMedRecord({ ...newMedRecord, date: e.target.value })}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                      <label style={{ font: '600 11px sans-serif', color: 'var(--text-muted)' }}>
                        Clinical Observations & Diagnostic Findings
                        <textarea
                          rows={3}
                          placeholder="Enter physical observations, ECG review, orthostatic response, or clinical findings..."
                          value={newMedRecord.findings}
                          onChange={(e) => setNewMedRecord({ ...newMedRecord, findings: e.target.value })}
                          required
                          style={{
                            width: '100%',
                            marginTop: 4,
                            padding: 10,
                            borderRadius: 6,
                            border: '1px solid var(--border-input)',
                            background: 'var(--bg-panel)',
                            color: 'var(--text-main)',
                            font: '400 12.5px sans-serif',
                          }}
                        />
                      </label>

                      <label style={{ font: '600 11px sans-serif', color: 'var(--text-muted)' }}>
                        Prescribed Countermeasures & Protocols (Optional)
                        <textarea
                          rows={2}
                          placeholder="e.g. Lower body negative pressure (LBNP) 20 min/day, 1.2L oral electrolyte fluid loading..."
                          value={newMedRecord.countermeasures}
                          onChange={(e) => setNewMedRecord({ ...newMedRecord, countermeasures: e.target.value })}
                          style={{
                            width: '100%',
                            marginTop: 4,
                            padding: 10,
                            borderRadius: 6,
                            border: '1px solid var(--border-input)',
                            background: 'var(--bg-panel)',
                            color: 'var(--text-main)',
                            font: '400 12.5px sans-serif',
                          }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="submit" disabled={medRecordSubmitting} className="btn-approve" style={{ width: 'auto', padding: '9px 18px' }}>
                        <Check size={14} /> {medRecordSubmitting ? 'Saving to Database…' : 'Save Medical Record'}
                      </button>
                      <button
                        type="button"
                        className="btn-decline"
                        onClick={() => setShowAddMedRecordModal(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* CLINICAL MEDICAL RECORDS LIST */}
              <section className="panel" style={{ marginBottom: 20 }}>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">MISSION MEDICAL DATABASE</div>
                    <h2>Clinical Evaluations & Countermeasure Protocols ({medicalRecords.length})</h2>
                    <p className="muted">
                      Stored in the mission database. Optional Firebase sync requires backend credentials.
                    </p>
                  </div>
                </div>

                <div className="med-records-list" style={{ marginTop: 12 }}>
                  {medicalRecords.map((r: Any) => (
                    <div className="med-record-card" key={r.id || r.title}>
                      <div className="med-record-top">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="status-pill approved">{r.record_type || 'Clinical Evaluation'}</span>
                            <span className="status-pill" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                              {r.date || '2026-11-14'}
                            </span>
                          </div>
                          <h3 className="med-record-title">{r.title}</h3>
                          <div className="med-record-physician">
                            <Stethoscope size={13} style={{ display: 'inline', marginRight: 4 }} />
                            Entered by: <b>{r.physician || 'Medical officer'}</b>{r.simulated ? ' · SIMULATED' : ''}
                          </div>
                        </div>
                        <span className={`status-pill ${String(r.status || '').toLowerCase().includes('pending') ? 'pending_approval' : 'approved'}`}>{r.status || 'Pending clinician review'}</span>
                      </div>

                      <div className="med-record-findings">
                        <b>Clinical Findings:</b> {r.findings}
                      </div>

                      {r.countermeasures && (
                        <div className="med-countermeasure-callout">
                          <Activity size={15} color="#0d9488" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <strong>Prescribed Countermeasure:</strong> {r.countermeasures}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {medicalRecords.length === 0 && (
                    <div className="empty">No clinical evaluations on record for this astronaut.</div>
                  )}
                </div>
              </section>

              {/* DOCUMENT INTELLIGENCE (PDF UPLOAD & OCR OBSERVATIONS) */}
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">DOCUMENT INTELLIGENCE</div>
                    <h2>
                      {isAdmin
                        ? `Lab & diagnostic reports · ${astronaut?.name}`
                        : 'My diagnostic lab reports'}
                    </h2>
                    <p className="muted">
                      {isAdmin
                        ? 'Upload diagnostic laboratory PDFs and verify extracted text for crew medical files.'
                        : 'Extracted clinical text remains unverified until reviewed by a medical officer.'}
                    </p>
                  </div>

                  {/* Upload only available for Medical Officers / Admins */}
                  {isAdmin && (
                    <label className="upload-btn">
                      <Upload size={15} /> Upload PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        hidden
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f && selected) {
                            const fd = new FormData();
                            fd.append('file', f);
                            try {
                              await api(`/astronauts/${selected}/documents`, { method: 'POST', body: fd });
                              setError('');
                              await load();
                            } catch (e: any) { setError(e.message || 'PDF upload failed.'); }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {docs.map((d: Any) => (
                  <div className="doc-card" key={d.id}>
                    <FileText size={19} />
                    <div>
                      <b>{d.filename}</b>
                      <p>
                        {d.simulated ? 'SIMULATED DEMO DOCUMENT · ' : ''}{d.verified ? 'Document reviewed' : 'Pending human review'}
                        {' · '}{d.extraction_method || 'text extraction'} · extraction confidence {Math.round(d.confidence * 100)}%
                      </p>
                      <pre>{d.extracted_text}</pre>
                      {(d.observations || []).map((o: Any) => {
                        const edit = observationEdits[o.id] || o;
                        return <div className="observation-review" key={o.id}>
                          <div className="observation-review-meta">Extracted candidate · confidence {Math.round((o.confidence || 0) * 100)}% · {o.review_status || 'pending review'}{o.verified ? ' · human approved' : ''}</div>
                          {isAdmin ? <div className="observation-review-fields">
                            <input aria-label="Observation name" value={edit.test_name || ''} onChange={(e) => setObservationEdits((prev) => ({ ...prev, [o.id]: { ...edit, test_name: e.target.value } }))} />
                            <input aria-label="Observation result" value={edit.result || ''} onChange={(e) => setObservationEdits((prev) => ({ ...prev, [o.id]: { ...edit, result: e.target.value } }))} />
                            <input aria-label="Observation unit" value={edit.unit || ''} onChange={(e) => setObservationEdits((prev) => ({ ...prev, [o.id]: { ...edit, unit: e.target.value } }))} />
                            <input aria-label="Reference range" value={edit.reference_range || ''} onChange={(e) => setObservationEdits((prev) => ({ ...prev, [o.id]: { ...edit, reference_range: e.target.value } }))} />
                            <button type="button" className="ack" onClick={async () => { try { await api(`/observations/${o.id}/verify`, { method: 'POST', body: JSON.stringify({ ...edit, review_note: 'Reviewed in medical officer interface' }) }); setObservationEdits((prev) => { const next = { ...prev }; delete next[o.id]; return next; }); await load(); } catch (e: any) { setError(e.message || 'Could not approve observation.'); } }}>Approve candidate</button>
                            <button type="button" className="btn-secondary" onClick={async () => { try { await api(`/observations/${o.id}/reject`, { method: 'POST', body: JSON.stringify({ review_note: 'Rejected in medical officer interface' }) }); await load(); } catch (e: any) { setError(e.message || 'Could not reject observation.'); } }}>Reject</button>
                          </div> : <div><b>{o.test_name}</b>: {o.result} {o.unit} · reference {o.reference_range}</div>}
                        </div>;
                      })}
                    </div>
                    {isAdmin && !d.verified && (
                      <button
                        className="ack"
                        onClick={async () => {
                          await api(`/documents/${d.id}/verify`, { method: 'POST' });
                          load();
                        }}
                      >
                        Mark document reviewed
                      </button>
                    )}
                  </div>
                ))}
                {!docs.length && (
                  <div className="empty">No reports uploaded for this astronaut.</div>
                )}
              </section>
            </>
          )}

          {/* CREW ACCOUNTS & APPROVALS TAB CONTENT (ADMIN ONLY) */}
          {tab === 'Crew accounts' && isAdmin && (
            <div className="crew-accounts-container">
              <div className="heading-row">
                <div>
                  <div className="eyebrow">
                    MISSION CONTROL ADMINISTRATION <span className="sep">·</span> CREW MANAGEMENT
                  </div>
                  <h1>Astronaut Accounts & Flight Clearances</h1>
                  <p className="muted">
                    Authorize pending astronaut applications, manage mission roster access, or provision new crew member credentials.
                  </p>
                </div>
                {renderHeaderCrewControls()}
              </div>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow" style={{ color: '#d97706' }}>ACTION REQUIRED</div>
                    <h2>Pending Flight Clearance Applications ({pendingUsers.length})</h2>
                    <p className="muted">
                      Astronauts who have requested flight access and are awaiting Flight Surgeon medical signoff.
                    </p>
                  </div>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="empty" style={{ padding: '24px 0' }}>
                    <CheckCircle2 size={24} color="#0d9488" style={{ marginBottom: 8 }} />
                    <p>All registered crew members have been evaluated and authorized. No applications pending.</p>
                  </div>
                ) : (
                  <div className="approval-grid">
                    {pendingUsers.map((u: Any) => (
                      <div className="applicant-card" key={u.id || u.username}>
                        <div>
                          <div className="applicant-card-header">
                            <div>
                              <div className="applicant-name">{u.full_name || u.name || u.username}</div>
                              <div style={{ font: '600 11px monospace', color: 'var(--text-muted)' }}>@{u.username}</div>
                            </div>
                            <span className="status-pill pending_approval">PENDING APPROVAL</span>
                          </div>
                          <div className="applicant-meta">
                            <span><Users size={12} /> Call Sign: <b>{u.call_sign || 'Unassigned'}</b></span>
                            <span><Clock3 size={12} /> Mission: <b>{u.mission || 'Asteria-7'}</b></span>
                            <span><BadgeCheck size={12} /> Role: <b>{u.specialization || 'Flight Crew'}</b></span>
                          </div>
                        </div>
                        <div className="applicant-actions">
                          <button
                            type="button"
                            className="btn-approve"
                            disabled={adminActionBusy}
                            onClick={() => handleApproveUser(u)}
                          >
                            <Check size={14} /> Approve & Enlist
                          </button>
                          <button
                            type="button"
                            className="btn-decline"
                            disabled={adminActionBusy}
                            onClick={() => handleRejectUser(u)}
                          >
                            <XCircle size={14} /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* SECTION 2: DIRECT CREW ONBOARDING (ADMIN ONLY) */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">ADMIN PRIVILEGE</div>
                    <h2>Direct Astronaut Provisioning</h2>
                    <p className="muted">
                      Immediately enlist and clear a new astronaut for flight duty without pending verification.
                    </p>
                  </div>
                </div>

                <form className="direct-create-box" onSubmit={handleDirectCreateAstronaut}>
                  <div className="direct-create-grid">
                    <label>
                      Astronaut Full Name
                      <input
                        placeholder="e.g. Dr. Jordan Lee"
                        value={directName}
                        onChange={(e) => setDirectName(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Username
                      <input
                        placeholder="e.g. jordan"
                        value={directUsername}
                        onChange={(e) => setDirectUsername(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Call Sign
                      <input
                        placeholder="e.g. TITAN-5"
                        value={directCallSign}
                        onChange={(e) => setDirectCallSign(e.target.value)}
                      />
                    </label>
                    <label>
                      Mission
                      <input
                        placeholder="e.g. Asteria-7"
                        value={directMission}
                        onChange={(e) => setDirectMission(e.target.value)}
                      />
                    </label>
                    <label>
                      Specialization
                      <select
                        value={directSpecialization}
                        onChange={(e) => setDirectSpecialization(e.target.value)}
                      >
                        <option value="Mission Specialist">Mission Specialist</option>
                        <option value="Flight Engineer">Flight Engineer</option>
                        <option value="Commander">Commander</option>
                        <option value="EVA Lead">EVA Lead</option>
                        <option value="Payload Specialist">Payload Specialist</option>
                      </select>
                    </label>
                  </div>

                  {directError && <p className="error">{directError}</p>}
                  {directSuccess && <p style={{ color: '#0d9488', font: '600 12px sans-serif', marginBottom: 10 }}>{directSuccess}</p>}

                  <button type="submit" disabled={directBusy} className="btn-approve" style={{ width: 'auto', padding: '9px 18px' }}>
                    <Plus size={14} /> Provision Crew Profile
                  </button>
                </form>
              </section>

              {/* SECTION 3: CREW ROSTER & REGISTRY TABLE */}
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">SYSTEM REGISTRY</div>
                    <h2>Mission Flight Roster & User Accounts</h2>
                    <p className="muted">
                      Complete registry of authenticated flight crew, medical directors, and clearance statuses.
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>CREW MEMBER</th>
                        <th>USERNAME</th>
                        <th>ROLE</th>
                        <th>CALL SIGN</th>
                        <th>MISSION</th>
                        <th>CLEARANCE STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemUsers.map((u: Any) => (
                        <tr key={u.id || u.username}>
                          <td>
                            <div className="roster-user-cell">
                              <div className="roster-avatar">
                                {(u.call_sign || u.name || u.username || 'CR').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <b>{u.full_name || u.name || u.username}</b>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.specialization || 'Flight Crew'}</div>
                              </div>
                            </div>
                          </td>
                          <td><code>@{u.username}</code></td>
                          <td>
                            <span className={`role-pill ${u.role === 'medical' ? 'admin' : 'user'}`}>
                              {u.role === 'medical' ? 'Admin / Surgeon' : 'Astronaut'}
                            </span>
                          </td>
                          <td><b>{u.call_sign || '—'}</b></td>
                          <td>{u.mission || 'Asteria-7'}</td>
                          <td>
                            <span className={`status-pill ${u.status || 'approved'}`}>
                              {u.status || 'approved'}
                            </span>
                          </td>
                          <td>
                            {u.status === 'pending_approval' && (
                              <button
                                type="button"
                                className="btn-approve"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                onClick={() => handleApproveUser(u)}
                              >
                                Approve
                              </button>
                            )}
                            {u.status === 'approved' && u.role !== 'medical' && (
                              <span style={{ color: '#0d9488', fontSize: 11, fontWeight: 600 }}>Active Crew</span>
                            )}
                            {u.role === 'medical' && (
                              <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>Flight Surgeon</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* AI ASSISTANT TAB CONTENT */}
          {tab === 'AI assistant' && (
            <>
              <div className="heading-row">
                <div>
                  <div className="eyebrow">
                    FLIGHT SURGEON AI DECISION SUPPORT <span className="sep">·</span>{' '}
                    {isAdmin ? `TARGET: ${astronaut?.name}` : 'CREW ASSISTANT'}
                  </div>
                  <h1>Evidence-Grounded Assistant</h1>
                  <p className="muted">
                    Ask questions about this astronaut’s measurements, personal baselines, assessments, alerts, and records.
                  </p>
                </div>
                {renderHeaderCrewControls()}
              </div>

              <section className="panel assistant">
                <div className="assistant-head">
                  <div className="assistant-icon">
                    <Atom />
                  </div>
                  <div>
                    <div className="eyebrow">
                      {assistantStatus?.mode || 'ASSISTANT MODE UNKNOWN'} · {isAdmin ? 'MEDICAL OFFICER' : 'CREW'}
                    </div>
                    <h2>
                      {isAdmin
                        ? `Ask about ${astronaut?.name}'s health signals`
                        : 'Ask about your mission health'}
                    </h2>
                    <p>{assistantStatus?.configured
                      ? `Gemini (${assistantStatus.model}) is available. Replies use retrieved project records.`
                      : assistantStatus ? 'Responses are generated from available local project records. Add a Gemini API key on the backend for live AI explanations.'
                        : 'Assistant mode could not be checked. Verify the backend connection.'}</p>
                  </div>
                </div>
                <form className="assistant-form" onSubmit={askAssistant}>
                  <div className="prompt-chips">
                    {[
                      'Summarize recent health changes',
                      'What evidence supports the open alerts?',
                      'How has sleep changed from baseline?',
                      'Summarize the last 7 days',
                      'Summarize medical records',
                      'Explain the mission timeline',
                    ].map((x) => (
                      <button key={x} type="button" onClick={() => setQuestion(x)}>
                        {x}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); askAssistant(); } }}
                    placeholder="Ask about available measurements, trends, alerts, or mission events…"
                    aria-label="Ask a question about mission health"
                    disabled={busy || !selected}
                  />
                  <div className="assistant-submit-row">
                    <button
                      className="ask-btn"
                      type="submit"
                      disabled={!question.trim() || busy || !selected}
                    >
                      {busy ? 'Retrieving evidence…' : 'Ask assistant'} <span>→</span>
                    </button>
                    <span className="assistant-shortcut">Press Ctrl + Enter to send</span>
                  </div>
                </form>
                {busy && <div className="assistant-loading" role="status"><span className="loading-dot" /> Searching this astronaut’s records and baselines…</div>}
                {answer && assistantResult && (
                  <div className="assistant-result" aria-live="polite">
                    <div className="assistant-result-top">
                      <span className="assistant-mode">{assistantResult.mode}</span>
                      <span>{assistantResult.sources?.length || 0} evidence sources</span>
                    </div>
                    {assistantResult.status_message && <p className="assistant-status-note">{assistantResult.status_message}</p>}
                    <pre className="assistant-response">{answer}</pre>
                    {assistantResult.sources?.length > 0 && (
                      <details className="assistant-evidence">
                        <summary>View supporting records</summary>
                        <ul>{assistantResult.sources.map((source: Any) => (
                          <li key={source.id}><b>[{source.id}]</b> {source.label} <span>{source.type}{source.timestamp ? ` · ${new Date(source.timestamp).toLocaleString()}` : ''}</span></li>
                        ))}</ul>
                        <pre>{assistantResult.evidence}</pre>
                      </details>
                    )}
                  </div>
                )}
                <div className="notice">
                  <ShieldCheck size={16} /> The assistant explains recorded
                  evidence; it does not diagnose, recommend treatment, or
                  determine alert priority.
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* NASA Flight Surgeon Daily Clinical Health Report Modal */}
      {renderDailyReportModal()}

      {/* Astronaut Telemedicine Request Modal */}
      {consultModalOpen && (
        <div className="clinical-modal-overlay" onClick={() => setConsultModalOpen(false)}>
          <div className="consult-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="clinical-modal-brand">ORBITCARE TELEMEDICINE · MISSION CONTROL LINK</div>
                <h3>Request Flight Surgeon Consultation</h3>
                <p>
                  Send a consultation request to the mission medical review queue. State any symptoms, fatigue, or concerns you want reviewed.
                </p>
              </div>
            <button
              type="button"
              className="clinical-modal-close"
              onClick={() => setConsultModalOpen(false)}
            >
              ✕
            </button>
          </div>

          <textarea
            className="consult-textarea"
            placeholder="Describe your symptoms or reason for consult (e.g., 'Experiencing mild dizziness during morning centrifuge prep; requesting evaluation.')..."
            value={consultNote}
            onChange={(e) => setConsultNote(e.target.value)}
          />

          {consultFeedback && (
            <div style={{ font: "600 12.5px 'DM Sans'", color: consultFeedback.startsWith('✓') ? '#059669' : '#dc2626', marginBottom: 14 }}>
              {consultFeedback}
            </div>
          )}

          <div className="consult-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConsultModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary-action"
              disabled={consultSubmitting || !consultNote.trim()}
              onClick={handleSendConsult}
            >
              {consultSubmitting ? 'Transmitting…' : '🚀 Transmit Priority Request'}
            </button>
          </div>
        </div>
        </div>
  )
}
    </div >
  );
}
