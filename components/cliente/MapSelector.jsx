'use client';

import { useEffect, useRef, useState } from 'react';

export default function MapSelector({ latLocal, lngLocal, radioKm, onConfirmar, onCancelar }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markerRef   = useRef(null);
  const circleRef   = useRef(null);
  const [pinPos, setPinPos] = useState({ lat: latLocal, lng: lngLocal });
  const [dentroDeZona, setDentroDeZona] = useState(true);

  useEffect(() => {
    // Leaflet se importa dinámicamente para evitar errores de SSR
    async function initMap() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Fix de íconos de Leaflet en Next.js
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapInstance.current) return; // ya inicializado

      const map = L.map(mapRef.current, {
        center: [latLocal, lngLocal],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // Círculo de cobertura (radio de delivery)
      const circle = L.circle([latLocal, lngLocal], {
        radius: radioKm * 1000,
        color: '#c1320a',
        fillColor: '#c1320a',
        fillOpacity: 0.06,
        weight: 1.5,
        dashArray: '6 4',
      }).addTo(map);

      // Marcador del local
      const iconLocal = L.divIcon({
        html: `<div style="background:#c1320a;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        className: '',
        iconAnchor: [6, 6],
      });
      L.marker([latLocal, lngLocal], { icon: iconLocal, title: 'Local' }).addTo(map);

      // Marcador draggable del cliente (empieza en el centro del local)
      const iconCliente = L.divIcon({
        html: `<div style="background:#1a1510;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:grab"></div>`,
        className: '',
        iconAnchor: [9, 9],
      });

      const marker = L.marker([latLocal, lngLocal], {
        draggable: true,
        icon: iconCliente,
        title: 'Tu domicilio',
      }).addTo(map);

      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        const dist = calcDist(lat, lng, latLocal, lngLocal);
        setPinPos({ lat, lng });
        setDentroDeZona(dist <= radioKm);
      });

      // También al tocar el mapa mueve el pin
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        const dist = calcDist(lat, lng, latLocal, lngLocal);
        setPinPos({ lat, lng });
        setDentroDeZona(dist <= radioKm);
      });

      mapInstance.current = map;
      markerRef.current   = marker;
      circleRef.current   = circle;
    }

    initMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  function calcDist(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return (
    <div className="mapa-container">
      <div ref={mapRef} className="mapa" />

      <div className="mapa-leyenda">
        <span className="leyenda-local">● Local</span>
        <span className="leyenda-pin">● Tu domicilio (arrastrá el pin o tocá en el mapa)</span>
      </div>

      {!dentroDeZona && (
        <div className="mapa-fuera-zona">
          Esa ubicación está fuera de nuestra zona de delivery.
        </div>
      )}

      <div className="mapa-acciones">
        <button className="mapa-btn-cancelar" onClick={onCancelar}>Cancelar</button>
        <button
          className="mapa-btn-confirmar"
          disabled={!dentroDeZona}
          onClick={() => onConfirmar(pinPos.lat, pinPos.lng)}
        >
          Confirmar ubicación
        </button>
      </div>

      <style jsx>{`
        .mapa-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mapa {
          height: 280px;
          border-radius: 12px;
          overflow: hidden;
          border: 1.5px solid #e4ddd3;
          z-index: 0;
        }
        .mapa-leyenda {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 11px;
          color: #9a8f82;
        }
        .leyenda-local { color: #c1320a; font-weight: 600; }
        .leyenda-pin   { color: #1a1510; }
        .mapa-fuera-zona {
          background: #fff5f3;
          border: 1px solid #fcd0c8;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          color: #c1320a;
          font-weight: 500;
        }
        .mapa-acciones {
          display: flex;
          gap: 8px;
        }
        .mapa-btn-cancelar {
          flex: 1;
          background: transparent;
          border: 1.5px solid #e4ddd3;
          color: #6b6259;
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
        }
        .mapa-btn-confirmar {
          flex: 2;
          background: #1a1510;
          color: #faf7f2;
          border: none;
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: filter 0.15s;
        }
        .mapa-btn-confirmar:hover:not(:disabled) { filter: brightness(1.2); }
        .mapa-btn-confirmar:disabled { opacity: 0.4; cursor: default; }
      `}</style>
    </div>
  );
}