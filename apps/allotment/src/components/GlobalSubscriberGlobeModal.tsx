import React, { useState, useEffect, useRef } from 'react';
import type { COBEOptions } from 'cobe';
import { useEscapeToClose, backdropProps } from './hud/ui';
import { X, Globe as GlobeIcon, MapPin, Compass, Play, Pause, TrendingUp, DollarSign, Users, ExternalLink } from 'lucide-react';
import { GardenState, Plant } from '../types';
import { Globe } from './Globe';
import { subscriptionMarkers } from '../lib/globeMarkers';
import { useReducedMotion } from '../lib/useReducedMotion';
import { largestPlan } from '../lib/plans';

interface GlobalSubscriberGlobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenState: GardenState;
  onSelectPlantFromGlobe?: (plant: Plant) => void;
}

export const GlobalSubscriberGlobeModal: React.FC<GlobalSubscriberGlobeModalProps> = ({
  isOpen,
  onClose,
  gardenState,
  onSelectPlantFromGlobe,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'3d_globe' | '2d_map'>('3d_globe');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [hoveredPlant, setHoveredPlant] = useState<Plant | null>(null);
  const reducedMotion = useReducedMotion();
  /** The globe only drifts if a person wants it to *and* the machine allows it. */
  const orbiting = isRotating && !reducedMotion;

  // Group subscribers by country & region
  const countryStats = React.useMemo(() => {
    const map: Record<string, { code: string; name: string; flag: string; region: string; count: number; mrr: number; plants: Plant[] }> = {};

    gardenState.plants.forEach((plant) => {
      const code = plant.countryCode || 'US';
      const name = plant.countryName || 'United States';
      const flag = plant.countryFlag || '🇺🇸';
      const region = plant.region || 'North America';

      if (!map[code]) {
        map[code] = { code, name, flag, region, count: 0, mrr: 0, plants: [] };
      }
      map[code].count++;
      map[code].mrr += plant.mrr;
      map[code].plants.push(plant);
    });

    return Object.values(map).sort((a, b) => b.mrr - a.mrr);
  }, [gardenState]);

  const regionStats = React.useMemo(() => {
    const map: Record<string, { name: string; count: number; mrr: number }> = {};
    gardenState.plants.forEach((plant) => {
      const reg = plant.region || 'North America';
      if (!map[reg]) {
        map[reg] = { name: reg, count: 0, mrr: 0 };
      }
      map[reg].count++;
      map[reg].mrr += plant.mrr;
    });
    return Object.values(map).sort((a, b) => b.mrr - a.mrr);
  }, [gardenState]);

  // Filtered plants list
  const filteredPlants = React.useMemo(() => {
    return gardenState.plants.filter((p) => {
      if (selectedCountry && p.countryCode !== selectedCountry) return false;
      if (selectedRegion && p.region !== selectedRegion) return false;
      return true;
    });
  }, [gardenState, selectedCountry, selectedRegion]);

  /**
   * The book of business as COBE markers — see `lib/globeMarkers.ts` for what
   * a dot's colour and size mean. It reads `filteredPlants`, so picking a
   * country or a region on the right empties the rest of the earth rather than
   * just dimming the list beside it.
   */
  const globeConfig = React.useMemo<COBEOptions>(
    () => ({
      width: 800,
      height: 800,
      devicePixelRatio: 2,
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 5.5,
      baseColor: [0.24, 0.28, 0.36],
      markerColor: [16 / 255, 185 / 255, 129 / 255],
      glowColor: [0.09, 0.14, 0.22],
      markers: subscriptionMarkers(filteredPlants),
    }),
    [filteredPlants]
  );

  // 2D Equirectangular Map Renderer. The 3D sphere is COBE's job now; this
  // canvas only ever runs for the flat projection.
  useEffect(() => {
    if (!isOpen || viewMode !== '2d_map') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Nothing here moves, so it is drawn once per change rather than at 60fps —
    // the frame loop only ever existed to spin the sphere.
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += height / 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // The flat projection reads off the same ladder the sphere's markers do,
    // so the same subscription is the same size and colour in both.
    const top = largestPlan();

    // Plot 2D coordinates
    filteredPlants.forEach((plant) => {
      const lat = plant.lat || 0;
      const lng = plant.lng || 0;

      const px = ((lng + 180) / 360) * width;
      const py = ((90 - lat) / 180) * height;

      const dotSize = plant.plan === top ? 6 : 4;

      ctx.beginPath();
      ctx.arc(px, py, dotSize * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = plant.plan === top ? '#10B981' : '#3B82F6';
      ctx.fill();
    });
  }, [isOpen, viewMode, filteredPlants]);

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/75 backdrop-blur-md p-4 animate-in fade-in duration-200" {...backdropProps(onClose)}>
      <div className="relative w-full max-w-5xl bg-slate-900 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-slate-800 p-6 text-slate-100 flex flex-col max-h-[90vh]">
        {/* Top Navigation Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <GlobeIcon className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white tracking-tight">
                  GLOBAL SUBSCRIBER SPHERE
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-500/30">
                  Live Stripe Geolocation
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Visualizing global customer allotment density across 15+ countries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRotating(!isRotating)}
              disabled={reducedMotion}
              title={
                reducedMotion
                  ? 'Orbit is off because this machine asks for reduced motion — drag the globe to turn it'
                  : undefined
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                orbiting
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {orbiting ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{orbiting ? 'Pause Orbit' : 'Orbit Globe'}</span>
            </button>

            <button
              onClick={() => setViewMode(viewMode === '3d_globe' ? '2d_map' : '3d_globe')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-700"
            >
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>{viewMode === '3d_globe' ? '2D Map Projection' : '3D Orbit Sphere'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 flex-1 overflow-hidden">
          {/* Globe Canvas Column */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-950/80 rounded-2xl border border-slate-800/80 p-4 relative min-h-[360px] overflow-hidden">
            {viewMode === '3d_globe' ? (
              <Globe
                config={globeConfig}
                autoRotate={orbiting}
                className="max-w-[380px]"
              />
            ) : (
              <canvas
                ref={canvasRef}
                width={520}
                height={380}
                className="w-full h-auto max-h-[380px] object-contain"
              />
            )}

            {/* Quick Canvas Overlay Info Badge */}
            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Showing {filteredPlants.length} Global Allotments</span>
            </div>
          </div>

          {/* Leaderboard & Regions Sidebar Column */}
          <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Regional Revenue Cards */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Regional Revenue Distribution
              </span>
              <div className="grid grid-cols-2 gap-2">
                {regionStats.map((reg) => (
                  <button
                    key={reg.name}
                    onClick={() =>
                      setSelectedRegion(selectedRegion === reg.name ? null : reg.name)
                    }
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col ${
                      selectedRegion === reg.name
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                        : 'bg-slate-800/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">{reg.name}</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-[11px] text-emerald-400 font-extrabold">
                        ${reg.mrr}/mo
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {reg.count} subs
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Country Breakdown List */}
            <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto min-h-[220px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Top Subscriber Countries
                </span>
                {selectedCountry && (
                  <button
                    onClick={() => setSelectedCountry(null)}
                    className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Clear Country Filter
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5 pr-1">
                {countryStats.map((c) => {
                  const isSelected = selectedCountry === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() =>
                        setSelectedCountry(selectedCountry === c.code ? null : c.code)
                      }
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                          : 'bg-slate-800/50 border-slate-800/80 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg leading-none">{c.flag}</span>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-xs leading-tight">{c.name}</span>
                          <span
                            className={`text-[10px] ${
                              isSelected ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            {c.count} active allotments
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-xs text-emerald-400">
                          ${c.mrr}/mo
                        </span>
                        {onSelectPlantFromGlobe && c.plants.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPlantFromGlobe(c.plants[0]);
                              onClose();
                            }}
                            className="p-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="Inspect Top Subscriber"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
