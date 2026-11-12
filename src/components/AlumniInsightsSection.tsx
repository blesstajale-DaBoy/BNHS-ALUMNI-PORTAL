import React, { useMemo, useState } from 'react';
import { MapPin, Briefcase, Users, ArrowUpRight, Compass } from 'lucide-react';
import { AlumniProfileRecord } from '../data/bnhsData';

interface AlumniInsightsSectionProps {
  alumniList: AlumniProfileRecord[];
  onFilterByBatchYear: (year: number) => void;
  onFilterByCity: (city: string) => void;
  onNavigateRegister: () => void;
}

interface BatchRankItem {
  year: number;
  count: number;
  sharePercent: number;
  strands: string[];
  professions: string[];
  members: AlumniProfileRecord[];
}

interface CityDistributionItem {
  city: string;
  regionLabel: string;
  count: number;
  sharePercent: number;
  professions: { title: string; count: number }[];
  members: AlumniProfileRecord[];
  coords: { x: number; y: number };
}

// Known schematic coordinates on our Philippine Archipelago SVG canvas (viewBox 0 0 360 440)
const KNOWN_CITY_COORDS: Record<string, { x: number; y: number; region: string }> = {
  'Barobo, Surigao del Sur': { x: 268, y: 312, region: 'Caraga Region XIII (Home Campus)' },
  'Tandag City, Surigao del Sur': { x: 274, y: 292, region: 'Caraga Region XIII' },
  'Butuan City, Agusan del Norte': { x: 246, y: 298, region: 'Caraga Region XIII' },
  'San Francisco, Agusan del Sur': { x: 256, y: 324, region: 'Caraga Region XIII' },
  'Davao City, Davao del Sur': { x: 248, y: 368, region: 'Davao Region XI' },
  'Cebu City, Cebu': { x: 205, y: 242, region: 'Central Visayas VII' },
  'Taguig City, Metro Manila': { x: 136, y: 132, region: 'National Capital Region (NCR)' },
};

function getCityPosition(city: string, index: number): { x: number; y: number; region: string } {
  const exact = KNOWN_CITY_COORDS[city];
  if (exact) return exact;

  const lower = city.toLowerCase();
  if (lower.includes('barobo')) return KNOWN_CITY_COORDS['Barobo, Surigao del Sur'];
  if (lower.includes('tandag')) return KNOWN_CITY_COORDS['Tandag City, Surigao del Sur'];
  if (lower.includes('butuan')) return KNOWN_CITY_COORDS['Butuan City, Agusan del Norte'];
  if (lower.includes('agusan')) return KNOWN_CITY_COORDS['San Francisco, Agusan del Sur'];
  if (lower.includes('davao')) return KNOWN_CITY_COORDS['Davao City, Davao del Sur'];
  if (lower.includes('cebu')) return KNOWN_CITY_COORDS['Cebu City, Cebu'];
  if (lower.includes('manila') || lower.includes('taguig') || lower.includes('makati') || lower.includes('quezon')) {
    return KNOWN_CITY_COORDS['Taguig City, Metro Manila'];
  }

  // Deterministic fallback coordinate on the map canvas for new user-entered cities
  const angle = (index * 137.5 * Math.PI) / 180;
  const x = Math.round(190 + Math.cos(angle) * 65);
  const y = Math.round(250 + Math.sin(angle) * 85);
  return { x, y, region: 'Alumni Chapter Hub' };
}

function getBatchDesignation(year: number, rankIndex: number): string {
  if (rankIndex === 0) return 'Most Active Batch Leader';
  if (year >= 2018) return 'Senior High School Cohort';
  if (year >= 2010) return 'RBEC / K-12 Transition Era';
  if (year >= 2000) return 'Silver Era Cohort';
  return 'Pioneer & Golden Tradition';
}

export const AlumniInsightsSection: React.FC<AlumniInsightsSectionProps> = ({
  alumniList,
  onFilterByBatchYear,
  onFilterByCity,
  onNavigateRegister,
}) => {
  const [showAllBatches, setShowAllBatches] = useState(false);
  const [selectedCityFilter, setSelectedCityFilter] = useState<string | null>(null);

  // 1. Compute Most Active Batch Leaderboard from graduationYear
  const batchLeaderboard = useMemo<BatchRankItem[]>(() => {
    const total = alumniList.length || 1;
    const byYear = new Map<number, AlumniProfileRecord[]>();

    alumniList.forEach((alum) => {
      const yr = Number(alum.graduationYear);
      const list = byYear.get(yr) || [];
      list.push(alum);
      byYear.set(yr, list);
    });

    const items: BatchRankItem[] = Array.from(byYear.entries()).map(([year, members]) => {
      const strands = Array.from(new Set(members.map((m) => m.strand)));
      const professions = Array.from(new Set(members.map((m) => m.profession)));
      return {
        year,
        count: members.length,
        sharePercent: Math.round((members.length / total) * 1000) / 10,
        strands,
        professions,
        members,
      };
    });

    return items.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.year - a.year;
    });
  }, [alumniList]);

  // 2. Compute Professional Distribution Across Cities from locationCity & profession
  const cityDistributions = useMemo<CityDistributionItem[]>(() => {
    const total = alumniList.length || 1;
    const byCity = new Map<string, AlumniProfileRecord[]>();

    alumniList.forEach((alum) => {
      const cityKey = alum.locationCity.trim() || 'Barobo, Surigao del Sur';
      const list = byCity.get(cityKey) || [];
      list.push(alum);
      byCity.set(cityKey, list);
    });

    const items: CityDistributionItem[] = Array.from(byCity.entries()).map(
      ([city, members], idx) => {
        const profCounts = new Map<string, number>();
        members.forEach((m) => {
          const p = m.profession.trim();
          profCounts.set(p, (profCounts.get(p) || 0) + 1);
        });

        const professions = Array.from(profCounts.entries())
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count);

        const pos = getCityPosition(city, idx);

        return {
          city,
          regionLabel: pos.region,
          count: members.length,
          sharePercent: Math.round((members.length / total) * 1000) / 10,
          professions,
          members,
          coords: { x: pos.x, y: pos.y },
        };
      }
    );

    return items.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.city.localeCompare(b.city);
    });
  }, [alumniList]);

  const maxBatchCount = batchLeaderboard[0]?.count || 1;
  const maxCityCount = cityDistributions[0]?.count || 1;
  const displayedBatches = showAllBatches ? batchLeaderboard : batchLeaderboard.slice(0, 5);

  const visibleCities = selectedCityFilter
    ? cityDistributions.filter((c) => c.city === selectedCityFilter)
    : cityDistributions;

  return (
    <div className="space-y-10">
      {/* SECTION A: MOST ACTIVE BATCH LEADERBOARD */}
      <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/15">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
              Batch Participation & Registry Standings
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              Most Active Batch Leaderboard
            </h2>
            <p className="text-sm text-white/80 mt-1.5 max-w-2xl leading-relaxed">
              Live ranking of Barobo National High School graduation years based on registered alumni profiles. Select any graduation batch to view its members in the Alumni Directory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 bg-[#650019] p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setShowAllBatches(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !showAllBatches
                    ? 'bg-[#D4AF37] text-[#450012]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Top 5 Batches
              </button>
              <button
                type="button"
                onClick={() => setShowAllBatches(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showAllBatches
                    ? 'bg-[#D4AF37] text-[#450012]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                All Batches ({batchLeaderboard.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onNavigateRegister}
              className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs hover:bg-[#e3c14d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Boost Your Batch Rank
            </button>
          </div>
        </div>

        {/* White Cards Leaderboard Table / Rows */}
        <div className="mt-6 space-y-3">
          {displayedBatches.map((batch, index) => {
            const barWidthPercent = Math.max(12, Math.round((batch.count / maxBatchCount) * 100));
            const isTopThree = index < 3;

            return (
              <div
                key={batch.year}
                onClick={() => onFilterByBatchYear(batch.year)}
                className="bg-white text-gray-900 rounded-xl p-4 sm:p-5 border border-gray-200 hover:border-[#D4AF37] transition-all cursor-pointer group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Rank + Batch Year + Strands & Professions */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-lg font-mono-num font-bold text-sm flex items-center justify-center shrink-0 border ${
                        index === 0
                          ? 'bg-[#D4AF37] text-[#450012] border-[#D4AF37]'
                          : isTopThree
                          ? 'bg-[#650019] text-[#D4AF37] border-[#D4AF37]/40'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      #{String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-gray-900 group-hover:text-[#650019] transition-colors">
                          Class of {batch.year}
                        </h3>
                        <span className="text-xs text-gray-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs font-semibold text-[#650019]">
                          {getBatchDesignation(batch.year, index)}
                        </span>
                      </div>

                      {/* Clean unboxed metadata per Zero-Pill Discipline */}
                      <div className="text-xs text-gray-600 mt-1 truncate max-w-2xl">
                        <span className="font-semibold text-gray-800">Strands:</span>{' '}
                        {batch.strands.join(' · ')}{' '}
                        <span className="mx-1.5 text-gray-400" aria-hidden="true">
                          |
                        </span>
                        <span className="font-semibold text-gray-800">Professions:</span>{' '}
                        {batch.professions.slice(0, 3).join(' · ')}
                        {batch.professions.length > 3 ? ` +${batch.professions.length - 3} more` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Right: Numeric Count + Proportional Density Bar */}
                  <div className="flex items-center gap-5 shrink-0 md:w-72 justify-between md:justify-end">
                    <div className="flex-1 max-w-[150px]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 font-medium">Registry Share</span>
                        <span className="font-mono-num font-bold text-[#650019]">
                          {batch.sharePercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#650019] rounded-full transition-all duration-300"
                          style={{ width: `${barWidthPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <span className="font-mono-num text-lg font-bold text-gray-900">
                        {batch.count}
                      </span>
                      <span className="block text-[11px] text-gray-500">
                        {batch.count === 1 ? 'Alumnus' : 'Alumni'}
                      </span>
                    </div>

                    <ArrowUpRight className="w-4 h-4 text-[#650019] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION B: PROFESSIONAL DISTRIBUTION ACROSS CITIES (DENSITY MAP & LIST) */}
      <div className="bg-[#450012] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/15">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">
              Geographic & Career Footprint (`locationCity`)
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              Professional Distribution of Alumni Across Cities
            </h2>
            <p className="text-sm text-white/80 mt-1.5 max-w-2xl leading-relaxed">
              Visual density map and city-by-city career directory showing where Barobo National High School graduates live and practice their professions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="bg-[#650019] border border-[#D4AF37]/30 rounded-lg px-4 py-2 text-right">
              <span className="block text-[11px] text-white/70">Active City Chapters</span>
              <span className="font-mono-num text-lg font-bold text-[#D4AF37]">
                {cityDistributions.length} Cities
              </span>
            </div>
            {selectedCityFilter && (
              <button
                type="button"
                onClick={() => setSelectedCityFilter(null)}
                className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#450012] font-bold text-xs hover:bg-[#e3c14d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Show All {cityDistributions.length} Cities
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Split: Interactive Density Map (Left) + Ranked Professional Distribution List (Right) */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Interactive SVG Regional & Archipelago Density Map */}
          <div className="lg:col-span-5 bg-white text-gray-900 rounded-xl p-5 border border-gray-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#650019]" />
                  <h3 className="text-sm font-bold text-gray-900">
                    Alumni City Density Map
                  </h3>
                </div>
                <span className="text-xs text-gray-500">Click hub to filter</span>
              </div>

              <div className="relative bg-[#450012] rounded-xl overflow-hidden border border-[#650019]/20 p-3">
                <svg
                  viewBox="0 0 360 440"
                  className="w-full h-[340px] select-none"
                  role="img"
                  aria-label="Philippine Alumni City Density Map"
                >
                  {/* Subtle Coordinate Grid Lines */}
                  <g stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1">
                    <line x1="0" y1="110" x2="360" y2="110" />
                    <line x1="0" y1="220" x2="360" y2="220" />
                    <line x1="0" y1="330" x2="360" y2="330" />
                    <line x1="120" y1="0" x2="120" y2="440" />
                    <line x1="240" y1="0" x2="240" y2="440" />
                  </g>

                  {/* Stylized Philippine Archipelago Silhouette Landmasses */}
                  <g fill="#650019" stroke="#D4AF37" strokeOpacity="0.35" strokeWidth="1.2">
                    {/* Luzon */}
                    <path d="M112,48 L152,55 L164,98 L148,136 L178,162 L162,182 L128,155 L118,125 L104,88 Z" />
                    {/* Visayas Corridor */}
                    <path d="M168,205 L235,198 L252,235 L218,265 L175,255 Z" />
                    {/* Mindanao & Caraga HeartLand */}
                    <path d="M196,282 L278,274 L296,338 L266,392 L212,386 L182,342 Z" />
                  </g>

                  {/* Connection Lines from Barobo Home Campus (268, 312) to Chapter Cities */}
                  <g stroke="#D4AF37" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3">
                    {cityDistributions.map((item) => (
                      <line
                        key={`line-${item.city}`}
                        x1={268}
                        y1={312}
                        x2={item.coords.x}
                        y2={item.coords.y}
                      />
                    ))}
                  </g>

                  {/* Proportional City Density Markers */}
                  {cityDistributions.map((item) => {
                    const isSelected = selectedCityFilter === item.city;
                    const outerRadius = 12 + Math.round((item.count / maxCityCount) * 14);
                    const innerRadius = 7 + Math.round((item.count / maxCityCount) * 6);
                    const shortCityName = item.city.split(',')[0];

                    return (
                      <g
                        key={item.city}
                        onClick={() =>
                          setSelectedCityFilter(isSelected ? null : item.city)
                        }
                        className="cursor-pointer"
                      >
                        <circle
                          cx={item.coords.x}
                          cy={item.coords.y}
                          r={outerRadius}
                          fill={isSelected ? '#D4AF37' : '#D4AF37'}
                          fillOpacity={isSelected ? 0.45 : 0.22}
                          stroke="#D4AF37"
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        <circle
                          cx={item.coords.x}
                          cy={item.coords.y}
                          r={innerRadius}
                          fill={isSelected ? '#ffffff' : '#D4AF37'}
                          stroke="#450012"
                          strokeWidth="2"
                        />
                        <text
                          x={item.coords.x}
                          y={item.coords.y + 3.5}
                          textAnchor="middle"
                          fill="#450012"
                          fontSize="9"
                          fontWeight="800"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {item.count}
                        </text>
                        <text
                          x={item.coords.x}
                          y={item.coords.y - outerRadius - 4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9.5"
                          fontWeight="600"
                        >
                          {shortCityName}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="mt-2 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-white/80">
                  <span>Circle size = Registered alumni density</span>
                  <span className="font-mono-num text-[#D4AF37] font-semibold">
                    Total: {alumniList.length} Eagles
                  </span>
                </div>
              </div>
            </div>

            {/* Quick City Filter Buttons below Map */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Select City Hub to Inspect Professions:
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCityFilter(null)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCityFilter === null
                      ? 'bg-[#650019] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Cities ({cityDistributions.length})
                </button>
                {cityDistributions.map((c) => {
                  const shortName = c.city.split(',')[0];
                  const active = selectedCityFilter === c.city;
                  return (
                    <button
                      key={c.city}
                      type="button"
                      onClick={() => setSelectedCityFilter(active ? null : c.city)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#D4AF37] text-[#450012]'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {shortName} ({c.count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Ranked City & Professional Distribution Density List */}
          <div className="lg:col-span-7 bg-white text-gray-900 rounded-xl p-5 sm:p-6 border border-gray-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100 mb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">
                    {selectedCityFilter
                      ? `Professional Breakdown: ${selectedCityFilter}`
                      : 'City-by-City Professional Distribution List'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Grouped by profile locationCity and active professions
                  </p>
                </div>
                <span className="font-mono-num text-xs font-bold text-[#650019]">
                  {visibleCities.length} {visibleCities.length === 1 ? 'Hub' : 'Hubs'} Shown
                </span>
              </div>

              <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                {visibleCities.map((cityItem) => {
                  const densityPercent = Math.max(
                    14,
                    Math.round((cityItem.count / maxCityCount) * 100)
                  );

                  return (
                    <div
                      key={cityItem.city}
                      className="p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-[#650019]/40 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#650019] shrink-0" />
                            <h4 className="font-display text-base font-bold text-gray-900">
                              {cityItem.city}
                            </h4>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{cityItem.regionLabel}</p>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="font-mono-num text-sm font-bold text-[#650019]">
                            {cityItem.count} {cityItem.count === 1 ? 'Alumnus' : 'Alumni'} (
                            {cityItem.sharePercent}%)
                          </span>
                        </div>
                      </div>

                      {/* Proportional City Density Bar */}
                      <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#650019] to-[#D4AF37] rounded-full transition-all duration-300"
                          style={{ width: `${densityPercent}%` }}
                        />
                      </div>

                      {/* Professions Breakdown in this City (Unboxed Clean Typography) */}
                      <div className="mt-3 pt-3 border-t border-gray-200/80">
                        <p className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-[#650019]" />
                          <span>Represented Professions in {cityItem.city.split(',')[0]}:</span>
                        </p>
                        <div className="text-xs text-gray-700 leading-relaxed">
                          {cityItem.professions.map((prof, pIdx) => (
                            <React.Fragment key={prof.title}>
                              {pIdx > 0 && (
                                <span className="mx-2 text-gray-400" aria-hidden="true">
                                  ·
                                </span>
                              )}
                              <span>
                                <strong className="text-gray-900">{prof.title}</strong>{' '}
                                <span className="font-mono-num text-gray-500">({prof.count})</span>
                              </span>
                            </React.Fragment>
                          ))}
                        </div>

                        {/* Alumni Names & Graduation Batches in this City */}
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span className="truncate max-w-md">
                            Notable Eagles:{' '}
                            {cityItem.members
                              .map((m) => `${m.fullName} ('${String(m.graduationYear).slice(-2)})`)
                              .join(' · ')}
                          </span>

                          <button
                            type="button"
                            onClick={() => onFilterByCity(cityItem.city)}
                            className="text-xs font-bold text-[#650019] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>View in Directory</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#650019]" />
                <span>Updated automatically from public Alumni Directory profiles</span>
              </span>
              <button
                type="button"
                onClick={onNavigateRegister}
                className="font-bold text-[#650019] hover:underline cursor-pointer"
              >
                Add or Update My City & Profession →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
