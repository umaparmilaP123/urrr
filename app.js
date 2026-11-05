/**
 * AwaazSafe — app.js
 * Main application script.
 * Sections:
 *  1.  i18n (English / Telugu labels)
 *  2.  Sample data
 *  3.  Storage helpers (localStorage)
 *  4.  Router (hash-based page switching)
 *  5.  MicController (Web Speech API + MediaRecorder for audio hashing)
 *  6.  GeminiService (AI structuring)
 *  7.  EvidenceSecurityUI (SHA-256, EXIF strip, C2PA badge rendering)
 *  8.  FakeEvidenceWarning modal
 *  9.  TranscriptPage
 * 10.  ReceiptPage (case key, vault)
 * 11.  Toast / Modal utilities
 * 12.  Init
 */

'use strict';

/* ═════════════════════════════════════════════════════════
   1. i18n — English / Telugu label map
════════════════════════════════════════════════════════ */
const TRANSLATIONS = {
  en: {
    nav_home:            'Home',
    nav_transcript:      'Report',
    nav_vault:           'Vault',
    nav_about:           'About',
    badge_text:          'Zero-Knowledge Anonymous • No Login Required',
    hero_headline:       'Report campus ragging and harassment in your own voice—100% anonymous, direct to external authorities.',
    hero_sub:            'AwaazSafe bypasses biased college gatekeepers to route complaints straight to external authorities. Speak. Submit. Stay safe.',
    stat1:               'Cybercrime cases in India (NCRB 2024)',
    stat2:               'SOS requests in Vizag alone',
    stat3:               'Cyber threats fastest-growing crime category',
    mic_instruction:     'Press the mic, speak your incident in Telugu or English, then get your secure tracking key.',
    mic_start:           'Tap to Speak',
    mic_recording:       'Recording…',
    mic_stop:            'Tap to Stop',
    transcript_placeholder: 'Your words will appear here as you speak…',
    btn_analyse:         'Analyse with AI →',
    btn_retry:           'Try Again',
    guarantee1:          'No name, no ID collected',
    guarantee2:          'Routed to external authorities only',
    guarantee3:          'Zero server storage',
    transcript_title:    'Review Your Report',
    transcript_sub:      'Your words, structured into a legal complaint. All identity markers can be removed.',
    raw_title:           'Your Words',
    raw_badge:           'Raw Transcript',
    raw_empty:           'No transcript yet. Go back and record your incident.',
    redact_title:        'Identity Redaction',
    redact_name:         'Remove my name if mentioned',
    redact_phone:        'Remove phone/ID numbers',
    redact_dept:         'Generalise department/batch',
    evidence_title:      'Attach Evidence',
    evidence_btn:        'Screenshots or Photos',
    evidence_hint:       'Max 3 files, 5 MB each',
    ai_title:            'AI Legal Summary',
    ai_badge:            'Powered by Gemini',
    ai_loading:          'Analysing your narrative…',
    ai_error:            'AI analysis failed. Please try again.',
    ai_empty:            'AI analysis will appear here after recording.',
    api_key_label:       '🔑 Gemini API Key',
    btn_save_key:        'Save',
    api_key_hint:        'Key is saved to your browser only. Never sent anywhere except Google\'s API.',
    btn_re_record:       '← Re-record',
    btn_submit_report:   'Submit Report →',
    receipt_title:       'Your Case is Logged',
    receipt_sub:         'Keep your case recovery key safe. It\'s the only way to track your report.',
    key_title:           'Case Recovery Key',
    btn_copy_key:        '📋 Copy Key',
    key_warning:         '⚠️ This key is not stored anywhere on our servers. Write it down or screenshot it.',
    authority_label:     'Routed to External Authority',
    status_received:     'Complaint Received',
    tracker_label:       '🔒 Encrypted Status Tracker:',
    stat_weekly:         'Weekly reports submitted',
    stat_voice:          'Voice transcription success',
    stat_ack:            'Authority acknowledgement',
    records_title:       'Case Vault',
    btn_clear:           '🗑 Clear My Data',
    records_empty:       'No reports yet. Your submissions will appear here.',
    col_location:        'Location',
    col_category:        'Category',
    col_authority:       'Authority',
    col_severity:        'Severity',
    col_type:            'Type',
    btn_new_report:      '+ New Report',
    about_badge:         'Student-built · Visakhapatnam · 2026',
    about_headline:      'Why AwaazSafe Exists',
    about_pitch:         'AwaazSafe is an anonymous voice-to-text reporting portal for Vizag students that bypasses biased college gatekeepers to route complaints straight to external authorities.',
    problem_title:       'The Problem',
    problem_desc:        'Students in Visakhapatnam colleges facing online abuse and ragging lack a confidential reporting channel. Fear of biased internal committees forces them into silence.',
    diff_title:          'What Makes Us Different',
    diff1:               '🔒 Zero-knowledge anonymity — no account, no personal data, no server logs',
    diff2:               '🎙️ Voice-to-text in Telugu & English — no typing required',
    diff3:               '🏛️ Direct routing to external authorities — UGC, AP Police, NCW, Vizag Cyber Cell',
    diff4:               '📱 Works on any phone browser — no app download needed',
    how_title:           'How It Works',
    how1:                'Student presses mic, speaks the incident in Telugu or English',
    how2:                'Gemini AI structures the speech into a formal legal complaint',
    how3:                'Student reviews, removes identity markers, and optionally attaches evidence',
    how4:                'Report is routed to the correct external authority — not the college admin',
    how5:                'Student gets a 16-character encrypted case key to track the complaint',
    team_title:          'Our Team',
    team_intro:          'A student team of 5 from Visakhapatnam, building safety tools for their peers.',
    team1_name:          'Priya Sharma',   team1_role: 'Product & UX',
    team2_name:          'Arjun Reddy',    team2_role: 'AI & Backend',
    team3_name:          'Kavitha Nair',   team3_role: 'Legal & Compliance',
    team4_name:          'Ravi Teja',      team4_role: 'Outreach & Ops',
    team5_name:          'Swathi Devi',    team5_role: 'Research & Data',
    cta_report:          '🎙️ Report an Incident Now',
    confirm_title:       'Clear all data?',
    confirm_desc:        'This will permanently delete all locally saved reports and settings. This cannot be undone.',
    confirm_cancel:      'Cancel',
    confirm_ok:          'Yes, Clear All',
  },
  te: {
    nav_home:            'హోమ్',
    nav_transcript:      'రిపోర్ట్',
    nav_vault:           'వాల్ట్',
    nav_about:           'గురించి',
    badge_text:          'జీరో-నాలెడ్జ్ అనానిమస్ • లాగిన్ అవసరం లేదు',
    hero_headline:       'మీ స్వంత గొంతుతో క్యాంపస్ రాగింగ్ మరియు వేధింపులను నివేదించండి—100% అనానిమస్.',
    hero_sub:            'AwaazSafe కళాశాల గేట్‌కీపర్‌లను దాటి నేరుగా బాహ్య అధికారులకు ఫిర్యాదులు పంపిస్తుంది.',
    stat1:               'భారతదేశంలో సైబర్ నేరాలు (NCRB 2024)',
    stat2:               'విజాగ్‌లో SOS అభ్యర్థనలు',
    stat3:               'సైబర్ బెదిరింపులు వేగంగా పెరుగుతున్న నేర వర్గం',
    mic_instruction:     'మైక్ నొక్కండి, తెలుగు లేదా ఇంగ్లీష్‌లో మాట్లాడండి, సురక్షిత ట్రాకింగ్ కీ పొందండి.',
    mic_start:           'మాట్లాడటానికి నొక్కండి',
    mic_recording:       'రికార్డ్ అవుతోంది…',
    mic_stop:            'ఆపడానికి నొక్కండి',
    transcript_placeholder: 'మీరు మాట్లాడినప్పుడు మీ మాటలు ఇక్కడ కనిపిస్తాయి…',
    btn_analyse:         'AI తో విశ్లేషించండి →',
    btn_retry:           'మళ్ళీ ప్రయత్నించండి',
    guarantee1:          'పేరు, ID సేకరించబడదు',
    guarantee2:          'బాహ్య అధికారులకు మాత్రమే పంపించబడుతుంది',
    guarantee3:          'సర్వర్ నిల్వ శూన్యం',
    transcript_title:    'మీ నివేదికను సమీక్షించండి',
    transcript_sub:      'మీ మాటలు చట్టపరమైన ఫిర్యాదుగా నిర్మించబడ్డాయి.',
    raw_title:           'మీ మాటలు',
    raw_badge:           'ముడి ట్రాన్స్క్రిప్ట్',
    raw_empty:           'ట్రాన్స్క్రిప్ట్ లేదు. వెనక్కి వెళ్ళి రికార్డ్ చేయండి.',
    redact_title:        'గుర్తింపు తొలగింపు',
    redact_name:         'పేరు ప్రస్తావించబడితే తొలగించండి',
    redact_phone:        'ఫోన్/ID నంబర్లు తొలగించండి',
    redact_dept:         'విభాగం/బ్యాచ్ సాధారణీకరించండి',
    evidence_title:      'ఆధారాలు జోడించండి',
    evidence_btn:        'స్క్రీన్‌షాట్లు లేదా ఫోటోలు',
    evidence_hint:       'గరిష్టంగా 3 ఫైళ్ళు, ప్రతి 5 MB',
    ai_title:            'AI చట్టపరమైన సారాంశం',
    ai_badge:            'Gemini ద్వారా',
    ai_loading:          'మీ కథనాన్ని విశ్లేషిస్తోంది…',
    ai_error:            'AI విశ్లేషణ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.',
    ai_empty:            'రికార్డ్ చేసిన తర్వాత AI విశ్లేషణ ఇక్కడ కనిపిస్తుంది.',
    api_key_label:       '🔑 Gemini API కీ',
    btn_save_key:        'సేవ్ చేయండి',
    api_key_hint:        'కీ మీ బ్రౌజర్‌లో మాత్రమే సేవ్ అవుతుంది.',
    btn_re_record:       '← మళ్ళీ రికార్డ్ చేయండి',
    btn_submit_report:   'నివేదిక సమర్పించండి →',
    receipt_title:       'మీ కేసు నమోదు చేయబడింది',
    receipt_sub:         'మీ కేసు రికవరీ కీ సురక్షితంగా ఉంచుకోండి.',
    key_title:           'కేసు రికవరీ కీ',
    btn_copy_key:        '📋 కీ కాపీ చేయండి',
    key_warning:         '⚠️ ఈ కీ మా సర్వర్లలో నిల్వ చేయబడదు. వ్రాసుకోండి లేదా స్క్రీన్‌షాట్ తీసుకోండి.',
    authority_label:     'బాహ్య అధికారులకు పంపించబడింది',
    status_received:     'ఫిర్యాదు అందుకోబడింది',
    tracker_label:       '🔒 ఎన్‌క్రిప్టెడ్ స్టేటస్ ట్రాకర్:',
    stat_weekly:         'వారంలో నివేదికలు సమర్పించబడ్డాయి',
    stat_voice:          'వాయిస్ ట్రాన్స్క్రిప్షన్ విజయం',
    stat_ack:            'అధికారుల అంగీకార రేటు',
    records_title:       'కేసు వాల్ట్',
    btn_clear:           '🗑 నా డేటా తొలగించండి',
    records_empty:       'ఇంకా నివేదికలు లేవు. మీ సమర్పణలు ఇక్కడ కనిపిస్తాయి.',
    col_location:        'స్థానం',
    col_category:        'వర్గం',
    col_authority:       'అధికారి',
    col_severity:        'తీవ్రత',
    col_type:            'రకం',
    btn_new_report:      '+ కొత్త నివేదిక',
    about_badge:         'విద్యార్థులచే నిర్మించబడింది · విశాఖపట్నం · 2026',
    about_headline:      'AwaazSafe ఎందుకు ఉంది',
    about_pitch:         'AwaazSafe విజాగ్ విద్యార్థులకు అనానిమస్ వాయిస్-టు-టెక్స్ట్ రిపోర్టింగ్ పోర్టల్.',
    problem_title:       'సమస్య',
    problem_desc:        'విశాఖపట్నం కళాశాలలలో విద్యార్థులకు గోప్య నివేదన మార్గం లేదు.',
    diff_title:          'మనం ఎందుకు వేరుగా ఉన్నాం',
    diff1:               '🔒 జీరో-నాలెడ్జ్ అనానిమిటీ',
    diff2:               '🎙️ తెలుగు & ఇంగ్లీష్‌లో వాయిస్-టు-టెక్స్ట్',
    diff3:               '🏛️ నేరుగా బాహ్య అధికారులకు',
    diff4:               '📱 ఏ ఫోన్ బ్రౌజర్‌లోనైనా పని చేస్తుంది',
    how_title:           'ఇది ఎలా పని చేస్తుంది',
    how1:                'విద్యార్థి మైక్ నొక్కి తెలుగు లేదా ఇంగ్లీష్‌లో సంఘటనను వివరిస్తారు',
    how2:                'Gemini AI అది చట్టపరమైన ఫిర్యాదుగా నిర్మిస్తుంది',
    how3:                'విద్యార్థి సమీక్షిస్తారు, గుర్తింపు మార్కర్లను తొలగిస్తారు',
    how4:                'నివేదిక సరైన బాహ్య అధికారికి పంపబడుతుంది',
    how5:                'విద్యార్థి 16-అక్షరాల ఎన్‌క్రిప్టెడ్ కేసు కీ పొందుతారు',
    team_title:          'మా బృందం',
    team_intro:          'విశాఖపట్నం నుండి 5 మంది విద్యార్థుల బృందం.',
    team1_name:          'ప్రియ శర్మ',    team1_role: 'ప్రొడక్ట్ & UX',
    team2_name:          'అర్జున్ రెడ్డి', team2_role: 'AI & బ్యాక్‌ఎండ్',
    team3_name:          'కవిత నాయర్',   team3_role: 'చట్టపరమైన & సమ్మతి',
    team4_name:          'రవి తేజ',      team4_role: 'అవుట్‌రీచ్ & ఆప్స్',
    team5_name:          'స్వాతి దేవి',   team5_role: 'పరిశోధన & డేటా',
    cta_report:          '🎙️ ఇప్పుడే సంఘటన నివేదించండి',
    confirm_title:       'అన్ని డేటా తొలగించాలా?',
    confirm_desc:        'ఇది స్థానికంగా సేవ్ చేసిన అన్ని నివేదికలు మరియు సెట్టింగులను శాశ్వతంగా తొలగిస్తుంది.',
    confirm_cancel:      'రద్దు',
    confirm_ok:          'అవును, అన్నీ తొలగించండి',
  }
};

/* ═════════════════════════════════════════════════════════
   2. Sample Pre-loaded Records
════════════════════════════════════════════════════════ */
const SAMPLE_RECORDS = [
  { location: 'AU College of Engineering, Hostel Block 1', category: 'Ragging & Threat',      authority: 'UGC Anti-Ragging Cell',              severity: 'High',     isSample: true },
  { location: 'GITAM University, Science Block',           category: 'Verbal Harassment',     authority: 'District Legal Services Authority',  severity: 'Medium',   isSample: true },
  { location: 'Vignan Institute of IT, Canteen Area',      category: 'Physical Intimidation',  authority: 'AP Women Commission',                severity: 'High',     isSample: true },
  { location: 'Gayatri Vidya Parishad College, Bus Stop',  category: 'Cyber Bullying',         authority: 'Vizag Cyber Crime Cell',             severity: 'Medium',   isSample: true },
  { location: 'ANITS, Boys Hostel Block 2',                category: 'Extortion & Ragging',   authority: 'UGC Anti-Ragging Cell',              severity: 'Critical', isSample: true },
  { location: 'Raghu Engineering College, Sports Ground',  category: 'Physical Assault',       authority: 'District Collectorate Safety Cell',  severity: 'Critical', isSample: true },
  { location: 'MVGR College of Engineering, Main Gate',    category: 'Stalking',              authority: 'AP Police Shakti Helpline',          severity: 'High',     isSample: true },
  { location: 'Centurion University, Library Corridor',    category: 'Sexual Harassment',      authority: 'National Commission for Women',      severity: 'Critical', isSample: true },
  { location: 'Bullayya College, Parking Area',            category: 'Cyber Threats',          authority: 'Vizag Cyber Crime Cell',             severity: 'Medium',   isSample: true },
  { location: 'Prism Degree College, Common Room',         category: 'Extortion',             authority: 'District Legal Services Authority',  severity: 'High',     isSample: true },
];

/* Authority routing map — category → external authority */
const AUTHORITY_MAP = {
  'Ragging & Physical Abuse': 'UGC Anti-Ragging Cell',
  'Verbal Harassment':        'District Legal Services Authority',
  'Cyber Bullying':           'Vizag Cyber Crime Cell',
  'Sexual Harassment':        'National Commission for Women',
  'Extortion & Ragging':      'UGC Anti-Ragging Cell',
  'Stalking':                 'AP Police Shakti Helpline',
  'Physical Intimidation':    'AP Women Commission',
  'Physical Assault':         'District Collectorate Safety Cell',
  'Cyber Threats':            'Vizag Cyber Crime Cell',
  'Other':                    'District Legal Services Authority',
};

/* ═════════════════════════════════════════════════════════
   3. Storage Helpers
════════════════════════════════════════════════════════ */
const Storage = {
  REPORTS_KEY: 'awaaz_reports',
  APP_KEY:     'awaaz_app',

  /** Load all reports (sample + user) */
  getReports() {
    try {
      const raw = localStorage.getItem(this.REPORTS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  /** Seed sample records if first visit */
  seedIfEmpty() {
    if (this.getReports() !== null) return;
    const seeded = SAMPLE_RECORDS.map((r, i) => ({
      id:          'SAMPLE-' + String(i).padStart(3, '0'),
      caseKey:     generateCaseKey(),
      timestamp:   new Date(Date.now() - (i * 86400000)).toISOString(),
      rawTranscript: '',
      structured:  { category: r.category, location: r.location, timestamp: 'Sample', summary: 'Sample record.', severity: r.severity },
      authority:   r.authority,
      evidenceFiles: [],
      isSample:    true,
    }));
    localStorage.setItem(this.REPORTS_KEY, JSON.stringify(seeded));
  },

  /** Add a new user report */
  addReport(report) {
    const all = this.getReports() || [];
    all.unshift(report);
    localStorage.setItem(this.REPORTS_KEY, JSON.stringify(all));
  },

  /** Load app settings */
  getApp() {
    try {
      const raw = localStorage.getItem(this.APP_KEY);
      return raw ? JSON.parse(raw) : { language: 'en', totalReports: 10, voiceSuccessRate: 94, authorityAckRate: 87 };
    } catch {
      return { language: 'en', totalReports: 10, voiceSuccessRate: 94, authorityAckRate: 87 };
    }
  },

  /** Save app settings */
  saveApp(data) {
    localStorage.setItem(this.APP_KEY, JSON.stringify(data));
  },

  /** Increment report count */
  incrementReports() {
    const app = this.getApp();
    app.totalReports = (app.totalReports || 0) + 1;
    this.saveApp(app);
  },

  /** Wipe everything */
  clearAll() {
    localStorage.removeItem(this.REPORTS_KEY);
    localStorage.removeItem(this.APP_KEY);
    localStorage.removeItem('awaaz_gemini_key');
  },

  /** Save/load Gemini API key */
  saveGeminiKey(key) { localStorage.setItem('awaaz_gemini_key', key); },
  getGeminiKey()     { return localStorage.getItem('awaaz_gemini_key') || ''; },
};

/* ═════════════════════════════════════════════════════════
   4. Crypto helpers
════════════════════════════════════════════════════════ */
/** Generate a random 16-character alphanumeric case key */
function generateCaseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

/* ═════════════════════════════════════════════════════════
   5. i18n Engine
════════════════════════════════════════════════════════ */
let currentLang = 'en';

function applyLang(lang) {
  currentLang = lang;
  const t = TRANSLATIONS[lang];
  document.documentElement.setAttribute('data-lang', lang);

  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) {
      // For buttons with icons that have inner structure, only update if simple text
      if (el.tagName === 'BUTTON' || el.tagName === 'P' || el.tagName === 'SPAN' || el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4' || el.tagName === 'LI' || el.tagName === 'A') {
        // Some elements have sub-HTML; only replace text if key matches
        el.textContent = t[key];
      }
    }
  });

  // Special: hero headline can have strong tags
  const headline = document.querySelector('[data-i18n="hero_headline"]');
  if (headline) headline.textContent = t.hero_headline;

  // Update mic button label
  const micLabel = document.getElementById('micBtnLabel');
  if (micLabel && !MicController.isRecording) micLabel.textContent = t.mic_start;

  // Lang toggle label
  document.getElementById('langLabel').textContent = lang === 'en' ? 'తెలుగు' : 'English';

  // Save preference
  const app = Storage.getApp();
  app.language = lang;
  Storage.saveApp(app);
}

function t(key) {
  return (TRANSLATIONS[currentLang] || TRANSLATIONS.en)[key] || key;
}

/* ═════════════════════════════════════════════════════════
   6. Router — hash-based page switching
════════════════════════════════════════════════════════ */
const PAGES = ['home', 'transcript', 'receipt', 'about'];

function goTo(page) {
  if (!PAGES.includes(page)) page = 'home';

  // Hide all pages, show target
  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.toggle('active', p === page);
  });

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-page') === page);
  });

  // Run page-specific setup
  if (page === 'receipt') ReceiptPage.render();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.location.hash = page;
}

function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'home';
  const page = PAGES.includes(hash) ? hash : 'home';
  goTo(page);
}

/* ═════════════════════════════════════════════════════════
   5. MicController — Web Speech API + MediaRecorder
   Two APIs run in parallel during recording:
     SpeechRecognition → live text transcript
     MediaRecorder      → audio blob for SHA-256 hashing
════════════════════════════════════════════════════════ */
const MicController = {
  recognition:   null,
  mediaRecorder: null,   /* Records raw audio for hashing */
  audioChunks:   [],     /* Collects audio Blob chunks from MediaRecorder */
  audioBlob:     null,   /* Final audio Blob after recording stops */
  voiceHash:     null,   /* SHA-256 hex of the voice recording */
  isRecording:   false,
  transcript:    '',
  recLang:       'en-IN',

  /** Initialize Web Speech API recognition */
  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.showUnsupported();
      return false;
    }
    this.SR = SR;
    return true;
  },

  /** Show browser-unsupported error */
  showUnsupported() {
    const err = document.getElementById('micError');
    const msg = document.getElementById('micErrorMsg');
    if (err && msg) {
      msg.textContent = 'Voice recording is not supported in this browser. Please use Chrome or Edge.';
      err.hidden = false;
    }
    const btn = document.getElementById('micBtn');
    if (btn) btn.disabled = true;
  },

  /** Toggle recording on/off */
  toggle() {
    if (this.isRecording) this.stop();
    else                   this.start();
  },

  /** Start listening — SpeechRecognition + MediaRecorder in parallel */
  async start() {
    /* Clear previous errors */
    const errEl = document.getElementById('micError');
    if (errEl) errEl.hidden = true;

    /* Hide any previous voice hash */
    const hashPanel = document.getElementById('voiceHashPanel');
    if (hashPanel) hashPanel.hidden = true;

    /* Reset audio capture state */
    this.audioChunks = [];
    this.audioBlob   = null;
    this.voiceHash   = null;

    /* ── MediaRecorder: capture raw audio for hashing ── */
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        /*
         * IMPORTANT: on some browsers (Chrome/Edge), ondataavailable fires
         * AFTER onstop. We use a small setTimeout(0) to yield to the event
         * loop so all pending ondataavailable callbacks flush before we
         * assemble the blob — otherwise audioChunks may be empty.
         */
        await new Promise(resolve => setTimeout(resolve, 0));

        /* Assemble audio blob from all collected chunks */
        this.audioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder.mimeType || 'audio/webm'
        });
        /* Release microphone tracks */
        stream.getTracks().forEach(t => t.stop());
        /* Hash the voice recording via security.js */
        await this._hashVoice();
      };

      /*
       * timeslice = 250 ms — collect chunks every 250 ms instead of 1000 ms.
       * This ensures at least one chunk arrives even for very short recordings
       * (< 1 s), and the final requestData() call in stop() captures the tail.
       */
      this.mediaRecorder.start(250);
    } catch (e) {
      /* MediaRecorder failure is non-fatal — STT still works */
      console.warn('[MicController] MediaRecorder unavailable:', e.message);
    }

    /* ── SpeechRecognition: live text transcript ── */
    this.recognition = new this.SR();
    this.recognition.continuous      = true;
    this.recognition.interimResults   = true;
    this.recognition.lang             = this.recLang;
    this.recognition.maxAlternatives  = 1;

    this.recognition.onresult = e => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript;
        if (e.results[i].isFinal) final   += piece + ' ';
        else                        interim += piece;
      }
      if (final) this.transcript += final;
      this.updateDisplay(this.transcript + interim);
    };

    this.recognition.onerror = e => {
      let msg = 'Microphone error. ';
      if (e.error === 'not-allowed')   msg = 'Microphone access denied. Please allow microphone permission and try again.';
      if (e.error === 'no-speech')     msg = 'No speech detected. Please try again.';
      if (e.error === 'network')       msg = 'Network error. Please check your connection.';
      if (e.error === 'audio-capture') msg = 'No microphone found. Please connect a microphone.';
      this.showError(msg);
      this.reset();
    };

    this.recognition.onend = () => {
      /* Auto-restart if still supposed to be recording (browser cuts off at ~60s) */
      if (this.isRecording) {
        try { this.recognition.start(); } catch(e) { this.stop(); }
      }
    };

    try {
      this.recognition.start();
      this.isRecording = true;
      this.updateUI();
    } catch(e) {
      this.showError('Could not start recording. Please try again.');
    }
  },

  /** Stop listening — triggers MediaRecorder.onstop → voice hash */
  stop() {
    this.isRecording = false;

    if (this.recognition) {
      try { this.recognition.stop(); } catch(e) {}
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      /* requestData() forces the browser to flush the current audio chunk
         immediately — prevents an empty blob on short recordings */
      this.mediaRecorder.requestData();
      this.mediaRecorder.stop(); /* fires onstop → _hashVoice() */
    }

    this.updateUI();

    const submitBtn = document.getElementById('submitTranscript');
    if (submitBtn) submitBtn.disabled = !this.transcript.trim();
  },

  /**
   * Hash the captured voice blob using window.AwaazSecurity.computeAudioHash().
   * Called automatically from MediaRecorder.onstop (and by the "Try Again" button).
   *
   * State machine:
   *   "Computing..." → "Success"  (64-char hex displayed)
   *   "Computing..." → "Failed"   (error message + "Try Again" button wired)
   */
  async _hashVoice() {
    const panel    = document.getElementById('voiceHashPanel');
    const hashEl   = document.getElementById('voiceHashValue');
    const statusEl = document.getElementById('voiceHashStatus');
    if (!panel) return;

    /* ── State: Computing ─────────────────────────────────────── */
    panel.hidden = false;
    if (hashEl)   hashEl.textContent = '—';
    if (statusEl) statusEl.innerHTML = '<span aria-hidden="true">⏳</span> Computing…';

    try {
      /* Validate blob before calling crypto */
      if (!this.audioBlob || this.audioBlob.size === 0) {
        throw new Error('No voice data captured. Please try again.');
      }
      if (!window.AwaazSecurity?.computeAudioHash) {
        throw new Error('Security module not loaded.');
      }

      /* Compute tamper-evident SHA-256 fingerprint */
      const sha256Hash   = await window.AwaazSecurity.computeAudioHash(this.audioBlob);
      this.voiceHash     = sha256Hash;

      /* ── State: Success ───────────────────────────────────── */
      if (hashEl)   hashEl.textContent = sha256Hash;
      if (statusEl) statusEl.innerHTML =
        `<span aria-hidden="true">✅</span> Hash computed — `
        + `${(this.audioBlob.size / 1024).toFixed(1)} KB fingerprinted.`;

    } catch (err) {
      console.error('[MicController] SHA-256 Computation Error:', err);
      this.voiceHash = null;

      /* ── State: Failed — show error + "Try Again" button ─── */
      if (hashEl)   hashEl.textContent = '—';
      if (statusEl) statusEl.innerHTML =
        `<span aria-hidden="true">⚠️</span> `
        + `Failed to compute tamper-evident hash. `
        + `<button class="btn-retry" id="voiceHashRetry">Try Again</button>`;

      /* Wire retry: clicking re-runs _hashVoice() on the same blob */
      const retryBtn = document.getElementById('voiceHashRetry');
      if (retryBtn) retryBtn.addEventListener('click', () => this._hashVoice(), { once: true });
    }
  },

  /** Reset everything */
  reset() {
    this.isRecording   = false;
    this.transcript    = '';
    this.audioChunks   = [];
    this.audioBlob     = null;
    this.voiceHash     = null;

    if (this.recognition) {
      try { this.recognition.stop(); } catch(e) {}
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try { this.mediaRecorder.stop(); } catch(e) {}
      this.mediaRecorder = null;
    }

    /* Hide voice hash panel */
    const panel = document.getElementById('voiceHashPanel');
    if (panel) panel.hidden = true;

    this.updateDisplay('');
    this.updateUI();

    const submitBtn = document.getElementById('submitTranscript');
    if (submitBtn) submitBtn.disabled = true;
  },

  /** Update live transcript display */
  updateDisplay(text) {
    const placeholder = document.getElementById('transcriptPlaceholder');
    const textEl      = document.getElementById('transcriptText');
    if (!placeholder || !textEl) return;
    if (text.trim()) {
      placeholder.style.display = 'none';
      textEl.textContent = text;
    } else {
      placeholder.style.display = '';
      textEl.textContent = '';
    }
  },

  /** Update mic button UI state */
  updateUI() {
    const btn   = document.getElementById('micBtn');
    const label = document.getElementById('micBtnLabel');
    if (!btn || !label) return;

    if (this.isRecording) {
      btn.classList.add('recording');
      btn.setAttribute('aria-label', 'Stop voice recording');
      label.textContent = t('mic_stop');
    } else {
      btn.classList.remove('recording');
      btn.setAttribute('aria-label', 'Start voice recording');
      label.textContent = t('mic_start');
    }
  },

  /** Show mic error */
  showError(msg) {
    const err   = document.getElementById('micError');
    const msgEl = document.getElementById('micErrorMsg');
    if (err && msgEl) { msgEl.textContent = msg; err.hidden = false; }
  },
};

/* Global reset mic helper (called from inline onclick) */
function resetMic() {
  MicController.reset();
  document.getElementById('micError').hidden = true;
}

/* ═════════════════════════════════════════════════════════
   7. EvidenceSecurityUI
   Processes each uploaded file through the security pipeline
   (security.js) and renders a per-file card showing:
     • C2PA trust badge
     • SHA-256 hash
     • Stripped EXIF fields
     • C2PA / AI detection summary
   Also stores processed hashes for the Case Vault receipt.
════════════════════════════════════════════════════════ */
const EvidenceSecurityUI = {
  /* Processed results keyed by file name — shared with ReceiptPage */
  results: [],

  /**
   * Process all uploaded files through the security pipeline and
   * render a card per file. Triggers FakeEvidenceWarning if needed.
   *
   * @param {FileList|File[]} files
   */
  async processFiles(files) {
    const list = Array.from(files).slice(0, 3);
    const container = document.getElementById('evidenceSecurityList');
    if (!container) return;

    /* Reset previous results */
    this.results = [];
    container.innerHTML = '';

    if (!list.length) return;

    /* Check security.js is available */
    if (!window.AwaazSecurity) {
      container.innerHTML =
        `<div class="evidence-sec-error">
           <span>⚠️</span> Security module not loaded. File hashing unavailable.
         </div>`;
      return;
    }

    for (const file of list) {
      /* Create a placeholder card in loading state */
      const card = document.createElement('div');
      card.className = 'evidence-sec-card';
      card.innerHTML = `
        <div class="ev-sec-filename">
          <span class="ev-sec-name">${escHtml(file.name)}</span>
        </div>
        <div class="evidence-sec-loading">
          <div class="spinner" aria-hidden="true"></div>
          <span>Scanning for metadata and verifying integrity…</span>
        </div>`;
      container.appendChild(card);

      try {
        /* Run the full pipeline: sanitize → hash → C2PA scan */
        const result = await window.AwaazSecurity.processEvidenceFile(file);
        this.results.push(result);

        /* Render the completed security card */
        card.innerHTML = this._renderCard(result);

        /* If AI-generated or heavily edited — show blocking warning */
        if (result.c2pa.isAIGenerated ||
            (result.c2pa.hasBeenEdited && !result.c2pa.hasManifest)) {
          FakeEvidenceWarning.show(result);
        }

      } catch (err) {
        /* Per-file error — don't block the whole form */
        card.innerHTML = `
          <div class="ev-sec-filename">
            <span class="ev-sec-name">${escHtml(file.name)}</span>
            <span class="c2pa-badge c2pa-badge--unknown">Error</span>
          </div>
          <div class="evidence-sec-error">
            <span aria-hidden="true">⚠️</span>
            ${escHtml(err.message)}
          </div>`;
      }
    }
  },

  /**
   * Build the HTML for one processed evidence security card.
   * @param {EvidenceResult} r
   * @returns {string} HTML string
   */
  _renderCard(r) {
    /* C2PA badge */
    const badgeClass = {
      VERIFIED: 'c2pa-badge--verified',
      WARNING:  'c2pa-badge--warning',
      UNKNOWN:  'c2pa-badge--unknown',
    }[r.c2pa.trustLevel] || 'c2pa-badge--unknown';

    const badgeLabel = {
      VERIFIED: '✅ Credentials Verified',
      WARNING:  '⚠️ AI / Edited Content',
      UNKNOWN:  '◌ No Credentials',
    }[r.c2pa.trustLevel] || '◌ Unknown';

    /* Stripped EXIF fields */
    const strippedHtml = r.strippedFields.length
      ? r.strippedFields.map(f =>
          `<span class="stripped-tag" title="Removed from file">${escHtml(f)}</span>`
        ).join('')
      : `<span class="stripped-none">No personal metadata detected</span>`;

    /* Sanitization warning (for non-images) */
    const warnHtml = r.sanitizeWarning
      ? `<div class="ev-sec-c2pa-summary" style="color:var(--amber-light)">
           ⚠️ ${escHtml(r.sanitizeWarning)}
         </div>`
      : '';

    return `
      <div class="ev-sec-filename">
        <span class="ev-sec-name">${escHtml(r.fileName)}</span>
        <span class="c2pa-badge ${badgeClass}" title="${escHtml(r.c2pa.summary)}">
          ${badgeLabel}
        </span>
      </div>

      <div class="ev-sec-hash">
        <span class="ev-sec-hash-label">SHA-256 (Sanitized File)</span>
        <span class="ev-sec-hash-value">${escHtml(r.sha256)}</span>
      </div>

      <div style="margin-bottom:0.5rem">
        <div class="ev-sec-hash-label" style="margin-bottom:0.4rem">
          EXIF / Metadata Stripped
        </div>
        <div class="ev-sec-stripped">${strippedHtml}</div>
      </div>

      ${warnHtml}

      <div class="ev-sec-c2pa-summary">${escHtml(r.c2pa.summary)}</div>`;
  },
};

/* ═════════════════════════════════════════════════════════
   8. FakeEvidenceWarning
   Blocking modal shown when AI-generated or heavily edited
   evidence is detected. Logs the event to localStorage.
   The user MUST acknowledge before continuing.
════════════════════════════════════════════════════════ */
const FakeEvidenceWarning = {

  /** Stable browser session ID (generated once per session, stored in sessionStorage) */
  _getSessionId() {
    let sid = sessionStorage.getItem('awaaz_session_id');
    if (!sid) {
      /* 32 random hex chars — identifies this browser session */
      sid = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                 .map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('awaaz_session_id', sid);
    }
    return sid;
  },

  /**
   * Display the blocking warning modal for a suspicious file.
   * Logs the detection event to localStorage for auditability.
   * @param {EvidenceResult} result
   */
  show(result) {
    const modal   = document.getElementById('fakeEvidenceModal');
    if (!modal) return;

    const now     = new Date();
    const session = this._getSessionId();

    /* Populate modal fields */
    document.getElementById('fakeEvidenceFileName').textContent =
      result.fileName;

    document.getElementById('fakeEvidenceDetails').textContent =
      result.c2pa.summary.replace(/^[⚠️✅◌]\s*/u, '');

    document.getElementById('fakeEvidenceHash').textContent =
      result.sha256 || 'Not available';

    document.getElementById('fakeEvidenceSession').textContent =
      session;

    document.getElementById('fakeEvidenceTime').textContent =
      now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    document.getElementById('fakeEvidenceTools').textContent =
      result.c2pa.detectedTools.join(', ') || 'Unknown tool';

    /* Show modal */
    modal.hidden = false;

    /* Log the detection event locally (not sent anywhere) */
    this._logEvent({
      type:     'FAKE_EVIDENCE_BLOCKED',
      fileName: result.fileName,
      sha256:   result.sha256,
      tools:    result.c2pa.detectedTools,
      session,
      timestamp: now.toISOString(),
    });
  },

  /** Close the modal */
  hide() {
    const modal = document.getElementById('fakeEvidenceModal');
    if (modal) modal.hidden = true;
  },

  /**
   * Log a detection event to localStorage for auditability.
   * This record stays on the device — it is NOT sent to any server.
   * @param {Object} event
   */
  _logEvent(event) {
    try {
      const existing = JSON.parse(
        localStorage.getItem('awaaz_blocked_events') || '[]'
      );
      existing.unshift(event);
      /* Keep only the 50 most recent events */
      localStorage.setItem(
        'awaaz_blocked_events',
        JSON.stringify(existing.slice(0, 50))
      );
    } catch (e) {
      console.warn('[FakeEvidenceWarning] Could not log event:', e.message);
    }
  },
};

/* ═════════════════════════════════════════════════════════
   8. GeminiService — AI legal structuring
════════════════════════════════════════════════════════ */
const GeminiService = {
  API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',

  /** Build the exact prompt described in requirements */
  buildPrompt(transcript) {
    return `You are a legal complaint structuring assistant for AwaazSafe, an anonymous student safety portal in Visakhapatnam, India. You receive raw, informal spoken narratives about campus ragging or harassment — often a mix of Telugu and English — and convert them into concise, structured legal complaint data.

Analyze the following spoken narrative and return ONLY a valid JSON object with these exact keys — no markdown, no extra text:
{
  "category": "<one of: Ragging & Physical Abuse | Verbal Harassment | Cyber Bullying | Sexual Harassment | Extortion & Ragging | Stalking | Physical Intimidation | Physical Assault | Cyber Threats | Other>",
  "location": "<specific place name inferred from the text>",
  "timestamp": "<date/time inferred, e.g. 'Previous Night, ~11:00 PM'>",
  "summary": "<2-sentence plain-English summary of the incident>",
  "severity": "<Low | Medium | High | Critical>"
}

Narrative:
"""
${transcript}
"""

Rules:
- Reply ONLY with the JSON object — no extra explanation.
- If a field cannot be inferred, use "Not specified".
- Always reply in simple, clear English regardless of input language.
- Severity: Critical = threats to life/sexual assault; High = physical harm/extortion; Medium = verbal/cyber; Low = mild intimidation.`;
  },

  /** Call Gemini API, returns structured JSON object */
  async analyse(transcript) {
    const apiKey = Storage.getGeminiKey();
    if (!apiKey) {
      throw new Error('NO_KEY');
    }

    const body = {
      contents: [{
        parts: [{ text: this.buildPrompt(transcript) }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
      }
    };

    const resp = await fetch(`${this.API_URL}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const msg = errData?.error?.message || `API error ${resp.status}`;
      throw new Error(msg);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    const parsed  = JSON.parse(cleaned);

    // Validate required keys
    const required = ['category','location','timestamp','summary','severity'];
    for (const k of required) {
      if (!(k in parsed)) parsed[k] = 'Not specified';
    }
    return parsed;
  },
};

/* ═════════════════════════════════════════════════════════
   9. TranscriptPage — manage page 2
════════════════════════════════════════════════════════ */
const TranscriptPage = {
  structured: null,  // last Gemini result

  /** Populate page with current transcript and trigger AI */
  load(transcript) {
    // Show raw transcript
    const rawEl = document.getElementById('transcriptRaw');
    if (rawEl) {
      rawEl.textContent = transcript || '';
      if (!transcript) rawEl.innerHTML = `<p class="empty-state">${t('raw_empty')}</p>`;
    }

    // Load saved API key
    const keyInput = document.getElementById('geminiKey');
    if (keyInput) keyInput.value = Storage.getGeminiKey();

    // Clear previous AI output
    this.clearAI();
    this.structured = null;

    // Auto-run AI if we have a key and transcript
    if (transcript && Storage.getGeminiKey()) {
      this.runAI(transcript);
    }
  },

  clearAI() {
    document.getElementById('aiLoading').hidden = true;
    document.getElementById('aiError').hidden   = true;
    const out = document.getElementById('aiOutput');
    out.innerHTML = `<p class="empty-state">${t('ai_empty')}</p>`;
  },

  /** Run Gemini AI analysis */
  async runAI(transcript) {
    if (!transcript) {
      showToast('Please record an incident first.');
      return;
    }

    const loadEl = document.getElementById('aiLoading');
    const errEl  = document.getElementById('aiError');
    const outEl  = document.getElementById('aiOutput');

    loadEl.hidden = false;
    errEl.hidden  = true;
    outEl.innerHTML = '';

    try {
      const result = await GeminiService.analyse(transcript);
      this.structured = result;
      this.renderAI(result);
    } catch(err) {
      loadEl.hidden = true;
      errEl.hidden  = false;
      const msgEl = document.getElementById('aiErrorMsg');
      if (err.message === 'NO_KEY') {
        msgEl.textContent = 'Please enter your Gemini API key below to enable AI analysis.';
      } else {
        msgEl.textContent = `AI Error: ${err.message}. Please try again.`;
      }
    } finally {
      loadEl.hidden = true;
    }
  },

  /** Render structured complaint in clean layout */
  renderAI(d) {
    const authority = AUTHORITY_MAP[d.category] || AUTHORITY_MAP['Other'];
    const html = `
      <div class="complaint-card">
        <div class="complaint-row">
          <span class="complaint-label">Category</span>
          <span class="complaint-value">${escHtml(d.category)}</span>
        </div>
        <div class="complaint-row">
          <span class="complaint-label">Location</span>
          <span class="complaint-value">${escHtml(d.location)}</span>
        </div>
        <div class="complaint-row">
          <span class="complaint-label">When it happened</span>
          <span class="complaint-value">${escHtml(d.timestamp)}</span>
        </div>
        <div class="complaint-row">
          <span class="complaint-label">Summary</span>
          <span class="complaint-value">${escHtml(d.summary)}</span>
        </div>
        <div class="complaint-row">
          <span class="complaint-label">Severity</span>
          <span class="complaint-value">
            <span class="severity-badge severity-${escHtml(d.severity)}">${escHtml(d.severity)}</span>
          </span>
        </div>
        <div class="complaint-row">
          <span class="complaint-label">Will be routed to</span>
          <span class="complaint-value" style="color:var(--teal-light);font-weight:600">${escHtml(authority)}</span>
        </div>
      </div>`;
    document.getElementById('aiOutput').innerHTML = html;
  },
};

/* ═════════════════════════════════════════════════════════
   10. ReceiptPage — case key & vault
════════════════════════════════════════════════════════ */
const ReceiptPage = {
  lastKey: null,

  /** Generate a case key and display it */
  generateAndShow(structured) {
    const key       = generateCaseKey();
    this.lastKey    = key;
    const authority = structured
      ? (AUTHORITY_MAP[structured.category] || AUTHORITY_MAP['Other'])
      : 'District Legal Services Authority';
    const now = new Date();

    // Show the case key card
    const card = document.getElementById('caseKeyCard');
    card.hidden = false;

    document.getElementById('caseKeyDisplay').textContent = key;
    document.getElementById('authorityName').textContent   = authority;
    document.getElementById('submissionTime').textContent  = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    document.getElementById('trackerLink').textContent     = `#awaaz/track/${key}`;
    document.getElementById('trackerLink').href            = `#receipt`;

    // ── Render tamper-evident hash receipt ───────────────
    this._renderHashes();

    // Save report to storage (include hashes for auditability)
    const evidenceHashes = EvidenceSecurityUI.results.map(r => ({
      fileName:  r.fileName,
      sha256:    r.sha256,
      c2paTrust: r.c2pa.trustLevel,
    }));

    const report = {
      id:            'USER-' + Date.now(),
      caseKey:       key,
      timestamp:     now.toISOString(),
      rawTranscript: MicController.transcript,
      voiceHash:     MicController.voiceHash || null,
      structured:    structured || { category: 'Other', location: 'Not specified', timestamp: 'Not specified', summary: 'No AI analysis.', severity: 'Medium' },
      authority,
      evidenceFiles: evidenceHashes,
      isSample:      false,
    };
    Storage.addReport(report);
    Storage.incrementReports();

    this.render();
  },

  /**
   * Render tamper-evident hash receipt inside the case key card.
   * Shows the voice recording hash and all evidence file hashes.
   */
  _renderHashes() {
    const container = document.getElementById('receiptHashes');
    if (!container) return;
    const rows = [];

    /* Voice recording hash */
    if (MicController.voiceHash) {
      rows.push(
        `<div class="receipt-hash-row">
           <span class="receipt-hash-name">🎙️ Voice Recording</span>
           <span class="receipt-hash-hex">${escHtml(MicController.voiceHash)}</span>
         </div>`
      );
    }

    /* Evidence file hashes */
    EvidenceSecurityUI.results.forEach(r => {
      const icon = { VERIFIED: '✅', WARNING: '⚠️', UNKNOWN: '◌' }[r.c2pa.trustLevel] || '◌';
      rows.push(
        `<div class="receipt-hash-row">
           <span class="receipt-hash-name">${icon} ${escHtml(r.fileName)}</span>
           <span class="receipt-hash-hex">${escHtml(r.sha256)}</span>
         </div>`
      );
    });

    if (rows.length) {
      container.hidden = false;
      container.innerHTML =
        `<div class="receipt-hashes-title">🔐 Tamper-Evident File Hashes (SHA-256)</div>`
        + rows.join('');
    } else {
      container.hidden = true;
    }
  },

  /** Render stats strip and records table */
  render() {    const app = Storage.getApp();

    // Stats strip
    document.getElementById('statWeekly').textContent = app.totalReports || 10;
    document.getElementById('statVoice').textContent  = (app.voiceSuccessRate || 94) + '%';
    document.getElementById('statAck').textContent    = (app.authorityAckRate || 87) + '%';

    // Records table
    const reports = Storage.getReports() || [];
    const tbody   = document.getElementById('recordsBody');
    const emptyEl = document.getElementById('recordsEmpty');

    if (!reports.length) {
      emptyEl.hidden = false;
      tbody.innerHTML = '';
      return;
    }

    emptyEl.hidden = true;
    tbody.innerHTML = reports.map(r => {
      const loc  = r.structured?.location || r.location || '—';
      const cat  = r.structured?.category || r.category || '—';
      const auth = r.authority || '—';
      const sev  = r.structured?.severity || r.severity || '—';
      const tag  = r.isSample ? `<span class="sample-tag">Sample</span>` : '';
      return `<tr>
        <td>${escHtml(loc)}</td>
        <td>${escHtml(cat)}</td>
        <td>${escHtml(auth)}</td>
        <td><span class="severity-badge severity-${escHtml(sev)}">${escHtml(sev)}</span></td>
        <td>${tag || '<span style="color:var(--teal-light);font-weight:600;font-size:0.8rem">Your report</span>'}</td>
      </tr>`;
    }).join('');
  },
};

/* ═════════════════════════════════════════════════════════
   11. Toast & Modal utilities
════════════════════════════════════════════════════════ */
let toastTimer = null;

function showToast(message, duration = 3000) {
  const toast = document.getElementById('globalToast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function showModal(onConfirm) {
  const overlay = document.getElementById('confirmModal');
  overlay.hidden = false;
  overlay.focus && overlay.focus();

  const cancel = document.getElementById('confirmCancel');
  const ok     = document.getElementById('confirmOk');

  const close = () => { overlay.hidden = true; };
  cancel.onclick = close;
  ok.onclick = () => { close(); onConfirm(); };
}

/* ═════════════════════════════════════════════════════════
   12. Escape HTML helper
════════════════════════════════════════════════════════ */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═════════════════════════════════════════════════════════
   13. INIT — Wire everything together
════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // ── Seed sample data ─────────────────────────────────
  Storage.seedIfEmpty();

  // ── Restore language preference ───────────────────────
  const savedLang = Storage.getApp().language || 'en';
  currentLang = savedLang;
  applyLang(savedLang);

  // ── Hash-based routing ────────────────────────────────
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();

  // ── Language toggle (header) ──────────────────────────
  document.getElementById('langToggle').addEventListener('click', () => {
    applyLang(currentLang === 'en' ? 'te' : 'en');
  });

  // ── Quick exit ────────────────────────────────────────
  document.getElementById('quickExit').addEventListener('click', () => {
    window.location.href = 'https://google.com';
  });

  // ── Nav links ─────────────────────────────────────────
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(link.getAttribute('data-page'));
    });
  });

  // ── Recording language selector ───────────────────────
  document.getElementById('langEn').addEventListener('click', function() {
    MicController.recLang = 'en-IN';
    this.classList.add('active');
    this.setAttribute('aria-pressed', 'true');
    document.getElementById('langTe').classList.remove('active');
    document.getElementById('langTe').setAttribute('aria-pressed', 'false');
  });
  document.getElementById('langTe').addEventListener('click', function() {
    MicController.recLang = 'te-IN';
    this.classList.add('active');
    this.setAttribute('aria-pressed', 'true');
    document.getElementById('langEn').classList.remove('active');
    document.getElementById('langEn').setAttribute('aria-pressed', 'false');
  });

  // ── Mic button ────────────────────────────────────────
  if (MicController.init()) {
    document.getElementById('micBtn').addEventListener('click', () => {
      MicController.toggle();
    });
  }

  // ── Submit to Transcript page ─────────────────────────
  document.getElementById('submitTranscript').addEventListener('click', () => {
    const transcript = MicController.transcript.trim();
    if (!transcript) {
      MicController.showError(t('raw_empty'));
      return;
    }
    MicController.stop();
    TranscriptPage.load(transcript);
    goTo('transcript');
  });

  // ── Save Gemini API key ───────────────────────────────
  document.getElementById('saveKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('geminiKey').value.trim();
    if (!key) {
      showToast('Please enter a valid API key.');
      return;
    }
    Storage.saveGeminiKey(key);
    showToast('API key saved to browser.');
    // Auto-run AI if we have a transcript
    if (MicController.transcript.trim()) {
      TranscriptPage.runAI(MicController.transcript.trim());
    }
  });

  // ── AI Retry button ───────────────────────────────────
  document.getElementById('aiRetry').addEventListener('click', () => {
    if (MicController.transcript.trim()) {
      TranscriptPage.runAI(MicController.transcript.trim());
    } else {
      showToast('Please record an incident first.');
    }
  });

  // ── Evidence file picker — with security pipeline ────
  document.getElementById('evidenceFiles').addEventListener('change', async (e) => {
    const files   = Array.from(e.target.files).slice(0, 3);
    const preview = document.getElementById('evidencePreview');
    preview.innerHTML = '';

    /* Render thumbnail previews first (immediate visual feedback) */
    files.forEach(file => {
      if (file.size > 50 * 1024 * 1024) {
        showToast(`${file.name} exceeds 50 MB limit.`);
        return;
      }
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => {
          const img     = document.createElement('img');
          img.src       = ev.target.result;
          img.className = 'evidence-thumb';
          img.alt       = `Evidence: ${file.name}`;
          preview.appendChild(img);
        };
        reader.readAsDataURL(file);
      } else {
        const span       = document.createElement('span');
        span.className   = 'evidence-name';
        span.textContent = '📄 ' + file.name;
        preview.appendChild(span);
      }
    });

    /* Then run security pipeline asynchronously (SHA-256 + EXIF + C2PA) */
    if (files.length) {
      await EvidenceSecurityUI.processFiles(files);
    }
  });

  // ── Fake Evidence Warning modal — button handlers ──────
  document.getElementById('fakeEvidenceRemove').addEventListener('click', () => {
    FakeEvidenceWarning.hide();
    document.getElementById('evidenceFiles').value = '';
    document.getElementById('evidencePreview').innerHTML = '';
    document.getElementById('evidenceSecurityList').innerHTML = '';
    EvidenceSecurityUI.results = [];
    showToast('File removed.');
  });

  document.getElementById('fakeEvidenceAcknowledge').addEventListener('click', () => {
    FakeEvidenceWarning.hide();
    document.getElementById('evidenceFiles').value = '';
    document.getElementById('evidencePreview').innerHTML = '';
    document.getElementById('evidenceSecurityList').innerHTML = '';
    EvidenceSecurityUI.results = [];
    showToast('⚠️ Altered file removed. Please upload authentic evidence only.');
  });

  // ── Submit report → Receipt ───────────────────────────
  document.getElementById('submitReport').addEventListener('click', () => {
    const transcript = MicController.transcript.trim();
    const errEl  = document.getElementById('submitError');
    const msgEl  = document.getElementById('submitErrorMsg');

    if (!transcript) {
      msgEl.textContent = 'Please go back and record your incident before submitting.';
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;

    // Generate case key with current structured data (may be null if AI skipped)
    ReceiptPage.generateAndShow(TranscriptPage.structured);
    goTo('receipt');
    showToast('✅ Report submitted anonymously!');
  });

  // ── Copy case key ─────────────────────────────────────
  document.getElementById('copyKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('caseKeyDisplay').textContent.trim();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(key).then(() => showToast('Case key copied!'));
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = key;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Case key copied!');
    }
  });

  // ── Clear data ────────────────────────────────────────
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    showModal(() => {
      Storage.clearAll();
      Storage.seedIfEmpty();      // Re-seed samples
      ReceiptPage.render();
      document.getElementById('caseKeyCard').hidden = true;
      showToast('All personal data cleared.');
    });
  });

  // ── Keyboard: Escape closes modal ─────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('confirmModal').hidden = true;
    }
  });

  // ── Initial vault render ──────────────────────────────
  ReceiptPage.render();
});
