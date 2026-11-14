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
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FilePlus,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  ShieldCheck,
  Stethoscope,
  Sun,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wind,
  XCircle,
} from 'lucide-react';
import {
  isFirebaseEnabled,
  subscribeToAssessments,
  saveAssessmentToFirebase,
  streamTelemetryToFirebase,
  firebaseRegisterUser,
  subscribeToFirebaseUsers,
  firebaseApproveUser,
  firebaseRejectUser,
  firebaseDirectCreateAstronaut,
  subscribeToMedicalRecords,
  saveMedicalRecordToFirebase,
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
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
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

  // Real-time synchronization & live telemetry state
  const [liveStreaming, setLiveStreaming] = useState(true);
  const [packetCount, setPacketCount] = useState(1420);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [realtimeClock, setRealtimeClock] = useState(() => {
    const d = new Date();
    return {
      utc: d.toISOString().slice(11, 19) + ' UTC',
      met: `060:${d.toISOString().slice(11, 19)}`,
    };
  });

  // Firebase Real-time Cloud Database (active in background)
  const firebaseActive = isFirebaseEnabled();
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
  const [regMission, setRegMission] = useState('Asteria-7');
  const [regSpecialization, setRegSpecialization] = useState('Mission Specialist');
  const [regBusy, setRegBusy] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regMessage, setRegMessage] = useState('');
  const [regError, setRegError] = useState('');

  // Admin User & Crew Clearance Management state
  const [systemUsers, setSystemUsers] = useState<Any[]>([]);
  const [adminActionBusy, setAdminActionBusy] = useState(false);

  // Direct Astronaut Provisioning state (Admin only)
  const [directName, setDirectName] = useState('');
  const [directUsername, setDirectUsername] = useState('');
  const [directPassword, setDirectPassword] = useState('orbitcare-demo');
  const [directCallSign, setDirectCallSign] = useState('');
  const [directMission, setDirectMission] = useState('Asteria-7');
  const [directSpecialization, setDirectSpecialization] = useState('Mission Specialist');
  const [directBusy, setDirectBusy] = useState(false);
  const [directSuccess, setDirectSuccess] = useState('');
  const [directError, setDirectError] = useState('');

  // Clinical Medical Records state (Firebase & Database)
  const [medicalRecords, setMedicalRecords] = useState<Any[]>([]);
  const [showAddMedRecordModal, setShowAddMedRecordModal] = useState(false);
  const [newMedRecord, setNewMedRecord] = useState({
    record_type: 'Clinical Evaluation',
    title: '',
    physician: 'Dr. Robert Vance, Flight Surgeon',
    findings: '',
    countermeasures: '',
    status: 'Signed & Verified',
    date: new Date().toISOString().split('T')[0],
  });
  const [medRecordSubmitting, setMedRecordSubmitting] = useState(false);

  // Selected pill in the Mission Telemetry Trend card
  const [selectedMetric, setSelectedMetric] = useState('Heart Rate');

  // Role detection
  const isAdmin = user?.role === 'medical';
  const isUser = !isAdmin && !!user;

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

    try {
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      setToken(d.access_token);
      setUser(d);
      localStorage.setItem('token', d.access_token);
      localStorage.setItem('user', JSON.stringify(d));
      // For regular astronaut user, pre-select their own astronaut_id
      if (d.role !== 'medical' && d.astronaut_id) {
        setSelected(d.astronaut_id);
      } else {
        setSelected(null);
      }
      setError('');
      setLoginClearancePending(false);
    } catch (x: any) {
      const msg = x.message || 'Login failed';
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
        mission: regMission.trim() || 'Asteria-7',
        specialization: regSpecialization.trim() || 'Mission Specialist',
      };

      // 1. Submit to Backend API
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // 2. Submit to Firebase (Realtime Database + Firestore)
      try {
        await firebaseRegisterUser({
          username: payload.username,
          password: payload.password,
          name: payload.full_name,
          call_sign: payload.call_sign,
          mission: payload.mission,
          specialization: payload.specialization,
        });
      } catch (fbErr) {
        console.warn('Firebase registration notice:', fbErr);
      }

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
      const res = await api(`/admin/users/${targetUser.id}/approve`, { method: 'POST' });
      const assignedAstroId = res.astronaut_id || targetUser.astronaut_id || 4;

      try {
        await firebaseApproveUser(targetUser.username, assignedAstroId, user?.username || 'medical');
      } catch (e) {
        console.warn('Firebase approve error:', e);
      }

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
      try {
        await firebaseRejectUser(targetUser.username);
      } catch (e) {
        console.warn('Firebase reject error:', e);
      }
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
        mission: directMission.trim() || 'Asteria-7',
        specialization: directSpecialization.trim() || 'Mission Specialist',
      };

      const res = await api('/admin/astronauts/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const newAstroId = res.astronaut?.id;
      try {
        await firebaseDirectCreateAstronaut(payload, newAstroId);
      } catch (e) {
        console.warn('Firebase direct create notice:', e);
      }

      setDirectSuccess(`Astronaut ${payload.name} (${payload.call_sign}) successfully created and cleared for flight!`);
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
        status: newMedRecord.status || 'Signed & Verified',
        date: newMedRecord.date || new Date().toISOString().split('T')[0],
      };

      await api(`/astronauts/${selected}/medical-records`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      try {
        await saveMedicalRecordToFirebase(selected, payload);
      } catch (e) {
        console.warn('Firebase medical record note:', e);
      }

      await load();
      setShowAddMedRecordModal(false);
      setNewMedRecord({
        record_type: 'Clinical Evaluation',
        title: '',
        physician: 'Dr. Robert Vance, Flight Surgeon',
        findings: '',
        countermeasures: '',
        status: 'Signed & Verified',
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
      setAstronauts(a);
      // For regular user, strictly lock ID to their assigned astronaut_id
      const id = (user?.role !== 'medical' && user?.astronaut_id)
        ? user.astronaut_id
        : (selected || a[0]?.id);

      setSelected(id);

      if (id) {
        const [m, b, l, t, d, ass, recs] = await Promise.all([
          api(`/astronauts/${id}/measurements`),
          api(`/astronauts/${id}/baselines`),
          api(`/alerts?astronaut_id=${id}`),
          api(`/timeline/${id}`),
          api(`/astronauts/${id}/documents`),
          api(`/astronauts/${id}/assessments`),
          api(`/astronauts/${id}/medical-records`).catch(() => []),
        ]);
        setMeasurements(m);
        setBaselines(b);
        setAlerts(l);
        setTimeline(t);
        setDocs(d);
        if (Array.isArray(recs)) {
          setMedicalRecords(recs);
        }

        // Merge server assessments with locally stored assessments (resilient across serverless containers)
        let mergedAss = Array.isArray(ass) ? [...ass] : [];
        try {
          const stored = JSON.parse(localStorage.getItem(`orbitcare_assessments_${id}`) || '[]');
          for (const item of stored) {
            const exists = mergedAss.some(
              (x: Any) => x.id === item.id || (x.timestamp === item.timestamp && x.symptoms === item.symptoms)
            );
            if (!exists) {
              mergedAss.push(item);
            }
          }
        } catch {}
        mergedAss.sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());
        setAssessmentsList(mergedAss);
      }

      if (user?.role === 'medical') {
        loadAdminUsers();
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [token, selected]);

  const astronaut = astronauts.find((a: Any) => a.id === selected) || astronauts[0];
  const metrics = useMemo(
    () => Array.from(new Set(measurements.map((x: Any) => x.metric))),
    [measurements]
  );
  const latest = (metric: string) =>
    measurements.filter((x: Any) => x.metric === metric).at(-1);
  const baseline = (metric: string) =>
    baselines.find((x: Any) => x.metric === metric);

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
        met: `060:${d.toISOString().slice(11, 19)}`,
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
        } catch {
          // Client-side realistic micro-fluctuation fallback if server endpoint is unreachable
          const latestHr =
            measurements
              .filter((m: Any) => m.metric === 'Resting heart rate')
              .at(-1)?.value || 84.0;
          const delta = (Math.random() - 0.48) * 1.2;
          const newVal =
            Math.round(Math.max(56, Math.min(115, latestHr + delta)) * 10) / 10;
          tickData = {
            id: Date.now(),
            astronaut_id: targetId,
            domain: 'cardiovascular',
            metric: 'Resting heart rate',
            value: newVal,
            unit: 'bpm',
            timestamp: new Date().toISOString(),
            source: 'Live telemetry downlink',
            quality: 'good',
            simulated: false,
          };
        }

        if (tickData && tickData.value !== undefined) {
          setMeasurements((prev) => [...prev, tickData]);
          setPacketCount((c) => c + 1);
          setLastSyncTime(new Date());

          // Stream to Firebase in real-time if active
          if (firebaseActive) {
            streamTelemetryToFirebase(targetId, tickData).catch(() => {});
          }
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
          let mergedAss = [...ass];
          try {
            const stored = JSON.parse(
              localStorage.getItem(`orbitcare_assessments_${targetId}`) || '[]'
            );
            for (const item of stored) {
              const exists = mergedAss.some(
                (x: Any) =>
                  x.id === item.id ||
                  (x.timestamp === item.timestamp && x.symptoms === item.symptoms)
              );
              if (!exists) mergedAss.push(item);
            }
          } catch {}
          mergedAss.sort(
            (x, y) =>
              new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime()
          );
          setAssessmentsList(mergedAss);
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
    if (!aid) return;

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

  // Compute 60-day telemetry curve, adaptive baseline, drift flags, domains & ticks dynamically
  const telemetryData = useMemo(() => {
    const filtered = measurements
      .filter((m: Any) => m.metric === backendMetric)
      .sort((a: Any, b: Any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (!filtered.length) {
      return {
        points: [],
        unit: 'BPM',
        median: 65.4,
        upper: 68.07,
        lower: 62.73,
        domain: [58, 86] as [number, number],
        ticks: [60, 66, 72, 78, 84],
      };
    }

    const rawUnit = filtered[0].unit;
    const unit = rawUnit === 'bpm' ? 'BPM' : rawUnit;

    // First 30 days as rolling calibration window (D1-D30)
    const calSlice = filtered.length >= 30 ? filtered.slice(0, 30) : filtered;
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

    let median: number;
    let lower: number;
    let upper: number;

    if (selectedMetric === 'Heart Rate' && (selected === 1 || !selected)) {
      median = 65.4;
      lower = 62.73;
      upper = 68.07;
    } else {
      median = Number(calculatedMedian.toFixed(1));
      const scale = Math.max(1.4826 * (calculatedMad || 1.2), Math.abs(median) * 0.04, 0.2);
      lower = Number((median - scale).toFixed(2));
      upper = Number((median + scale).toFixed(2));
    }

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

    let yDomain: [number, number];
    let yTicks: number[];

    if (selectedMetric === 'Heart Rate') {
      yDomain = [58, 86];
      yTicks = [60, 66, 72, 78, 84];
    } else if (selectedMetric === 'HRV') {
      yDomain = [35, 75];
      yTicks = [40, 48, 56, 64, 72];
    } else if (selectedMetric === 'Systolic BP') {
      yDomain = [108, 142];
      yTicks = [112, 118, 124, 130, 136];
    } else if (selectedMetric === 'Core Temp') {
      yDomain = [36.0, 37.8];
      yTicks = [36.2, 36.6, 37.0, 37.4];
    } else if (selectedMetric === 'Grip') {
      yDomain = [34, 54];
      yTicks = [36, 40, 44, 48, 52];
    } else if (selectedMetric === 'Sleep duration') {
      yDomain = [3.5, 9.0];
      yTicks = [4, 5, 6, 7, 8];
    } else if (['Fatigue', 'Sleep quality', 'Stress', 'Mood'].includes(selectedMetric)) {
      yDomain = [0, 10];
      yTicks = [2, 4, 6, 8, 10];
    } else if (selectedMetric === 'Body mass') {
      yDomain = [68, 80];
      yTicks = [70, 72, 74, 76, 78];
    } else if (selectedMetric === 'Cabin CO2') {
      yDomain = [1.5, 3.5];
      yTicks = [1.5, 2.0, 2.5, 3.0, 3.5];
    } else if (selectedMetric === 'Radiation dose rate') {
      yDomain = [0.25, 0.65];
      yTicks = [0.3, 0.4, 0.5, 0.6];
    } else {
      const allVals = points.map((p: any) => p.value);
      const minVal = Math.min(...allVals, lower);
      const maxVal = Math.max(...allVals, upper);
      const pad = (maxVal - minVal) * 0.15 || 5;
      const low = Math.floor(minVal - pad);
      const high = Math.ceil(maxVal + pad);
      const step = Math.round((high - low) / 4) || 1;
      yDomain = [low, high];
      yTicks = [low, low + step, low + step * 2, low + step * 3, high];
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
  }, [measurements, backendMetric, selectedMetric, selected]);

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
      return (
        <div className="telemetry-tooltip">
          <div className="tooltip-day">{data.dayFull || label}</div>
          <div className="tooltip-value">
            {data.value} <span className="tooltip-unit">{data.unit}</span>
          </div>
          <div className="tooltip-baseline">
            Baseline: {data.baselineMedian} {data.unit} ({data.baselineLower}-
            {data.baselineUpper})
          </div>
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
    : '7.5';

  const behaviouralChartPoints = useMemo(() => {
    if (!assessmentsList.length) {
      return Array.from({ length: 60 }, (_, i) => ({
        day: `D${i + 1}`,
        dayNum: i + 1,
        value: 7.5,
        sleep_hours: 7.5,
        fatigue: 2,
        stress: 3,
        mood: 7,
        sleep_quality: 7,
        symptoms: 'None reported',
        isAnomaly: false,
      }));
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
    switch (behaviouralMetric) {
      case 'Fatigue':
        return {
          unit: '/10',
          targetLabel: 'Nominal threshold: <= 3/10',
          baselineVal: 3.0,
          color: '#ef4444',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      case 'Stress':
        return {
          unit: '/10',
          targetLabel: 'Operational limit: <= 4/10',
          baselineVal: 3.0,
          color: '#f59e0b',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      case 'Mood':
        return {
          unit: '/10',
          targetLabel: 'Nominal readiness: >= 7/10',
          baselineVal: 7.0,
          color: '#10b981',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      case 'Sleep Quality':
        return {
          unit: '/10',
          targetLabel: 'Restorative baseline: >= 7/10',
          baselineVal: 7.0,
          color: '#8b5cf6',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
      case 'Sleep Duration':
      default:
        return {
          unit: 'hrs',
          targetLabel: 'Target operational sleep: 7.0 – 8.5 hrs',
          baselineVal: 7.5,
          color: '#0284c7',
          yDomain: [0, 10],
          yTicks: [0, 2, 4, 6, 8, 10],
        };
    }
  }, [behaviouralMetric]);

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

  // Reusable Telemetry Trend Card
  const renderTelemetryCard = () => (
    <section className="telemetry-card">
      <div className="telemetry-head">
        <div className="telemetry-head-left">
          <div className="telemetry-title-row">
            <h2>Mission Telemetry Trend</h2>
            <span className="telemetry-badge">
              60-Day Adaptive Baseline
            </span>
          </div>
          <p className="telemetry-subtitle">
            {isAdmin
              ? `Tracking adaptation for ${astronaut?.name || 'astronaut'} relative to calibrated normal range (${telemetryData.median} ${telemetryData.unit})`
              : `Tracking your personal adaptation relative to calibrated normal range (${telemetryData.median} ${telemetryData.unit})`}
          </p>
        </div>

        <div className="telemetry-pills">
          {availablePills.map((m) => (
            <button
              key={m}
              className={`telemetry-pill-btn ${
                selectedMetric === m ? 'active' : ''
              }`}
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
            Live {selectedMetric}: <b>{latest(backendMetric)?.value ?? telemetryData.points.at(-1)?.value ?? '--'}</b> {telemetryData.unit}
          </span>
          <span className="live-strip-tag">
            LEO Downlink · 0.25 Hz
          </span>
        </div>
        <div className="live-strip-right">
          <span className="live-strip-packets">
            Packets: <b>{packetCount}</b>
          </span>
          <span className="live-strip-time">
            Last tick: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
            data={telemetryData.points}
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
              dataKey="day"
              ticks={['D1', 'D15', 'D30', 'D45', 'D60']}
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
              domain={telemetryData.domain}
              ticks={telemetryData.ticks}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: '#94a3b8',
                fontSize: 11,
                fontFamily: "'DM Mono', monospace",
              }}
              width={35}
            />

            {/* Three reference dashed lines for calibrated baseline & normal range */}
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
              dot={<CustomDot />}
              activeDot={<CustomActiveDot />}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="telemetry-footer">
        <div className="telemetry-legend">
          <span className="legend-item">
            <span className="legend-dot telemetry-dot" /> Telemetry
          </span>
          <span className="legend-item">
            <span className="legend-line baseline-line" /> Baseline Median
          </span>
          <span className="legend-item">
            <span className="legend-dot drift-dot" /> Baseline Drift
          </span>
        </div>
        <div className="telemetry-calibration">
          Rolling Calibration Window: D1-D30
        </div>
      </div>
    </section>
  );

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

              {/* Quick Access Role Presets */}
              <div className="login-roles">
                <div className="login-roles-title">QUICK ACCESS DEMO PRESETS:</div>
                <div className="login-roles-buttons">
                  <button
                    type="button"
                    className="role-preset-btn admin-preset"
                    onClick={() => {
                      setUsernameInput('medical');
                      setPasswordInput('orbitcare-demo');
                      setError('');
                      setLoginClearancePending(false);
                    }}
                  >
                    <ShieldCheck size={14} color="#d97706" />
                    <span>Admin (Medical Officer)</span>
                  </button>
                  <button
                    type="button"
                    className="role-preset-btn"
                    onClick={() => {
                      setUsernameInput('astronaut');
                      setPasswordInput('orbitcare-demo');
                      setError('');
                      setLoginClearancePending(false);
                    }}
                  >
                    <Users size={14} color="#0284c7" />
                    <span>User (Maya Chen)</span>
                  </button>
                  <button
                    type="button"
                    className="role-preset-btn"
                    onClick={() => {
                      setUsernameInput('elena');
                      setPasswordInput('orbitcare-demo');
                      setError('');
                      setLoginClearancePending(false);
                    }}
                  >
                    <Users size={14} color="#0284c7" />
                    <span>User (Elena Rossi)</span>
                  </button>
                  <button
                    type="button"
                    className="role-preset-btn"
                    onClick={() => {
                      setUsernameInput('david');
                      setPasswordInput('orbitcare-demo');
                      setError('');
                      setLoginClearancePending(false);
                    }}
                  >
                    <Users size={14} color="#0284c7" />
                    <span>User (David Okafor)</span>
                  </button>
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

          <div className="credentials" style={{ marginTop: 14 }}>
            Demo Credentials · Password <b>orbitcare-demo</b>
          </div>
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
      <aside className="sidebar">
        <div className="brand">
          <div>
            <img className="brand-logo" src="/orbitcare-logo-transparent.png" alt="ORBITCARE" />
            <small>{isAdmin ? 'MISSION CONTROL' : 'ASTRONAUT PORTAL'}</small>
          </div>
        </div>
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
              onClick={() => handleTabChange(label)}
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
            <i /> {liveStreaming ? (isAdmin ? 'REAL-TIME TELEMETRY LIVE' : 'TELEMETRY DOWNLINK ACTIVE') : 'DOWNLINK STREAM PAUSED'}
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
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">
            ASTERIA-7 <span>/</span> {isAdmin ? 'MISSION CONTROL' : 'ASTRONAUT PORTAL'} <span>/</span> {tab.toUpperCase()}
          </div>
          <div className="top-right">
            {/* Astronaut Selector in Topbar: Active when NOT on Overview (sub-views) */}
            {tab !== 'Overview' && isAdmin && (
              <div className="topbar-crew-select" title="Switch monitored crew member">
                <Users size={14} className="topbar-crew-icon" />
                <span className="topbar-select-label">Crew:</span>
                <select
                  value={selected || ''}
                  onChange={(e) => setSelected(+e.target.value)}
                >
                  {astronauts.map((a: Any) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.call_sign})
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </div>
            )}

            {/* Astronaut Badge in Topbar: Active when NOT on Overview (sub-views) */}
            {tab !== 'Overview' && isUser && (
              <div className="topbar-user-badge" title="Active Astronaut Profile">
                <span className="topbar-user-avatar">
                  {astronaut?.call_sign?.slice(0, 2) || 'OR'}
                </span>
                <span className="topbar-user-name">{astronaut?.name}</span>
                <span className="topbar-user-callsign">{astronaut?.call_sign}</span>
              </div>
            )}

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
                    MISSION DAY 060 <span className="sep">·</span> LOW EARTH ORBIT <span className="sep">·</span>{' '}
                    {isAdmin ? 'FLIGHT SURGEON OVERVIEW' : 'ASTRONAUT TELEMETRY'}
                  </div>
                  <h1>
                    {isAdmin ? 'Crew Health Overview' : 'Personal Health Overview'}
                  </h1>
                  <p className="muted">
                    {isAdmin
                      ? `Comprehensive flight surgeon overview, telemetry alerts, and baseline drift across Asteria-7 crew.`
                      : `Personal health signals, baseline comparisons, and telemetry for ${astronaut?.name}.`}
                  </p>
                </div>

                {/* OVERVIEW MEMBER DETAILS: Dropdown for Admin, Locked Personal Badge for User */}
                {isAdmin ? (
                  <div className="selector">
                    <span>ASTRONAUT</span>
                    <select
                      value={selected || ''}
                      onChange={(e) => setSelected(+e.target.value)}
                    >
                      {astronauts.map((a: Any) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.call_sign}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} />
                  </div>
                ) : (
                  <div className="personal-badge-card">
                    <span className="personal-badge-label">LOGGED IN CREW MEMBER</span>
                    <div className="personal-badge-name">
                      <span className="personal-avatar">
                        {astronaut?.call_sign?.slice(0, 2) || 'OR'}
                      </span>
                      <strong>{astronaut?.name || user?.username}</strong>
                    </div>
                    <div className="personal-badge-callsign">
                      Call Sign: <b>{astronaut?.call_sign}</b> · Mission: <b>{astronaut?.mission || 'Asteria-7'}</b>
                    </div>
                  </div>
                )}
              </div>

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
                    DAY 60 <small>of 180</small>
                  </strong>
                  <div className="stat-foot">ASTERIA-7 · Low Earth Orbit</div>
                </div>
              </div>

              {/* 60-Day Telemetry Trend Graph */}
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
                        Click any measurement row below to visualize its 60-day adaptive
                        trend graph above.
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
                              className={`table-row-clickable ${
                                isSelected ? 'active' : ''
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
              </div>

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
                        {assessmentsList.length || 60}-Day Longitudinal Self-Reports
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
                        className={`telemetry-pill-btn ${
                          behaviouralMetric === m ? 'active' : ''
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
                          assessmentsList.length > 60
                            ? ['D1', 'D15', 'D30', 'D45', `D${assessmentsList.length}`]
                            : ['D1', 'D15', 'D30', 'D45', 'D60']
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
                    Mission Timeline: D1–D{assessmentsList.length || 60} ({assessmentsList.length} logs recorded)
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

                      const optimisticEntry: Any = {
                        id: Date.now(),
                        astronaut_id: targetId,
                        ...payload,
                        timestamp: new Date().toISOString(),
                        source: 'Astronaut self-report',
                        simulated: false,
                      };

                      try {
                        let created: Any | null = null;
                        try {
                          created = await api(`/astronauts/${targetId}/assessments`, {
                            method: 'POST',
                            body: JSON.stringify(payload),
                          });
                        } catch (err: any) {
                          console.warn('Backend POST assessment failed, using optimistic entry:', err);
                        }

                        const finalEntry = (created && created.id) ? created : optimisticEntry;

                        // Immediately append to state for zero-latency UI update
                        setAssessmentsList((prev) => {
                          const updated = [...prev, finalEntry];
                          try {
                            const key = `orbitcare_assessments_${targetId}`;
                            const prevStored = JSON.parse(localStorage.getItem(key) || '[]');
                            localStorage.setItem(key, JSON.stringify([...prevStored, finalEntry]));
                          } catch {}

                          // If Firebase Cloud Database is active, save to Firestore in real-time!
                          if (firebaseActive) {
                            saveAssessmentToFirebase(targetId, payload).catch((e) =>
                              console.warn('Firebase save error:', e)
                            );
                          }

                          return updated;
                        });

                        setAssessmentFeedback(
                          `Assessment successfully recorded for Mission Day ${assessmentsList.length + 1} (${symptomsVal})!`
                        );
                        setTimeout(() => setAssessmentFeedback(''), 8000);

                        // Reset symptoms input for next log
                        setAssessment((prev) => ({
                          ...prev,
                          symptoms: '',
                        }));

                        // Trigger non-blocking background refresh
                        load().catch(() => {});
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
                        const dayIndex = assessmentsList.length - i;
                        const isLatest = i === 0;
                        return (
                          <tr
                            key={a.id || i}
                            style={isLatest && !a.simulated ? { background: isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.08)' } : undefined}
                          >
                            <td>
                              <span className="type-pill assessment">
                                Day {dayIndex}
                              </span>
                              {isLatest && !a.simulated && (
                                <span style={{ marginLeft: '6px', fontSize: '10px', background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  NEW
                                </span>
                              )}
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
                                className={`priority ${
                                  a.fatigue >= 5 ? 'high-text' : ''
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
                      ? `Longitudinal clinical evaluations, countermeasure protocols, and certified medical reports for ${astronaut?.name}.`
                      : 'Your certified flight medical history, physician evaluations, and prescribed microgravity countermeasures.'}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-approve"
                    style={{ width: 'auto', padding: '9px 16px', display: 'inline-flex', gap: 6 }}
                    onClick={() => setShowAddMedRecordModal(!showAddMedRecordModal)}
                  >
                    <FilePlus size={15} />
                    {showAddMedRecordModal ? 'Close Form' : '+ Add Clinical Evaluation'}
                  </button>
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
                          placeholder="e.g. Day 60 Post-EVA Orthostatic & Cardiovascular Assessment"
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
                      Stored in primary database & synchronized with Firebase Cloud in real time.
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
                            Signed by: <b>{r.physician || 'Flight Surgeon'}</b>
                          </div>
                        </div>
                        <span className="status-pill approved">{r.status || 'Signed & Verified'}</span>
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
                            await api(`/astronauts/${selected}/documents`, {
                              method: 'POST',
                              body: fd,
                            });
                            load();
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
                        {d.verified
                          ? 'Verified by medical officer'
                          : 'Pending human review'}{' '}
                        · extraction confidence {Math.round(d.confidence * 100)}%
                      </p>
                      <pre>{d.extracted_text}</pre>
                    </div>
                    {isAdmin && !d.verified && (
                      <button
                        className="ack"
                        onClick={async () => {
                          await api(`/documents/${d.id}/verify`, { method: 'POST' });
                          load();
                        }}
                      >
                        Verify
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
              </div>

              {/* SECTION 1: PENDING APPROVALS */}
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
                    <Plus size={14} /> Provision & Clear Astronaut
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
                    Natural language queries grounded in mission telemetry, clinical guidelines, and flight logs.
                  </p>
                </div>
              </div>

              <section className="panel assistant">
                <div className="assistant-head">
                  <div className="assistant-icon">
                    <Atom />
                  </div>
                  <div>
                    <div className="eyebrow">
                      {isAdmin
                        ? 'FLIGHT SURGEON AI ASSISTANT'
                        : 'CREW PERSONAL HEALTH ASSISTANT'}
                    </div>
                    <h2>
                      {isAdmin
                        ? `Ask about ${astronaut?.name}'s health signals`
                        : 'Ask about your mission health'}
                    </h2>
                    <p>
                      Answers use available records. Interpretations are not
                      diagnoses.
                    </p>
                  </div>
                </div>
                <div className="prompt-chips">
                  {[
                    'Summarize recent health changes',
                    'What evidence supports the open alerts?',
                    'How has sleep changed from baseline?',
                  ].map((x) => (
                    <button key={x} onClick={() => setQuestion(x)}>
                      {x}
                    </button>
                  ))}
                </div>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about available measurements, trends, alerts, or mission events…"
                />
                <button
                  className="ask-btn"
                  disabled={!question.trim() || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await api('/assistant/ask', {
                        method: 'POST',
                        body: JSON.stringify({ question, astronaut_id: selected }),
                      });
                      setAnswer(
                        `${r.mode}\n\n${r.answer}\n\nEvidence retrieved:\n${r.evidence}`
                      );
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Retrieving evidence…' : 'Ask assistant'} <span>→</span>
                </button>
                {answer && <pre className="answer">{answer}</pre>}
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
    </div>
  );
}
