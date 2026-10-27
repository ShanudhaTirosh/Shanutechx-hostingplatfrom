'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { Activity, ShieldCheck, Zap, RefreshCw, Radio, Globe2, Server, MapPin } from 'lucide-react';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const W = 900, H = 440;

// Mercator projection matching SVG viewport
const proj = geoMercator().scale(135).center([10, 18]).translate([W / 2, H / 2]);
const px = (c: [number, number]): [number, number] => {
  const p = proj(c);
  return p || [W / 2, H / 2];
};

// Curved arc SVG path string between two geo-coordinates
const arcPath = (a: [number, number], b: [number, number]) => {
  const [x1, y1] = px(a), [x2, y2] = px(b);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return `M${x1},${y1} Q${mx - (dy / len) * len * 0.22},${my + (dx / len) * len * 0.22} ${x2},${y2}`;
};

export interface NodeItem {
  id: string;
  name: string;
  city: string;
  region: 'Americas' | 'Europe' | 'Asia-Pacific';
  coords: [number, number];
  basePing: number;
  spec: string;
  country: string;
}

const NODES: NodeItem[] = [
  { id: 'usw', name: 'US West',     city: 'Los Angeles', region: 'Americas',     coords: [-118.24, 34.05], basePing: 135, spec: '10 Gbps Uplink · Anycast BGP', country: 'US' },
  { id: 'use', name: 'US East',     city: 'New York',    region: 'Americas',     coords: [-74.01,  40.71],  basePing: 110, spec: 'DDoS Shielded · Tier 4 DC', country: 'US' },
  { id: 'br',  name: 'Brazil',      city: 'São Paulo',   region: 'Americas',     coords: [-46.63, -23.55], basePing: 175, spec: 'LATAM Edge Routing', country: 'BR' },
  { id: 'uk',  name: 'UK Hub',      city: 'London',      region: 'Europe',       coords: [-0.13,  51.51],  basePing: 84,  spec: 'LINX Peering · 10Gbps Uplink', country: 'GB' },
  { id: 'de',  name: 'DE Hub',      city: 'Frankfurt',   region: 'Europe',       coords: [8.68,   50.11],  basePing: 92,  spec: 'DE-CIX Core Direct', country: 'DE' },
  { id: 'fr',  name: 'France',      city: 'Paris',       region: 'Europe',       coords: [2.35,   48.86],  basePing: 88,  spec: 'FranceIX IXP Hub', country: 'FR' },
  { id: 'nl',  name: 'Netherlands', city: 'Amsterdam',   region: 'Europe',       coords: [4.90,   52.37],  basePing: 82,  spec: 'AMS-IX Ultra Low Ping', country: 'NL' },
  { id: 'in',  name: 'IN Hub',      city: 'Mumbai',      region: 'Asia-Pacific', coords: [72.88,  19.08],  basePing: 45,  spec: 'NIXI Peering · Local POP', country: 'IN' },
  { id: 'sg',  name: 'SG Hub',      city: 'Singapore',   region: 'Asia-Pacific', coords: [103.82,  1.35],  basePing: 55,  spec: 'SGIX Core · Trans-Asian IX', country: 'SG' },
  { id: 'jp',  name: 'JP Hub',      city: 'Tokyo',       region: 'Asia-Pacific', coords: [139.69, 35.69],  basePing: 70,  spec: 'JPIX High Speed Fibre', country: 'JP' },
  { id: 'au',  name: 'AU Hub',      city: 'Sydney',      region: 'Asia-Pacific', coords: [151.21,-33.87],  basePing: 160, spec: 'AusIX Pacific Backbone', country: 'AU' },
];

const EDGES: [string, string][] = [
  ['usw','use'], ['use','uk'], ['use','br'],
  ['uk','de'],   ['uk','fr'],  ['uk','nl'],
  ['de','in'],   ['in','sg'],
  ['sg','jp'],   ['sg','au'],
];

const nmap = Object.fromEntries(NODES.map(n => [n.id, n]));

const LOG_TPL = [
  (a: string, b: string) => `Packet routed ${a} → ${b}`,
  (a: string, b: string) => `Tunnel active ${a} ↔ ${b}`,
  (a: string, b: string) => `Encrypted data ${a} → ${b}`,
  (a: string, b: string) => `BGP Session healthy ${a} ↔ ${b}`,
];

function StatBox({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon?: any }) {
  return (
    <div className="bg-[#090b24]/80 border border-white/[0.08] rounded-xl px-3.5 py-2 text-center min-w-[95px] backdrop-blur-md shadow-lg flex items-center gap-2">
      {Icon && <Icon size={14} style={{ color }} className="shrink-0 hidden sm:block" />}
      <div className="text-left">
        <div className="text-xs font-black font-mono tracking-tight" style={{ color }}>{value}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function NetworkMap() {
  const [worldGeo, setWorldGeo] = useState<any>(null);
  const [selectedRegion, setSelectedRegion] = useState<'All' | 'Americas' | 'Europe' | 'Asia-Pacific'>('All');
  const [hover, setHover] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [pings, setPings] = useState<Record<string, number>>(
    Object.fromEntries(NODES.map(n => [n.id, n.basePing]))
  );
  const [traffic, setTraffic] = useState(1253.8);
  const [sessions, setSessions] = useState(848);
  const [pps, setPps] = useState(13099);
  const [hotEdge, setHotEdge] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [log, setLog] = useState<Array<{ id: number; msg: string; time: string }>>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Load World Atlas Countries GeoJSON
  useEffect(() => {
    fetch(GEO_URL)
      .then((res) => res.json())
      .then((topo) => {
        const geoData = feature(topo, topo.objects.countries as any);
        setWorldGeo(geoData);
      })
      .catch((err) => console.error('Failed to load world map atlas:', err));
  }, []);

  // Live telemetry metrics simulator
  useEffect(() => {
    const t = setInterval(() => {
      setPings((prev) => {
        const next = { ...prev };
        NODES.forEach((n) => {
          next[n.id] = Math.max(1, Math.round(n.basePing + (Math.random() - 0.5) * 6));
        });
        return next;
      });
      setTraffic((v) => +(v + Math.random() * 0.8).toFixed(1));
      setSessions((v) => v + Math.floor((Math.random() - 0.3) * 5));
      setPps(Math.floor(12400 + Math.random() * 2100));
      setHotEdge(Math.floor(Math.random() * EDGES.length));

      const [a, b] = EDGES[Math.floor(Math.random() * EDGES.length)];
      const msg = LOG_TPL[Math.floor(Math.random() * LOG_TPL.length)](nmap[a].name, nmap[b].name);
      setLog((prev) => [
        { id: Date.now(), msg, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 8),
      ]);
    }, 1800);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [log]);

  const runLatencyTest = () => {
    setIsTesting(true);
    setPings((prev) => {
      const next = { ...prev };
      NODES.forEach((n) => {
        next[n.id] = Math.max(12, Math.round(n.basePing - 5 + Math.random() * 10));
      });
      return next;
    });
    setTimeout(() => setIsTesting(false), 1200);
  };

  const focusNodeId = hover || activeNode;
  const hoverNode = focusNodeId ? nmap[focusNodeId] : null;

  const activeEdges = focusNodeId
    ? new Set(EDGES.map((e, i) => (e.includes(focusNodeId) ? i : -1)).filter((i) => i >= 0))
    : new Set<number>();

  const filteredNodes = selectedRegion === 'All'
    ? NODES
    : NODES.filter((n) => n.region === selectedRegion);

  const pathGenerator = geoPath().projection(proj);

  return (
    <section className="relative py-14 max-w-7xl mx-auto px-4 font-sans text-white">
      {/* Keyframe Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes nm-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.6)} 60%{box-shadow:0 0 0 8px rgba(52,211,153,0)} }
        @keyframes radar-sweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes nm-log-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .nm-log-row { animation: nm-log-in 0.25s ease; }
        .nm-geo:hover { fill: #1e2d45 !important; }
        .radar-line { transform-origin: 450px 220px; animation: radar-sweep 12s linear infinite; }
      ` }} />

      {/* Header & Controls */}
      <div className="text-center mb-10 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(168,85,247,0.3)]">
          <Radio size={14} className="text-emerald-400 animate-pulse" />
          GLOBAL EDGE NETWORK TELEMETRY
        </div>

        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Global Network Footprint
        </h2>
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          Strategically deployed high-throughput nodes across major regions for ultra-low latency networking.
        </p>

        {/* Region Filter Tabs & Latency Test Button */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {(['All', 'Americas', 'Europe', 'Asia-Pacific'] as const).map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all border ${
                selectedRegion === region
                  ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                  : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {region}
            </button>
          ))}

          <button
            onClick={runLatencyTest}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-mono hover:border-emerald-400 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
          >
            <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
            {isTesting ? 'Testing Latencies...' : 'Test Latencies'}
          </button>
        </div>
      </div>

      {/* Main Glassmorphism Command Center Card */}
      <div className="bg-[#05071a]/95 border border-white/10 rounded-3xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.8)] relative backdrop-blur-2xl">
        {/* Radar Ambient Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="radar-line absolute w-[900px] h-[900px] -top-[230px] -left-[220px] rounded-full bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(56,189,248,0.25)_360deg)]" />
        </div>

        {/* Top Control & Telemetry Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 md:px-6 border-b border-white/[0.08] relative z-10 bg-[#080a22]/90">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse shadow-[0_0_10px_#34d399]" />
            <span className="text-xs font-mono font-black tracking-widest text-white uppercase">
              NETWORK STATUS — LIVE TELEMETRY
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <StatBox label="Nodes Online" value={`${NODES.length}/${NODES.length}`} color="#34d399" icon={Server} />
            <StatBox label="Sessions" value={sessions.toLocaleString()} color="#38bdf8" icon={Globe2} />
            <StatBox label="Pkt/s" value={pps.toLocaleString()} color="#a78bfa" icon={Zap} />
            <StatBox label="Traffic" value={`${traffic} GB`} color="#f472b6" icon={Activity} />
          </div>
        </div>

        {/* Map & Activity Log Grid Layout */}
        <div className="flex flex-col lg:flex-row relative z-10">
          {/* 2D Vector Map Canvas */}
          <div className="flex-1 relative min-h-[340px] sm:min-h-[440px] p-2 flex items-center justify-center">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto max-h-[520px] block select-none"
            >
              <defs>
                {EDGES.map(([a, b], i) => (
                  <path key={i} id={`stxPath_${i}`} d={arcPath(nmap[a].coords, nmap[b].coords)} />
                ))}
                <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Vector Countries */}
              <g className="countries">
                {worldGeo?.features?.map((geo: any, idx: number) => {
                  const d = pathGenerator(geo);
                  if (!d) return null;
                  return (
                    <path
                      key={idx}
                      d={d}
                      className="nm-geo transition-colors duration-200"
                      fill="#0b1126"
                      stroke="#1e293b"
                      strokeWidth="0.65"
                    />
                  );
                })}
              </g>

              {/* Base Arc Connections */}
              {EDGES.map(([a, b], i) => {
                const isEdgeActive = activeEdges.has(i);
                const isHot = i === hotEdge && !focusNodeId;
                const nodeARegionMatches = selectedRegion === 'All' || nmap[a].region === selectedRegion;
                const nodeBRegionMatches = selectedRegion === 'All' || nmap[b].region === selectedRegion;
                const isDimmed = !nodeARegionMatches && !nodeBRegionMatches;

                return (
                  <path
                    key={`base_${i}`}
                    d={arcPath(nmap[a].coords, nmap[b].coords)}
                    fill="none"
                    stroke={isEdgeActive ? '#38bdf8' : isHot ? '#c084fc' : '#1e3a4a'}
                    strokeWidth={isEdgeActive ? 2.4 : isHot ? 2 : 1.2}
                    opacity={isDimmed ? 0.15 : 1}
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Dashed Moving Arcs */}
              {EDGES.map(([a, b], i) => {
                const isEdgeActive = activeEdges.has(i);
                const isHot = i === hotEdge && !focusNodeId;
                return (
                  <path
                    key={`dash_${i}`}
                    d={arcPath(nmap[a].coords, nmap[b].coords)}
                    fill="none"
                    stroke={isEdgeActive ? '#38bdf8' : isHot ? '#c084fc' : '#38bdf8'}
                    strokeWidth={isEdgeActive ? 1.8 : isHot ? 1.5 : 0.9}
                    strokeDasharray="6 6"
                    opacity={isEdgeActive ? 0.95 : isHot ? 0.8 : 0.35}
                    filter={isEdgeActive ? 'url(#glow-cyan)' : undefined}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="12"
                      to="0"
                      dur={`${1.2 + (i % 4) * 0.25}s`}
                      repeatCount="indefinite"
                    />
                  </path>
                );
              })}

              {/* Animated Travelling Data Packets */}
              {EDGES.map(([a, b], i) => {
                const dur1 = 2.5 + (i % 5) * 0.45;
                const dur2 = 3.1 + (i % 4) * 0.35;
                return (
                  <g key={`pkt_${i}`}>
                    {/* Forward Cyan Packet */}
                    <circle r="3.6" fill="#38bdf8" opacity="0.95" filter="url(#glow-cyan)">
                      <animateMotion dur={`${dur1}s`} repeatCount="indefinite" calcMode="linear">
                        <mpath href={`#stxPath_${i}`} />
                      </animateMotion>
                    </circle>
                    {/* Return Emerald Packet */}
                    <circle r="2.8" fill="#34d399" opacity="0.85" filter="url(#glow-cyan)">
                      <animateMotion
                        dur={`${dur2}s`}
                        keyPoints="1;0"
                        keyTimes="0;1"
                        calcMode="linear"
                        repeatCount="indefinite"
                      >
                        <mpath href={`#stxPath_${i}`} />
                      </animateMotion>
                    </circle>
                  </g>
                );
              })}

              {/* Beacon Server Nodes */}
              {NODES.map((node, idx) => {
                const [x, y] = px(node.coords);
                const isHovered = focusNodeId === node.id;
                const isSelectedRegion = selectedRegion === 'All' || node.region === selectedRegion;
                const isConnected =
                  activeEdges.size > 0 &&
                  EDGES.some(([a, b], i) => activeEdges.has(i) && (a === node.id || b === node.id));

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x},${y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHover(node.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
                    opacity={isSelectedRegion ? 1 : 0.3}
                  >
                    {/* Expanding Outer Ring */}
                    <circle fill="none" stroke="#38bdf8" strokeWidth="1" r="4">
                      <animate
                        attributeName="r"
                        values="4;18;4"
                        dur={`${3 + (idx % 4) * 0.6}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.85;0;0.85"
                        dur={`${3 + (idx % 4) * 0.6}s`}
                        repeatCount="indefinite"
                      />
                    </circle>

                    {/* Expanding Inner Ring */}
                    <circle fill="none" stroke="#34d399" strokeWidth="0.8" r="4">
                      <animate
                        attributeName="r"
                        values="4;12;4"
                        dur={`${2 + (idx % 3) * 0.5}s`}
                        begin={`${0.5 + (idx % 3) * 0.3}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.75;0;0.75"
                        dur={`${2 + (idx % 3) * 0.5}s`}
                        begin={`${0.5 + (idx % 3) * 0.3}s`}
                        repeatCount="indefinite"
                      />
                    </circle>

                    {/* Node Core */}
                    <circle
                      r={isHovered ? 7.5 : isConnected ? 6 : 4.5}
                      fill={isHovered ? '#ffffff' : '#38bdf8'}
                      className="transition-all duration-200"
                      filter="url(#glow-cyan)"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hover / Selection Tooltip Popup */}
            {hoverNode && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#080b24]/95 border border-cyan-500/40 rounded-2xl px-5 py-3.5 shadow-[0_10px_35px_rgba(0,0,0,0.7)] backdrop-blur-xl flex items-center gap-4 text-xs z-30 whitespace-nowrap animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs shrink-0">
                  <MapPin size={16} />
                </div>
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[10px] font-semibold">{hoverNode.country}</span>
                    {hoverNode.name} — {hoverNode.city}
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                      ONLINE
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 space-x-2 font-mono">
                    <span>
                      Latency: <strong className="text-emerald-400">{pings[hoverNode.id]}ms</strong>
                    </span>
                    <span>•</span>
                    <span className="text-slate-300">{hoverNode.spec}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log Telemetry Sidebar */}
          <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-white/[0.08] flex flex-col bg-[#040614]/70">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Activity size={13} className="text-purple-400" /> LIVE ROUTING LOG
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            </div>

            <div ref={logRef} className="flex-1 overflow-y-auto max-h-[280px] lg:max-h-full divide-y divide-white/[0.04]">
              {log.map((entry) => (
                <div key={entry.id} className="nm-log-row p-3 hover:bg-white/[0.03] transition-colors">
                  <div className="text-xs text-slate-300 leading-snug font-sans flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">›</span>
                    <span>{entry.msg}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>{entry.time}</span>
                    <span className="text-[9px] text-purple-400 font-bold">ENCRYPTED</span>
                  </div>
                </div>
              ))}
              {log.length === 0 && (
                <div className="p-6 text-xs text-slate-500 text-center font-mono">Listening for events…</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-t border-white/[0.08] bg-[#080a22]/90 text-xs font-mono text-slate-400 relative z-10">
          <div className="flex flex-wrap items-center gap-6">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Active Node
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-6 h-0.5 border-t border-dashed border-sky-400" /> Data Route
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Return Packet
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">Click or hover any node for details</span>
        </div>
      </div>

      {/* Interactive Node Ping Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 mt-6">
        {filteredNodes.map((node, i) => {
          const isNodeActive = focusNodeId === node.id;
          return (
            <div
              key={node.id}
              onMouseEnter={() => setHover(node.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isNodeActive
                  ? 'bg-purple-600/20 border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.35)] scale-[1.02]'
                  : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-semibold">{node.country}</span>
                  {node.name}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
                  style={{ animation: `nm-pulse ${2 + (i % 3) * 0.4}s infinite` }}
                />
              </div>
              <div className="text-[11px] text-slate-400">{node.city}</div>
              <div className="text-xs font-mono font-bold text-sky-400 mt-2.5 flex items-center justify-between">
                <span>~{pings[node.id]}ms</span>
                <span className="text-[10px] text-slate-500 font-normal">Active</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default memo(NetworkMap);
