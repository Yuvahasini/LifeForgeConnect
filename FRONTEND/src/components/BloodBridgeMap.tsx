import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface Donor {
  id: string | number;
  name: string;
  blood_group: string;
  city: string;
  trust_score: number;
  distance_km: number;
  lat: number;
  lng: number;
}

interface HospitalLocation {
  lat: number;
  lng: number;
  name: string;
}

interface BloodBridgeMapProps {
  donors?: Donor[];
  hospitalLocation?: HospitalLocation | null;
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BloodBridgeMap = ({ donors = [], hospitalLocation }: BloodBridgeMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Always destroy previous instance before creating a new one
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      // Guard: component may have unmounted during async import
      if (!mapRef.current || mapInstanceRef.current) return;

      const center: [number, number] = hospitalLocation
        ? [hospitalLocation.lat, hospitalLocation.lng]
        : [20.5937, 78.9629]; // India center fallback
      const zoom = hospitalLocation ? 10 : 5;

      const map = L.default.map(mapRef.current, { center, zoom });
      mapInstanceRef.current = map;

      L.default
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        })
        .addTo(map);

      // ── Blue pin: Hospital ──────────────────────────────────────────────
      const blueIcon = new L.default.Icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      if (hospitalLocation) {
        L.default
          .marker([hospitalLocation.lat, hospitalLocation.lng], {
            icon: blueIcon,
            zIndexOffset: 1000,
          })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:160px;font-family:sans-serif">
              <p style="margin:0 0 4px;font-weight:700;color:#1d4ed8;font-size:14px">🏥 ${hospitalLocation.name}</p>
              <p style="margin:0;font-size:11px;color:#6b7280">Your Hospital Location</p>
            </div>`
          )
          .openPopup();
      }

      // ── Red pins: Donors ────────────────────────────────────────────────
      const redIcon = new L.default.Icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      donors.forEach((donor) => {
        if (!donor.lat || !donor.lng) return;

        let distanceText = "";
        if (hospitalLocation) {
          const dist = getDistanceKm(
            hospitalLocation.lat,
            hospitalLocation.lng,
            donor.lat,
            donor.lng
          );
          distanceText = `<p style="margin:6px 0 0;color:#dc2626;font-weight:700;font-size:13px">📏 ${dist.toFixed(1)} km from your hospital</p>`;
        } else if (donor.distance_km) {
          distanceText = `<p style="margin:6px 0 0;font-size:12px">📏 ${donor.distance_km.toFixed(1)} km away</p>`;
        }

        L.default
          .marker([donor.lat, donor.lng], { icon: redIcon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:170px;font-family:sans-serif">
              <p style="margin:0 0 4px;font-weight:700;font-size:14px">${donor.name}</p>
              <p style="margin:2px 0;font-size:12px">🩸 <b>${donor.blood_group}</b></p>
              <p style="margin:2px 0;font-size:12px">📍 ${donor.city}</p>
              <p style="margin:2px 0;font-size:12px">⭐ Trust Score: ${donor.trust_score}</p>
              ${distanceText}
            </div>`
          );
      });

      // ── Fit map to show hospital + all donors ───────────────────────────
      const allPoints: [number, number][] = [];
      if (hospitalLocation) allPoints.push([hospitalLocation.lat, hospitalLocation.lng]);
      donors.forEach((d) => { if (d.lat && d.lng) allPoints.push([d.lat, d.lng]); });

      if (allPoints.length > 1) {
        map.fitBounds(L.default.latLngBounds(allPoints), { padding: [50, 50] });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // Stringify so effect re-runs when donors or hospital location actually changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(donors), JSON.stringify(hospitalLocation)]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "450px", borderRadius: "12px", zIndex: 0, position: "relative" }}
    />
  );
};

export default BloodBridgeMap;