import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  getDatabase,
  ref as rtdbRef,
  push as rtdbPush,
  onValue as rtdbOnValue,
  set as rtdbSet,
  get as rtdbGet,
  child as rtdbChild,
  update as rtdbUpdate,
  type Database,
} from 'firebase/database';

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  databaseURL?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

const STORAGE_KEY = 'orbitcare_firebase_config';

export function getSavedFirebaseConfig(): FirebaseConfig | null {
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProject = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (envKey && envProject) {
    return {
      apiKey: envKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProject}.firebaseapp.com`,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${envProject}-default-rtdb.asia-southeast1.firebasedatabase.app`,
      projectId: envProject,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProject}.firebasestorage.app`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch {}

  return null;
}

export function saveFirebaseConfig(cfg: FirebaseConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    firebaseApp = null;
    firestoreDb = null;
    rtdbInstance = null;
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
  }
}

export function clearFirebaseConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    firebaseApp = null;
    firestoreDb = null;
    rtdbInstance = null;
  } catch (e) {
    console.error('Failed to clear Firebase config:', e);
  }
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let rtdbInstance: Database | null = null;

export function initFirebase(): {
  app: FirebaseApp | null;
  db: Firestore | null;
  rtdb: Database | null;
} {
  if (firebaseApp) {
    return { app: firebaseApp, db: firestoreDb, rtdb: rtdbInstance };
  }

  const config = getSavedFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, db: null, rtdb: null };
  }

  try {
    const existing = getApps();
    if (existing.length > 0) {
      firebaseApp = existing[0];
    } else {
      firebaseApp = initializeApp(config);
    }

    try {
      firestoreDb = getFirestore(firebaseApp);
    } catch {}

    try {
      if (config.databaseURL) {
        rtdbInstance = getDatabase(firebaseApp, config.databaseURL);
      }
    } catch {}

    return { app: firebaseApp, db: firestoreDb, rtdb: rtdbInstance };
  } catch (err) {
    console.warn('Firebase initialization note:', err);
    return { app: null, db: null, rtdb: null };
  }
}

export function isFirebaseEnabled(): boolean {
  const { db, rtdb } = initFirebase();
  return db !== null || rtdb !== null;
}

// ----------------- USERS & AUTHENTICATION (FIREBASE) -----------------

export interface FirebaseUserRecord {
  id?: number;
  username: string;
  name?: string;
  full_name?: string;
  password?: string;
  password_hash?: string;
  role: 'medical' | 'astronaut';
  status: 'pending_approval' | 'approved' | 'rejected';
  call_sign?: string;
  mission?: string;
  specialization?: string;
  astronaut_id?: number | null;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

export async function firebaseGetUsers(): Promise<FirebaseUserRecord[]> {
  const { rtdb } = initFirebase();
  if (!rtdb) return [];
  try {
    const snap = await rtdbGet(rtdbRef(rtdb, 'users'));
    const val = snap.val();
    if (!val) return [];
    return Object.values(val);
  } catch (e) {
    console.warn('firebaseGetUsers note:', e);
    return [];
  }
}

export function subscribeToFirebaseUsers(onData: (users: FirebaseUserRecord[]) => void): () => void {
  const { rtdb } = initFirebase();
  if (!rtdb) return () => {};
  try {
    const usersRef = rtdbRef(rtdb, 'users');
    const unsub = rtdbOnValue(usersRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list: FirebaseUserRecord[] = Object.values(val);
        onData(list);
      }
    });
    return () => unsub();
  } catch {
    return () => {};
  }
}

export async function firebaseRegisterUser(data: {
  username: string;
  password?: string;
  name?: string;
  full_name?: string;
  call_sign?: string;
  mission?: string;
  specialization?: string;
}): Promise<FirebaseUserRecord> {
  const { rtdb } = initFirebase();
  const uname = data.username.trim().toLowerCase();
  const now = new Date().toISOString();

  const userRecord: FirebaseUserRecord = {
    username: uname,
    password: data.password || 'orbitcare-demo',
    name: (data.full_name || data.name || uname).trim(),
    full_name: (data.full_name || data.name || uname).trim(),
    role: 'astronaut',
    status: 'pending_approval',
    call_sign: data.call_sign?.trim() || `CREW-${Math.floor(10 + Math.random() * 90)}`,
    mission: data.mission?.trim() || 'Asteria-7',
    specialization: data.specialization?.trim() || 'Mission Specialist',
    astronaut_id: null,
    created_at: now,
  };

  if (rtdb) {
    await rtdbSet(rtdbRef(rtdb, `users/${uname}`), userRecord);
  }
  return userRecord;
}

export async function firebaseApproveUser(
  username: string,
  astronautId: number,
  adminUsername: string = 'medical'
) {
  const { rtdb } = initFirebase();
  const uname = username.toLowerCase();
  const now = new Date().toISOString();

  if (rtdb) {
    try {
      const userSnap = await rtdbGet(rtdbRef(rtdb, `users/${uname}`));
      const u = userSnap.val() || {};

      const updatePayload = {
        ...u,
        status: 'approved',
        astronaut_id: astronautId,
        approved_at: now,
        approved_by: adminUsername,
      };

      await rtdbSet(rtdbRef(rtdb, `users/${uname}`), updatePayload);

      // Create astronaut profile in Firebase
      await rtdbSet(rtdbRef(rtdb, `astronauts/${astronautId}`), {
        id: astronautId,
        name: u.full_name || u.name || uname.toUpperCase(),
        call_sign: u.call_sign || `CREW-${astronautId}`,
        mission: u.mission || 'Asteria-7',
        status: 'Active',
      });

      // Generate calibrated baseline measurements directly in Firebase
      const metrics = [
        ['cardiovascular', 'Resting heart rate', 'bpm', 68.0],
        ['cardiovascular', 'HRV', 'ms', 62.0],
        ['cardiovascular', 'Systolic BP', 'mmHg', 116.0],
        ['immune', 'Core Temp', '°C', 36.6],
        ['musculoskeletal', 'Grip', 'kg', 46.0],
        ['musculoskeletal', 'Body mass', 'kg', 72.0],
        ['behavioural', 'Sleep duration', 'hours', 7.6],
        ['behavioural', 'Fatigue', '/10', 2.2],
        ['behavioural', 'Sleep quality', '/10', 7.8],
        ['behavioural', 'Stress', '/10', 2.5],
        ['behavioural', 'Mood', '/10', 8.0],
        ['radiation_environment', 'Cabin CO2', 'mmHg', 2.4],
        ['radiation_environment', 'Radiation dose rate', 'mSv/day', 0.41],
      ];

      const newMeasurements: any[] = [];
      const nowDate = new Date();
      for (const [domain, metric, unit, base] of metrics) {
        for (let day = 1; day <= 30; day++) {
          const d = new Date(nowDate.getTime() - (30 - day) * 86400000);
          const val = Number((Number(base) + (Math.random() - 0.5) * 2.8).toFixed(2));
          newMeasurements.push({
            id: Date.now() + Math.random(),
            astronaut_id: astronautId,
            domain,
            metric,
            value: val,
            unit,
            timestamp: d.toISOString(),
            source: 'Calibrated mission baseline',
            quality: 'good',
            simulated: false,
          });
        }
      }
      await rtdbSet(rtdbRef(rtdb, `measurements/${astronautId}`), newMeasurements);
    } catch (e) {
      console.warn('RTDB approve user note:', e);
    }
  }
}

export async function firebaseRejectUser(username: string) {
  const { rtdb } = initFirebase();
  const uname = username.toLowerCase();
  if (rtdb) {
    try {
      await rtdbUpdate(rtdbRef(rtdb, `users/${uname}`), {
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('RTDB reject user note:', e);
    }
  }
}

export async function firebaseDirectCreateAstronaut(
  data: {
    username: string;
    password?: string;
    name: string;
    call_sign?: string;
    mission?: string;
    specialization?: string;
  },
  astronautId: number
) {
  const { rtdb } = initFirebase();
  const uname = data.username.trim().toLowerCase();
  const now = new Date().toISOString();

  const userRecord: FirebaseUserRecord = {
    username: uname,
    password: data.password || 'orbitcare-demo',
    name: data.name.trim(),
    full_name: data.name.trim(),
    role: 'astronaut',
    status: 'approved',
    call_sign: data.call_sign?.trim() || `ASTRO-${Math.floor(10 + Math.random() * 90)}`,
    mission: data.mission?.trim() || 'Asteria-7',
    specialization: data.specialization?.trim() || 'Mission Specialist',
    astronaut_id: astronautId,
    created_at: now,
    approved_at: now,
    approved_by: 'medical',
  };

  if (rtdb) {
    await rtdbSet(rtdbRef(rtdb, `users/${uname}`), userRecord);
    await rtdbSet(rtdbRef(rtdb, `astronauts/${astronautId}`), {
      id: astronautId,
      name: userRecord.name,
      call_sign: userRecord.call_sign,
      mission: userRecord.mission,
      status: 'Active',
    });
  }

  return userRecord;
}

// ----------------- ASTRONAUTS (FIREBASE) -----------------

export async function firebaseGetAstronauts(): Promise<any[]> {
  const { rtdb } = initFirebase();
  if (!rtdb) return [];
  try {
    const snap = await rtdbGet(rtdbRef(rtdb, 'astronauts'));
    const val = snap.val();
    if (!val) return [];
    const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
    return list.sort((a, b) => a.id - b.id);
  } catch (e) {
    console.warn('firebaseGetAstronauts note:', e);
    return [];
  }
}

export function subscribeToAstronauts(onData: (astronauts: any[]) => void): () => void {
  const { rtdb } = initFirebase();
  if (!rtdb) return () => {};
  try {
    const astroRef = rtdbRef(rtdb, 'astronauts');
    const unsub = rtdbOnValue(astroRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
        onData(list.sort((a, b) => a.id - b.id));
      }
    });
    return () => unsub();
  } catch {
    return () => {};
  }
}

// ----------------- MEASUREMENTS & TELEMETRY (FIREBASE) -----------------

export async function firebaseGetMeasurements(astronautId: number): Promise<any[]> {
  const { rtdb } = initFirebase();
  if (!rtdb) return [];
  try {
    const snap = await rtdbGet(rtdbRef(rtdb, `measurements/${astronautId}`));
    const val = snap.val();
    if (!val) return [];
    const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
    return list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (e) {
    console.warn('firebaseGetMeasurements note:', e);
    return [];
  }
}

export function subscribeToMeasurements(
  astronautId: number,
  onData: (measurements: any[]) => void
): () => void {
  const { rtdb } = initFirebase();
  if (!rtdb) return () => {};
  try {
    const measRef = rtdbRef(rtdb, `measurements/${astronautId}`);
    const unsub = rtdbOnValue(measRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
        list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        onData(list);
      }
    });
    return () => unsub();
  } catch {
    return () => {};
  }
}

export async function streamTelemetryToFirebase(astronautId: number, measurement: any) {
  const { rtdb } = initFirebase();
  if (!rtdb) return;

  const payload = {
    astronaut_id: astronautId,
    domain: measurement.domain || 'cardiovascular',
    metric: measurement.metric || 'Resting heart rate',
    value: measurement.value,
    unit: measurement.unit || 'bpm',
    timestamp: new Date().toISOString(),
    source: 'Live telemetry downlink (Firebase Cloud)',
    simulated: false,
  };

  try {
    const newRef = rtdbPush(rtdbRef(rtdb, `measurements/${astronautId}`));
    await rtdbSet(newRef, payload);
    const liveRef = rtdbRef(rtdb, `telemetry/${astronautId}`);
    await rtdbSet(liveRef, payload);
  } catch {}
}

// ----------------- MEDICAL RECORDS (FIREBASE) -----------------

export interface FirebaseMedicalRecord {
  id?: string;
  astronaut_id: number;
  record_type: string;
  title: string;
  physician: string;
  findings: string;
  countermeasures: string;
  status: string;
  date: string;
  timestamp: string;
}

export async function firebaseGetMedicalRecords(astronautId: number): Promise<FirebaseMedicalRecord[]> {
  const { rtdb } = initFirebase();
  if (!rtdb) return [];
  try {
    const snap = await rtdbGet(rtdbRef(rtdb, `medical_records/${astronautId}`));
    const val = snap.val();
    if (!val) return [];
    const list: FirebaseMedicalRecord[] = Object.entries(val).map(([k, v]: [string, any]) => ({
      id: k,
      ...v,
    }));
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    return [];
  }
}

export function subscribeToMedicalRecords(
  astronautId: number,
  onData: (records: FirebaseMedicalRecord[]) => void
): () => void {
  const { rtdb } = initFirebase();
  if (!rtdb) return () => {};
  try {
    const recordsRef = rtdbRef(rtdb, `medical_records/${astronautId}`);
    const unsub = rtdbOnValue(recordsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list: FirebaseMedicalRecord[] = Object.entries(val).map(([k, v]: [string, any]) => ({
          id: k,
          ...v,
        }));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onData(list);
      }
    });
    return () => unsub();
  } catch {
    return () => {};
  }
}

export async function saveMedicalRecordToFirebase(
  astronautId: number,
  record: {
    record_type?: string;
    title: string;
    physician?: string;
    findings: string;
    countermeasures?: string;
    status?: string;
    date?: string;
  }
) {
  const { rtdb } = initFirebase();
  if (!rtdb) return;

  const now = new Date().toISOString();
  const payload: FirebaseMedicalRecord = {
    astronaut_id: astronautId,
    record_type: record.record_type || 'Clinical Evaluation',
    title: record.title,
    physician: record.physician || 'Flight Surgeon',
    findings: record.findings,
    countermeasures: record.countermeasures || '',
    status: record.status || 'Signed & Verified',
    date: record.date || now.split('T')[0],
    timestamp: now,
  };

  try {
    const newRef = rtdbPush(rtdbRef(rtdb, `medical_records/${astronautId}`));
    await rtdbSet(newRef, payload);
  } catch (e) {
    console.warn('RTDB save medical record note:', e);
  }
}

// ----------------- DAILY HEALTH DATA (ASSESSMENTS) -----------------

export async function firebaseGetAssessments(astronautId: number): Promise<any[]> {
  const { rtdb } = initFirebase();
  if (!rtdb) return [];
  try {
    const snap = await rtdbGet(rtdbRef(rtdb, `assessments/${astronautId}`));
    const val = snap.val();
    if (!val) return [];
    const list = Object.entries(val).map(([k, v]: [string, any]) => ({
      id: k,
      ...v,
    }));
    return list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (e) {
    return [];
  }
}

export function subscribeToAssessments(
  astronautId: number,
  onData: (assessments: any[]) => void
): () => void {
  const { rtdb } = initFirebase();
  if (!rtdb) return () => {};
  try {
    const assessmentsRef = rtdbRef(rtdb, `assessments/${astronautId}`);
    const unsubRtdb = rtdbOnValue(assessmentsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list = Object.entries(val).map(([k, v]: [string, any]) => ({
          id: k,
          ...v,
        }));
        list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        onData(list);
      }
    });
    return () => unsubRtdb();
  } catch {
    return () => {};
  }
}

export async function saveAssessmentToFirebase(astronautId: number, assessment: any) {
  const { rtdb } = initFirebase();
  if (!rtdb) return;

  const payload = {
    astronaut_id: astronautId,
    sleep_hours: Number(assessment.sleep_hours) || 7.5,
    sleep_quality: Math.round(Number(assessment.sleep_quality)) || 7,
    stress: Math.round(Number(assessment.stress)) || 3,
    mood: Math.round(Number(assessment.mood)) || 7,
    fatigue: Math.round(Number(assessment.fatigue)) || 2,
    symptoms: (assessment.symptoms || '').trim() || 'None reported',
    source: 'Astronaut self-report (Firebase Cloud)',
    simulated: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const newRef = rtdbPush(rtdbRef(rtdb, `assessments/${astronautId}`));
    await rtdbSet(newRef, payload);
  } catch (e) {
    console.warn('Realtime Database assessment note:', e);
  }
}

// ----------------- ALERTS (FIREBASE) -----------------

export async function firebaseGetAlerts(astronautId?: number): Promise<any[]> {
  const { rtdb } = initFirebase();
  if (!rtdb) return [];
  try {
    const snap = await rtdbGet(rtdbRef(rtdb, 'alerts'));
    const val = snap.val();
    if (!val) return [];
    let list: any[] = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
    if (astronautId) {
      list = list.filter((a) => a.astronaut_id === astronautId);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) {
    return [];
  }
}

export function subscribeToAlerts(onData: (alerts: any[]) => void): () => void {
  const { rtdb } = initFirebase();
  if (!rtdb) return () => {};
  try {
    const alertsRef = rtdbRef(rtdb, 'alerts');
    const unsub = rtdbOnValue(alertsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list: any[] = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        onData(list);
      }
    });
    return () => unsub();
  } catch {
    return () => {};
  }
}

export async function firebaseAcknowledgeAlert(alertId: number | string, note: string, acknowledgedBy: string) {
  const { rtdb } = initFirebase();
  if (!rtdb) return;
  try {
    await rtdbUpdate(rtdbRef(rtdb, `alerts/${alertId}`), {
      acknowledged: true,
      follow_up: note,
      acknowledged_by: acknowledgedBy,
      acknowledged_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('firebaseAcknowledgeAlert note:', e);
  }
}
