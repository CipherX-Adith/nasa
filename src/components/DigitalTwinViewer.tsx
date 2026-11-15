import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Heart,
  Wind,
  Brain,
  Activity,
  Shield,
  Plus,
  Minus,
  Maximize2,
  Play,
  Pause,
  Radiation,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Public API (drop-in compatible with the previous component)        */
/* ------------------------------------------------------------------ */

export type OrganKey = 'heart' | 'lungs' | 'brain' | 'muscles' | 'immune';
export type TwinStatus = 'nominal' | 'review' | 'priority' | 'recorded' | 'nodata';

export interface TwinVitals {
  heartRate?: number | null;
  hrv?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  coreTemp?: number | null;
  grip?: number | null;
  sleepHours?: number | null;
  fatigue?: number | null;
  cabinCo2?: number | null;
  radiation?: number | null;
  /** optional new signals (breaths/min, SpO2 %) – used when the backend provides them */
  respiration?: number | null;
  spo2?: number | null;
}

export interface DigitalTwinProps {
  selectedOrgan: OrganKey;
  onSelectOrgan: (organ: OrganKey) => void;
  astronautName?: string;
  vitals?: TwinVitals;
  /** Personal baselines (median of the astronaut's own history). Enables status colouring. */
  baselines?: TwinVitals;
  /** Explicit per-organ status from the backend; overrides the local baseline comparison. */
  organStatus?: Partial<Record<OrganKey, TwinStatus>>;
  missionDay?: number;
  /** Where the numbers come from – shown as a provenance chip. */
  dataSource?: 'simulated' | 'real' | 'mixed';
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

const ORGAN_ORDER: OrganKey[] = ['heart', 'lungs', 'brain', 'muscles', 'immune'];

const ORGAN_COLOR: Record<OrganKey, string> = {
  heart: '#ef4444',
  lungs: '#22d3ee',
  brain: '#a78bfa',
  muscles: '#34d399',
  immune: '#fbbf24',
};

const STATUS_LABEL: Record<TwinStatus, string> = {
  nominal: 'Within personal range',
  review: 'Review trend',
  priority: 'Priority review',
  recorded: 'Recorded',
  nodata: 'No data',
};

const STATUS_COLOR: Record<TwinStatus, string> = {
  nominal: '#34d399',
  review: '#fbbf24',
  priority: '#f87171',
  recorded: '#38bdf8',
  nodata: '#94a3b8',
};

/** Smoothly animates a number towards its target (requestAnimationFrame, ease-out). */
function useAnimatedNumber(target: number | null | undefined, duration = 700): number | null {
  const [shown, setShown] = useState<number | null>(num(target) ? target : null);
  const fromRef = useRef<number | null>(num(target) ? target : null);
  useEffect(() => {
    if (!num(target)) {
      setShown(null);
      fromRef.current = null;
      return;
    }
    const from = fromRef.current ?? target;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      fromRef.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return shown;
}

/** deterministic pseudo random – keeps particle layouts stable between renders */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const gauss = (t: number, c: number, w: number) => Math.exp(-Math.pow((t - c) / w, 2));

/** Builds a repeating waveform path: `periods` copies of g(t), each 100 units wide, height 60. */
function buildWave(g: (t: number) => number, periods = 6, step = 2): string {
  let d = '';
  for (let k = 0; k < periods; k++) {
    for (let x = 0; x <= 100; x += step) {
      const px = k * 100 + x;
      const y = clamp(g(x / 100), 2, 58);
      d += `${d === '' ? 'M' : 'L'}${px},${y.toFixed(2)} `;
    }
  }
  return d;
}

const WAVES: Record<OrganKey, string> = {
  heart: buildWave(
    (t) =>
      38 -
      (5 * gauss(t, 0.15, 0.035) -
        6 * gauss(t, 0.31, 0.012) +
        28 * gauss(t, 0.35, 0.014) -
        9 * gauss(t, 0.39, 0.014) +
        8 * gauss(t, 0.62, 0.05)),
    6,
    1,
  ),
  lungs: buildWave((t) => 30 - 17 * Math.sin(2 * Math.PI * t) * (0.85 + 0.15 * Math.sin(2 * Math.PI * t * 2))),
  brain: buildWave(
    (t) =>
      30 +
      8 * Math.sin(2 * Math.PI * 3 * t) +
      5 * Math.sin(2 * Math.PI * 7 * t + 1) +
      3 * Math.sin(2 * Math.PI * 13 * t + 2),
  ),
  muscles: buildWave((t) => {
    const win = gauss(t, 0.45, 0.2);
    return 30 - 20 * win * Math.sin(2 * Math.PI * 19 * t) * Math.cos(2 * Math.PI * 5 * t);
  }),
  immune: buildWave(
    (t) => 44 - 30 * gauss(t, 0.2, 0.012) - 20 * gauss(t, 0.55, 0.012) - 36 * gauss(t, 0.82, 0.012),
    6,
    1,
  ),
};

type Organ = {
  title: string;
  short: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  metricLabel: string;
  description: string;
};

const ORGANS: Record<OrganKey, Organ> = {
  heart: {
    title: 'Cardiovascular System',
    short: 'Cardio',
    Icon: Heart,
    metricLabel: 'Resting heart rate',
    description:
      'Review the recorded heart-rate trend against this crew member’s personal history and the mission medical protocol. Animation rate follows the latest recorded heart rate.',
  },
  lungs: {
    title: 'Pulmonary & Respiratory',
    short: 'Pulmonary',
    Icon: Wind,
    metricLabel: 'Cabin CO₂',
    description:
      'Cabin CO₂ is an environmental measurement. Confirm its source and units before interpreting it. Breathing animation uses the recorded respiration rate when available, otherwise an ambient rate.',
  },
  brain: {
    title: 'Neurocognitive & Sleep',
    short: 'Neuro',
    Icon: Brain,
    metricLabel: 'Sleep · Fatigue',
    description:
      'Review sleep and fatigue check-ins over time with the astronaut’s reported context and mission routine. Neural activity slows visually as reported fatigue rises.',
  },
  muscles: {
    title: 'Musculoskeletal & Grip',
    short: 'Muscle',
    Icon: Activity,
    metricLabel: 'Grip strength',
    description:
      'Review repeated strength measurements against personal history and the crew’s prescribed exercise plan. Fibre glow scales with grip relative to the personal baseline when one is available.',
  },
  immune: {
    title: 'Immune, Thermal & Radiation Context',
    short: 'Immune',
    Icon: Shield,
    metricLabel: 'Core temperature',
    description:
      'Review recorded temperature, measurement conditions and symptoms under the mission medical protocol. Radiation is an environmental measure shown as particles; it is not an immune-system reading.',
  },
};

/** Percent / absolute deviation → status. Illustrative thresholds only. */
function computeStatus(organ: OrganKey, v: TwinVitals, b: TwinVitals): TwinStatus {
  const pct = (cur: number | null | undefined, base: number | null | undefined) =>
    num(cur) && num(base) && base !== 0 ? Math.abs(cur - base) / Math.abs(base) : null;
  const grade = (d: number | null, r: number, p: number): TwinStatus =>
    d == null ? 'recorded' : d >= p ? 'priority' : d >= r ? 'review' : 'nominal';

  switch (organ) {
    case 'heart': {
      if (!num(v.heartRate)) return 'nodata';
      return grade(pct(v.heartRate, b.heartRate), 0.1, 0.2);
    }
    case 'lungs': {
      if (!num(v.cabinCo2) && !num(v.spo2) && !num(v.respiration)) return 'nodata';
      if (num(v.spo2) && v.spo2 < 92) return 'priority';
      return grade(pct(v.cabinCo2, b.cabinCo2), 0.2, 0.4);
    }
    case 'brain': {
      if (!num(v.sleepHours) && !num(v.fatigue)) return 'nodata';
      const sleepDrop = num(v.sleepHours) && num(b.sleepHours) ? (b.sleepHours - v.sleepHours) / b.sleepHours : null;
      const fatigueRise = num(v.fatigue) && num(b.fatigue) ? (v.fatigue - b.fatigue) / 10 : null;
      const worst = Math.max(sleepDrop ?? -1, fatigueRise ?? -1);
      return worst < 0 && sleepDrop == null && fatigueRise == null ? 'recorded' : grade(Math.max(worst, 0), 0.15, 0.3);
    }
    case 'muscles': {
      if (!num(v.grip)) return 'nodata';
      const drop = num(b.grip) && b.grip > 0 ? Math.max(0, (b.grip - v.grip) / b.grip) : null;
      return grade(drop, 0.1, 0.2);
    }
    case 'immune': {
      if (!num(v.coreTemp)) return 'nodata';
      if (!num(b.coreTemp)) return 'recorded';
      const d = Math.abs(v.coreTemp - b.coreTemp);
      return d >= 1 ? 'priority' : d >= 0.5 ? 'review' : 'nominal';
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Styles (self-contained, prefix otw-)                               */
/* ------------------------------------------------------------------ */

const CSS = `
.otw-card{--otw-bg:#ffffff;--otw-fg:#0f172a;--otw-muted:#64748b;--otw-line:rgba(15,23,42,.12);--otw-chip:rgba(15,23,42,.05);
  background:var(--otw-bg);color:var(--otw-fg);border:1px solid var(--otw-line);border-radius:22px;padding:20px;
  box-shadow:0 18px 50px -24px rgba(2,12,40,.35);font-family:inherit;overflow:hidden}
[data-theme="dark"] .otw-card{--otw-bg:#0b1220;--otw-fg:#e6edf7;--otw-muted:#94a3b8;--otw-line:rgba(148,163,184,.18);--otw-chip:rgba(148,163,184,.1);
  box-shadow:0 18px 60px -24px rgba(0,0,0,.8)}
.otw-head{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
.otw-title{margin:0;font-size:1.15rem;font-weight:700;letter-spacing:.01em}
.otw-sub{margin:4px 0 0;color:var(--otw-muted);font-size:.8rem;max-width:560px;line-height:1.45}
.otw-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.otw-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:var(--otw-chip);
  font-size:.7rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--otw-fg);border:1px solid var(--otw-line)}
.otw-chip i{width:7px;height:7px;border-radius:50%;display:inline-block;background:currentColor;animation:otw-blink 1.8s ease-in-out infinite}
.otw-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--otw-line);background:var(--otw-chip);
  color:var(--otw-fg);border-radius:10px;padding:6px 10px;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .2s}
.otw-btn:hover{transform:translateY(-1px);border-color:rgba(56,189,248,.6)}
.otw-btn[aria-pressed="true"]{background:rgba(56,189,248,.16);border-color:rgba(56,189,248,.7);color:#38bdf8}
.otw-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:18px;margin-top:16px}
@media(max-width:900px){.otw-layout{grid-template-columns:1fr}}

/* ---------- stage ---------- */
.otw-viewport{position:relative;border-radius:18px;overflow:hidden;min-height:580px;
  background:radial-gradient(120% 90% at 50% 8%,#10294d 0%,#07122a 48%,#030712 100%);border:1px solid rgba(56,189,248,.25);
  touch-action:none;cursor:grab;perspective:1100px;user-select:none}
.otw-viewport.otw-dragging{cursor:grabbing}
.otw-stars{position:absolute;inset:0;pointer-events:none}
.otw-star{position:absolute;border-radius:50%;background:#fff;animation:otw-twinkle var(--d,4s) ease-in-out infinite;animation-delay:var(--l,0s)}
.otw-orbit{position:absolute;left:50%;top:52%;border:1px dashed rgba(56,189,248,.22);border-radius:50%;pointer-events:none;
  transform:translate(-50%,-50%) rotateX(72deg);animation:otw-orbit var(--s,26s) linear infinite}
.otw-orbit::after{content:"";position:absolute;top:-4px;left:50%;width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 12px 3px rgba(56,189,248,.8)}
.otw-floor{position:absolute;left:-10%;right:-10%;bottom:-8%;height:38%;pointer-events:none;opacity:.55;
  background:
   linear-gradient(rgba(56,189,248,.35) 1px,transparent 1px) 0 0/100% 34px,
   linear-gradient(90deg,rgba(56,189,248,.35) 1px,transparent 1px) 0 0/48px 100%;
  transform:perspective(380px) rotateX(64deg);transform-origin:50% 100%;
  -webkit-mask-image:linear-gradient(to top,#000 10%,transparent 92%);mask-image:linear-gradient(to top,#000 10%,transparent 92%);
  animation:otw-floor 3.2s linear infinite}
.otw-tilt{position:absolute;inset:0;display:grid;place-items:center;transform-style:preserve-3d;
  transform:rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg));transition:transform .25s ease-out}
.otw-sway{width:100%;height:100%;display:grid;place-items:center;transform-style:preserve-3d;animation:otw-sway 11s ease-in-out infinite alternate}
.otw-paused .otw-sway{animation-play-state:paused}
.otw-pan{width:100%;height:100%;display:flex;align-items:center;justify-content:center;transform-origin:50% 50%}
.otw-svg{height:540px;width:auto;max-width:100%;overflow:visible;filter:drop-shadow(0 0 22px rgba(56,189,248,.28))}
.otw-hud{position:absolute;pointer-events:none;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(125,211,252,.85);font-weight:600}
.otw-hud b{color:#fff;font-weight:700}
.otw-hud.tl{top:12px;left:14px}.otw-hud.tr{top:12px;right:14px;text-align:right}
.otw-hud.bl{bottom:12px;left:14px}.otw-hud.br{bottom:12px;right:14px;text-align:right}
.otw-controls{position:absolute;left:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;z-index:3}
.otw-ctl{width:32px;height:32px;border-radius:10px;border:1px solid rgba(125,211,252,.35);background:rgba(8,20,45,.72);color:#bae6fd;
  display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(6px);transition:all .2s}
.otw-ctl:hover{background:rgba(56,189,248,.25);color:#fff;transform:scale(1.07)}

/* ---------- svg animations ---------- */
.otw-heart-beat{transform-box:fill-box;transform-origin:center;animation:otw-lubdub var(--hb,.8s) ease-in-out infinite}
.otw-heart-ring{transform-box:fill-box;transform-origin:center;animation:otw-ring var(--hb,.8s) ease-out infinite}
.otw-lung-l{transform-box:fill-box;transform-origin:100% 50%;animation:otw-breathe var(--br,4.2s) ease-in-out infinite}
.otw-lung-r{transform-box:fill-box;transform-origin:0% 50%;animation:otw-breathe var(--br,4.2s) ease-in-out infinite}
.otw-airflow{stroke-dasharray:3 7;animation:otw-flow var(--br,4.2s) linear infinite}
.otw-brain-glow{transform-box:fill-box;transform-origin:center;animation:otw-brain var(--nr,2.6s) ease-in-out infinite}
.otw-fibre{stroke-dasharray:6 5;animation:otw-flow var(--mf,2.4s) linear infinite}
.otw-aura{transform-box:fill-box;transform-origin:center;animation:otw-aura 3.6s ease-in-out infinite}
.otw-scan{animation:otw-scan 5.5s ease-in-out infinite}
.otw-pin-ring{transform-box:fill-box;transform-origin:center;animation:otw-pin 2.2s ease-out infinite}
.otw-rad{animation:otw-rad var(--rd,3s) linear infinite;animation-delay:var(--rl,0s);opacity:0}
.otw-leader{stroke-dasharray:180;stroke-dashoffset:180;animation:otw-draw .9s ease forwards}
.otw-vessel{stroke-dasharray:2 6;animation:otw-flow var(--hb3,2.4s) linear infinite}
.otw-paused *{animation-play-state:paused !important}
@keyframes otw-lubdub{0%{transform:scale(1)}10%{transform:scale(1.13)}20%{transform:scale(.99)}32%{transform:scale(1.08)}48%,100%{transform:scale(1)}}
@keyframes otw-ring{0%{transform:scale(.7);opacity:.75}70%{opacity:0}100%{transform:scale(2.3);opacity:0}}
@keyframes otw-breathe{0%,100%{transform:scale(.95,.97)}50%{transform:scale(1.08,1.04)}}
@keyframes otw-flow{to{stroke-dashoffset:-44}}
@keyframes otw-brain{0%,100%{opacity:.55;transform:scale(.97)}50%{opacity:1;transform:scale(1.06)}}
@keyframes otw-aura{0%,100%{opacity:.35;transform:scale(.97)}50%{opacity:.65;transform:scale(1.04)}}
@keyframes otw-scan{0%{transform:translateY(24px);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(580px);opacity:0}}
@keyframes otw-pin{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}
@keyframes otw-rad{0%{transform:translate(0,0);opacity:0}10%{opacity:.95}85%{opacity:.8}100%{transform:translate(var(--rx,90px),var(--ry,130px));opacity:0}}
@keyframes otw-draw{to{stroke-dashoffset:0}}
@keyframes otw-twinkle{0%,100%{opacity:.15}50%{opacity:.9}}
@keyframes otw-orbit{from{transform:translate(-50%,-50%) rotateX(72deg) rotateZ(0deg)}to{transform:translate(-50%,-50%) rotateX(72deg) rotateZ(360deg)}}
@keyframes otw-floor{from{background-position:0 0,0 0}to{background-position:0 34px,0 0}}
@keyframes otw-sway{from{transform:rotateY(-9deg)}to{transform:rotateY(9deg)}}
@keyframes otw-blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes otw-wave{to{transform:translateX(-100px)}}
@media (prefers-reduced-motion:reduce){.otw-card *{animation-duration:.001ms !important;animation-iteration-count:1 !important}}

/* ---------- side panel ---------- */
.otw-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.otw-banner{border:1px solid var(--otw-line);border-left-width:4px;border-radius:16px;padding:14px 16px;background:var(--otw-chip)}
.otw-banner-top{display:flex;align-items:center;gap:12px}
.otw-ico{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:none}
.otw-banner h4{margin:0;font-size:1rem}
.otw-banner small{color:var(--otw-muted);display:block;margin-top:2px}
.otw-status{margin-left:auto;font-size:.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:5px 10px;border-radius:999px;white-space:nowrap}
.otw-desc{margin:10px 0 0;font-size:.82rem;line-height:1.5;color:var(--otw-muted)}
.otw-wave{height:84px;border-radius:14px;overflow:hidden;position:relative;background:#050b1a;border:1px solid rgba(56,189,248,.22)}
.otw-wave svg{position:absolute;inset:0;width:100%;height:100%}
.otw-wave-label{position:absolute;left:10px;top:6px;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(186,230,253,.8);z-index:2;font-weight:600}
.otw-wave-grid{background-color:#050b1a;background-image:
  linear-gradient(rgba(56,189,248,.12) 1px,transparent 1px),
  linear-gradient(90deg,rgba(56,189,248,.12) 1px,transparent 1px);background-size:100% 14px,20px 100%}
.otw-wave-run{animation:otw-wave var(--wp,.8s) linear infinite}
.otw-readouts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.otw-readout{border:1px solid var(--otw-line);background:var(--otw-chip);border-radius:14px;padding:10px 12px;min-width:0}
.otw-readout span{display:block;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--otw-muted);font-weight:600}
.otw-readout strong{display:block;font-size:1.25rem;margin-top:2px;font-variant-numeric:tabular-nums}
.otw-readout em{font-style:normal;font-size:.7rem;color:var(--otw-muted);font-weight:500;margin-left:4px}
.otw-readout small{display:block;font-size:.68rem;color:var(--otw-muted);margin-top:2px}
.otw-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.otw-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid var(--otw-line);background:var(--otw-chip);
  color:var(--otw-fg);font-size:.76rem;font-weight:600;cursor:pointer;transition:all .2s}
.otw-pill:hover{transform:translateY(-1px)}
.otw-note{margin:12px 0 0;font-size:.7rem;color:var(--otw-muted);line-height:1.45}
.otw-layers{display:flex;gap:6px;flex-wrap:wrap}
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type Layer = 'skin' | 'skeleton' | 'vessels' | 'nerves' | 'radiation';

export const DigitalTwinViewer: React.FC<DigitalTwinProps> = ({
  selectedOrgan,
  onSelectOrgan,
  astronautName = 'Crew member',
  vitals = {},
  baselines = {},
  organStatus,
  missionDay,
  dataSource = 'simulated',
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const prefersReduced = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const [playing, setPlaying] = useState(!prefersReduced);
  const [hovered, setHovered] = useState<OrganKey | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    skin: true,
    skeleton: true,
    vessels: true,
    nerves: true,
    radiation: true,
  });
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof svg.pauseAnimations !== 'function') return;
    if (playing) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [playing]);

  /* ----- derived physiology-driven animation parameters ----- */
  const hr = num(vitals.heartRate) ? clamp(vitals.heartRate, 35, 190) : 72;
  const hrReal = num(vitals.heartRate);
  const beat = 60 / hr; // seconds per heartbeat
  const resp = num(vitals.respiration) ? clamp(vitals.respiration, 6, 40) : 14.5;
  const breath = 60 / resp;
  const fatigue = num(vitals.fatigue) ? clamp(vitals.fatigue, 0, 10) : 3;
  const neuralPeriod = 2.2 + fatigue * 0.28;
  const gripRatio =
    num(vitals.grip) && num(baselines.grip) && baselines.grip > 0 ? clamp(vitals.grip / baselines.grip, 0.4, 1.15) : 0.9;
  const radiationRate = num(vitals.radiation) ? clamp(vitals.radiation, 0, 3) : 0.4;
  const radiationCount = Math.round(clamp(6 + radiationRate * 18, 6, 30));
  const temp = num(vitals.coreTemp) ? vitals.coreTemp : 36.8;
  const heat = clamp((temp - 36.5) / 1.5, 0, 1); // 0 = cool teal, 1 = hot red
  const auraColor = heat < 0.35 ? '#2dd4bf' : heat < 0.7 ? '#fbbf24' : '#f87171';

  const statuses = useMemo(() => {
    const out = {} as Record<OrganKey, TwinStatus>;
    for (const k of ORGAN_ORDER) out[k] = organStatus?.[k] ?? computeStatus(k, vitals, baselines);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(vitals), JSON.stringify(baselines), JSON.stringify(organStatus)]);

  /* ----- animated readout numbers ----- */
  const aHr = useAnimatedNumber(vitals.heartRate);
  const aHrv = useAnimatedNumber(vitals.hrv);
  const aSys = useAnimatedNumber(vitals.systolicBp);
  const aDia = useAnimatedNumber(vitals.diastolicBp);
  const aCo2 = useAnimatedNumber(vitals.cabinCo2);
  const aResp = useAnimatedNumber(vitals.respiration);
  const aSpo2 = useAnimatedNumber(vitals.spo2);
  const aSleep = useAnimatedNumber(vitals.sleepHours);
  const aFatigue = useAnimatedNumber(vitals.fatigue);
  const aGrip = useAnimatedNumber(vitals.grip);
  const aTemp = useAnimatedNumber(vitals.coreTemp);
  const aRad = useAnimatedNumber(vitals.radiation);

  const f = (v: number | null, d = 1) => (v == null ? '—' : v.toFixed(d));

  const readouts: Record<OrganKey, { label: string; value: string; unit: string; hint?: string }[]> = {
    heart: [
      { label: 'Heart rate', value: f(aHr), unit: 'bpm', hint: baselines.heartRate != null ? `baseline ${f(baselines.heartRate ?? null)}` : undefined },
      { label: 'HRV', value: f(aHrv, 0), unit: 'ms' },
      { label: 'Blood pressure', value: aSys == null ? '—' : `${aSys.toFixed(0)}/${aDia == null ? '—' : aDia.toFixed(0)}`, unit: 'mmHg' },
      { label: 'Beat period', value: hrReal ? beat.toFixed(2) : '—', unit: 's' },
    ],
    lungs: [
      { label: 'Cabin CO₂', value: f(aCo2, 2), unit: 'mmHg', hint: 'environmental' },
      { label: 'Respiration', value: f(aResp, 0), unit: '/min', hint: num(vitals.respiration) ? undefined : 'ambient animation' },
      { label: 'SpO₂', value: f(aSpo2, 0), unit: '%' },
      { label: 'Breath period', value: breath.toFixed(1), unit: 's' },
    ],
    brain: [
      { label: 'Sleep', value: f(aSleep), unit: 'h' },
      { label: 'Fatigue', value: f(aFatigue, 0), unit: '/10' },
      { label: 'Neural rhythm', value: neuralPeriod.toFixed(1), unit: 's', hint: 'visual only' },
      { label: 'Baseline sleep', value: f(baselines.sleepHours ?? null), unit: 'h' },
    ],
    muscles: [
      { label: 'Grip', value: f(aGrip), unit: 'kg' },
      { label: 'Baseline grip', value: f(baselines.grip ?? null), unit: 'kg' },
      { label: 'Vs baseline', value: num(vitals.grip) && num(baselines.grip) && baselines.grip > 0 ? `${(((vitals.grip - baselines.grip) / baselines.grip) * 100).toFixed(0)}` : '—', unit: '%' },
      { label: 'Fibre glow', value: (gripRatio * 100).toFixed(0), unit: '%', hint: 'visual only' },
    ],
    immune: [
      { label: 'Core temp', value: f(aTemp, 1), unit: '°C' },
      { label: 'Radiation', value: f(aRad, 2), unit: 'mSv/day', hint: 'environmental' },
      { label: 'Particles shown', value: String(radiationCount), unit: '', hint: 'scaled to dose' },
      { label: 'Baseline temp', value: f(baselines.coreTemp ?? null, 1), unit: '°C' },
    ],
  };

  const wavePeriod: Record<OrganKey, number> = {
    heart: beat,
    lungs: breath,
    brain: neuralPeriod * 0.6,
    muscles: 2.2,
    immune: clamp(4 - radiationRate * 2, 1.2, 4),
  };

  const active = ORGANS[selectedOrgan];
  const activeStatus = statuses[selectedOrgan];
  const activeColor = ORGAN_COLOR[selectedOrgan];
  const ActiveIcon = active.Icon;

  /* ----- stable decorative particles ----- */
  const stars = useMemo(() => {
    const r = seeded(7);
    return Array.from({ length: 46 }, () => ({
      x: r() * 100,
      y: r() * 100,
      s: 1 + r() * 2,
      d: 2.5 + r() * 4,
      l: -r() * 5,
    }));
  }, []);

  const radParticles = useMemo(() => {
    const r = seeded(21);
    return Array.from({ length: 30 }, () => ({
      x: 40 + r() * 300,
      y: -10 + r() * 150,
      d: 1.6 + r() * 2.4,
      l: -r() * 4,
      len: 10 + r() * 14,
    }));
  }, []);

  /* ----- interaction ----- */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current;
    if (!el) return;
    if (drag.current && zoom > 1) {
      setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
      return;
    }
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--ty', `${(nx * 16).toFixed(2)}deg`);
    el.style.setProperty('--tx', `${(-ny * 10).toFixed(2)}deg`);
  };
  const onPointerLeave = () => {
    viewportRef.current?.style.setProperty('--ty', '0deg');
    viewportRef.current?.style.setProperty('--tx', '0deg');
    drag.current = null;
    setDragging(false);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return; // never hijack normal page scrolling
    e.preventDefault();
    setZoom((z) => clamp(z - e.deltaY * 0.002, 0.85, 2.2));
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const toggleLayer = (l: Layer) => setLayers((s) => ({ ...s, [l]: !s[l] }));

  const organOpacity = (k: OrganKey, base = 0.5) => (selectedOrgan === k || hovered === k ? 1 : base);
  const hit = (k: OrganKey) => ({
    onClick: () => onSelectOrgan(k),
    onMouseEnter: () => setHovered(k),
    onMouseLeave: () => setHovered(null),
    style: { cursor: 'pointer' } as React.CSSProperties,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `${ORGANS[k].title} – ${STATUS_LABEL[statuses[k]]}`,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectOrgan(k);
      }
    },
  });

  const pins: Record<OrganKey, { x: number; y: number }> = {
    heart: { x: 198, y: 206 },
    lungs: { x: 152, y: 212 },
    brain: { x: 190, y: 68 },
    muscles: { x: 98, y: 215 },
    immune: { x: 188, y: 268 },
  };
  const leaders: Record<OrganKey, string> = {
    heart: 'M198,206 L300,170 L352,170',
    lungs: 'M152,212 L90,196 L30,196',
    brain: 'M190,68 L300,52 L352,52',
    muscles: 'M98,215 L70,250 L30,250',
    immune: 'M188,268 L300,290 L352,290',
  };

  const bodyPath =
    'M 190,32 C 172,32 160,45 160,65 C 160,82 170,95 178,102 C 174,106 172,112 172,118 C 152,122 134,132 120,146 C 108,160 102,185 96,215 C 90,245 84,285 78,320 C 74,338 68,360 74,368 C 80,374 88,360 92,342 C 98,310 104,275 110,245 C 114,228 118,210 126,200 C 128,225 130,255 132,285 C 134,315 138,335 142,350 C 144,358 142,370 142,390 C 142,425 146,465 150,510 C 152,535 152,565 150,585 C 148,594 158,598 166,598 C 176,598 178,588 178,575 C 178,550 178,515 176,475 C 176,445 176,415 178,390 L 186,370 L 190,366 L 194,370 L 202,390 C 204,415 204,445 204,475 C 202,515 202,550 202,575 C 202,588 204,598 214,598 C 222,598 232,594 230,585 C 228,565 228,535 230,510 C 234,465 238,425 238,390 C 238,370 236,358 238,350 C 242,335 246,315 248,285 C 250,255 252,225 254,200 C 262,210 266,228 270,245 C 276,275 282,310 288,342 C 292,360 300,374 306,368 C 312,360 306,338 302,320 C 296,285 290,245 284,215 C 278,185 272,160 260,146 C 246,132 228,122 208,118 C 208,112 206,106 202,102 C 210,95 220,82 220,65 C 220,45 208,32 190,32 Z';

  const arteryPaths = [
    'M195,215 C190,190 186,172 190,160 C194,150 198,135 198,115',
    'M192,222 L190,330 C190,350 178,390 170,440 L165,540',
    'M190,330 C190,350 202,390 210,440 L215,540',
    'M205,214 C232,226 250,236 262,258 C272,284 280,300 288,330',
  ];
  const nervePaths = [
    'M190,72 C189,100 191,130 190,160 L190,350',
    'M182,125 C160,135 140,152 120,178 C105,198 94,240 84,295',
    'M198,125 C220,135 240,152 260,178 C275,198 286,240 296,295',
    'M188,350 C182,400 174,450 166,540',
    'M192,350 C198,400 206,450 214,540',
  ];

  const dur = (n: number) => `${Math.max(0.4, n).toFixed(2)}s`;
  const css = (vars: Record<string, string>) => vars as unknown as React.CSSProperties;

  const provenance =
    dataSource === 'real'
      ? { label: 'Real NASA data', color: '#34d399' }
      : dataSource === 'mixed'
        ? { label: 'Real + simulated', color: '#fbbf24' }
        : { label: 'Simulated data', color: '#38bdf8' };

  return (
    <div className={`otw-card ${playing ? '' : 'otw-paused'}`}>
      <style>{CSS}</style>

      <div className="otw-head">
        <div>
          <h3 className="otw-title">Digital Twin · {astronautName}</h3>
          <p className="otw-sub">
            Live visualization of recorded measurements and self-reports. Motion rates follow recorded values where they exist; it does not
            simulate or predict organ function.
          </p>
        </div>
        <div className="otw-chips">
          <span className="otw-chip" style={{ color: provenance.color }}>
            <i /> {provenance.label}
          </span>
          {missionDay != null && <span className="otw-chip">Mission day {missionDay}</span>}
          <button type="button" className="otw-btn" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>

      <div className="otw-layout">
        {/* =============== STAGE =============== */}
        <div>
          <div
            ref={viewportRef}
            className={`otw-viewport ${dragging ? 'otw-dragging' : ''}`}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
          >
            <div className="otw-stars" aria-hidden="true">
              {stars.map((s, i) => (
                <span key={i} className="otw-star" style={css({ left: `${s.x}%`, top: `${s.y}%`, width: `${s.s}px`, height: `${s.s}px`, '--d': `${s.d}s`, '--l': `${s.l}s` })} />
              ))}
            </div>
            <div className="otw-orbit" style={css({ width: '88%', height: '88%', '--s': '30s' })} aria-hidden="true" />
            <div className="otw-orbit" style={css({ width: '64%', height: '64%', '--s': '19s', animationDirection: 'reverse' })} aria-hidden="true" />
            <div className="otw-floor" aria-hidden="true" />

            <div className="otw-tilt">
              <div className="otw-sway">
                <div className="otw-pan" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transition: dragging ? 'none' : 'transform .35s cubic-bezier(.16,1,.3,1)' }}>
                  <svg
                    ref={svgRef}
                    viewBox="0 0 380 620"
                    className="otw-svg"
                    role="img"
                    aria-label={`Animated digital twin of ${astronautName}`}
                    style={css({
                      '--hb': dur(beat),
                      '--hb3': dur(beat * 3),
                      '--br': dur(breath),
                      '--nr': dur(neuralPeriod),
                      '--mf': dur(3.4 - gripRatio * 2),
                    })}
                  >
                    <defs>
                      <clipPath id={`${uid}-body`}>
                        <path d={bodyPath} />
                      </clipPath>
                      <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#7dd3fc" stopOpacity=".30" />
                        <stop offset=".55" stopColor="#38bdf8" stopOpacity=".14" />
                        <stop offset="1" stopColor="#0ea5e9" stopOpacity=".20" />
                      </linearGradient>
                      <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#e0f2fe" />
                        <stop offset=".5" stopColor="#38bdf8" />
                        <stop offset="1" stopColor="#14b8a6" />
                      </linearGradient>
                      <linearGradient id={`${uid}-scan`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#38bdf8" stopOpacity="0" />
                        <stop offset=".85" stopColor="#7dd3fc" stopOpacity=".28" />
                        <stop offset="1" stopColor="#e0f2fe" stopOpacity=".6" />
                      </linearGradient>
                      <radialGradient id={`${uid}-aura`}>
                        <stop offset="0" stopColor={auraColor} stopOpacity=".55" />
                        <stop offset="1" stopColor={auraColor} stopOpacity="0" />
                      </radialGradient>
                      {ORGAN_ORDER.map((k) => (
                        <radialGradient id={`${uid}-g-${k}`} key={k}>
                          <stop offset="0" stopColor={ORGAN_COLOR[k]} stopOpacity=".95" />
                          <stop offset=".6" stopColor={ORGAN_COLOR[k]} stopOpacity=".35" />
                          <stop offset="1" stopColor={ORGAN_COLOR[k]} stopOpacity="0" />
                        </radialGradient>
                      ))}
                      <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="5" result="b" />
                        <feMerge>
                          <feMergeNode in="b" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* thermal aura (colour follows recorded core temperature) */}
                    <ellipse className="otw-aura" cx="190" cy="250" rx="120" ry="210" fill={`url(#${uid}-aura)`} />

                    {/* body shell */}
                    {layers.skin && (
                      <g>
                        <path d={bodyPath} fill={`url(#${uid}-skin)`} stroke={`url(#${uid}-edge)`} strokeWidth="1.6" />
                        <g clipPath={`url(#${uid}-body)`} opacity=".5" stroke="#7dd3fc" strokeWidth=".5" fill="none">
                          {Array.from({ length: 16 }, (_, i) => (
                            <line key={i} x1="60" x2="320" y1={40 + i * 36} y2={40 + i * 36} strokeDasharray="2 5" />
                          ))}
                        </g>
                      </g>
                    )}

                    {/* skeleton */}
                    {layers.skeleton && (
                      <g fill="none" stroke="rgba(224,242,254,.7)" strokeLinecap="round" opacity=".85">
                        <path d="M186,142 C166,137 142,143 126,152 M194,142 C214,137 238,143 254,152" strokeWidth="2" />
                        <path d="M186,144 L194,144 L193,228 L187,228 Z" fill="rgba(224,242,254,.18)" strokeWidth="1" />
                        <line x1="190" y1="108" x2="190" y2="350" strokeWidth="2.4" />
                        {Array.from({ length: 12 }, (_, i) => {
                          const y = 160 + i * 9;
                          const w = 46 - Math.abs(i - 3) * 2.4;
                          return (
                            <g key={i} strokeWidth="1.1">
                              <path d={`M187,${y} C${187 - w},${y - 6} ${187 - w - 6},${y + 14} 190,${y + 22}`} />
                              <path d={`M193,${y} C${193 + w},${y - 6} ${193 + w + 6},${y + 14} 190,${y + 22}`} />
                            </g>
                          );
                        }).slice(0, 10)}
                        <path d="M154,335 C138,345 140,370 156,380 C172,388 186,376 188,364 M226,335 C242,345 240,370 224,380 C208,388 194,376 192,364" strokeWidth="1.8" />
                        <g strokeWidth="2">
                          <line x1="116" y1="168" x2="96" y2="248" />
                          <line x1="94" y1="256" x2="78" y2="335" />
                          <line x1="264" y1="168" x2="284" y2="248" />
                          <line x1="286" y1="256" x2="302" y2="335" />
                          <line x1="172" y1="388" x2="166" y2="485" strokeWidth="3" />
                          <line x1="166" y1="500" x2="164" y2="575" />
                          <line x1="208" y1="388" x2="214" y2="485" strokeWidth="3" />
                          <line x1="214" y1="500" x2="216" y2="575" />
                        </g>
                      </g>
                    )}

                    {/* muscle fibres (flow speed/glow follow grip vs baseline) */}
                    <g
                      onClick={() => onSelectOrgan('muscles')}
                      onMouseEnter={() => setHovered('muscles')}
                      onMouseLeave={() => setHovered(null)}
                      style={{ cursor: 'pointer' }}
                      fill="none"
                      stroke={ORGAN_COLOR.muscles}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      opacity={organOpacity('muscles', 0.28 + gripRatio * 0.3)}
                      filter={selectedOrgan === 'muscles' ? `url(#${uid}-glow)` : undefined}
                    >
                      {[0, 1, 2].map((i) => (
                        <React.Fragment key={i}>
                          <path className="otw-fibre" d={`M${122 - i * 3},${172 + i * 3} C${108 - i * 4},${200} ${100 - i * 3},${225} ${99 - i * 2},${248}`} />
                          <path className="otw-fibre" d={`M${258 + i * 3},${172 + i * 3} C${272 + i * 4},${200} ${280 + i * 3},${225} ${281 + i * 2},${248}`} />
                          <path className="otw-fibre" d={`M${172 - i * 3},${395} C${164 - i * 3},${430} ${160 - i * 2},${460} ${162 - i},${486}`} />
                          <path className="otw-fibre" d={`M${208 + i * 3},${395} C${216 + i * 3},${430} ${220 + i * 2},${460} ${218 + i},${486}`} />
                        </React.Fragment>
                      ))}
                    </g>

                    {/* nerves + neural sparks */}
                    {layers.nerves && (
                      <g>
                        <g fill="none" stroke="rgba(251,191,36,.5)" strokeWidth="1">
                          {nervePaths.map((d) => (
                            <path key={d} d={d} />
                          ))}
                        </g>
                        {nervePaths.map((d, i) => (
                          <circle key={`spark-${i}`} r="2.2" fill="#fde68a" filter={`url(#${uid}-glow)`}>
                            <animateMotion dur={dur(neuralPeriod * (1.1 + i * 0.25))} repeatCount="indefinite" begin={`-${(i * 0.7).toFixed(1)}s`} path={d} />
                          </circle>
                        ))}
                      </g>
                    )}

                    {/* vessels + blood cells (speed follows heart rate) */}
                    {layers.vessels && (
                      <g>
                        <g fill="none" strokeWidth="2" opacity=".75">
                          {arteryPaths.map((d, i) => (
                            <path key={d} d={d} stroke={i === 3 ? '#38bdf8' : '#ef4444'} className="otw-vessel" />
                          ))}
                        </g>
                        {arteryPaths.map((d, i) =>
                          [0, 1, 2].map((j) => (
                            <circle key={`rbc-${i}-${j}`} r="2.4" fill={i === 3 ? '#7dd3fc' : '#fb7185'}>
                              <animateMotion dur={dur(beat * (3.2 + i * 0.6))} repeatCount="indefinite" begin={`-${((beat * (3.2 + i * 0.6) * j) / 3).toFixed(2)}s`} path={d} />
                            </circle>
                          )),
                        )}
                      </g>
                    )}

                    {/* brain */}
                    <g {...hit('brain')}>
                      <ellipse className="otw-brain-glow" cx="190" cy="68" rx="30" ry="34" fill={`url(#${uid}-g-brain)`} opacity={organOpacity('brain', 0.7)} />
                      <path
                        d="M172,66 C172,52 184,46 190,50 C196,46 208,52 208,66 C210,78 202,88 190,88 C178,88 170,78 172,66 Z"
                        fill="rgba(167,139,250,.28)"
                        stroke="#c4b5fd"
                        strokeWidth="1.2"
                        filter={selectedOrgan === 'brain' ? `url(#${uid}-glow)` : undefined}
                      />
                      <path d="M190,50 L190,88 M178,60 Q184,66 178,74 M202,60 Q196,66 202,74 M182,54 Q190,60 198,54" fill="none" stroke="#ddd6fe" strokeWidth=".9" opacity=".85" />
                    </g>

                    {/* lungs */}
                    <g {...hit('lungs')}>
                      <g className="otw-lung-l" opacity={organOpacity('lungs', 0.62)}>
                        <path d="M176,168 C158,174 146,196 148,228 C150,250 168,258 178,248 Z" fill={`url(#${uid}-g-lungs)`} stroke="#67e8f9" strokeWidth="1" />
                      </g>
                      <g className="otw-lung-r" opacity={organOpacity('lungs', 0.62)}>
                        <path d="M204,168 C222,174 234,196 232,228 C230,250 212,258 202,248 Z" fill={`url(#${uid}-g-lungs)`} stroke="#67e8f9" strokeWidth="1" />
                      </g>
                      <path className="otw-airflow" d="M190,112 L190,160 M190,160 L176,184 M190,160 L204,184 M176,184 L164,214 M204,184 L216,214" fill="none" stroke="#a5f3fc" strokeWidth="1.4" strokeLinecap="round" />
                    </g>

                    {/* immune / metabolic core */}
                    <g {...hit('immune')}>
                      <path
                        d="M160,250 C175,245 205,250 215,260 C218,275 185,285 165,278 Z"
                        fill={`url(#${uid}-g-immune)`}
                        stroke="#fcd34d"
                        strokeWidth="1"
                        opacity={organOpacity('immune', 0.7)}
                        filter={selectedOrgan === 'immune' ? `url(#${uid}-glow)` : undefined}
                      />
                    </g>

                    {/* heart */}
                    <g {...hit('heart')}>
                      <circle className="otw-heart-ring" cx="198" cy="206" r="14" fill="none" stroke="#ef4444" strokeWidth="1.6" />
                      <circle className="otw-heart-ring" cx="198" cy="206" r="14" fill="none" stroke="#fb7185" strokeWidth="1" style={{ animationDelay: `${(beat * 0.5).toFixed(2)}s` }} />
                      <g className="otw-heart-beat">
                        <ellipse cx="198" cy="206" rx="22" ry="25" fill={`url(#${uid}-g-heart)`} opacity={organOpacity('heart', 0.85)} />
                        <path
                          d="M198,197 C192,188 183,194 187,206 C189,214 198,223 198,223 C198,223 207,214 209,206 C213,194 204,188 198,197 Z"
                          fill="#fff"
                          opacity=".92"
                          filter={selectedOrgan === 'heart' ? `url(#${uid}-glow)` : undefined}
                        />
                      </g>
                    </g>

                    {/* radiation particles passing through the body (rate scales with recorded dose) */}
                    {layers.radiation && (
                      <g clipPath={`url(#${uid}-body)`}>
                        {radParticles.slice(0, radiationCount).map((p, i) => (
                          <line
                            key={i}
                            className="otw-rad"
                            x1={p.x}
                            y1={p.y}
                            x2={p.x + p.len * 0.5}
                            y2={p.y + p.len * 0.8}
                            stroke="#fde047"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            style={css({ '--rd': `${p.d}s`, '--rl': `${p.l}s`, '--rx': '70px', '--ry': '110px' })}
                          />
                        ))}
                      </g>
                    )}

                    {/* holographic scan sweep, clipped to body */}
                    <g clipPath={`url(#${uid}-body)`}>
                      <g className="otw-scan">
                        <rect x="60" y="-46" width="260" height="46" fill={`url(#${uid}-scan)`} />
                        <line x1="60" x2="320" y1="0" y2="0" stroke="#bae6fd" strokeWidth="1" opacity=".55" />
                      </g>
                    </g>

                    {/* pins + leader lines for the selected organ */}
                    {ORGAN_ORDER.map((k) => (
                      <g key={`pin-${k}`} transform={`translate(${pins[k].x},${pins[k].y})`} {...hit(k)}>
                        <circle className="otw-pin-ring" r="9" fill="none" stroke={ORGAN_COLOR[k]} strokeWidth="1.5" style={{ animationDelay: `${ORGAN_ORDER.indexOf(k) * 0.35}s` }} />
                        <circle r={selectedOrgan === k ? 6 : 4.5} fill={ORGAN_COLOR[k]} stroke="#fff" strokeWidth="1.2" />
                      </g>
                    ))}
                    <g key={selectedOrgan}>
                      <path className="otw-leader" d={leaders[selectedOrgan]} fill="none" stroke={activeColor} strokeWidth="1.2" />
                      <text
                        x={leaders[selectedOrgan].endsWith('30,196') || leaders[selectedOrgan].endsWith('30,250') ? 30 : 352}
                        y={Number(leaders[selectedOrgan].split(',').pop()) - 6}
                        textAnchor={leaders[selectedOrgan].endsWith('30,196') || leaders[selectedOrgan].endsWith('30,250') ? 'start' : 'end'}
                        fontSize="11"
                        fontWeight="700"
                        letterSpacing=".08em"
                        fill={activeColor}
                      >
                        {active.short.toUpperCase()}
                      </text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            <div className="otw-hud tl">
              Subject <b>{astronautName}</b>
            </div>
            <div className="otw-hud tr">
              {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              <br />
              <b>{hrReal ? `${hr.toFixed(0)} bpm` : 'HR n/a'}</b>
            </div>
            <div className="otw-hud bl">
              Zoom <b>{(zoom * 100).toFixed(0)}%</b>
            </div>
            <div className="otw-hud br">Hover to tilt · Ctrl+scroll to zoom</div>

            <div className="otw-controls">
              <button type="button" className="otw-ctl" title="Zoom in" onClick={() => setZoom((z) => clamp(z + 0.2, 0.85, 2.2))}>
                <Plus size={14} />
              </button>
              <button type="button" className="otw-ctl" title="Zoom out" onClick={() => setZoom((z) => clamp(z - 0.2, 0.85, 2.2))}>
                <Minus size={14} />
              </button>
              <button type="button" className="otw-ctl" title="Reset view" onClick={resetView}>
                <Maximize2 size={13} />
              </button>
            </div>
          </div>

          <div className="otw-layers" style={{ marginTop: 12 }}>
            {(
              [
                ['skin', 'Body'],
                ['skeleton', 'Skeleton'],
                ['vessels', 'Vessels'],
                ['nerves', 'Nerves'],
                ['radiation', 'Radiation'],
              ] as [Layer, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" className="otw-btn" aria-pressed={layers[k]} onClick={() => toggleLayer(k)}>
                {k === 'radiation' && <Radiation size={12} />} {label}
              </button>
            ))}
          </div>
        </div>

        {/* =============== SIDE PANEL =============== */}
        <div className="otw-side">
          <div className="otw-banner" style={{ borderLeftColor: activeColor }}>
            <div className="otw-banner-top">
              <div className="otw-ico" style={{ background: `${activeColor}22`, color: activeColor }}>
                <ActiveIcon size={20} color={activeColor} />
              </div>
              <div>
                <h4>{active.title}</h4>
                <small>{active.metricLabel}</small>
              </div>
              <span className="otw-status" style={{ background: `${STATUS_COLOR[activeStatus]}22`, color: STATUS_COLOR[activeStatus] }}>
                {STATUS_LABEL[activeStatus]}
              </span>
            </div>
            <p className="otw-desc">{active.description}</p>
          </div>

          <div className="otw-wave otw-wave-grid" aria-hidden="true">
            <span className="otw-wave-label">
              {selectedOrgan === 'heart' ? 'ECG-style trace' : selectedOrgan === 'lungs' ? 'Respiration trace' : selectedOrgan === 'brain' ? 'Neural activity (illustrative)' : selectedOrgan === 'muscles' ? 'Muscle activity (illustrative)' : 'Radiation event ticks (illustrative)'}
            </span>
            <svg viewBox="0 0 300 60" preserveAspectRatio="none" key={selectedOrgan}>
              <g className="otw-wave-run" style={css({ '--wp': dur(wavePeriod[selectedOrgan]) })}>
                <path d={WAVES[selectedOrgan]} fill="none" stroke={activeColor} strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${activeColor})` }} />
              </g>
            </svg>
          </div>

          <div className="otw-readouts">
            {readouts[selectedOrgan].map((r) => (
              <div className="otw-readout" key={r.label}>
                <span>{r.label}</span>
                <strong>
                  {r.value}
                  <em>{r.unit}</em>
                </strong>
                {r.hint && <small>{r.hint}</small>}
              </div>
            ))}
          </div>

          <div className="otw-pills">
            {ORGAN_ORDER.map((k) => {
              const Icon = ORGANS[k].Icon;
              const on = selectedOrgan === k;
              return (
                <button
                  key={k}
                  type="button"
                  className="otw-pill"
                  onClick={() => onSelectOrgan(k)}
                  style={on ? { borderColor: ORGAN_COLOR[k], background: `${ORGAN_COLOR[k]}1f`, color: ORGAN_COLOR[k] } : undefined}
                >
                  <Icon size={13} color={on ? ORGAN_COLOR[k] : undefined} />
                  {ORGANS[k].short}
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[statuses[k]] }} title={STATUS_LABEL[statuses[k]]} />
                </button>
              );
            })}
          </div>

          <p className="otw-note">
            Status colours compare the latest recorded value with this astronaut’s own baseline (illustrative thresholds, not clinical limits).
            Without a baseline the status shows “Recorded”. Prototype only: not a diagnosis, treatment advice or flight clearance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinViewer;
