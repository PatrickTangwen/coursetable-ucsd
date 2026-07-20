import chroma from 'chroma-js';
import type { ExtraInfo } from '../queries/graphql-types';
import type { Theme } from '../slices/ThemeSlice';

// Phrases for search speed [50 character limit]
export const searchSpeed = {
  fast: [
    'fast',
    'kinda fast',
    'not too slow',
    'loading the UCSD catalog',
    'not not not fast',
    'faster than opening another tab',
    'faster than schedule reshuffling',
    'quick enough for planning',
  ],
  faster: [
    'faster',
    'really fast',
    'blazing fast',
    'faster than a page refresh',
    'not not fast',
  ],
  fastest: [
    'fastest',
    'wicked fast',
    'faster than a section search',
    'faster than the speed of light',
    'faster than a prerequisite check',
    'faster than building a shortlist',
    'faster than comparing sections',
    'faster than finding an open study room',
    'faster than a coffee refill',
  ],
};

export const skillsAreas: {
  [type in 'areas' | 'skills']: { [code: string]: string };
} = {
  areas: {
    Hu: 'Humanities & Arts',
    So: 'Social Sciences',
    Sc: 'Sciences',
  },
  skills: {
    QR: 'Quantitative Reasoning',
    WR: 'Writing',
    L: 'All Language',
    ...Object.fromEntries(
      [1, 2, 3, 4, 5].map((i): [string, string] => [
        `L${i}`,
        `Language Level ${i}`,
      ]),
    ),
  },
};

export const skillsAreasColors: { [code: string]: string } = {
  Hu: '#9970AB',
  So: '#4393C3',
  Sc: '#5AAE61',
  QR: '#CC3311',
  WR: '#EC7014',
  L: '#000000',
  ...Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`L${i}`, '#888888'])),
};

export const ratingColormap = chroma
  .scale(['#f8696b', '#ffeb84', '#63b37b'])
  .domain([1, 5]);
export const workloadColormap = chroma
  .scale(['#f8696b', '#ffeb84', '#63b37b'])
  .domain([5, 1]);

export const credits = [0.5, 1, 1.5, 2];

// https://catalog.yale.edu/ycps/subject-abbreviations/
export const subjects: { [code: string]: string } = {
  ACCT: 'Accounting',
  ADSC: 'Administrative Sciences',
  AFAM: 'African American Studies',
  AFAS: 'African & African-Amer Studies',
  AFKN: 'Afrikaans',
  AFST: 'African Studies',
  AKKD: 'Akkadian',
  AMST: 'American Studies',
  AMTH: 'Applied Mathematics',
  ANES: 'Anesthesiology',
  ANTH: 'Anthropology',
  APHY: 'Applied Physics',
  ARBC: 'Arabic',
  ARCG: 'Archaeological Studies',
  ARCH: 'Architecture',
  ARMN: 'Armenian',
  ART: 'Art',
  ASL: 'American Sign Language',
  ASTR: 'Astronomy',
  'B&BS': 'Biological & Biomedical Sci',
  BENG: 'Biomedical Engineering',
  BIOL: 'Biology',
  BIS: 'Biostatistics',
  BME: 'Biomedical Engineering',
  BNGL: 'Bengali',
  BRST: 'British Studies',
  BURM: 'Burmese',
  'C&MP': 'Cell & Molecular Physiology',
  CAND: 'Prep for Adv to Candidacy',
  'CB&B': 'Comp Biol & Bioinfomatics',
  CBIO: 'Cell Biology',
  CDE: 'Chronic Disease Epidemiology',
  CENG: 'Chemical Engineering',
  CEU: 'Continuing Education Unit',
  CGSC: 'Cognitive Science',
  CHEM: 'Chemistry',
  CHER: 'Cherokee',
  CHLD: 'Child Study',
  CHNS: 'Chinese',
  CLCV: 'Classical Civilization',
  CLSS: 'Classics',
  CPAR: 'Computing and the Arts',
  CPLT: 'Comparative Literature',
  CPMD: 'Comparative Medicine',
  CPSC: 'Computer Science',
  CPTC: 'Coptic',
  CSBF: 'Coll Sem:Ben Franklin Coll',
  CSBK: 'Coll Sem:Berkeley Coll',
  CSBR: 'Coll Sem:Branford Coll',
  CSCC: 'Coll Sem:Calhoun Coll',
  CSDC: 'Coll Sem:Davenport Coll',
  CSEC: 'Computer Science and Economics',
  CSE: 'Computer Science and Engineering',
  CSES: 'Coll Sem:Ezra Stiles Coll',
  CSGH: 'Coll Sem:Grace Hopper Coll',
  CSJE: 'Coll Sem:Jonathan Edwards Coll',
  CSLI: 'Computing and Linguistics',
  CSMC: 'Coll Sem:Morse Coll',
  CSMY: 'Coll Sem:Pauli Murray Coll',
  CSPC: 'Coll Sem:Pierson Coll',
  CSSM: 'Coll Sem:Silliman Coll',
  CSSY: 'Coll Sem:Saybrook Coll',
  CSTC: 'Coll Sem:Trumbull Coll',
  CSTD: 'Coll Sem:Timothy Dwight Coll',
  CSYC: 'Coll Sem: Yale Coll',
  CTLN: 'Catalan',
  CZEC: 'Czech',
  DERM: 'Dermatology',
  DEVN: 'The DeVane Lecture Course',
  DIAG: 'Diagnostic Radiology',
  DIR: 'Directing',
  DISA: 'Diss Research',
  DISR: 'Diss Research',
  DRAM: 'Drama',
  DRMA: 'Drama Summer',
  DRST: 'Directed Studies',
  DUTC: 'Dutch',
  'E&EB': 'Ecology & Evolutionary Biology',
  'E&RS': 'European & Russian Studies',
  EALL: 'East Asian Lang and Lit',
  EAST: 'East Asian Studies',
  ECE: 'Electrical & Computer Eng',
  ECON: 'Economics',
  EDST: 'Education Studies',
  EEB: 'Ecology & Evolutionary Biology',
  EECS: 'Elec Eng & Comp Sci',
  EENG: 'Electrical Engineering',
  EGYP: 'Egyptology',
  EHS: 'Environmental Health Sciences',
  EID: 'Epidemiology Infectious Diseas',
  ELP: 'English Language Program',
  EMD: 'Epidemiology Microbial Disease',
  EMST: 'Early Modern Studies',
  ENAS: 'Engineering & Applied Science',
  ENGL: 'English',
  ENHS: 'Environmental Health Sciences',
  ENRG: 'Energy Studies',
  ENV: 'Environment',
  ENVE: 'Environmental Engineering',
  'EP&E': 'Ethics, Politics, & Economics',
  EPH: 'Epidemiology & Public Health',
  EPS: 'Earth and Planetary Sciences',
  'ER&M': 'Ethnicity, Race, & Migration',
  ESL: 'English as a Second Language',
  EVST: 'Environmental Studies',
  EXPA: 'Experimental Pathology',
  EXCH: 'Exchange Scholar Experience',
  'F&ES': 'Forestry & Environment Studies',
  FILM: 'Film & Media Studies',
  FNSH: 'Finnish',
  FREN: 'French',
  'G&G': 'Geology and Geophysics',
  GENE: 'Genetics',
  GHD: 'Global Health',
  GLBL: 'Global Affairs',
  GMAN: 'German',
  GMIC: 'Germanic',
  GMST: 'German Studies',
  GRAN: 'Gross Anatomy',
  GREK: 'Ancient Greek',
  GSAS: 'Graduate School',
  HAUS: 'Hausa',
  HEBR: 'Modern Hebrew',
  HELN: 'Hellenic Studies',
  HGRN: 'Hungarian',
  HIST: 'History',
  HLTH: 'Health Studies',
  'HM&S': 'History of Medicine & Science',
  HMRT: 'Human Rights',
  HNDI: 'Hindi',
  HPA: 'Health Policy Administration',
  HPM: 'Health Policy and Management',
  HPR: 'Health Policy Resources & Adm',
  HSAR: 'History of Art',
  HSCI: 'Health Science in Clinical Investigation',
  HSHM: 'Hist of Science, Hist of Med',
  HSMD: 'History of Medicine',
  HSPL: 'History & Politics',
  HUMS: 'Humanities',
  IBIO: 'Immunobiology',
  IDRS: 'Independent Research in the Summer',
  IHD: 'International Health',
  IMED: 'Investigative Medicine',
  IND: 'IndoEuropean',
  INDC: 'Indic',
  INDN: 'Indonesian',
  INMD: 'Internal Medicine',
  INP: 'Interdpt Neuroscience Pgm',
  INRL: 'International Relations',
  INTL: 'International',
  INTS: 'International Studies',
  IRAN: 'Iranian',
  IRES: 'Independent Research',
  ITAL: 'Italian',
  JAPN: 'Japanese',
  JDST: 'Judaic Studies',
  KHMR: 'Khmer',
  KREN: 'Korean',
  LAST: 'Latin American Studies',
  LATN: 'Latin',
  LAW: 'Law',
  LBMD: 'Laboratory Medicine',
  LING: 'Linguistics',
  LITR: 'Literature',
  LUCE: 'The Henry Luce Course',
  MATH: 'Mathematics',
  'MB&B': 'Molecular Biophysics & Biochem',
  MBIO: 'Microbiology',
  MCDB: 'Molecular, Cellular & Dev Biol',
  MD: 'MD Program',
  MDVL: 'Medieval Studies',
  MED: 'Master of Environmental Design',
  MEDC: 'Courses in School of Medicine',
  MEDR: 'Clinical Clerkships',
  MENG: 'Mechanical Engineering',
  MESO: 'Mesopotamia',
  MGMT: 'Management',
  MGRK: 'Modern Greek',
  MGT: 'School of Management',
  MHHR: 'Material Histories of the Human Record',
  MIC: 'Microbiology',
  MMES: 'Modern Middle East Studies',
  MRES: "Master's Thesis Research",
  MTBT: 'Modern Tibetan',
  MUS: 'School of Music',
  MUSI: 'Music Department',
  NAVY: 'Naval Science',
  NBIO: 'Neurobiology',
  NELC: 'Near Eastern Langs & Civs',
  NHTL: 'Nahuatl',
  NPLI: 'Nepali',
  NRLG: 'Neurology',
  NSCI: 'Neuroscience',
  NURS: 'Nursing',
  OBGN: 'Obstetrics/Gynecology',
  OBIO: 'Organismal Biology',
  OLPA: 'Online Physician Assistant Pgm',
  OPRH: 'Orthopaedics & Rehabilitation',
  OPRS: 'Operations Research',
  OPVS: 'Ophthalmology & Visual Science',
  ORMS: 'Operations Res/Mgmt Science',
  OTTM: 'Ottoman',
  PA: 'Physician Associate Program',
  PATH: 'Pathology',
  PEDT: 'Pediatrics',
  PERS: 'Persian',
  PHAR: 'Pharmacology',
  PHIL: 'Philosophy',
  PHUM: 'Public Humanities',
  PHYS: 'Physics',
  PIH: 'Program International Health',
  PLSC: 'Political Science',
  PLSH: 'Polish',
  PMAE: 'Personalized Medicine & Applied Engineering',
  PNJB: 'Punjabi',
  PORT: 'Portuguese',
  PPM: 'Public & Private Management',
  PRAC: 'Practicum Analysis',
  PSYC: 'Psychology',
  PSYT: 'Psychiatry',
  PTB: 'Program in Translational Biomedicine',
  QMSE: 'Quantum Materials Science and Engineering',
  QUAL: 'Preparing for Qualifying Exams',
  QUAN: 'Quantitative Reasoning',
  REL: 'Religion',
  RLST: 'Religious Studies',
  RNST: 'Renaissance Studies',
  ROMN: 'Romanian',
  RSEE: 'Russian & East Europe Studies',
  RUSS: 'Russian',
  'S&DS': 'Statistics and Data Science',
  SAST: 'South Asian Studies',
  SBCR: 'Serbian & Croatian',
  SBS: 'Social and Behavioral Sciences',
  SCAN: 'Scandinavian',
  SCIE: 'Science',
  SKRT: 'Sanskrit',
  SLAV: 'Slavic',
  SMTC: 'Semitic',
  SNHL: 'Sinhala',
  SOCY: 'Sociology',
  SPAN: 'Spanish',
  SPEC: 'Special Divisional Major',
  SPTC: 'Special Term Course',
  STAT: 'Statistics',
  STCY: 'Study of the City',
  STEV: 'Studies in the Environment',
  STRT: 'Start Program',
  SUMR: 'Summer Program',
  SURG: 'Surgery',
  SWAH: 'Kiswahili',
  SWED: 'Swedish',
  TAML: 'Tamil',
  TBTN: 'Tibetan',
  TDPS: 'Theater, Dance, and Performance Studies',
  THST: 'Theater Studies',
  TKSH: 'Turkish',
  TPRP: 'Teacher Preparation',
  TRAD: 'Therapeutic Radiology',
  TWI: 'Twi',
  UKRN: 'Ukrainian',
  URBN: 'Urban Studies',
  URDU: 'Heritage Urdu',
  USAF: 'Aerospace Studies',
  VAIR: 'Visiting Assistant in Research',
  VIET: 'Vietnamese',
  WGSS: "Women'sGender&SexualityStudies",
  WGST: "Women's & Gender Studies",
  WHIT: 'Whitney Seminar',
  WLOF: 'Wolof',
  WMST: "Women's Studies",
  YDSH: 'Yiddish',
  YORU: 'Yoruba',
  YPKU: 'PKU: Direct Enrollment',
  YSM: 'Yale School of Medicine',
  ZULU: 'Zulu',
};

export { default as courseInfoAttributes } from '../generated/infoAttributes.json';

// To get a list of abbreviations, run
// a `listings(distinct_on: [school])` GQL query
// School labels were filled in manually
export const schools: { [code: string]: string } = {
  YC: 'Yale College',
  AC: 'School of Architecture',
  AT: 'School of Fine Arts',
  GS: 'Graduate School of Arts and Sciences',
  DI: 'Divinity School',
  DR: 'School of Drama',
  FS: 'School of the Environment',
  GB: 'Jackson School of Global Affairs',
  LW: 'Law School',
  MD: 'School of Medicine',
  MG: 'School of Management',
  MU: 'School of Music',
  NR: 'School of Nursing',
  PA: 'Physician Associate Program',
  PH: 'School of Public Health',
  SU: 'Summer Session',
};

export const extraInfo: { [key in ExtraInfo]: string } = {
  ACTIVE: 'ACTIVE',
  MOVED_TO_SPRING_TERM: 'MOVED TO SPRING',
  CANCELLED: 'CANCELLED',
  MOVED_TO_FALL_TERM: 'MOVED TO FALL',
  CLOSED: 'CLOSED',
  NUMBER_CHANGED: 'NUMBER CHANGED',
};

// This is the preferred order in which they will be displayed
export const evalQuestionTags = [
  'Overall',
  'Workload',
  'Engagement',
  'Organization',
  'Feedback',
  'Intellectual challenge',
  'Summary',
  'Recommend',
  'Skills',
  'Strengths/weaknesses',
  'Available resources',
  'Major',
  'Professor',
];

// Each course hue has an intentional accent, soft surface, and readable text
// color. Presets use the exact trio; custom colors continue to derive these
// roles at the component boundary.
export const worksheetColorTokens = [
  {
    hue: 'Coral',
    solid: '#D96868',
    soft: '#FBEAEA',
    deep: '#8D3434',
    dark: {
      background: '#2C1C1F',
      hover: '#382226',
      border: '#704047',
      primary: '#D9787C',
      text: '#F0A5A8',
    },
  },
  {
    hue: 'Orange',
    solid: '#D98245',
    soft: '#FBEFE5',
    deep: '#8A4B20',
    dark: {
      background: '#2D211A',
      hover: '#39291F',
      border: '#755039',
      primary: '#D98A55',
      text: '#EDB083',
    },
  },
  {
    hue: 'Amber',
    solid: '#C79A30',
    soft: '#FAF3DD',
    deep: '#765913',
    dark: {
      background: '#2B2619',
      hover: '#37301D',
      border: '#6F602E',
      primary: '#C9A447',
      text: '#E4C976',
    },
  },
  {
    hue: 'Green',
    solid: '#62A168',
    soft: '#EAF5EB',
    deep: '#356B3B',
    dark: {
      background: '#1C281F',
      hover: '#223328',
      border: '#416A49',
      primary: '#6DAF74',
      text: '#9BD1A0',
    },
  },
  {
    hue: 'Teal',
    solid: '#3F9B91',
    soft: '#E3F4F1',
    deep: '#24675F',
    dark: {
      background: '#182927',
      hover: '#1E3431',
      border: '#376B65',
      primary: '#4EAAA0',
      text: '#82CEC6',
    },
  },
  {
    hue: 'Blue',
    solid: '#4E8BC8',
    soft: '#E8F1FA',
    deep: '#285D91',
    dark: {
      background: '#192532',
      hover: '#1E2F40',
      border: '#365E83',
      primary: '#6098D0',
      text: '#91BDE6',
    },
  },
  {
    hue: 'Indigo',
    solid: '#6C76C8',
    soft: '#ECEEFA',
    deep: '#414B91',
    dark: {
      background: '#202236',
      hover: '#282B44',
      border: '#505889',
      primary: '#7D87D4',
      text: '#ABB2EA',
    },
  },
  {
    hue: 'Purple',
    solid: '#9369BD',
    soft: '#F2EAF8',
    deep: '#604080',
    dark: {
      background: '#271F32',
      hover: '#32283F',
      border: '#654A7C',
      primary: '#A17AC5',
      text: '#C7A6E1',
    },
  },
  {
    hue: 'Rose',
    solid: '#C56892',
    soft: '#FAEAF1',
    deep: '#843E5F',
    dark: {
      background: '#301E29',
      hover: '#3C2633',
      border: '#79445D',
      primary: '#D0789E',
      text: '#E7A7C2',
    },
  },
] as const;

export type WorksheetHue = (typeof worksheetColorTokens)[number]['hue'];

export const worksheetColors = worksheetColorTokens.map((color) => color.solid);

// Courses saved before the named Hue palette retain their original hex. Map
// those historical presets at render time so Dark Mode can use the matching
// approved Hue without rewriting persisted worksheet data or changing their
// Light Mode appearance.
const legacyWorksheetColorHues: {
  [color: string]: WorksheetHue | undefined;
} = {
  '#31a4d4': 'Blue',
  '#3d95d6': 'Blue',
  '#df8653': 'Orange',
  '#26ba9a': 'Green',
  '#49be85': 'Green',
  '#6cc26f': 'Green',
  '#c765b0': 'Rose',
  '#daa126': 'Amber',
  '#7d7fd9': 'Indigo',
  '#ca5f53': 'Coral',
  '#2cafb7': 'Teal',
  '#a06fd0': 'Purple',
  '#a3b24b': 'Green',
  '#ba7881': 'Rose',
};

export function getWorksheetColorToken(color: string) {
  const normalizedColor = color.toLowerCase();
  return worksheetColorTokens.find(
    (preset) => preset.solid.toLowerCase() === normalizedColor,
  );
}

function getLegacyWorksheetColorToken(color: string) {
  const hue = legacyWorksheetColorHues[color.toLowerCase()];
  return hue
    ? worksheetColorTokens.find((preset) => preset.hue === hue)
    : undefined;
}

export type WorksheetColorAppearance = {
  background: string;
  hover: string;
  border: string;
  primary: string;
  text: string;
};

export function getWorksheetColorAppearance(
  color: string,
  theme: Theme,
): WorksheetColorAppearance {
  const preset = getWorksheetColorToken(color);
  if (theme === 'dark') {
    const darkPreset = preset ?? getLegacyWorksheetColorToken(color);
    if (darkPreset) return darkPreset.dark;
  }
  if (preset) {
    return {
      background: preset.soft,
      hover: preset.soft,
      border: preset.solid,
      primary: preset.solid,
      text: preset.deep,
    };
  }

  const base = chroma.valid(color) ? chroma(color) : chroma('#378add');
  if (theme === 'light') {
    const soft = chroma.mix(base, '#ffffff', 0.85).hex();
    return {
      background: soft,
      hover: soft,
      border: base.hex(),
      primary: base.hex(),
      text: base.darken(2).hex(),
    };
  }

  const primary = chroma.mix(base, '#ffffff', 0.18, 'lab');
  return {
    background: chroma.mix(primary, '#121212', 0.82, 'lab').hex(),
    hover: chroma.mix(primary, '#121212', 0.74, 'lab').hex(),
    border: chroma.mix(primary, '#121212', 0.46, 'lab').hex(),
    primary: primary.hex(),
    text: chroma.mix(primary, '#ffffff', 0.38, 'lab').hex(),
  };
}

export function getNextWorksheetColor(usedColors: readonly string[]) {
  const usage = new Map(
    worksheetColors.map((color) => [color.toLowerCase(), 0]),
  );
  for (const color of usedColors) {
    const normalizedColor = color.toLowerCase();
    const count = usage.get(normalizedColor);
    if (count !== undefined) usage.set(normalizedColor, count + 1);
  }

  return worksheetColors.reduce((nextColor, color) =>
    usage.get(color.toLowerCase())! < usage.get(nextColor.toLowerCase())!
      ? color
      : nextColor,
  );
}

export const barChartColors = [
  '#f54242',
  '#f5a142',
  '#f5f542',
  '#aeed1a',
  '#00e800',
];

// The days_of_week field on course_meetings is a bitmask where the ith bit
// (1 << i) represents whether the course meets on the ith day of the week.
// For example, if a course meets on Monday, Wednesday, and Friday, the value
// will be 2 + 8 + 32 = 42.
export const weekdays = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};
