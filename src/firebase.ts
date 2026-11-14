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

// Firebase configuration loaded securely from environment variables
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
  username: string;
  name: string;
  password?: string;
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

/**
 * Register a new astronaut account in Firebase with 'pending_approval' status
 */
export async function firebaseRegisterUser(data: {
  username: string;
  password?: string;
  name: string;
  call_sign?: string;
  mission?: string;
  specialization?: string;
}): Promise<FirebaseUserRecord> {
  const { db, rtdb } = initFirebase();
  const uname = data.username.trim().toLowerCase();
  const now = new Date().toISOString();

  const userRecord: FirebaseUserRecord = {
    username: uname,
    password: data.password || 'orbitcare-demo',
    name: data.name.trim(),
    role: 'astronaut',
    status: 'pending_approval',
    call_sign: data.call_sign?.trim() || `CREW-${Math.floor(10 + Math.random() * 90)}`,
    mission: data.mission?.trim() || 'Asteria-7',
    specialization: data.specialization?.trim() || 'Mission Specialist',
    astronaut_id: null,
    created_at: now,
  };

  if (rtdb) {
    try {
      await rtdbSet(rtdbRef(rtdb, `users/${uname}`), userRecord);
    } catch (e) {
      console.warn('Firebase RTDB user registration note:', e);
    }
  }

  if (db) {
    try {
      await setDoc(doc(db, 'users', uname), userRecord);
    } catch (e) {
      console.warn('Firestore user registration note:', e);
    }
  }

  return userRecord;
}

/**
 * Real-time subscription to all users in Firebase (for Admin approval dashboard)
 */
export function subscribeToFirebaseUsers(onData: (users: FirebaseUserRecord[]) => void): () => void {
  const { db, rtdb } = initFirebase();
  const unsubs: (() => void)[] = [];

  if (rtdb) {
    try {
      const usersRef = rtdbRef(rtdb, 'users');
      const unsub = rtdbOnValue(usersRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list: FirebaseUserRecord[] = Object.values(val);
          onData(list);
        }
      });
      unsubs.push(() => unsub());
    } catch {}
  }

  if (db) {
    try {
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as FirebaseUserRecord);
        if (list.length > 0) {
          onData(list);
        }
      });
      unsubs.push(unsub);
    } catch {}
  }

  return () => {
    unsubs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}

/**
 * Approve a pending astronaut account in Firebase and link astronaut_id
 */
export async function firebaseApproveUser(
  username: string,
  astronautId: number,
  adminUsername: string = 'medical'
) {
  const { db, rtdb } = initFirebase();
  const uname = username.toLowerCase();
  const updatePayload = {
    status: 'approved',
    astronaut_id: astronautId,
    approved_at: new Date().toISOString(),
    approved_by: adminUsername,
  };

  if (rtdb) {
    try {
      await rtdbUpdate(rtdbRef(rtdb, `users/${uname}`), updatePayload);
    } catch (e) {
      console.warn('RTDB approve user note:', e);
    }
  }

  if (db) {
    try {
      await updateDoc(doc(db, 'users', uname), updatePayload);
    } catch (e) {
      console.warn('Firestore approve user note:', e);
    }
  }
}

/**
 * Reject a pending astronaut account in Firebase
 */
export async function firebaseRejectUser(username: string) {
  const { db, rtdb } = initFirebase();
  const uname = username.toLowerCase();
  const updatePayload = {
    status: 'rejected',
    rejected_at: new Date().toISOString(),
  };

  if (rtdb) {
    try {
      await rtdbUpdate(rtdbRef(rtdb, `users/${uname}`), updatePayload);
    } catch (e) {
      console.warn('RTDB reject user note:', e);
    }
  }

  if (db) {
    try {
      await updateDoc(doc(db, 'users', uname), updatePayload);
    } catch (e) {
      console.warn('Firestore reject user note:', e);
    }
  }
}

/**
 * Direct astronaut creation by Admin in Firebase
 */
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
  const { db, rtdb } = initFirebase();
  const uname = data.username.trim().toLowerCase();
  const now = new Date().toISOString();

  const userRecord: FirebaseUserRecord = {
    username: uname,
    password: data.password || 'orbitcare-demo',
    name: data.name.trim(),
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
    try {
      await rtdbSet(rtdbRef(rtdb, `users/${uname}`), userRecord);
      await rtdbSet(rtdbRef(rtdb, `astronauts/${astronautId}`), {
        id: astronautId,
        name: userRecord.name,
        call_sign: userRecord.call_sign,
        mission: userRecord.mission,
        status: 'Active',
      });
    } catch (e) {
      console.warn('RTDB direct create note:', e);
    }
  }

  if (db) {
    try {
      await setDoc(doc(db, 'users', uname), userRecord);
      await setDoc(doc(db, 'astronauts', String(astronautId)), {
        id: astronautId,
        name: userRecord.name,
        call_sign: userRecord.call_sign,
        mission: userRecord.mission,
        status: 'Active',
      });
    } catch (e) {
      console.warn('Firestore direct create note:', e);
    }
  }

  return userRecord;
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

/**
 * Real-time subscription to medical records for an astronaut
 */
export function subscribeToMedicalRecords(
  astronautId: number,
  onData: (records: FirebaseMedicalRecord[]) => void
): () => void {
  const { db, rtdb } = initFirebase();
  const unsubs: (() => void)[] = [];

  if (rtdb) {
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
      unsubs.push(() => unsub());
    } catch {}
  }

  if (db) {
    try {
      const q = query(
        collection(db, 'medical_records'),
        where('astronaut_id', '==', astronautId),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as FirebaseMedicalRecord[];
        if (list.length > 0) {
          onData(list);
        }
      });
      unsubs.push(unsub);
    } catch {}
  }

  return () => {
    unsubs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}

/**
 * Save a medical record to Firebase
 */
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
  const { db, rtdb } = initFirebase();
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

  if (rtdb) {
    try {
      const newRef = rtdbPush(rtdbRef(rtdb, `medical_records/${astronautId}`));
      await rtdbSet(newRef, payload);
    } catch (e) {
      console.warn('RTDB save medical record note:', e);
    }
  }

  if (db) {
    try {
      await addDoc(collection(db, 'medical_records'), {
        ...payload,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore save medical record note:', e);
    }
  }
}

// ----------------- DAILY HEALTH DATA (ASSESSMENTS) -----------------

/**
 * Real-time subscription to astronaut assessments (Firestore + Realtime Database)
 */
export function subscribeToAssessments(
  astronautId: number,
  onData: (assessments: any[]) => void
): () => void {
  const { db, rtdb } = initFirebase();
  const unsubs: (() => void)[] = [];

  if (rtdb) {
    try {
      const assessmentsRef = rtdbRef(rtdb, `assessments/${astronautId}`);
      const unsubRtdb = rtdbOnValue(assessmentsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list = Object.entries(val).map(([k, v]: [string, any]) => ({
            id: k,
            ...v,
          }));
          onData(list);
        }
      });
      unsubs.push(() => unsubRtdb());
    } catch {}
  }

  if (db) {
    try {
      const q = query(
        collection(db, 'assessments'),
        where('astronaut_id', '==', astronautId),
        orderBy('timestamp', 'asc'),
        limit(100)
      );

      const unsubFs = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              timestamp:
                data.timestamp && typeof data.timestamp.toDate === 'function'
                  ? data.timestamp.toDate().toISOString()
                  : data.timestamp || new Date().toISOString(),
            };
          });
          onData(items);
        },
        () => {}
      );
      unsubs.push(unsubFs);
    } catch {}
  }

  return () => {
    unsubs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}

/**
 * Save assessment record to Firebase (Realtime Database & Firestore)
 */
export async function saveAssessmentToFirebase(astronautId: number, assessment: any) {
  const { db, rtdb } = initFirebase();
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

  if (rtdb) {
    try {
      const newRef = rtdbPush(rtdbRef(rtdb, `assessments/${astronautId}`));
      await rtdbSet(newRef, payload);
    } catch (e) {
      console.warn('Realtime Database assessment note:', e);
    }
  }

  if (db) {
    try {
      await addDoc(collection(db, 'assessments'), {
        ...payload,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Firestore assessment note:', e);
    }
  }
}

// ----------------- ALERTS & TELEMETRY -----------------

export function subscribeToAlerts(onData: (alerts: any[]) => void): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  try {
    const q = query(collection(db, 'alerts'), orderBy('created_at', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        onData(items);
      },
      () => {}
    );
  } catch {
    return () => {};
  }
}

export async function streamTelemetryToFirebase(astronautId: number, measurement: any) {
  const { db, rtdb } = initFirebase();
  const payload = {
    astronaut_id: astronautId,
    domain: measurement.domain || 'cardiovascular',
    metric: measurement.metric || 'Resting heart rate',
    value: measurement.value,
    unit: measurement.unit || 'bpm',
    timestamp: new Date().toISOString(),
    source: 'Live telemetry downlink (Firebase)',
    simulated: false,
  };

  if (rtdb) {
    try {
      const newRef = rtdbPush(rtdbRef(rtdb, `telemetry/${astronautId}`));
      await rtdbSet(newRef, payload);
    } catch {}
  }

  if (db) {
    try {
      await addDoc(collection(db, 'telemetry'), {
        ...payload,
        timestamp: serverTimestamp(),
      });
    } catch {}
  }
}
