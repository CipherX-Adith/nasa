import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
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
  // 1. Read from Vite environment variables (.env locally or Vercel Environment Variables in production)
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

  // 2. Fall back to cached configuration in localStorage if present
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

/**
 * Real-time subscription to astronaut assessments (Firestore + Realtime Database)
 */
export function subscribeToAssessments(
  astronautId: number,
  onData: (assessments: any[]) => void
): () => void {
  const { db, rtdb } = initFirebase();
  const unsubs: (() => void)[] = [];

  // 1. Subscribe to Realtime Database if available
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

  // 2. Subscribe to Firestore if available
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

  // Write to Realtime Database
  if (rtdb) {
    try {
      const newRef = rtdbPush(rtdbRef(rtdb, `assessments/${astronautId}`));
      await rtdbSet(newRef, payload);
    } catch (e) {
      console.warn('Realtime Database assessment note:', e);
    }
  }

  // Write to Firestore
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

/**
 * Real-time subscription to medical alerts
 */
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

/**
 * Stream real-time telemetry tick to Firebase
 */
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
