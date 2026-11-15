export type ChallengeResource = {
  title: string;
  agency: string;
  url: string;
  summary: string;
  relevance: string[];
};

// The challenge's five resource links are explanatory research material, not
// telemetry datasets. Keep the links and the app's evidence mapping together.
export const challengeResources: ChallengeResource[] = [
  {
    title: '5 Hazards of Human Spaceflight',
    agency: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazards/',
    summary: 'NASA groups exploration hazards into radiation, isolation and confinement, distance from Earth, gravity fields, and hostile or closed environments.',
    relevance: ['Context for every health domain', 'Isolation and confinement → mood, stress, sleep check-ins', 'Gravity fields → muscle and body-mass trends', 'Closed environments → cabin and immune context'],
  },
  {
    title: 'Risks of Human Spaceflight',
    agency: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/risks/',
    summary: 'NASA describes health risks associated with human spaceflight and links to the research behind them.',
    relevance: ['Use alongside personal trends when reviewing cardiovascular, behavioral, immune, and musculoskeletal observations.', 'A personal-baseline change is a prompt for review, not a diagnosis.'],
  },
  {
    title: 'Ongoing HRP Research in Space',
    agency: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/',
    summary: 'Current NASA Human Research Program research activities related to astronaut health.',
    relevance: ['Research context for the indicators collected in ORBITCARE.', 'The app does not import individual research-study measurements from this overview page.'],
  },
  {
    title: 'Monitoring Radiation for Astronaut Health',
    agency: 'Canadian Space Agency',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
    summary: 'Canadian Space Agency overview of technologies and research used to measure astronaut radiation exposure and study its effects.',
    relevance: ['Radiation exposure is a mission-environment measure; it is distinct from a personal vital sign.', 'ORBITCARE has no connected dosimeter feed, so radiation values in the demo remain synthetic and must not be treated as actual exposure.'],
  },
  {
    title: 'Why Do We Conduct Science Experiments in Space?',
    agency: 'Canadian Space Agency',
    url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
    summary: 'How the space environment enables research that advances knowledge about human health, technology, and exploration.',
    relevance: ['Explains why spaceflight research informs future health monitoring.', 'Study results are not interchangeable with an individual crew member’s live measurements.'],
  },
];

export const challengeGuidance = [
  'Compare a crew member with their own recorded history; do not treat an Earth reference range as a spaceflight diagnosis.',
  'When a reading changes, confirm the measurement and review its timestamp, source, quality, symptoms, and recent context.',
  'For persistent or concerning changes, follow the mission medical protocol and contact the flight surgeon. ORBITCARE does not prescribe treatment or clear crew for flight.',
];
