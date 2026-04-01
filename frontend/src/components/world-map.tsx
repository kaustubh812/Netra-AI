"use client";

import { useEffect, useMemo, useState } from "react";

// ── Projection ──────────────────────────────────────────────
// Equirectangular: [lng, lat] → [x, y] on viewBox 0 0 960 480
// Shifted to crop poles (useless whitespace) → focus latitudes -60 to 85
const VW = 960;
const VH = 480;
const LAT_MIN = -60;
const LAT_MAX = 85;

function projectX(lng: number): number {
  return ((lng + 180) / 360) * VW;
}
function projectY(lat: number): number {
  const clamped = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
  return ((LAT_MAX - clamped) / (LAT_MAX - LAT_MIN)) * VH;
}

// Convert GeoJSON coordinates → SVG path string
function coordsToPath(coords: number[][]): string {
  if (coords.length === 0) return "";
  const parts = coords.map(([lng, lat], i) => {
    const x = projectX(lng).toFixed(1);
    const y = projectY(lat).toFixed(1);
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  });
  return parts.join("") + "Z";
}

function geometryToPaths(geometry: { type: string; coordinates: number[][][] | number[][][][] }): string[] {
  if (geometry.type === "Polygon") {
    // Only outer ring (index 0)
    return [(geometry.coordinates as number[][][]).map(ring => coordsToPath(ring)).join("")];
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).map(poly =>
      poly.map(ring => coordsToPath(ring)).join("")
    );
  }
  return [];
}

// ── Country dot positions (financial centers) ───────────────
const COUNTRY_POSITIONS: Record<string, [number, number]> = {
  IN: [78.9, 20.6],
  US: [-95.7, 37.1],
  CN: [104.0, 35.0],
  JP: [139.7, 35.7],
  GB: [-1.5, 53.5],
  DE: [10.0, 51.0],
  FR: [2.35, 46.5],
  HK: [114.2, 22.3],
  KR: [127.0, 37.6],
  AU: [134.0, -25.0],
};

interface GeoData {
  land: { type: string; coordinates: number[][][] | number[][][][] };
  countries: Record<string, { type: string; coordinates: number[][][] | number[][][][] }>;
}

interface WorldMapProps {
  countries: Record<string, { overall_change_pct: number }>;
  selectedCountry: string | null;
  onSelectCountry: (code: string) => void;
}

export function WorldMap({ countries, selectedCountry, onSelectCountry }: WorldMapProps) {
  const [geo, setGeo] = useState<GeoData | null>(null);

  useEffect(() => {
    fetch("/world-map.json")
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => {});
  }, []);

  // Pre-compute SVG paths from GeoJSON
  const landPaths = useMemo(() => {
    if (!geo) return [];
    return geometryToPaths(geo.land);
  }, [geo]);

  const countryPaths = useMemo(() => {
    if (!geo) return {};
    const result: Record<string, string[]> = {};
    for (const [code, geom] of Object.entries(geo.countries)) {
      result[code] = geometryToPaths(geom);
    }
    return result;
  }, [geo]);

  const dots = useMemo(() => {
    return Object.entries(COUNTRY_POSITIONS).map(([code, [lng, lat]]) => {
      const x = projectX(lng);
      const y = projectY(lat);
      const data = countries[code];
      const change = data?.overall_change_pct ?? 0;
      const positive = change >= 0;
      const isSelected = selectedCountry === code;
      return { code, x, y, positive, isSelected, change };
    });
  }, [countries, selectedCountry]);

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="neon-green" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feFlood floodColor="rgb(16,185,129)" floodOpacity="0.4" />
          <feComposite in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="neon-red" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feFlood floodColor="rgb(244,63,94)" floodOpacity="0.4" />
          <feComposite in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle latitude/longitude grid */}
      {[-30, 0, 30, 60].map((lat) => {
        const y = projectY(lat);
        return (
          <line key={`lat${lat}`} x1="0" y1={y} x2={VW} y2={y}
            stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" strokeDasharray="3 6" />
        );
      })}
      {[-120, -60, 0, 60, 120].map((lng) => {
        const x = projectX(lng);
        return (
          <line key={`lng${lng}`} x1={x} y1="0" x2={x} y2={VH}
            stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" strokeDasharray="3 6" />
        );
      })}

      {/* Land mass — base layer */}
      {landPaths.map((d, i) => (
        <path
          key={`land-${i}`}
          d={d}
          fill="rgba(30,30,60,0.7)"
          stroke="rgba(100,120,160,0.25)"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      ))}

      {/* Tracked country shapes — neon colored */}
      {Object.entries(countryPaths).map(([code, paths]) => {
        const data = countries[code];
        if (!data) return null;
        const positive = data.overall_change_pct >= 0;
        const isSelected = selectedCountry === code;

        const fillColor = positive
          ? isSelected ? "rgba(16,185,129,0.30)" : "rgba(16,185,129,0.13)"
          : isSelected ? "rgba(244,63,94,0.30)" : "rgba(244,63,94,0.13)";
        const strokeColor = positive
          ? isSelected ? "rgba(16,185,129,0.8)" : "rgba(16,185,129,0.35)"
          : isSelected ? "rgba(244,63,94,0.8)" : "rgba(244,63,94,0.35)";
        const filterAttr = isSelected
          ? positive ? "url(#neon-green)" : "url(#neon-red)"
          : undefined;

        return paths.map((d, i) => (
          <path
            key={`${code}-${i}`}
            d={d}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={isSelected ? 1.2 : 0.6}
            strokeLinejoin="round"
            filter={filterAttr}
            onClick={() => onSelectCountry(code)}
            className="cursor-pointer"
          />
        ));
      })}

      {/* Country dots with pulsing glow */}
      {dots.map(({ code, x, y, positive, isSelected, change }) => {
        const color = positive ? "rgb(16,185,129)" : "rgb(244,63,94)";
        const glow = positive ? "rgba(16,185,129,0.6)" : "rgba(244,63,94,0.6)";
        const dimGlow = positive ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)";
        const r = isSelected ? 7 : 4.5;

        return (
          <g
            key={code}
            onClick={() => onSelectCountry(code)}
            className="cursor-pointer"
          >
            {/* Pulse ring */}
            <circle cx={x} cy={y} r={r + 4} fill="none" stroke={glow} strokeWidth="1" opacity="0.5">
              <animate attributeName="r" values={`${r + 2};${r + 12};${r + 2}`} dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite" />
            </circle>

            {/* Soft halo */}
            <circle cx={x} cy={y} r={r + 3} fill={dimGlow} />

            {/* Dot */}
            <circle
              cx={x} cy={y} r={r}
              fill={color}
              stroke={isSelected ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.15)"}
              strokeWidth={isSelected ? 1.5 : 0.5}
              style={{ filter: `drop-shadow(0 0 ${isSelected ? 8 : 3}px ${glow})` }}
            />

            {/* Label */}
            <text
              x={x} y={y - r - 4}
              textAnchor="middle"
              fill="rgba(255,255,255,0.75)"
              fontSize="9"
              fontWeight="600"
              fontFamily="Inter, sans-serif"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
            >
              {code}
            </text>

            {/* Change % */}
            <text
              x={x} y={y + r + 11}
              textAnchor="middle"
              fill={color}
              fontSize="8.5"
              fontWeight="600"
              fontFamily="JetBrains Mono, monospace"
              style={{ textShadow: `0 0 8px ${glow}` }}
            >
              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
