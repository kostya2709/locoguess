/**
 * Street View panorama panel — reusable across map components.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  lat: number;
  lng: number;
  onClose: (finalLat: number, finalLng: number) => void;
}

export function StreetViewPanel({ lat, lng, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setNoData(false);

    const sv = new google.maps.StreetViewService();

    const trySource = async (source: google.maps.StreetViewSource, radius: number): Promise<google.maps.StreetViewPanoramaData | null> => {
      return new Promise((resolve) => {
        sv.getPanorama({
          location: { lat, lng },
          radius,
          source,
          preference: google.maps.StreetViewPreference.NEAREST,
        }, (data, status) => {
          resolve(status === google.maps.StreetViewStatus.OK && data ? data : null);
        });
      });
    };

    (async () => {
      let data = await trySource(google.maps.StreetViewSource.OUTDOOR, 500);
      if (!data) data = await trySource(google.maps.StreetViewSource.DEFAULT, 1000);
      if (!data) data = await trySource(google.maps.StreetViewSource.DEFAULT, 5000);

      if (data?.location?.pano && containerRef.current) {
        panoramaRef.current = new google.maps.StreetViewPanorama(containerRef.current, {
          pano: data.location.pano,
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          motionTracking: false,
          motionTrackingControl: false,
          addressControl: false,
          showRoadLabels: false,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          fullscreenControl: false,
        });
      } else {
        setNoData(true);
      }
    })();

    return () => { panoramaRef.current = null; };
  }, [lat, lng]);

  function handleClose() {
    const pano = panoramaRef.current;
    if (pano) {
      const pos = pano.getPosition();
      if (pos) {
        onClose(pos.lat(), pos.lng());
        return;
      }
    }
    onClose(lat, lng);
  }

  return (
    <div className="streetview-panel">
      <button className="streetview-close" onClick={handleClose}>✕</button>
      {noData && <div className="streetview-no-data">Панорама недоступна в этой точке</div>}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
