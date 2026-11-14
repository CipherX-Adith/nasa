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

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const STORAGE_KEY = 'orbitcare_firebase_config';

export function getSavedFirebaseConfig(): FirebaseConfig | null {
  // 1. Check localStorage first
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch {}

  // 2. Fall back to Vite environment variables
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProject = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (envKey && envProject) {
    return {
      apiKey: envKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProject}.firebaseapp.com`,
      projectId: envProject,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProject}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return null;
}

export function saveFirebaseConfig(cfg: FirebaseConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    // Reset app instance to reinitialize
    firebaseApp = null;
    firestoreDb = null;
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
  }
}

export function clearFirebaseConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    firebaseApp = null;
    firestoreDb = null;
  } catch (e) {
    console.error('Failed to clear Firebase config:', e);
  }
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

export function initFirebase(): { app: FirebaseApp | null; db: Firestore | null } {
  if (firestoreDb && firebaseApp) {
    return { app: firebaseApp, db: firestoreDb };
  }

  const config = getSavedFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, db: null };
  }

  try {
    const existing = getApps();
    if (existing.length > 0) {
      firebaseApp = existing[0];
    } else {
      firebaseApp = initializeApp(config);
    }
    firestoreDb = getFirestore(firebaseApp);
    return { app: firebaseApp, db: firestoreDb };
  } catch (err) {
    console.warn('Firebase initialization error:', err);
    return { app: null, db: null };
  }
}

export function isFirebaseEnabled(): boolean {
  const { db } = initFirebase();
  return db !== null;
}

/**
 * Real-time subscription to astronaut assessments collection
 */
export function subscribeToAssessments(
  astronautId: number,
  onData: (assessments: any[]) => void
): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  try {
    const q = query(
      collection(db, 'assessments'),
      where('astronaut_id', '==', astronautId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
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
      (err) => {
        console.warn('Firestore assessments snapshot error:', err);
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn('subscribeToAssessments error:', e);
    return () => {};
  }
}

/**
 * Save assessment record to Firestore
 */
export async function saveAssessmentToFirebase(astronautId: number, assessment: any) {
  const { db } = initFirebase();
  if (!db) return null;

  try {
    const docRef = await addDoc(collection(db, 'assessments'), {
      astronaut_id: astronautId,
      sleep_hours: Number(assessment.sleep_hours) || 7.5,
      sleep_quality: Math.round(Number(assessment.sleep_quality)) || 7,
      stress: Math.round(Number(assessment.stress)) || 3,
      mood: Math.round(Number(assessment.mood)) || 7,
      fatigue: Math.round(Number(assessment.fatigue)) || 2,
      symptoms: (assessment.symptoms || '').trim() || 'None reported',
      source: 'Astronaut self-report (Firebase Cloud)',
      simulated: false,
      timestamp: serverTimestamp(),
      created_at: new Date().toISOString(),
    });
    return docRef.id;
  } catch (err) {
    console.error('Failed to save assessment to Firebase:', err);
    return null;
  }
}

/**
 * Real-time subscription to medical alerts collection
 */
export function subscribeToAlerts(onData: (alerts: any[]) => void): () => void {
  const { db } = initFirebase();
  if (!db) return () => {};

  try {
    const q = query(collection(db, 'alerts'), orderBy('created_at', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        onData(items);
      },
      (err) => {
        console.warn('Firestore alerts snapshot error:', err);
      }
    );
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Save or acknowledge alert in Firestore
 */
export async function acknowledgeAlertInFirebase(alertId: string, note: string, acknowledgedBy: string) {
  const { db } = initFirebase();
  if (!db) return false;

  try {
    const ref = doc(db, 'alerts', alertId);
    await setDoc(
      ref,
      {
        acknowledged: true,
        acknowledged_by: acknowledgedBy,
        follow_up: note,
        acknowledged_at: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('Failed to acknowledge alert in Firebase:', err);
    return false;
  }
}

/**
 * Stream real-time telemetry tick to Firestore
 */
export async function streamTelemetryToFirebase(astronautId: number, measurement: any) {
  const { db } = initFirebase();
  if (!db) return null;

  try {
    const docRef = await addDoc(collection(db, 'telemetry'), {
      astronaut_id: astronautId,
      domain: measurement.domain || 'cardiovascular',
      metric: measurement.metric || 'Resting heart rate',
      value: measurement.value,
      unit: measurement.unit || 'bpm',
      timestamp: serverTimestamp(),
      source: 'Live telemetry downlink (Firebase)',
      simulated: false,
    });
    return docRef.id;
  } catch (err) {
    console.warn('Failed to stream telemetry to Firebase:', err);
    return null;
  }
}
