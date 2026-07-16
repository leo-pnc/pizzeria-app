'use client';

import { useEffect, useRef, useState } from 'react';

export default function MapSelector({ lat, lng, radioKm, onConfirmar, onCancelar }) {
  const latLocal    = lat;
  const lngLocal    = lng;
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markerRef   = useRef(null);
  const [pinPos, setPinPos]             = useState({ lat: latLocal, lng: lngLocal });
  const [dentroDeZona, setDentroDeZona] = useState(true);

  useEffect(() => {
    async function initMap() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (mapInstance.current) return;

      const map = L.map(mapRef.current, {
        center: [latLocal, lngLocal],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // CartoDB Positron — blanco, minimalista, sin ruido visual
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      L.control.attribution({ prefix: false, position: 'bottomright' })
        .addAttribution('© <a href="https://carto.com">CARTO</a>')
        .addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Círculo de cobertura sutil
      L.circle([latLocal, lngLocal], {
        radius: radioKm * 1000,
        color: '#c1320a',
        fillColor: '#c1320a',
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: '6 5',
      }).addTo(map);

      // Pin del local — punto rojo fijo pequeño
      L.marker([latLocal, lngLocal], {
        icon: L.divIcon({
          html: `<div style="width:12px;height:12px;background:#c1320a;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)"></div>`,
          className: '',
          iconAnchor: [6, 6],
        }),
        interactive: false,
      }).addTo(map);

      // Pin del cliente — gota negra draggable
      const iconCliente = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:grab">
          <div style="width:24px;height:24px;background:#1a1510;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.28)"></div>
        </div>`,
        className: '',
        iconAnchor: [12, 24],
      });

      const marker = L.marker([latLocal, lngLocal], { draggable: true, icon: iconCliente }).addTo(map);

      function actualizar(lat, lng) {
        const dist = calcDist(lat, lng, latLocal, lngLocal);
        setPinPos({ lat, lng });
        setDentroDeZona(dist <= radioKm);
      }

      marker.on('drag', () => { const p = marker.getLatLng(); actualizar(p.lat, p.lng); });
      marker.on('dragend', () => { const p = marker.getLatLng(); actualizar(p.lat, p.lng); });
      map.on('click', (e) => { marker.setLatLng([e.latlng.lat, e.latlng.lng]); actualizar(e.latlng.lat, e.latlng.lng); });

      mapInstance.current = map;
      markerRef.current   = marker;
    }

    initMap();
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, []);

  function calcDist(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return (
    <div className="wrap">
      <div className="instruccion">Tocá en el mapa o arrastrá el pin hasta tu domicilio</div>
      <div ref={mapRef} className="mapa" />

      <div className="leyenda">
        <span className="leg"><span className="dot dot-r" /> Local</span>
        <span className="leg"><span className="dot dot-n" /> Tu domicilio</span>
      </div>

      {!dentroDeZona && (
        <div className="fuera-zona">Esa ubicación está fuera de nuestra zona de delivery ({radioKm} km).</div>
      )}

      <div className="acciones">
        <button className="btn-cancel" onClick={onCancelar}>Cancelar</button>
        <button className="btn-ok" disabled={!dentroDeZona} onClick={() => onConfirmar(pinPos.lat, pinPos.lng)}>
          Confirmar ubicación
        </button>
      </div>

      <style jsx>{`
        .wrap { display: flex; flex-direction: column; gap: 10px; position: relative; }

        .instruccion {
          position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
          background: rgba(255,255,255,0.92); backdrop-filter: blur(4px);
          border: 1px solid #e4ddd3; border-radius: 20px; padding: 6px 14px;
          font-size: 12px; color: #6b6259; white-space: nowrap;
          z-index: 999; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .mapa {
          height: 300px; border-radius: 14px; overflow: hidden;
          border: 1.5px solid #e4ddd3; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .leyenda { display: flex; gap: 16px; font-size: 12px; color: #9a8f82; }
        .leg { display: flex; align-items: center; gap: 5px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-r { background: #c1320a; }
        .dot-n { background: #1a1510; }

        .fuera-zona {
          background: #fff5f3; border: 1px solid #fcd0c8; border-radius: 10px;
          padding: 10px 14px; font-size: 13px; color: #c1320a; font-weight: 500;
        }

        .acciones { display: flex; gap: 8px; }

        .btn-cancel {
          flex: 1; background: transparent; border: 1.5px solid #e4ddd3;
          color: #6b6259; border-radius: 10px; padding: 13px; font-size: 14px;
          font-family: inherit; cursor: pointer; transition: border-color 0.15s;
        }
        .btn-cancel:hover { border-color: #c1320a; }

        .btn-ok {
          flex: 2; background: #1a1510; color: #faf7f2; border: none;
          border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 700;
          font-family: inherit; cursor: pointer; transition: filter 0.15s, transform 0.1s;
        }
        .btn-ok:hover:not(:disabled) { filter: brightness(1.2); transform: translateY(-1px); }
        .btn-ok:disabled { opacity: 0.35; cursor: default; }
      `}</style>
    </div>
  );
}