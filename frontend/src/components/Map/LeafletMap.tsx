/**
 * Leaflet + OpenStreetMap map provider.
 * Free, no API key required.
 */

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GameMapProps } from './types';

// Fix default marker icon path issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function createColoredIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const correctIcon = L.divIcon({
  className: 'correct-marker',
  html: '<div style="background:#facc15;width:22px;height:22px;border-radius:50%;border:3px solid #a16207;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function createDraftIcon(color: string, isCaptain: boolean) {
  const size = isCaptain ? 18 : 14;
  const opacity = isCaptain ? 0.9 : 0.45;
  const border = isCaptain ? '2px solid white' : '2px dashed rgba(255,255,255,0.7)';
  return L.divIcon({
    className: 'draft-marker',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:${border};opacity:${opacity};box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAX_ZOOM = Number(import.meta.env.VITE_MAX_ZOOM) || 18;

export function LeafletMap({ guessPosition, onPositionChange, revealData, teamColor, teamDrafts, currentPlayerId, currentPlayerNickname, isCaptain }: GameMapProps) {
  return (
    <MapContainer
      center={[62, 95]}
      zoom={3}
      minZoom={3}
      maxZoom={MAX_ZOOM}
      className="guess-map"
      style={{ height: '100%', width: '100%' }}
      attributionControl={false}
    >
      <ResizeHandler />
      <TileLayer
        attribution={import.meta.env.VITE_TILE_URL ? '' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
        url={TILE_URL}
        maxZoom={MAX_ZOOM}
        noWrap={true}
      />

      {onPositionChange && (
        <ClickHandler onClick={(lat, lng) => onPositionChange([lat, lng])} />
      )}

      {!revealData && teamDrafts && teamColor && teamDrafts
        .filter((d) => d.player_id !== currentPlayerId)
        .map((d) => (
          <Marker
            key={d.player_id}
            position={[d.lat, d.lng]}
            icon={createDraftIcon(teamColor, d.is_captain)}
            eventHandlers={
              isCaptain && onPositionChange
                ? { click: () => onPositionChange([d.lat, d.lng]) }
                : undefined
            }
          >
            <Tooltip direction="top" offset={[0, -10]} permanent className="nickname-tooltip">
              {d.nickname}{d.is_captain ? ' ★' : ''}
            </Tooltip>
          </Marker>
        ))
      }

      {guessPosition && !revealData && (
        <Marker
          position={guessPosition}
          icon={teamColor
            ? (isCaptain ? createColoredIcon(teamColor) : createDraftIcon(teamColor, false))
            : undefined
          }
        >
          {currentPlayerNickname && (
            <Tooltip direction="top" offset={[0, -10]} permanent className="nickname-tooltip">
              {currentPlayerNickname}{isCaptain ? ' ★' : ''}
            </Tooltip>
          )}
        </Marker>
      )}

      {revealData && (
        <>
          <Marker position={[revealData.correct.lat, revealData.correct.lng]} icon={correctIcon} />
          {revealData.guesses.map((g) => (
            <Marker key={g.team_id} position={[g.lat, g.lng]} icon={createColoredIcon(g.team_color)} />
          ))}
          {revealData.guesses.map((g) => (
            <Polyline
              key={`line-${g.team_id}`}
              positions={[[revealData.correct.lat, revealData.correct.lng], [g.lat, g.lng]]}
              color={g.team_color}
              weight={2}
              dashArray="5,10"
            />
          ))}
        </>
      )}
    </MapContainer>
  );
}
