/**
 * Simple map for picking a location (click to place marker).
 * Uses the same provider as the game map (Leaflet or Google Maps).
 * Google Maps version includes Street View support for exploring locations.
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { StreetViewPanel } from './StreetViewPanel';

// Fix leaflet icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const MAP_PROVIDER = import.meta.env.VITE_MAP_PROVIDER || 'leaflet';
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAX_ZOOM = Number(import.meta.env.VITE_MAX_ZOOM) || 18;

interface Props {
  position: [number, number] | null;
  onPositionChange: (pos: [number, number]) => void;
  height?: string;
}

// --- Leaflet ---
function LeafletClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function LeafletPicker({ position, onPositionChange, height = '250px' }: Props) {
  return (
    <MapContainer center={position || [62, 95]} zoom={position ? 8 : 3} minZoom={3} maxZoom={MAX_ZOOM} style={{ height, width: '100%' }} attributionControl={false}>
      <TileLayer url={TILE_URL} maxZoom={MAX_ZOOM} noWrap={true} />
      <LeafletClickHandler onClick={(lat, lng) => onPositionChange([lat, lng])} />
      {position && <Marker position={position} />}
    </MapContainer>
  );
}

// --- Google Maps ---
function GoogleClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
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

function MapRefBridge({ onMap }: { onMap: (map: google.maps.Map | null) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

function GooglePicker({ position, onPositionChange, height = '250px' }: Props) {
  const [streetView, setStreetView] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  function handleOpenStreetView() {
    if (position) {
      setStreetView({ lat: position[0], lng: position[1] });
    } else if (mapRef.current) {
      const center = mapRef.current.getCenter();
      if (center) setStreetView({ lat: center.lat(), lng: center.lng() });
    }
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <div style={{ position: 'relative', width: '100%', height }}>
        <Map
          defaultCenter={position ? { lat: position[0], lng: position[1] } : { lat: 62, lng: 95 }}
          defaultZoom={position ? 8 : 3}
          minZoom={3}
          gestureHandling="cooperative"
          disableDefaultUI={true}
          zoomControl={true}
          mapId="locoguess-picker"
          style={{ width: '100%', height: '100%' }}
        >
          <MapRefBridge onMap={(m) => { mapRef.current = m; }} />
          <GoogleClickHandler onClick={(lat, lng) => onPositionChange([lat, lng])} />
          {position && (
            <AdvancedMarker position={{ lat: position[0], lng: position[1] }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            </AdvancedMarker>
          )}
        </Map>

        <button
          className="streetview-btn"
          onClick={handleOpenStreetView}
          title={position ? 'Панорама из этой точки' : 'Панорама'}
        >
          🔭
        </button>

        {streetView && (
          <StreetViewPanel
            lat={streetView.lat}
            lng={streetView.lng}
            onClose={(finalLat, finalLng) => {
              setStreetView(null);
              // Update marker to where the user ended up in Street View
              onPositionChange([finalLat, finalLng]);
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

// --- Switcher ---
export function PickerMap(props: Props) {
  if (MAP_PROVIDER === 'google') {
    return <GooglePicker {...props} />;
  }
  return <LeafletPicker {...props} />;
}
