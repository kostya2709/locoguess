/**
 * Google Maps provider with Street View panorama support.
 * Requires VITE_GOOGLE_MAPS_API_KEY environment variable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { StreetViewPanel } from './StreetViewPanel';
import type { GameMapProps } from './types';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/** Colored circle marker for teams. Shifted down so the circle's center
 * (not its bottom) sits at the AdvancedMarker's lat/lng anchor. */
function CircleMarker({ color, size = 16, opacity = 1, dashed = false, label }: {
  color: string; size?: number; opacity?: number; dashed?: boolean; label?: string;
}) {
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
      transform: `translateY(${size / 2}px)`,
    }}>
      {label && <div className="gmap-marker-label">{label}</div>}
      <div style={{
        width: size, height: size, borderRadius: '50%', background: color,
        border: dashed ? '2px dashed rgba(255,255,255,0.7)' : '2px solid white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)', opacity,
      }} />
    </div>
  );
}

function CorrectMarker() {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', background: '#facc15',
      border: '3px solid #a16207', boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      transform: 'translateY(11px)',
    }} />
  );
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onClick]);
  return null;
}

/** Dashed polyline between two points on Google Maps. */
function DashedPolyline({ from, to, color }: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; color: string }) {
  const map = useMap();
  const lineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;
    lineRef.current = new google.maps.Polyline({
      path: [from, to],
      strokeColor: color,
      strokeWeight: 2,
      strokeOpacity: 0,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeWeight: 2, scale: 3 },
        offset: '0',
        repeat: '15px',
      }],
      map,
    });
    return () => { lineRef.current?.setMap(null); };
  }, [map, from, to, color]);

  return null;
}

/** Exposes the map instance to the parent via ref callback. */
function MapRefBridge({ onMap }: { onMap: (map: google.maps.Map | null) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}


function GoogleMapInner(props: GameMapProps & { onMapReady: (map: google.maps.Map | null) => void }) {
  const { guessPosition, onPositionChange, revealData, teamColor, teamDrafts, currentPlayerId, currentPlayerNickname, isCaptain, onMapReady } = props;

  const handleClick = useCallback((lat: number, lng: number) => {
    onPositionChange?.([lat, lng]);
  }, [onPositionChange]);

  return (
    <Map
      defaultCenter={{ lat: 62, lng: 95 }}
      defaultZoom={3}
      minZoom={3}
      gestureHandling="cooperative"
      disableDefaultUI={true}
      zoomControl={true}
      mapId="locoguess-map"
      style={{ width: '100%', height: '100%' }}
    >
      <MapRefBridge onMap={onMapReady} />
      {onPositionChange && <MapClickHandler onClick={handleClick} />}

      {!revealData && teamDrafts && teamColor && teamDrafts
        .filter((d) => d.player_id !== currentPlayerId)
        .map((d) => (
          <AdvancedMarker
            key={d.player_id}
            position={{ lat: d.lat, lng: d.lng }}
            onClick={isCaptain && onPositionChange ? () => onPositionChange([d.lat, d.lng]) : undefined}
          >
            <CircleMarker
              color={teamColor}
              size={d.is_captain ? 18 : 14}
              opacity={d.is_captain ? 0.9 : 0.45}
              dashed={!d.is_captain}
              label={`${d.nickname}${d.is_captain ? ' ★' : ''}`}
            />
          </AdvancedMarker>
        ))
      }

      {guessPosition && !revealData && (
        <AdvancedMarker position={{ lat: guessPosition[0], lng: guessPosition[1] }}>
          <CircleMarker
            color={teamColor || '#3388ff'}
            size={isCaptain ? 16 : 14}
            opacity={isCaptain ? 1 : 0.45}
            dashed={!isCaptain}
            label={currentPlayerNickname ? `${currentPlayerNickname}${isCaptain ? ' ★' : ''}` : undefined}
          />
        </AdvancedMarker>
      )}

      {revealData && (
        <>
          <AdvancedMarker position={{ lat: revealData.correct.lat, lng: revealData.correct.lng }}>
            <CorrectMarker />
          </AdvancedMarker>
          {revealData.guesses.map((g) => (
            <AdvancedMarker key={g.team_id} position={{ lat: g.lat, lng: g.lng }}>
              <CircleMarker color={g.team_color} />
            </AdvancedMarker>
          ))}
          {revealData.guesses.map((g) => (
            <DashedPolyline
              key={`line-${g.team_id}`}
              from={{ lat: revealData.correct.lat, lng: revealData.correct.lng }}
              to={{ lat: g.lat, lng: g.lng }}
              color={g.team_color}
            />
          ))}
        </>
      )}
    </Map>
  );
}

export function GoogleMapView(props: GameMapProps) {
  const [streetView, setStreetView] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  if (!API_KEY) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#666' }}>
        Google Maps API ключ не задан (VITE_GOOGLE_MAPS_API_KEY)
      </div>
    );
  }

  function handleOpenStreetView() {
    if (props.guessPosition) {
      setStreetView({ lat: props.guessPosition[0], lng: props.guessPosition[1] });
    } else if (mapRef.current) {
      const center = mapRef.current.getCenter();
      if (center) setStreetView({ lat: center.lat(), lng: center.lng() });
    }
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <GoogleMapInner {...props} onMapReady={(m) => { mapRef.current = m; }} />

        {/* Street View toggle button (only if enabled in game settings) */}
        {props.streetViewEnabled !== false && (
          <button
            className="streetview-btn"
            onClick={handleOpenStreetView}
            title={props.guessPosition ? 'Панорама из этой точки' : 'Панорама (выберите точку)'}
          >
            🔭
          </button>
        )}

        {/* Street View overlay */}
        {streetView && (
          <StreetViewPanel
            lat={streetView.lat}
            lng={streetView.lng}
            onClose={(finalLat, finalLng) => {
              setStreetView(null);
              // Pan the map to where the user ended up in Street View
              if (mapRef.current) {
                mapRef.current.panTo({ lat: finalLat, lng: finalLng });
              }
            }}
          />
        )}
      </div>
    </APIProvider>
  );
}
