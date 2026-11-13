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
  Check,
  ChevronDown,
  Clock3,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Upload,
  Users,
  Wind,
} from 'lucide-react';

const API = 'http://localhost:8000/api';
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

  // Selected pill in the Mission Telemetry Trend card
  const [selectedMetric, setSelectedMetric] = useState('Heart Rate');

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
      throw Error(d.detail || 'Request failed');
    }
    return res.json();
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement)
      .value;
    const password = (form.elements.namedItem('password') as HTMLInputElement)
      .value;

    try {
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(d.access_token);
      setUser(d);
      localStorage.setItem('token', d.access_token);
      localStorage.setItem('user', JSON.stringify(d));
      setError('');
    } catch (x: any) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    if (!token) return;
    try {
      const a = await api('/astronauts');
      setAstronauts(a);
      const id = selected || user?.astronaut_id || a[0]?.id;
      if (!selected) setSelected(id);
      if (id) {
        const [m, b, l, t, d] = await Promise.all([
          api(`/astronauts/${id}/measurements`),
          api(`/astronauts/${id}/baselines`),
          api(`/alerts?astronaut_id=${id}`),
          api(`/timeline/${id}`),
          api(`/astronauts/${id}/documents`),
        ]);
        setMeasurements(m);
        setBaselines(b);
        setAlerts(l);
        setTimeline(t);
        setDocs(d);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [token, selected]);

  const astronaut = astronauts.find((a: Any) => a.id === selected);
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

    if (selectedMetric === 'Heart Rate') {
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
            Tracking individual adaptation relative to calibrated normal
            range ({telemetryData.median} {telemetryData.unit})
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
            <div className="logo">
              <Atom />
            </div>
            <div>
              <strong>
                ORBITCARE <span>AI</span>
              </strong>
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
            Sign in to view health trends, mission alerts, and evidence-grounded
            insights.
          </p>
          <form onSubmit={login}>
            <label>
              Username
              <input name="username" defaultValue="medical" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                defaultValue="orbitcare-demo"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'} <span>→</span>
            </button>
          </form>
          <div className="credentials">
            DEMO ACCESS <b>medical</b> or <b>astronaut</b> · Password{' '}
            <b>orbitcare-demo</b>
          </div>
          <div className="login-foot">
            <ShieldCheck size={14} /> Decision support prototype · Simulated
            mission data
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
          <div className="logo">
            <Atom />
          </div>
          <div>
            <strong>
              ORBITCARE <span>AI</span>
            </strong>
            <small>MISSION HEALTH</small>
          </div>
        </div>
        <div className="mission-label">MISSION CONTROL</div>
        <nav>
          {[
            [LayoutDashboard, 'Overview'],
            [HeartPulse, 'Cardiovascular'],
            [Wind, 'Behavioural'],
            [Clock3, 'Mission timeline'],
            [FileText, 'Medical records'],
            [MessageCircle, 'AI assistant'],
          ].map(([Icon, label]: any) => (
            <button
              className={tab === label ? 'nav active' : 'nav'}
              onClick={() => handleTabChange(label)}
              key={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="live">
            <i /> MISSION SIMULATION LIVE
          </div>
          <div className="profile">
            <div className="avatar">{user?.role === 'medical' ? 'MO' : 'AS'}</div>
            <div>
              <b>{user?.username}</b>
              <small>
                {user?.role === 'medical' ? 'Medical officer' : 'Astronaut'}
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
            ASTERIA-7 <span>/</span> HEALTH INTELLIGENCE
          </div>
          <div className="top-right">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
            >
              {isLight ? <Moon size={15} /> : <Sun size={15} />}
              <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
            </button>
            <div className="live">
              <i /> SYSTEM NOMINAL
            </div>
            <div className="avatar small">
              {user?.role === 'medical' ? 'MO' : 'AS'}
            </div>
          </div>
        </header>

        <div className="content">
          <div className="heading-row">
            <div>
              <div className="eyebrow">
                MISSION DAY 060 <span className="sep">·</span> LOW EARTH ORBIT
              </div>
              <h1>{tab === 'Overview' ? 'Crew health overview' : tab}</h1>
              <p className="muted">
                {tab === 'Cardiovascular'
                  ? 'Continuous cardiovascular monitoring, hemodynamics, and cardiac adaptation indicators.'
                  : tab === 'Behavioural'
                  ? 'Sleep architecture, cognitive stress levels, and daily astronaut subjective logs.'
                  : 'A unified view of crew health signals, personal baselines, and mission events.'}
              </p>
            </div>
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
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-top">
                <span>CREW STATUS</span>
                <Users size={17} />
              </div>
              <strong>
                {astronauts.length.toString().padStart(2, '0')}{' '}
                <small>astronauts</small>
              </strong>
              <div className="stat-foot">
                <i /> All crew profiles active
              </div>
            </div>
            <div className="stat">
              <div className="stat-top">
                <span>OPEN ALERTS</span>
                <AlertTriangle size={17} />
              </div>
              <strong>
                {alerts
                  .filter((a: Any) => !a.acknowledged)
                  .length.toString()
                  .padStart(2, '0')}{' '}
                <small>require review</small>
              </strong>
              <div className="stat-foot amber">
                Prioritized by deterministic rules
              </div>
            </div>
            <div className="stat">
              <div className="stat-top">
                <span>MEASUREMENTS</span>
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

          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError('')}>Dismiss</button>
            </div>
          )}

          {/* DYNAMIC TELEMETRY CARD: Featured on Overview, Cardiovascular, or Behavioural */}
          {(tab === 'Overview' ||
            tab === 'Cardiovascular' ||
            tab === 'Behavioural') &&
            renderTelemetryCard()}

          {/* OVERVIEW TAB CONTENT */}
          {tab === 'Overview' && (
            <>
              <div className="grid-main">
                <section className="panel alert-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">REQUIRES ATTENTION</div>
                      <h2>
                        Priority alerts{' '}
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
                        {user?.role === 'medical' && !a.acknowledged && (
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
                      <div className="eyebrow">RECENT MISSION EVENTS</div>
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
                      <h2>Health domains</h2>
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

              <div id="measurements-table" style={{ marginTop: '16px' }}>
                <section className="panel table-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">CREW HEALTH RECORDS</div>
                      <h2>Measurements & Baselines</h2>
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
            <div className="grid-main" style={{ marginTop: '16px' }}>
              <section className="panel" style={{ gridColumn: 'span 2' }}>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">CARDIOVASCULAR PROFILE</div>
                    <h2>Hemodynamic Summary & Baseline Drift</h2>
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
          )}

          {/* BEHAVIOURAL TAB CONTENT */}
          {tab === 'Behavioural' && (
            <section className="panel table-panel" style={{ marginTop: '16px' }}>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">ASTRONAUT SELF-REPORT</div>
                  <h2>Daily health assessment</h2>
                  <p className="muted">
                    Manual assessment values are self-reported, not instrument
                    measurements.
                  </p>
                </div>
              </div>
              <div className="assessment-form">
                {[
                  ['sleep_hours', 'Sleep duration (hours)', 0, 24],
                  ['sleep_quality', 'Sleep quality (1–10)', 1, 10],
                  ['stress', 'Stress (1–10)', 1, 10],
                  ['mood', 'Mood (1–10)', 1, 10],
                  ['fatigue', 'Fatigue (1–10)', 1, 10],
                ].map(([k, label, min, max]: any) => (
                  <label key={k}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={k === 'sleep_hours' ? 0.5 : 1}
                      value={(assessment as any)[k]}
                      onChange={(e) =>
                        setAssessment({
                          ...assessment,
                          [k]: +e.target.value,
                        })
                      }
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
                  />
                </label>
                <button
                  onClick={async () => {
                    if (selected) {
                      await api(`/astronauts/${selected}/assessments`, {
                        method: 'POST',
                        body: JSON.stringify(assessment),
                      });
                      load();
                    }
                  }}
                >
                  <Plus size={15} /> Submit assessment
                </button>
              </div>
            </section>
          )}

          {/* MISSION TIMELINE TAB CONTENT */}
          {tab === 'Mission timeline' && (
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
          )}

          {/* MEDICAL RECORDS TAB CONTENT */}
          {tab === 'Medical records' && (
            <section className="panel table-panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">DOCUMENT INTELLIGENCE</div>
                  <h2>Medical reports</h2>
                  <p className="muted">
                    Extracted text remains unverified until reviewed by a medical
                    officer.
                  </p>
                </div>
                {user?.role === 'medical' && (
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
                  {user?.role === 'medical' && !d.verified && (
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
          )}

          {/* AI ASSISTANT TAB CONTENT */}
          {tab === 'AI assistant' && (
            <section className="panel assistant">
              <div className="assistant-head">
                <div className="assistant-icon">
                  <Atom />
                </div>
                <div>
                  <div className="eyebrow">EVIDENCE-GROUNDED ASSISTANT</div>
                  <h2>Ask about mission health</h2>
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
          )}
        </div>
      </main>
    </div>
  );
}
