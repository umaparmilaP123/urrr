import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, CheckCircle, RefreshCw } from 'lucide-react';
import { useUrbanGuard } from '../context/UrbanGuardContext';

export default function ProofOfWorkModal({ isOpen, onClose, complaintId }) {
  const { resolveComplaint } = useUrbanGuard();
  const [proofNote, setProofNote] = useState('');
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    setCapturedImage(null);
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
    } catch (err) {
      console.warn("Camera hardware access denied/unavailable. Generating mock resolution canvas.", err);
      setCameraActive(false);
      setTimeout(generateCanvasMock, 100);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const captureSnapshot = () => {
    if (cameraActive && videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Stamp resolved watermark
      ctx.fillStyle = 'rgba(6, 78, 59, 0.85)';
      ctx.fillRect(10, 420, 620, 50);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`URBANGUARD RESOLVED • TICKET: #${complaintId}`, 20, 440);
      ctx.fillText(`TIME CLEARED: ${new Date().toLocaleString()}`, 20, 455);

      const base64 = canvas.toDataURL('image/jpeg');
      setCapturedImage(base64);
      stopCamera();
    } else {
      if (canvasRef.current) {
        const base64 = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(base64);
      }
    }
  };

  const generateCanvasMock = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Background green slate (emerald theme)
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Hazard clearance stripes
    ctx.fillStyle = '#10b981';
    for (let i = 0; i < canvas.width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 15, 0);
      ctx.lineTo(i + 5, 10);
      ctx.lineTo(i - 10, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Grid details
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Large Checked target circle in center
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 45, 0, Math.PI * 2);
    ctx.stroke();

    // Check mark
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 20, canvas.height / 2 - 3);
    ctx.lineTo(canvas.width / 2 - 5, canvas.height / 2 + 13);
    ctx.lineTo(canvas.width / 2 + 20, canvas.height / 2 - 13);
    ctx.stroke();

    // Text details
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`[MOCK FIELD CLEARANCE STREAM]`, 30, 45);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '12px monospace';
    ctx.fillText(`TICKET NUMBER: #${complaintId}`, 30, 85);
    ctx.fillText(`RESOLUTION STATUS: CLEARED & SAFE`, 30, 105);
    ctx.fillText(`VERIFIED BY: WARD 14 FIELD AGENCY`, 30, 125);
    ctx.fillText(`LAT/LON: SYNCHRONIZED`, 30, 145);
    ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString()}`, 30, 165);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`✔ PROOF-OF-WORK VERIFIED (SYSTEM APPROVED)`, 30, canvas.height - 25);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, complaintId]);

  useEffect(() => {
    if (isOpen && !cameraActive) {
      generateCanvasMock();
    }
  }, [isOpen, cameraActive, complaintId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!proofNote.trim()) {
      alert("Please provide verification notes detailing what was resolved.");
      return;
    }

    let finalImg = capturedImage;
    if (!finalImg && canvasRef.current) {
      finalImg = canvasRef.current.toDataURL('image/jpeg');
    }

    resolveComplaint(complaintId, {
      afterImage: finalImg,
      proofNote: proofNote.trim()
    });

    setProofNote('');
    setCapturedImage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <h3 className="font-bold text-lg text-slate-100 flex items-center gap-1.5">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            Proof-Of-Work Clearance (Ticket #{complaintId})
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 p-1.5 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Clearance Video Feed / Proof Snapshot
            </label>
            
            <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Proof of Work"
                  className="w-full h-full object-cover"
                />
              ) : cameraActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={360}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Status HUD Overlays */}
              <div className="absolute top-3 left-3 px-2 py-0.5 bg-slate-950/80 backdrop-blur rounded text-[10px] text-emerald-400 font-mono font-bold tracking-wide border border-emerald-500/20">
                {cameraActive ? "🔴 CLEARANCE STREAM ONLINE" : "🖥️ DISPATCH STAMP SIMULATOR"}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!capturedImage ? (
                <button
                  type="button"
                  onClick={captureSnapshot}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  Capture Verification Proof
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null);
                    startCamera();
                  }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Photo
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Work Done / Verification Notes
            </label>
            <textarea
              rows={3}
              required
              placeholder="Describe work completed (e.g. Water pumped out, electrical lines re-routed, tree cleared)..."
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-600"
            />
          </div>

          <div className="flex gap-3 justify-end border-t border-slate-800 pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-850 bg-slate-800/40 hover:bg-slate-800 text-slate-350 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              Mark As Resolved
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
