import React, { useState } from 'react';
import {
  Heart,
  Wind,
  Brain,
  Activity,
  Shield,
  Sparkles,
  Plus,
  Minus,
  Maximize2,
  Info,
} from 'lucide-react';

export type OrganKey = 'heart' | 'lungs' | 'brain' | 'muscles' | 'immune';

export interface DigitalTwinProps {
  selectedOrgan: OrganKey;
  onSelectOrgan: (organ: OrganKey) => void;
  astronautName?: string;
  vitals?: {
    heartRate?: number;
    hrv?: number;
    systolicBp?: number;
    diastolicBp?: number;
    coreTemp?: number;
    grip?: number;
    sleepHours?: number;
    fatigue?: number;
    cabinCo2?: number;
    radiation?: number;
  };
}

export const DigitalTwinViewer: React.FC<DigitalTwinProps> = ({
  selectedOrgan,
  onSelectOrgan,
  astronautName = 'Maya Chen',
  vitals = {},
}) => {
  const [zoom, setZoom] = useState(1);
  const [hoveredOrgan, setHoveredOrgan] = useState<OrganKey | null>(null);

  const hr = vitals.heartRate ?? 84.9;
  const temp = vitals.coreTemp ?? 37.1;
  const grip = vitals.grip ?? 44.2;
  const sleep = vitals.sleepHours ?? 5.2;
  const fatigue = vitals.fatigue ?? 7;
  const co2 = vitals.cabinCo2 ?? 0.38;

  const organData: Record<
    OrganKey,
    {
      title: string;
      icon: any;
      metricLabel: string;
      value: string;
      status: 'Critical' | 'Suboptimal' | 'Nominal' | 'Optimal';
      color: string;
      bg: string;
      glowColor: string;
      description: string;
    }
  > = {
    heart: {
      title: 'Cardiovascular System',
      icon: Heart,
      metricLabel: 'Resting Heart Rate',
      value: `${hr.toFixed(1)} BPM`,
      status: hr > 80 ? 'Critical' : 'Nominal',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      glowColor: 'rgba(239, 68, 68, 0.6)',
      description:
        'Cephalad microgravity fluid shift increasing central venous pressure and elevated resting baseline drift.',
    },
    lungs: {
      title: 'Pulmonary & Respiratory',
      icon: Wind,
      metricLabel: 'Gas Exchange & Cabin CO2',
      value: `${co2.toFixed(2)} kPa CO2`,
      status: co2 > 0.45 ? 'Suboptimal' : 'Nominal',
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      glowColor: 'rgba(6, 182, 212, 0.6)',
      description:
        'Thoracic blood pooling impacts microvascular ventilation-perfusion matching. SpO2 nominal at 98.2%.',
    },
    brain: {
      title: 'Neurocognitive & Sleep',
      icon: Brain,
      metricLabel: 'Sleep Duration & Fatigue',
      value: `${sleep.toFixed(1)} hrs · Fatigue ${fatigue}/10`,
      status: sleep < 6 || fatigue > 5 ? 'Suboptimal' : 'Nominal',
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.12)',
      glowColor: 'rgba(139, 92, 246, 0.6)',
      description:
        'Circadian misalignment and space motion sickness adaptation leading to elevated operational cognitive fatigue.',
    },
    muscles: {
      title: 'Musculoskeletal & Grip',
      icon: Activity,
      metricLabel: 'Grip Strength & Bone Load',
      value: `${grip.toFixed(1)} kg force`,
      status: grip < 40 ? 'Suboptimal' : 'Nominal',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      glowColor: 'rgba(16, 185, 129, 0.6)',
      description:
        'Anti-gravity postural muscle unloading mitigated via daily Advanced Resistive Exercise Device (ARED) protocol.',
    },
    immune: {
      title: 'Core Metabolic & Immune',
      icon: Shield,
      metricLabel: 'Core Temperature',
      value: `${temp.toFixed(1)} °C`,
      status: temp > 37.5 ? 'Suboptimal' : 'Nominal',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      glowColor: 'rgba(245, 158, 11, 0.6)',
      description:
        'Spaceflight-associated neuro-vestibular core temperature elevation (space fever phenomenon) under observation.',
    },
  };

  const active = organData[selectedOrgan];

  return (
    <div className="digital-twin-card">
      <div className="digital-twin-head">
        <div>
          <h3 className="digital-twin-title">Your Digital Twin Overview</h3>
          <p className="digital-twin-subtitle">
            A personalized model uses your medical history, imaging, and real-time data to simulate and predict heart function.
          </p>
        </div>
        <button
          type="button"
          className="twin-view-all-btn"
          onClick={() => onSelectOrgan('heart')}
        >
          View all data
        </button>
      </div>

      {/* Anatomical Holographic Body Container */}
      <div className="anatomical-viewport">
        <div
          className="anatomical-stage"
          style={{
            transform: `scale(${zoom})`,
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <svg
            viewBox="0 0 380 620"
            className="anatomical-svg"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Radial glow filter for organ hotspots */}
              <filter id="twin-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="intense-glow" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Shading gradients for 3D body volume */}
              <linearGradient id="body-glass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(215, 235, 250, 0.85)" />
                <stop offset="50%" stopColor="rgba(180, 210, 235, 0.65)" />
                <stop offset="100%" stopColor="rgba(145, 185, 220, 0.5)" />
              </linearGradient>

              <linearGradient id="body-contour-stroke" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
                <stop offset="35%" stopColor="rgba(56, 189, 248, 0.7)" />
                <stop offset="70%" stopColor="rgba(13, 148, 136, 0.5)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.8)" />
              </linearGradient>

              {/* Internal organs gradients */}
              <radialGradient id="heart-pulse-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#f97316" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="lung-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#0284c7" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="brain-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
                <stop offset="70%" stopColor="#6366f1" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="liver-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                <stop offset="70%" stopColor="#d97706" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Subtle background anatomical grid & height markers */}
            <g opacity="0.12" stroke="#0284c7" strokeWidth="0.7" strokeDasharray="3,3">
              <line x1="40" y1="75" x2="340" y2="75" />
              <line x1="40" y1="210" x2="340" y2="210" />
              <line x1="40" y1="320" x2="340" y2="320" />
              <line x1="40" y1="450" x2="340" y2="450" />
              <line x1="190" y1="20" x2="190" y2="600" />
            </g>

            {/* ANATOMICAL HUMAN BODY SILHOUETTE (Medical Vector Contour) */}
            <g className="body-silhouette-group">
              {/* Outer Body Volume */}
              <path
                d="
                  M 190,32
                  C 172,32 160,45 160,65
                  C 160,82 170,95 178,102
                  C 174,106 172,112 172,118
                  C 152,122 134,132 120,146
                  C 108,160 102,185 96,215
                  C 90,245 84,285 78,320
                  C 74,338 68,360 74,368
                  C 80,374 88,360 92,342
                  C 98,310 104,275 110,245
                  C 114,228 118,210 126,200
                  C 128,225 130,255 132,285
                  C 134,315 138,335 142,350
                  C 144,358 142,370 142,390
                  C 142,425 146,465 150,510
                  C 152,535 152,565 150,585
                  C 148,594 158,598 166,598
                  C 176,598 178,588 178,575
                  C 178,550 178,515 176,475
                  C 176,445 176,415 178,390
                  L 186,370
                  L 190,366
                  L 194,370
                  L 202,390
                  C 204,415 204,445 204,475
                  C 202,515 202,550 202,575
                  C 202,588 204,598 214,598
                  C 222,598 232,594 230,585
                  C 228,565 228,535 230,510
                  C 234,465 238,425 238,390
                  C 238,370 236,358 238,350
                  C 242,335 246,315 248,285
                  C 250,255 252,225 254,200
                  C 262,210 266,228 270,245
                  C 276,275 282,310 288,342
                  C 292,360 300,374 306,368
                  C 312,360 306,338 302,320
                  C 296,285 290,245 284,215
                  C 278,185 272,160 260,146
                  C 246,132 228,122 208,118
                  C 208,112 206,106 202,102
                  C 210,95 220,82 220,65
                  C 220,45 208,32 190,32
                  Z
                "
                fill="url(#body-glass-grad)"
                stroke="url(#body-contour-stroke)"
                strokeWidth="1.6"
                filter="drop-shadow(0 10px 18px rgba(10, 40, 80, 0.08))"
              />

              {/* SKELETAL SYSTEM: Clavicles, Sternum, Ribcage, Spine, Pelvis, and Long Bones */}
              <g className="anatomical-skeleton-group" fill="none">
                {/* Clavicle Collarbones */}
                <path
                  d="M 186,142 C 166,137 142,143 126,152 M 194,142 C 214,137 238,143 254,152"
                  stroke="rgba(255, 255, 255, 0.85)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* Sternum / Breastbone */}
                <path
                  d="M 186,144 L 194,144 L 193,228 L 187,228 Z"
                  fill="rgba(255, 255, 255, 0.3)"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="1.2"
                />
                <circle cx="190" cy="233" r="2.2" fill="rgba(255, 255, 255, 0.85)" />

                {/* 10 Pairs of Anatomically Curved Ribs */}
                <g stroke="rgba(255, 255, 255, 0.72)" strokeWidth="1.3">
                  {/* Left Thoracic Ribs */}
                  <path d="M 187,156 C 164,150 144,158 136,172 C 144,178 170,166 187,162" />
                  <path d="M 187,170 C 156,165 134,176 128,192 C 136,198 166,184 187,178" />
                  <path d="M 187,184 C 150,180 126,194 120,212 C 130,220 162,202 187,194" />
                  <path d="M 188,198 C 146,195 122,212 116,234 C 128,242 162,220 188,210" />
                  <path d="M 188,212 C 143,210 120,230 114,252 C 126,260 162,236 188,226" />
                  <path d="M 188,226 C 143,226 120,248 116,270 C 128,276 163,252 188,240" />
                  <path d="M 189,240 C 146,242 124,266 120,288 C 132,294 165,268 189,254" />
                  <path d="M 189,252 C 150,258 130,280 126,302 C 138,306 167,284 189,266" />
                  <path d="M 189,264 C 156,272 136,294 134,314 C 144,316 169,296 189,278" />
                  <path d="M 190,276 C 162,284 144,306 142,324 C 152,326 172,306 190,288" />

                  {/* Right Thoracic Ribs */}
                  <path d="M 193,156 C 216,150 236,158 244,172 C 236,178 210,166 193,162" />
                  <path d="M 193,170 C 224,165 246,176 252,192 C 244,198 214,184 193,178" />
                  <path d="M 193,184 C 230,180 254,194 260,212 C 250,220 218,202 193,194" />
                  <path d="M 192,198 C 234,195 258,212 264,234 C 252,242 218,220 192,210" />
                  <path d="M 192,212 C 237,210 260,230 266,252 C 254,260 218,236 192,226" />
                  <path d="M 192,226 C 237,226 260,248 264,270 C 252,276 217,252 192,240" />
                  <path d="M 191,240 C 234,242 256,266 260,288 C 248,294 215,268 191,254" />
                  <path d="M 191,252 C 230,258 250,280 254,302 C 242,306 213,284 191,266" />
                  <path d="M 191,264 C 224,272 244,294 246,314 C 236,316 211,296 191,278" />
                  <path d="M 190,276 C 218,284 236,306 238,324 C 228,326 208,306 190,288" />
                </g>

                {/* Vertebral Spinal Column (Cervical, Thoracic & Lumbar Discs) */}
                <line x1="190" y1="108" x2="190" y2="350" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="2.8" />
                <g stroke="rgba(255, 255, 255, 0.65)" strokeWidth="1.2">
                  {[116, 126, 136, 146, 156, 166, 176, 186, 196, 206, 216, 226, 236, 246, 256, 266, 276, 286, 296, 306, 316, 326, 336, 346].map((y) => (
                    <line key={y} x1="186" y1={y} x2="194" y2={y} />
                  ))}
                </g>

                {/* Pelvic Girdle & Iliac Crests */}
                <path
                  d="M 154,335 C 138,345 140,370 156,380 C 172,388 186,376 188,364"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth="2"
                />
                <path
                  d="M 226,335 C 242,345 240,370 224,380 C 208,388 194,376 192,364"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth="2"
                />
                <ellipse cx="190" cy="370" rx="14" ry="18" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.2" />

                {/* Limb Bones: Arms & Legs */}
                <g stroke="rgba(255, 255, 255, 0.55)">
                  {/* Left Arm Humerus, Radius & Ulna */}
                  <line x1="116" y1="168" x2="96" y2="248" strokeWidth="2.4" />
                  <circle cx="96" cy="251" r="3.5" fill="none" strokeWidth="1.2" />
                  <line x1="94" y1="256" x2="78" y2="335" strokeWidth="1.6" />
                  <line x1="97" y1="256" x2="82" y2="335" strokeWidth="1.2" />

                  {/* Right Arm Humerus, Radius & Ulna */}
                  <line x1="264" y1="168" x2="284" y2="248" strokeWidth="2.4" />
                  <circle cx="284" cy="251" r="3.5" fill="none" strokeWidth="1.2" />
                  <line x1="286" y1="256" x2="302" y2="335" strokeWidth="1.6" />
                  <line x1="283" y1="256" x2="298" y2="335" strokeWidth="1.2" />

                  {/* Left Leg Femur, Patella & Tibia */}
                  <line x1="172" y1="388" x2="166" y2="485" strokeWidth="3" />
                  <circle cx="166" cy="492" r="4.5" fill="none" strokeWidth="1.4" />
                  <line x1="166" y1="500" x2="164" y2="575" strokeWidth="2.2" />

                  {/* Right Leg Femur, Patella & Tibia */}
                  <line x1="208" y1="388" x2="214" y2="485" strokeWidth="3" />
                  <circle cx="214" cy="492" r="4.5" fill="none" strokeWidth="1.4" />
                  <line x1="214" y1="500" x2="216" y2="575" strokeWidth="2.2" />
                </g>
              </g>

              {/* Neural & Circulatory Plexus (Fine luminous branches) */}
              <g opacity="0.65" fill="none">
                {/* Neural Plexus radiating down arms */}
                <path d="M 182,125 C 160,135 140,152 120,178 C 105,198 94,240 84,295" stroke="rgba(251, 191, 36, 0.55)" strokeWidth="1.1" />
                <path d="M 198,125 C 220,135 240,152 260,178 C 275,198 286,240 296,295" stroke="rgba(251, 191, 36, 0.55)" strokeWidth="1.1" />

                {/* Major Circulatory Arteries & Veins */}
                <path d="M 195,195 C 190,178 185,170 190,160 C 194,152 198,135 198,115" stroke="#ef4444" strokeWidth="2.2" />
                <path d="M 192,215 L 190,330 C 190,350 178,390 170,440 L 165,540" stroke="#ef4444" strokeWidth="1.8" />
                <path d="M 190,330 C 190,350 202,390 210,440 L 215,540" stroke="#ef4444" strokeWidth="1.8" />
                <path d="M 184,195 L 184,130" stroke="#38bdf8" strokeWidth="1.8" />
                <path d="M 184,215 L 186,330 C 186,350 174,390 166,440 L 161,540" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M 186,330 C 186,350 198,390 206,440 L 211,540" stroke="#38bdf8" strokeWidth="1.5" />
              </g>
            </g>

            {/* ---------------- ORGAN ANATOMICAL RENDERINGS ---------------- */}

            {/* 1. BRAIN (Neurocognitive) */}
            <g
              className="organ-group"
              onClick={() => onSelectOrgan('brain')}
              onMouseEnter={() => setHoveredOrgan('brain')}
              onMouseLeave={() => setHoveredOrgan(null)}
              cursor="pointer"
            >
              <ellipse
                cx="190"
                cy="68"
                rx="22"
                ry="26"
                fill="url(#brain-grad)"
                opacity={selectedOrgan === 'brain' || hoveredOrgan === 'brain' ? '0.9' : '0.45'}
                filter="url(#twin-glow)"
              />
              <path
                d="M 180,55 Q 190,62 182,75 Q 190,82 184,90 M 198,55 Q 190,62 196,75 Q 190,82 194,90"
                stroke="#c084fc"
                strokeWidth="1.2"
                fill="none"
                opacity="0.8"
              />
            </g>

            {/* 2. LUNGS (Pulmonary) */}
            <g
              className="organ-group"
              onClick={() => onSelectOrgan('lungs')}
              onMouseEnter={() => setHoveredOrgan('lungs')}
              onMouseLeave={() => setHoveredOrgan(null)}
              cursor="pointer"
            >
              {/* Left Lung Lobe */}
              <path
                d="M 176,170 C 160,175 148,195 150,225 C 152,245 168,252 178,245 Z"
                fill="url(#lung-grad)"
                opacity={selectedOrgan === 'lungs' || hoveredOrgan === 'lungs' ? '0.9' : '0.4'}
                filter="url(#twin-glow)"
              />
              {/* Right Lung Lobe */}
              <path
                d="M 204,170 C 220,175 232,195 230,225 C 228,245 212,252 202,245 Z"
                fill="url(#lung-grad)"
                opacity={selectedOrgan === 'lungs' || hoveredOrgan === 'lungs' ? '0.9' : '0.4'}
                filter="url(#twin-glow)"
              />
            </g>

            {/* 3. LIVER / METABOLIC CORE (Immune) */}
            <g
              className="organ-group"
              onClick={() => onSelectOrgan('immune')}
              onMouseEnter={() => setHoveredOrgan('immune')}
              onMouseLeave={() => setHoveredOrgan(null)}
              cursor="pointer"
            >
              <path
                d="M 160,250 C 175,245 205,250 215,260 C 218,275 185,285 165,278 Z"
                fill="url(#liver-grad)"
                opacity={selectedOrgan === 'immune' || hoveredOrgan === 'immune' ? '0.9' : '0.35'}
                filter="url(#twin-glow)"
              />
            </g>

            {/* 4. HEART (Cardiovascular Primary) */}
            <g
              className="organ-group"
              onClick={() => onSelectOrgan('heart')}
              onMouseEnter={() => setHoveredOrgan('heart')}
              onMouseLeave={() => setHoveredOrgan(null)}
              cursor="pointer"
            >
              <ellipse
                cx="198"
                cy="206"
                rx="18"
                ry="21"
                fill="url(#heart-pulse-grad)"
                filter={selectedOrgan === 'heart' ? 'url(#intense-glow)' : 'url(#twin-glow)'}
                opacity={selectedOrgan === 'heart' || hoveredOrgan === 'heart' ? '1' : '0.75'}
              />
              <path
                d="M 198,198 C 193,190 185,195 188,206 C 190,214 198,222 198,222 C 198,222 206,214 208,206 C 211,195 203,190 198,198 Z"
                fill="#ffffff"
                opacity="0.9"
              />
            </g>

            {/* ---------------- INTERACTIVE PULSING HOTSPOT PINS ---------------- */}

            {/* HEART HOTSPOT (Red / Orange Glowing Pulse) */}
            <g
              className="organ-hotspot-pin"
              transform="translate(198, 206)"
              onClick={() => onSelectOrgan('heart')}
              cursor="pointer"
            >
              <circle
                r="16"
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.5"
                opacity="0.6"
                className="hotspot-pulse-ring"
              />
              <circle r="8" fill="#ef4444" />
              <circle r="3.5" fill="#ffffff" />
            </g>

            {/* LUNG HOTSPOT (Cyan Glowing Pulse) */}
            <g
              className="organ-hotspot-pin"
              transform="translate(152, 210)"
              onClick={() => onSelectOrgan('lungs')}
              cursor="pointer"
            >
              <circle
                r="14"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.5"
                opacity="0.6"
                className="hotspot-pulse-ring-delayed"
              />
              <circle r="7" fill="#06b6d4" />
              <circle r="3" fill="#ffffff" />
            </g>

            {/* BRAIN HOTSPOT (Purple Glowing Pulse) */}
            <g
              className="organ-hotspot-pin"
              transform="translate(190, 70)"
              onClick={() => onSelectOrgan('brain')}
              cursor="pointer"
            >
              <circle
                r="14"
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.5"
                opacity="0.6"
                className="hotspot-pulse-ring"
              />
              <circle r="7" fill="#a855f7" />
              <circle r="3" fill="#ffffff" />
            </g>

            {/* LIVER / IMMUNE HOTSPOT (Amber Glowing Pulse) */}
            <g
              className="organ-hotspot-pin"
              transform="translate(185, 265)"
              onClick={() => onSelectOrgan('immune')}
              cursor="pointer"
            >
              <circle
                r="14"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                opacity="0.6"
                className="hotspot-pulse-ring-delayed"
              />
              <circle r="7" fill="#f59e0b" />
              <circle r="3" fill="#ffffff" />
            </g>

            {/* MUSCULOSKELETAL HOTSPOT (Emerald Glowing Pulse at Arm/Grip) */}
            <g
              className="organ-hotspot-pin"
              transform="translate(90, 310)"
              onClick={() => onSelectOrgan('muscles')}
              cursor="pointer"
            >
              <circle
                r="14"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                opacity="0.6"
                className="hotspot-pulse-ring"
              />
              <circle r="7" fill="#10b981" />
              <circle r="3" fill="#ffffff" />
            </g>
          </svg>

          {/* ClyHealth Heart Floating Badge: 72% */}
          <div
            className={`cly-hotspot-pill heart-cly-pill ${selectedOrgan === 'heart' ? 'active' : ''}`}
            style={{ top: '34%', left: '58%' }}
            onClick={() => onSelectOrgan('heart')}
            title="Cardiovascular System (Click to inspect)"
          >
            <span className="cly-pill-dot orange-dot" />
            <span className="cly-pill-num">72%</span>
          </div>

          {/* ClyHealth Liver/Abdomen Floating Badge: 15% */}
          <div
            className={`cly-hotspot-pill liver-cly-pill ${selectedOrgan === 'immune' ? 'active' : ''}`}
            style={{ top: '44%', left: '28%' }}
            onClick={() => onSelectOrgan('immune')}
            title="Metabolic & Hepatic System (Click to inspect)"
          >
            <span className="cly-pill-dot blue-dot" />
            <span className="cly-pill-num">15%</span>
          </div>

          {/* Floating Zoom & Fit Controls (Bottom Left) */}
          <div className="cly-floating-controls-left">
            <button
              type="button"
              className="cly-control-btn"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 1.4))}
              title="Zoom In"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="cly-control-btn"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.85))}
              title="Zoom Out"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              className="cly-control-btn"
              onClick={() => setZoom(1)}
              title="Fit to Screen"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          {/* Floating AI Simulation Sparkle Button (Bottom Right) */}
          <button
            type="button"
            className="cly-floating-sparkle-btn"
            onClick={() => onSelectOrgan('heart')}
            title="AI Physiological Twin Analysis"
          >
            <Sparkles size={18} className="sparkle-glow-icon" />
          </button>
        </div>
      </div>

      {/* Active Organ Insight Panel */}
      <div className="active-organ-banner" style={{ borderColor: active.color }}>
        <div className="organ-banner-header">
          <div className="organ-banner-icon" style={{ background: active.bg, color: active.color }}>
            <active.icon size={18} />
          </div>
          <div className="organ-banner-title-box">
            <div className="organ-banner-title">{active.title}</div>
            <div className="organ-banner-metric">
              {active.metricLabel}: <b>{active.value}</b>
            </div>
          </div>
          <span className={`status-pill ${active.status.toLowerCase()}`}>
            {active.status}
          </span>
        </div>
        <p className="organ-banner-desc">{active.description}</p>
      </div>

      {/* Quick Organ Selector Row */}
      <div className="organ-quick-row">
        {(['heart', 'lungs', 'brain', 'muscles', 'immune'] as OrganKey[]).map((key) => {
          const item = organData[key];
          const isSelected = selectedOrgan === key;
          const Icon = item.icon;
          return (
            <button
              key={key}
              type="button"
              className={`organ-selector-pill ${isSelected ? 'active' : ''}`}
              style={{
                borderColor: isSelected ? item.color : undefined,
                background: isSelected ? item.bg : undefined,
                color: isSelected ? item.color : undefined,
              }}
              onClick={() => onSelectOrgan(key)}
            >
              <Icon size={13} />
              <span>{item.title.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
