'use client';

import { useEffect, useRef, useState } from 'react';

export default function MapaLocal({ lat, lng, radioKm, onUbicar }) {
  const latInicial  = lat || -32.889458;
  const lngInicial  = lng || -68.845839;
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markerRef   = useRef(null);
  const circleRef   = useRef(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    async function initMap() {
      if (mapInstance.current) return;
      if (!mapRef.current) return;
      if (!latInicial || !lngInicial) return;

      const L = (await import('leaflet')).default;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center: [latInicial, lngInicial],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      L.control.attribution({ prefix: false, position: 'bottomright' })
        .addAttribution('© <a href="https://carto.com">CARTO</a>')
        .addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Círculo de cobertura, se actualiza cuando cambia el radio
      const circle = L.circle([latInicial, lngInicial], {
        radius: (radioKm || 5) * 1000,
        color: '#e23e45',
        fillColor: '#e23e45',
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: '6 5',
      }).addTo(map);

      // Pin del local — gota roja draggable
      const iconLocal = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:grab">
          <div style="width:26px;height:26px;background:#e23e45;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3)"></div>
        </div>`,
        className: '',
        iconAnchor: [13, 26],
      });

      const marker = L.marker([latInicial, lngInicial], {
        draggable: true,
        icon: iconLocal,
      }).addTo(map);

      function actualizar(lat, lng) {
        circle.setLatLng([lat, lng]);
        onUbicar(lat, lng);
      }

      marker.on('drag',    () => { const p = marker.getLatLng(); circle.setLatLng(p); });
      marker.on('dragend', () => { const p = marker.getLatLng(); actualizar(p.lat, p.lng); });
      map.on('click', (e) => {
        marker.setLatLng([e.latlng.lat, e.latlng.lng]);
        actualizar(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => map.invalidateSize(), 100);

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

  // Actualizar el radio del círculo si cambia desde el input de arriba
  useEffect(() => {
    if (circleRef.current && radioKm) {
      circleRef.current.setRadius(radioKm * 1000);
    }
  }, [radioKm]);

  // Buscar dirección por texto (usando Nominatim, gratis, de OpenStreetMap)
  async function buscarDireccion(e) {
    e.preventDefault();
    const texto = e.target.busqueda.value.trim();
    if (!texto) return;
    setBuscando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lon);
        mapInstance.current.setView([latNum, lngNum], 16);
        markerRef.current.setLatLng([latNum, lngNum]);
        circleRef.current.setLatLng([latNum, lngNum]);
        onUbicar(latNum, lngNum);
      }
    } catch (err) {
      console.error('Error buscando dirección', err);
    }
    setBuscando(false);
  }

  return (
    <div className="wrap">
      <form className="buscador" onSubmit={buscarDireccion}>
        <input name="busqueda" type="text" placeholder="Buscar dirección del local…" />
        <button type="submit" disabled={buscando}>{buscando ? '…' : 'Buscar'}</button>
      </form>

      <div className="instruccion">Arrastrá el pin o tocá en el mapa para ubicar el local</div>
      <div ref={mapRef} className="mapa" />

      <style jsx>{`
        .wrap { display: flex; flex-direction: column; gap: 10px; position: relative; }

        .buscador { display: flex; gap: 8px; }
        .buscador input {
          flex: 1; background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px;
          padding: 9px 12px; font-size: 13px; color: #1a1510; font-family: inherit; outline: none;
        }
        .buscador input:focus { border-color: #e23e45; }
        .buscador button {
          background: #1a1510; color: #fff; border: none; border-radius: 8px;
          padding: 9px 16px; font-size: 13px; font-family: inherit; cursor: pointer;
        }
        .buscador button:disabled { opacity: 0.5; cursor: default; }

        .instruccion {
          position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
          background: rgba(255,255,255,0.92); backdrop-filter: blur(4px);
          border: 1px solid #ede8e0; border-radius: 20px; padding: 6px 14px;
          font-size: 12px; color: #6b6259; white-space: nowrap;
          z-index: 999; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .mapa {
          height: 280px; width: 100%; border-radius: 12px; overflow: hidden;
          border: 1.5px solid #ede8e0;
        }
      `}</style>
    </div>
  );
}