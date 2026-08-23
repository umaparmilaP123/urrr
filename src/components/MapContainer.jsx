import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import L from 'leaflet';
import { ThumbsUp, CheckCircle } from 'lucide-react';
import { useUrbanGuard } from '../context/UrbanGuardContext';

// ── CRITICAL FIX: Leaflet marker icon asset paths ──────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ── Category images ───────────────────────────────────────────────────────
const CAT_IMAGES = {
  'Electricity': 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=300&q=80',
  'Sanitation & Drainage': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=300&q=80',
  'Roads & Infrastructure': 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=300&q=80',
  'Solid Waste Management': 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=300&q=80',
};

const CAT_EMOJI = {
  'Electricity': '⚡',
  'Sanitation & Drainage': '💧',
  'Solid Waste Management': '🪵',
  'Roads & Infrastructure': '🚧',
};

// ── Popup React Component ─────────────────────────────────────────────────
const MapPopup = ({ complaint, onUpvote, viewMode }) => {
  const imgSrc = (complaint.status === 'RESOLVED' && complaint.resolvedImage)
    ? complaint.resolvedImage
    : CAT_IMAGES[complaint.category] || 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&w=300&q=80';

  const severityColor = { CRITICAL: 'bg-red-600', HIGH: 'bg-orange-500', MEDIUM: 'bg-yellow-500 text-slate-900' };
  const statusColor = {
    RESOLVED: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
    ESCALATED: 'text-red-400 bg-red-950/40 border-red-500/30',
    IN_PROGRESS: 'text-blue-400 bg-blue-950/40 border-blue-500/30',
    OPEN: 'text-slate-300 bg-slate-800/60 border-slate-700/50',
  };

  // Lifecycle progress
  const lifePct = complaint.status === 'RESOLVED' ? 100 : complaint.status === 'IN_PROGRESS' ? 55 : complaint.status === 'ESCALATED' ? 80 : 15;
  const lifeColor = complaint.status === 'RESOLVED' ? 'bg-emerald-500' : complaint.status === 'ESCALATED' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className="w-64 flex flex-col gap-2 text-slate-100 font-sans text-xs p-1 select-none">
      {/* Image */}
      <div className="relative h-28 rounded overflow-hidden border border-slate-700 bg-slate-900">
        <img src={imgSrc} alt={complaint.title} className="w-full h-full object-cover" />
        <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-black uppercase shadow ${severityColor[complaint.severity] || severityColor.MEDIUM} text-white`}>
          {complaint.severity}
        </span>
        {complaint.waterLevel > 0 && (
          <span className="absolute bottom-2 right-2 bg-slate-900/85 backdrop-blur px-1.5 py-0.5 rounded text-[10px] border border-blue-500/30 text-blue-300 font-medium">
            🌊 {complaint.waterLevel} ft
          </span>
        )}
      </div>

      {/* Info */}
      <div>
        <h4 className="font-bold text-sm leading-tight text-white mb-0.5 line-clamp-2">{complaint.title}</h4>
        <p className="text-slate-400 text-[10px] flex items-center gap-1 mb-1.5">
          <span>{CAT_EMOJI[complaint.category] || '⚠️'}</span>
          <span className="font-medium text-slate-300">{complaint.category}</span>
          <span>•</span>
          <span>#{complaint.id}</span>
        </p>
        <p className="text-slate-300 text-[10px] leading-normal line-clamp-3 bg-slate-900/50 p-1.5 rounded border border-slate-800">
          {complaint.description}
        </p>
      </div>

      {/* Lifecycle Progress */}
      <div>
        <div className="flex justify-between text-[9px] font-medium text-slate-400 mb-1">
          <span>Lifecycle Progress</span>
          <span className={`uppercase px-1 py-0.5 rounded border text-[8px] font-bold ${statusColor[complaint.status] || statusColor.OPEN}`}>{complaint.status}</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
          <div className={`h-full transition-all duration-700 ${lifeColor} ${complaint.status === 'ESCALATED' ? 'animate-pulse' : ''}`} style={{ width: `${lifePct}%` }} />
        </div>
        <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
          <span>Open</span><span>In Progress</span><span>Resolved</span>
        </div>
      </div>

      {/* Worker / Proof */}
      {complaint.status === 'RESOLVED' && complaint.resolvedProof && (
        <div className="bg-emerald-950/20 border border-emerald-500/20 p-1.5 rounded flex items-start gap-1">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-emerald-300 italic line-clamp-2">"{complaint.resolvedProof}"</p>
        </div>
      )}
      {complaint.dispatchedWorker && complaint.status !== 'RESOLVED' && (
        <div className="bg-blue-950/20 border border-blue-500/20 p-1 rounded">
          <p className="text-[9px] text-blue-300 font-medium">👷 {complaint.dispatchedWorker}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-2 gap-1.5">
        <span className="text-slate-400 text-[10px] font-medium shrink-0">
          🗣️ {complaint.upvotesCount} voice{complaint.upvotesCount !== 1 ? 's' : ''}
        </span>
        {viewMode === 'citizen' && complaint.status !== 'RESOLVED' && (
          <button
            onClick={onUpvote}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded shadow transition-all text-[10px] shrink-0"
          >
            <ThumbsUp className="w-3 h-3" />
            I Have This Issue Too
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main MapContainer Component ───────────────────────────────────────────
export default function MapContainer({ complaints, focusedComplaint, viewMode }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const popupRootsRef = useRef([]);
  const { upvoteComplaint, activeDepartment } = useUrbanGuard();

  // Custom icon factory
  const makeIcon = (severity, status) => {
    let bg = '#eab308'; // MEDIUM: yellow
    let pulse = '';
    let sym = '●';

    if (status === 'RESOLVED') { bg = '#10b981'; sym = '✓'; }
    else if (severity === 'CRITICAL') { bg = '#ef4444'; pulse = '#ef4444'; sym = '!'; }
    else if (severity === 'HIGH') { bg = '#f97316'; pulse = '#f97316'; sym = '▲'; }

    const ringHtml = (pulse && status !== 'RESOLVED')
      ? `<span class="cm-ping" style="position:absolute;inset:0;border-radius:9999px;opacity:0.6;background:${pulse};"></span>`
      : '';

    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <style>@keyframes pp{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(2.1);opacity:0}}.cm-ping{animation:pp 1.4s cubic-bezier(0,0,0.2,1) infinite}</style>
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:30px;height:30px;">
          ${ringHtml}
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${bg};border:2.5px solid rgba(15,23,42,0.9);box-shadow:0 2px 10px rgba(0,0,0,0.6);">
            <span style="font-size:9px;font-weight:900;color:${status === 'RESOLVED' ? '#ecfdf5' : '#fff'};line-height:1;">${sym}</span>
          </div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  };

  // 1. Initialize map ONCE
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      fadeAnimation: true,
    }).setView([17.4401, 78.3489], 14);

    // Dark CartoDB tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);
    markersRef.current = markers;
    mapRef.current = map;

    // Initial invalidation after DOM settles
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      popupRootsRef.current.forEach(r => { try { r.unmount(); } catch (_) {} });
      popupRootsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. ResizeObserver + viewMode invalidation (prevents gray tiles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !containerRef.current) return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    map.invalidateSize();
    return () => ro.disconnect();
  }, [viewMode]);

  // 3. Render/update markers when complaints or department filter changes
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    // Cleanup old popup roots
    popupRootsRef.current.forEach(r => { try { r.unmount(); } catch (_) {} });
    popupRootsRef.current = [];
    markers.clearLayers();

    const visible = complaints.filter(c =>
      activeDepartment === 'All' || c.department === activeDepartment
    );

    visible.forEach(c => {
      const icon = makeIcon(c.severity, c.status);
      const marker = L.marker(c.coordinates, { icon });

      const div = document.createElement('div');
      div.style.background = '#1e293b';
      div.style.padding = '8px';
      div.style.borderRadius = '8px';
      const root = ReactDOM.createRoot(div);

      root.render(
        <MapPopup
          complaint={c}
          viewMode={viewMode}
          onUpvote={() => {
            upvoteComplaint(c.id);
            setTimeout(() => marker.setPopupContent(div), 50);
          }}
        />
      );
      popupRootsRef.current.push(root);

      marker.bindPopup(div, { maxWidth: 290, minWidth: 270, className: 'custom-leaflet-popup' });
      markers.addLayer(marker);
    });
  }, [complaints, activeDepartment, viewMode]);

  // 4. Focus / pan handler
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers || !focusedComplaint) return;

    map.setView(focusedComplaint.coordinates, 16, { animate: true, duration: 1 });
    setTimeout(() => {
      markers.eachLayer(layer => {
        if (!(layer instanceof L.Marker)) return;
        const ll = layer.getLatLng();
        if (
          Math.abs(ll.lat - focusedComplaint.coordinates[0]) < 0.0002 &&
          Math.abs(ll.lng - focusedComplaint.coordinates[1]) < 0.0002
        ) {
          layer.openPopup();
        }
      });
    }, 1100);
  }, [focusedComplaint]);

  return (
    // CRITICAL: explicit dimensions wrapper prevents gray/blank tiles
    <div className="w-full h-[450px] min-h-[450px] relative z-0 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}