"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coord } from "@/lib/ritians/data";
import { RIT_CAMPUS_COORDS } from "@/lib/ritians/data";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";

export interface MapVehicle {
  id: string;
  vehicleNumber: string;
  vehicleName: string;
  status: "live" | "idle" | "offline" | "tracking";
  coords: Coord;
  speed?: number;
  heading?: number;
  lastSeenAt?: string;
  routeNo?: string;
  selected?: boolean;
}

export interface FleetMapProps {
  vehicles: MapVehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  showRouteForVehicleId?: string | null;
  crossedStopNames?: string[];
  height?: string;
  centerOnSelected?: boolean;
  className?: string;
}

function markerClass(status: MapVehicle["status"], selected?: boolean): string {
  return `bus-marker ${status}${selected ? " selected" : ""}`;
}

export function FleetMap({
  vehicles, selectedVehicleId, onSelectVehicle, showRouteForVehicleId,
  crossedStopNames = [], height = "100%", centerOnSelected = true, className,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const stopLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectVehicle);
  useEffect(() => { onSelectRef.current = onSelectVehicle; }, [onSelectVehicle]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [13.0827, 80.2707],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    stopLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markersRef.current;

    for (const [id, marker] of existing.entries()) {
      if (!vehicles.find((v) => v.id === id)) {
        map.removeLayer(marker);
        existing.delete(id);
      }
    }

    for (const v of vehicles) {
      const latlng: L.LatLngExpression = [v.coords.lat, v.coords.lng];
      let marker = existing.get(v.id);
      const isSelected = v.id === selectedVehicleId;
      const html = `<div class="${markerClass(v.status, isSelected)}"><i class="fas fa-bus"></i></div>`;
      const popupHtml = `
        <div style="min-width: 220px;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">
            ${v.vehicleName} <span style="font-family: monospace; font-size: 11px; opacity: 0.7;">${v.vehicleNumber}</span>
          </div>
          <div style="font-size: 12px; margin-bottom: 4px;">Status: <strong style="color: ${
            v.status === "live" ? "#10b981" :
            v.status === "tracking" ? "#06b6d4" :
            v.status === "idle" ? "#fbbf24" : "#94a3b8"
          }; text-transform: uppercase; letter-spacing: 0.05em;">${v.status}</strong></div>
          ${v.speed !== undefined ? `<div style="font-size: 12px; margin-bottom: 4px;">Speed: <span style="font-family: monospace; color: #06b6d4;">${Math.round(v.speed)} km/h</span></div>` : ""}
          ${v.lastSeenAt ? `<div style="font-size: 12px; margin-bottom: 4px;">Updated: <span style="opacity: 0.7;">${timeAgo(new Date(v.lastSeenAt))}</span></div>` : ""}
          <div style="font-size: 11px; opacity: 0.6; margin-top: 6px;">${v.coords.lat.toFixed(4)}, ${v.coords.lng.toFixed(4)}</div>
          ${v.routeNo ? `<div style="font-size: 11px; opacity: 0.6; margin-top: 2px;">Route: <span style="font-family: monospace;">${v.routeNo}</span></div>` : ""}
        </div>
      `;
      if (!marker) {
        const icon = L.divIcon({
          html,
          className: "rt-leaflet-bus-icon",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });
        marker = L.marker(latlng, { icon }).addTo(map);
        marker.on("click", () => onSelectRef.current(v.id));
        marker.bindPopup(popupHtml);
        existing.set(v.id, marker);
      } else {
        marker.setLatLng(latlng);
        const icon = L.divIcon({
          html,
          className: "rt-leaflet-bus-icon",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });
        marker.setIcon(icon);
        marker.setPopupContent(popupHtml);
      }
      if (isSelected && centerOnSelected) {
        map.panTo(latlng, { animate: true });
        marker.openPopup();
      }
    }
  }, [vehicles, selectedVehicleId, centerOnSelected]);

  useEffect(() => {
    const map = mapRef.current;
    const stopLayer = stopLayerRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !stopLayer || !routeLayer) return;
    stopLayer.clearLayers();
    routeLayer.clearLayers();

    if (!showRouteForVehicleId) return;
    const v = vehicles.find((x) => x.id === showRouteForVehicleId);
    if (!v || !v.routeNo) return;

    const stops = getRouteStopsWithCoords(v.routeNo);
    if (stops.length === 0) return;

    const latlngs: L.LatLngExpression[] = stops.map((s) => {
      const c = s.coords || RIT_CAMPUS_COORDS;
      return [c.lat, c.lng];
    });
    L.polyline(latlngs, {
      color: "#22D3EE", weight: 2, opacity: 0.7, dashArray: "6 4",
    }).addTo(routeLayer);

    stops.forEach((s, i) => {
      const c = s.coords || RIT_CAMPUS_COORDS;
      const isRIT = s.stop === "RIT Campus";
      const isCrossed = crossedStopNames.includes(s.stop);
      const icon = L.divIcon({
        html: `<div class="stop-marker ${isRIT ? "rit" : ""} ${isCrossed ? "crossed" : ""}"></div>`,
        className: "rt-leaflet-stop-icon",
        iconSize: isRIT ? [16, 16] : [12, 12],
        iconAnchor: isRIT ? [8, 8] : [6, 6],
      });
      const marker = L.marker([c.lat, c.lng], { icon }).addTo(stopLayer);
      marker.bindPopup(`
        <div style="min-width: 160px;">
          <div style="font-weight: 700; font-size: 13px;">${i + 1}. ${s.stop}</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">Time: <span style="font-family: monospace;">${s.time}</span></div>
          <div style="font-size: 11px; opacity: 0.6; margin-top: 2px;">${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</div>
          ${isCrossed ? '<div style="font-size: 11px; color: #10b981; margin-top: 4px; font-weight: 600;">✓ Crossed</div>' : ""}
        </div>
      `);
    });

    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [showRouteForVehicleId, vehicles, crossedStopNames]);

  return <div ref={containerRef} className={className} style={{ height, width: "100%" }} />;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return `${h}h ago`;
}
