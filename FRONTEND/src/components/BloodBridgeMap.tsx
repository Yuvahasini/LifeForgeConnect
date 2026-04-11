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

interface BloodBridgeMapProps {
  donors?: Donor[];
}

const BloodBridgeMap = ({ donors = [] }: BloodBridgeMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.default.map(mapRef.current).setView(
        [19.076, 72.8777],
        12
      );
      mapInstanceRef.current = map;

      L.default.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }
      ).addTo(map);

      const redIcon = new L.default.Icon({
        iconUrl:
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      donors.forEach((donor) => {
        if (!donor.lat || !donor.lng) return;

        L.default
          .marker([donor.lat, donor.lng], { icon: redIcon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:150px">
              <p style="margin:4px 0;font-weight:700">${donor.name}</p>
              <p style="margin:4px 0">🩸 ${donor.blood_group}</p>
              <p style="margin:4px 0">📍 ${donor.city}</p>
              <p style="margin:4px 0">⭐ Trust Score: ${donor.trust_score}</p>
              <p style="margin:4px 0">📏 ${donor.distance_km} km away</p>
            </div>
          `);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [donors]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "450px",
        borderRadius: "12px",
        zIndex: 0,
      }}
    />
  );
};

export default BloodBridgeMap;
