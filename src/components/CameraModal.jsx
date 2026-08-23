import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, MapPin, RefreshCw, Upload, Sparkles, AlertTriangle, CheckCircle2, Loader2, RotateCcw, Monitor, Circle } from 'lucide-react';
import { useUrbanGuard } from '../context/UrbanGuardContext';
import { analyzeHazardImage, mapCategoryToForm } from '../utils/analyzeHazardImage';

// ---------------------------------------------------------------------------
// Mock fallback — used when API key is missing or call fails
// ---------------------------------------------------------------------------
const MOCK_TITLES = [
  'Severe waterlogging near submerged vehicle on main road',
  'Flooded underpass blocking commuter route',
  'Exposed transformer wires dangling over floodwater',
  'Fallen tree blocking Ward 14 arterial road',
  'Overflowing storm drain causing road submersion',
];
const MOCK_REASONING = [
  'Car tires are fully submerged up to the rim, indicating approximately 1.5 ft of standing water. Road markings are no longer visible. Hazard poses medium risk to two-wheelers and pedestrians.',
  'Floodwater has reached bonnet level of parked vehicles, suggesting 3+ ft depth. The underpass is completely impassable and requires immediate municipal response.',
  'Live electrical wires are visibly downed and partially submerged in standing water. This is a life-threatening critical hazard requiring emergency dispatch.',
  'A large tree has fallen across both lanes, obstructing traffic flow. No visible water hazard but complete blockage of the arterial route.',
  'Storm drain overflow has created a 1 ft deep flood pool spanning 20+ metres of roadway. Manhole cover displaced posing additional hazard.',
];
function generateMockResult() {
  const idx = Math.floor(Math.random() * MOCK_TITLES.length);
  const cats = ['Flooding', 'Flooding', 'Electricity', 'Tree Fall', 'Flooding'];
  const urgencies = ['MEDIUM', 'CRITICAL', 'CRITICAL', 'MEDIUM', 'MEDIUM'];
  const waters = [1.5, 3.0, 0.5, 0.0, 1.0];
  return {
    hazard_category: cats[idx],
    estimated_water_level_ft: waters[idx],
    urgency_level: urgencies[idx],
    confidence_score: parseFloat((0.55 + Math.random() * 0.30).toFixed(2)),
    incident_title: MOCK_TITLES[idx],
    reasoning: MOCK_REASONING[idx],
    _isMock: true,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function AiBadge({ overridden, mock }) {
  if (overridden) {
    return (
      <span className="ml-2 text-[9px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded uppercase tracking-wide">
        Overridden
      </span>
    );
  }
  if (mock) {
    return (
      <span className="ml-2 text-[9px] font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-wide flex items-center gap-0.5 inline-flex">
        <Circle className="w-2 h-2 fill-amber-400" /> Simulated
      </span>
    );
  }
  return (
    <span className="ml-2 text-[9px] font-bold text-violet-300 bg-violet-950/50 border border-violet-500/30 px-1.5 py-0.5 rounded uppercase tracking-wide flex items-center gap-0.5 inline-flex">
      <Sparkles className="w-2.5 h-2.5" /> AI Filled
    </span>
  );
}

function AnalyzingSkeleton({ label }) {
  return (
    <div className="w-full px-3 py-2 bg-slate-900 border border-violet-500/30 rounded-lg flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
      <span className="text-[11px] text-violet-300 font-mono">Analyzing {label}...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CameraModal({ isOpen, onClose }) {
  const { submitComplaint } = useUrbanGuard();

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Sanitation & Drainage');
  const [severity, setSeverity] = useState('HIGH');
  const [waterLevel, setWaterLevel] = useState('1.5');
  const [latitude, setLatitude] = useState(17.4401);
  const [longitude, setLongitude] = useState(78.3489);
  const [description, setDescription] = useState('');

  // GPS states
  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsSource, setGpsSource] = useState('Default (Center)');

  // Camera states
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  // AI Vision states
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiOverrides, setAiOverrides] = useState(new Set());

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const markOverride = (field) => setAiOverrides(prev => new Set([...prev, field]));
  const isAiFilled = (field) => aiResult !== null && !aiOverrides.has(field);

  // -- GPS ------------------------------------------------------------------
  const fetchGpsLocation = () => {
    setFetchingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const dist = Math.sqrt(Math.pow(lat - 17.4401, 2) + Math.pow(lng - 78.3489, 2));
          if (dist > 1.0) {
            setLatitude(parseFloat((17.4401 + (Math.random() - 0.5) * 0.005).toFixed(5)));
            setLongitude(parseFloat((78.3489 + (Math.random() - 0.5) * 0.005).toFixed(5)));
            setGpsSource('Simulated GPS (Cyberabad Target)');
          } else {
            setLatitude(parseFloat(lat.toFixed(5)));
            setLongitude(parseFloat(lng.toFixed(5)));
            setGpsSource('Device Geolocation (Live)');
          }
          setFetchingGps(false);
        },
        () => {
          setLatitude(parseFloat((17.4401 + (Math.random() - 0.5) * 0.004).toFixed(5)));
          setLongitude(parseFloat((78.3489 + (Math.random() - 0.5) * 0.004).toFixed(5)));
          setGpsSource('Fallback GPS (Cyberabad Ward 14)');
          setFetchingGps(false);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setGpsSource('Fallback GPS (No Browser Support)');
      setFetchingGps(false);
    }
  };

  // -- Camera ---------------------------------------------------------------
  const startCamera = async () => {
    setCapturedImage(null);
    setAiResult(null);
    setAiError(null);
    setAiOverrides(new Set());
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraActive(false);
      setTimeout(generateCanvasMock, 100);
    }
  };

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setCameraActive(false);
  };

  // -- AI Vision Analysis ---------------------------------------------------
  const applyResult = (result) => {
    setAiResult(result);
    setSeverity(result.urgency_level === 'LOW' ? 'MEDIUM' : result.urgency_level);
    setWaterLevel(String(result.estimated_water_level_ft));
    setCategory(mapCategoryToForm(result.hazard_category));
    setTitle(result.incident_title);
    setDescription(result.reasoning);
  };

  const analyzeImage = useCallback(async (base64) => {
    setAiAnalyzing(true);
    setAiError(null);
    setAiResult(null);
    setAiOverrides(new Set());
    try {
      const result = await analyzeHazardImage(base64);
      applyResult(result);
    } catch (err) {
      // Graceful fallback to mock simulation for any failure
      const mock = generateMockResult();
      applyResult(mock);
      if (err.code === 'NO_KEY') {
        setAiError('No API key found — showing simulated AI analysis. Add VITE_GEMINI_API_KEY to .env for live results.');
      } else {
        setAiError('API unavailable (' + (err.code || 'ERROR') + ') — showing simulated analysis. Fields are editable.');
      }
    } finally {
      setAiAnalyzing(false);
    }
  }, []);

  // -- Capture Snapshot -----------------------------------------------------
  const captureSnapshot = () => {
    let base64;
    if (cameraActive && videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(10, 420, 620, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('URBANGUARD STREAM | LAT: ' + latitude + ' LON: ' + longitude, 20, 440);
      ctx.fillText('TIMESTAMP: ' + new Date().toLocaleString(), 20, 455);
      base64 = canvas.toDataURL('image/jpeg');
      stopCamera();
    } else if (canvasRef.current) {
      base64 = canvasRef.current.toDataURL('image/jpeg');
    }
    if (base64) {
      setCapturedImage(base64);
      analyzeImage(base64);
    }
  };

  // -- Canvas Mock ----------------------------------------------------------
  const generateCanvasMock = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eab308';
    for (let i = 0; i < canvas.width; i += 30) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 15, 0);
      ctx.lineTo(i + 5, 10); ctx.lineTo(i - 10, 10); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(51,65,85,0.3)'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 70, canvas.height / 2); ctx.lineTo(canvas.width / 2 + 70, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 70); ctx.lineTo(canvas.width / 2, canvas.height / 2 + 70);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc'; ctx.font = '54px system-ui';
    const emojiMap = { 'Electricity': '⚡', 'Sanitation & Drainage': '💧', 'Roads & Infrastructure': '🚧', 'Solid Waste Management': '🪵' };
    ctx.fillText(emojiMap[category] || '⚠️', canvas.width / 2 - 27, canvas.height / 2 + 18);
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 14px monospace';
    ctx.fillText('[MOCK LIVE TELEMETRY STREAM]', 30, 45);
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px monospace';
    ctx.fillText('TARGET: ' + category.toUpperCase(), 30, 80);
    ctx.fillText('SEVERITY RATING: ' + severity, 30, 100);
    ctx.fillText('H2O LEVEL: ' + waterLevel + ' FT', 30, 120);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('GPS: WARD 14 CYBERABAD', 30, 150);
    ctx.fillText('LAT: ' + latitude.toFixed(5) + '  LON: ' + longitude.toFixed(5), 30, 170);
    ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px monospace';
    ctx.fillText('[OK] MOCK CAMERA STAMP - OVERLAY ACTIVE', 30, canvas.height - 25);
  };

  useEffect(() => { if (isOpen && !cameraActive) generateCanvasMock(); }, [category, severity, waterLevel, latitude, longitude, isOpen, cameraActive]);
  useEffect(() => { if (isOpen) { fetchGpsLocation(); startCamera(); } else { stopCamera(); } }, [isOpen]);

  // -- Submit ---------------------------------------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { alert('Please fill in the incident title and description.'); return; }
    let base64 = capturedImage;
    if (!base64 && canvasRef.current) base64 = canvasRef.current.toDataURL('image/jpeg');
    submitComplaint({
      title: title.trim(), category, severity,
      waterLevel: parseFloat(waterLevel) || 0,
      coordinates: [latitude, longitude],
      description: description.trim(),
      reportedBy: 'Citizen Portal (Camera Upload)'
    });
    setTitle(''); setDescription(''); setCapturedImage(null);
    setAiResult(null); setAiError(null); setAiOverrides(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const isMock = aiResult?._isMock === true;
  const severityColor = { CRITICAL: 'text-red-400', HIGH: 'text-orange-400', MEDIUM: 'text-yellow-400', LOW: 'text-blue-400' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <h3 className="font-bold text-lg text-slate-100 flex items-center gap-1.5">
              <Camera className="w-5 h-5 text-blue-500" />
              Report New Monsoon Hazard
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 p-1.5 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">

          {/* Camera + GPS row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Camera Capture / Simulation
              </label>

              <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
                {capturedImage ? (
                  <img src={capturedImage} alt="Captured Scene" className="w-full h-full object-cover" />
                ) : cameraActive ? (
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                ) : (
                  <canvas ref={canvasRef} width={480} height={360} className="w-full h-full object-cover" />
                )}

                <div className="absolute top-3 left-3 px-2 py-0.5 bg-slate-950/80 backdrop-blur rounded text-[10px] font-mono font-bold tracking-wide border flex items-center gap-1.5 border-red-500/20 text-red-400">
                  {cameraActive
                    ? <><Circle className="w-2 h-2 fill-red-500 animate-pulse" /> CAM ONLINE</>
                    : <><Monitor className="w-3 h-3" /> SIMULATION</>
                  }
                </div>

                {aiAnalyzing && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                    <p className="text-xs font-bold text-violet-300 tracking-wide">AI Vision Analyzing...</p>
                    <p className="text-[10px] text-slate-400">Estimating hazard metrics from image</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!capturedImage ? (
                  <button type="button" onClick={captureSnapshot} disabled={aiAnalyzing}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded text-sm transition-colors flex items-center justify-center gap-1.5">
                    <Camera className="w-4 h-4" /> Capture Snapshot
                  </button>
                ) : (
                  <button type="button" onClick={() => { setCapturedImage(null); setAiResult(null); setAiError(null); setAiOverrides(new Set()); startCamera(); }}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded text-sm transition-colors flex items-center justify-center gap-1.5">
                    <RotateCcw className="w-4 h-4" /> Retake Photo
                  </button>
                )}
                {capturedImage && !aiAnalyzing && (
                  <button type="button" onClick={() => analyzeImage(capturedImage)}
                    className="py-2 px-3 bg-violet-700/60 hover:bg-violet-600/80 border border-violet-500/40 text-violet-200 font-semibold rounded text-sm transition-colors flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Re-analyze
                  </button>
                )}
              </div>
            </div>

            {/* GPS Metadata */}
            <div className="flex flex-col justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800/80">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-blue-500" /> Live Incident GPS Coords
                  </h4>
                  <button type="button" onClick={fetchGpsLocation} disabled={fetchingGps}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 disabled:opacity-50">
                    <RefreshCw className={"w-3 h-3 " + (fetchingGps ? 'animate-spin' : '')} /> Sync GPS
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium">Latitude</label>
                    <input type="number" step="0.00001" value={latitude}
                      onChange={e => { setLatitude(parseFloat(e.target.value) || 0); setGpsSource('Manual Tweak (Override)'); }}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium">Longitude</label>
                    <input type="number" step="0.00001" value={longitude}
                      onChange={e => { setLongitude(parseFloat(e.target.value) || 0); setGpsSource('Manual Tweak (Override)'); }}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Telemetry Fix:</span>
                  <span className="text-blue-400 font-medium font-mono">{gpsSource}</span>
                </div>
              </div>
              <div className="text-[10px] leading-relaxed text-slate-500 mt-4 p-2 bg-slate-900/50 rounded border border-slate-800/40">
                Coordinates default near Hitec City / Cyber Towers (Ward 14) so reports appear live in map views.
              </div>
            </div>
          </div>

          {/* AI Vision Status Banner */}
          {(aiAnalyzing || aiResult || aiError) && (
            <div className={"flex items-start gap-3 p-3 rounded-lg border text-xs " + (
              aiAnalyzing
                ? 'bg-violet-950/20 border-violet-500/25 text-violet-300'
                : isMock
                ? 'bg-amber-950/20 border-amber-500/25 text-amber-300'
                : aiError && !aiResult
                ? 'bg-red-950/20 border-red-500/25 text-red-300'
                : 'bg-emerald-950/20 border-emerald-500/25 text-emerald-300'
            )}>
              {aiAnalyzing
                ? <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5 text-violet-400" />
                : isMock || aiError
                ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              }
              <div className="flex-1">
                {aiAnalyzing && <p className="font-semibold">AI Vision analyzing image -- estimating hazard metrics...</p>}
                {aiError && <p className="text-[10px] leading-relaxed mt-0.5 opacity-80">{aiError}</p>}
                {aiResult && !aiAnalyzing && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={"font-bold " + (isMock ? 'text-amber-300' : 'text-emerald-300')}>
                      {isMock ? 'Simulated Analysis (no API key)' : 'AI Analysis Complete'}
                    </span>
                    <span className={"font-bold " + (severityColor[aiResult.urgency_level] || 'text-white')}>
                      Threat: {aiResult.urgency_level}
                    </span>
                    <span className="text-slate-300">Water: {aiResult.estimated_water_level_ft} ft</span>
                    <span className="text-slate-300">Confidence: {Math.round(aiResult.confidence_score * 100)}%</span>
                    <span className="text-slate-500 text-[10px] w-full mt-0.5">All fields are editable -- override any value below.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <hr className="border-slate-800" />

          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Hazard Category */}
            <div>
              <label className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Hazard Category
                {isAiFilled('category') && <AiBadge overridden={false} mock={isMock} />}
                {aiResult && aiOverrides.has('category') && <AiBadge overridden={true} />}
              </label>
              {aiAnalyzing ? <AnalyzingSkeleton label="category" /> : (
                <select value={category}
                  onChange={e => { setCategory(e.target.value); if (aiResult) markOverride('category'); }}
                  className={"w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors " + (isAiFilled('category') ? 'border-violet-500/40' : 'border-slate-800')}>
                  <option value="Electricity">Electricity (Poles, Transformers, Wires)</option>
                  <option value="Sanitation & Drainage">Sanitation &amp; Drainage (Manholes, Floods)</option>
                  <option value="Roads & Infrastructure">Roads &amp; Infrastructure (Potholes, Landslips)</option>
                  <option value="Solid Waste Management">Solid Waste Management (Debris, Fallen Trees)</option>
                </select>
              )}
            </div>

            {/* Urgency & Threat Level */}
            <div>
              <label className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Urgency &amp; Threat Level
                {isAiFilled('severity') && <AiBadge overridden={false} mock={isMock} />}
                {aiResult && aiOverrides.has('severity') && <AiBadge overridden={true} />}
              </label>
              {aiAnalyzing ? <AnalyzingSkeleton label="threat level" /> : (
                <select value={severity}
                  onChange={e => {
                    setSeverity(e.target.value);
                    if (!aiResult) {
                      if (e.target.value === 'CRITICAL') setWaterLevel('3.0');
                      else if (e.target.value === 'HIGH') setWaterLevel('1.5');
                      else setWaterLevel('0.3');
                    }
                    if (aiResult) markOverride('severity');
                  }}
                  className={"w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors " + (isAiFilled('severity') ? 'border-violet-500/40' : 'border-slate-800')}>
                  <option value="CRITICAL">CRITICAL -- Water above 2.5 ft / Life Threat (SLA: 2 Hrs)</option>
                  <option value="HIGH">HIGH -- Waterlogged / Road Blocked (SLA: 12 Hrs)</option>
                  <option value="MEDIUM">MEDIUM -- Minor Potholes / Broken Streetlights (SLA: 48 Hrs)</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Incident Title */}
            <div>
              <label className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Incident Title
                {isAiFilled('title') && <AiBadge overridden={false} mock={isMock} />}
                {aiResult && aiOverrides.has('title') && <AiBadge overridden={true} />}
              </label>
              {aiAnalyzing ? <AnalyzingSkeleton label="title" /> : (
                <input type="text" placeholder="e.g. Broken pole at Hitec Metro Stn" value={title}
                  onChange={e => { setTitle(e.target.value); if (aiResult) markOverride('title'); }}
                  className={"w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-600 transition-colors " + (isAiFilled('title') ? 'border-violet-500/40' : 'border-slate-800')} />
              )}
            </div>

            {/* Estimated Water Level */}
            <div>
              <label className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Estimated Water Level (ft)
                {isAiFilled('waterLevel') && <AiBadge overridden={false} mock={isMock} />}
                {aiResult && aiOverrides.has('waterLevel') && <AiBadge overridden={true} />}
              </label>
              {aiAnalyzing ? <AnalyzingSkeleton label="water depth" /> : (
                <input type="number" step="0.1" min="0" max="10" value={waterLevel}
                  onChange={e => { setWaterLevel(e.target.value); if (aiResult) markOverride('waterLevel'); }}
                  className={"w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors " + (isAiFilled('waterLevel') ? 'border-violet-500/40' : 'border-slate-800')} />
              )}
            </div>
          </div>

          {/* Detailed Description */}
          <div>
            <label className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Detailed Description
              {isAiFilled('description') && <AiBadge overridden={false} mock={isMock} />}
              {aiResult && aiOverrides.has('description') && <AiBadge overridden={true} />}
            </label>
            {aiAnalyzing ? (
              <div className="w-full px-3 py-4 bg-slate-900 border border-violet-500/30 rounded-lg flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
                <span className="text-[11px] text-violet-300 font-mono">Generating incident description...</span>
              </div>
            ) : (
              <textarea rows={3} placeholder="Provide exact details of hazard, risk levels, and visual markers..." value={description}
                onChange={e => { setDescription(e.target.value); if (aiResult) markOverride('description'); }}
                className={"w-full px-3 py-2 bg-slate-900 border rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-600 transition-colors " + (isAiFilled('description') ? 'border-violet-500/40' : 'border-slate-800')} />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t border-slate-800 pt-4 mt-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300 font-semibold text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={aiAnalyzing}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> Submit Hazard Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
