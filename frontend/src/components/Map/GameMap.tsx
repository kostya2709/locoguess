/**
 * Map provider switcher.
 *
 * Set VITE_MAP_PROVIDER to "google" to use Google Maps, otherwise Leaflet/OSM.
 * Google Maps also requires VITE_GOOGLE_MAPS_API_KEY.
 */

import type { GameMapProps } from './types';
import { LeafletMap } from './LeafletMap';
import { GoogleMapView } from './GoogleMapView';

const MAP_PROVIDER = import.meta.env.VITE_MAP_PROVIDER || 'leaflet';

export function GameMap(props: GameMapProps) {
  if (MAP_PROVIDER === 'google') {
    return <GoogleMapView {...props} />;
  }
  return <LeafletMap {...props} />;
}

// Re-export types for convenience
export type { GameMapProps, DraftMarker, RevealData } from './types';
