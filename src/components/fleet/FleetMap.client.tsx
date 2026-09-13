"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coord } from "@/lib/ritians/data";
import { RIT_CAMPUS_COORDS } from "@/lib/ritians/data";
import { getRouteStopsWithCoords } from "@/lib/ritians/fleet";
import {
  planMarkerInterpolation,
  sampleInterpolation,
  lerpCoord,
  lerpHeading,
  type MarkerInterpolationState,
} from "@/lib/fleet/physics";

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
  /** GPS accuracy in metres. When > 25m, the map draws an accuracy circle. */
  accuracy?: number;
  /** Raw GPS coords (before road-snapping). When set, the map draws a small
   *  dot at the raw position so the user can see how far the GPS was from
   *  the snapped route position. */
  rawCoords?: Coord;
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

export function FleetMap({
  vehicles, selectedVehicleId, onSelectVehicle, showRouteForVehicleId,
  crossedStopNames = [], height = "100%", centerOnSelected = true, className,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const stopLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const originDestLayerRef = useRef<L.LayerGroup | null>(null);
  // Accuracy circle layer — draws a translucent circle around each bus
  // showing the GPS accuracy radius. Only drawn when accuracy > 25m.
  const accuracyLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectVehicle);
  useEffect(() => { onSelectRef.current = onSelectVehicle; }, [onSelectVehicle]);

  // Per-marker interpolation state — drives the requestAnimationFrame loop
  // so each marker smoothly moves from its previous position to the new
  // target at a rate derived from the actual bus speed.
  const interpRef = useRef<Map<string, MarkerInterpolationState>>(new Map());
  const vehiclesRef = useRef(vehicles);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [13.0827, 80.2707],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    stopLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    originDestLayerRef.current = L.layerGroup().addTo(map);
    accuracyLayerRef.current = L.layerGroup().addTo(map);
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

  // Build bus icon — green teardrop with bus SVG, rotates by heading (like shared project)
  function buildBusIcon(isSelected: boolean, isLive: boolean, heading?: number): L.DivIcon {
    const h = heading || 0;
    const size = isSelected ? 44 : 40;
    return L.divIcon({
      className: '',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#22c55e,#16a34a);transform:rotate(${h - 45}deg);box-shadow:0 4px 16px rgba(34,197,94,0.5);border:3px solid white;">
        <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-${h - 45}deg);">
          <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
        </svg>
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  // Build origin marker — orange circle with "A" (like shared project)
  function buildOriginIcon(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;color:white;font-weight:bold;">A</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }

  // Build destination (RIT Campus) marker — red circle with "B" (like shared project)
  function buildDestIcon(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;color:white;font-weight:bold;">B</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }

  // Build boarding stop marker — small dot (cyan = upcoming, green = crossed)
  function buildStopIcon(isCrossed: boolean): L.DivIcon {
    const color = isCrossed ? "#22c55e" : "#06b6d4";
    const size = 10;
    return L.divIcon({
      className: '',
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 4px ${color};"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  // Build popup HTML for a bus marker — shows live state, speed, ETA, accuracy.
  // Critical: when speed = 0, the popup explicitly shows "NOT MOVING" so the
  // user is never confused about whether the bus is actually moving or not.
  // The marker animation also stops (duration = 0) when speed = 0, so the
  // popup text and the marker behavior always agree.
  function buildPopupHtml(v: MapVehicle, isLive: boolean): string {
    // Derive the human-readable state from the actual speed value.
    // This is the source of truth — not a separate "status" flag.
    let statusLabel: string;
    let statusColor: string;
    let statusEmoji: string;
    if (!isLive) {
      statusLabel = "OFFLINE";
      statusColor = "#64748b";
      statusEmoji = "⚫";
    } else if (v.speed === undefined || v.speed == null) {
      statusLabel = "LIVE";
      statusColor = "#10b981";
      statusEmoji = "🚌";
    } else if (v.speed < 1) {
      // Speed essentially zero — bus is stopped
      statusLabel = "NOT MOVING";
      statusColor = "#fbbf24";
      statusEmoji = "🛑";
    } else if (v.speed < 5) {
      // Crawling — below the "moving" threshold in the state engine
      statusLabel = "SLOWING";
      statusColor = "#fbbf24";
      statusEmoji = "🐢";
    } else {
      statusLabel = "MOVING";
      statusColor = "#10b981";
      statusEmoji = "🚌";
    }

    return `
      <div style="min-width: 240px; color: #1a1d2a;">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">
          ${v.vehicleName} <span style="font-family: monospace; font-size: 11px; opacity: 0.6;">${v.vehicleNumber}</span>
        </div>
        <div style="font-size: 12px; margin-bottom: 4px;">Status: <strong style="color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.05em;">${statusEmoji} ${statusLabel}</strong></div>
        ${v.speed !== undefined && isLive ? `<div style="font-size: 12px; margin-bottom: 4px;">Speed: <span style="font-family: monospace; color: ${v.speed < 1 ? "#fbbf24" : "#06b6d4"}; font-weight: 600;">${Math.round(v.speed)} km/h</span>${v.speed < 1 ? ' <span style="font-size: 10px; color: #f59e0b; font-weight: 700;">(stationary)</span>' : ''}</div>` : ""}
        ${isLive ? `<div style="font-size: 12px; margin-bottom: 4px;">Updated: <span style="color: #10b981; font-weight: 600;">${v.lastSeenAt ? timeAgo(new Date(v.lastSeenAt)) : "just now"}</span></div>` : ""}
        ${v.heading != null && isLive ? `<div style="font-size: 12px; margin-bottom: 4px;">Heading: <span style="font-family: monospace; color: #f59e0b; font-weight: 600;">${Math.round(v.heading)}°</span></div>` : ""}
        <div style="font-size: 11px; color: #64748b; margin-top: 6px;">${v.coords.lat.toFixed(4)}, ${v.coords.lng.toFixed(4)}</div>
        ${v.routeNo ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Route: <span style="font-family: monospace; font-weight: 600; color: #f59e0b;">${v.routeNo}</span></div>` : ""}
      </div>
    `;
  }

  // Update bus markers — plan interpolation for each marker based on
  // the actual reported speed. The requestAnimationFrame loop below
  // samples the interpolation every frame and calls setLatLng, so the
  // marker visually moves smoothly between fixes instead of jumping.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markersRef.current;
    const interps = interpRef.current;

    // Remove markers no longer present
    for (const [id, marker] of existing.entries()) {
      if (!vehicles.find((v) => v.id === id)) {
        map.removeLayer(marker);
        existing.delete(id);
        interps.delete(id);
      }
    }

    for (const v of vehicles) {
      const targetLatLng: L.LatLngExpression = [v.coords.lat, v.coords.lng];
      let marker = existing.get(v.id);
      const isSelected = v.id === selectedVehicleId;
      const isLive = v.status === "live" || v.status === "tracking";

      // Plan interpolation from the marker's current position to the new target.
      // The duration is derived from distance / actual_speed (NOT a fixed duration).
      // Acceptance test 16: animation duration = distance_to_target / actual_speed
      if (marker) {
        const currentLatLng = marker.getLatLng();
        const fromCoord: Coord = { lat: currentLatLng.lat, lng: currentLatLng.lng };
        const toCoord: Coord = v.coords;
        // Look up previous heading for smooth rotation
        const prevInterp = interps.get(v.id);
        const fromHeading = prevInterp?.toHeading ?? v.heading ?? null;
        const interp = planMarkerInterpolation(
          fromCoord,
          toCoord,
          fromHeading,
          v.heading ?? null,
          v.speed ?? 0
        );
        if (interp) {
          interps.set(v.id, interp);
        } else if (interps.has(v.id) === false) {
          // No movement needed — marker is essentially at target
          marker.setLatLng(targetLatLng);
        }
      }

      const icon = buildBusIcon(isSelected, isLive, v.heading);
      const popupHtml = buildPopupHtml(v, isLive);

      if (!marker) {
        marker = L.marker(targetLatLng, { icon, zIndexOffset: 1000 }).addTo(map);
        marker.on("click", () => onSelectRef.current(v.id));
        marker.bindPopup(popupHtml);
        existing.set(v.id, marker);
      } else {
        marker.setIcon(icon);
        marker.setPopupContent(popupHtml);
      }
    }
  }, [vehicles, selectedVehicleId]);

  // requestAnimationFrame loop — sample the interpolation state for each
  // marker every frame and call setLatLng with the interpolated position.
  // This produces smooth sub-second movement between fixes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let raf = 0;

    const loop = () => {
      const now = performance.now();
      for (const [id, interp] of interpRef.current.entries()) {
        const marker = markersRef.current.get(id);
        if (!marker) {
          interpRef.current.delete(id);
          continue;
        }
        const { coords, heading, t } = sampleInterpolation(interp, now);
        marker.setLatLng([coords.lat, coords.lng]);

        // Update icon heading if we have a heading
        const v = vehiclesRef.current.find((x) => x.id === id);
        if (v) {
          const isSelected = v.id === selectedVehicleId;
          const isLive = v.status === "live" || v.status === "tracking";
          // Use the interpolated heading for smooth rotation
          if (heading != null) {
            const icon = buildBusIcon(isSelected, isLive, heading);
            marker.setIcon(icon);
          }
        }

        // Center on selected marker if centerOnSelected is true
        if (v?.selected && centerOnSelected && t < 1) {
          map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 14), { animate: false });
        }

        // If interpolation finished, remove it
        if (t >= 1) {
          interpRef.current.delete(id);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [centerOnSelected, selectedVehicleId]);

  // Open popup on selected marker when selection changes
  useEffect(() => {
    if (!selectedVehicleId || !centerOnSelected) return;
    const marker = markersRef.current.get(selectedVehicleId);
    if (marker) {
      marker.openPopup();
      const v = vehicles.find((x) => x.id === selectedVehicleId);
      if (v) {
        const map = mapRef.current;
        if (map) map.setView([v.coords.lat, v.coords.lng], Math.max(map.getZoom(), 14), { animate: true });
      }
    }
  }, [selectedVehicleId, centerOnSelected, vehicles]);

  // Draw GPS accuracy circles + raw GPS dots for buses that have poor accuracy
  // or have been snapped to the route. This visualizes the GPS uncertainty so
  // the user can see whether the marker is at the correct location or floating.
  useEffect(() => {
    const accuracyLayer = accuracyLayerRef.current;
    if (!accuracyLayer) return;
    accuracyLayer.clearLayers();

    for (const v of vehiclesRef.current) {
      // Accuracy circle — only draw when accuracy is poor (> 25m)
      if (v.accuracy != null && v.accuracy > 25 && (v.status === "tracking" || v.status === "live")) {
        const color = v.accuracy > 100 ? "#ef4444" : v.accuracy > 50 ? "#fbbf24" : "#06b6d4";
        L.circle([v.coords.lat, v.coords.lng], {
          radius: v.accuracy,
          color,
          fillColor: color,
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.4,
          dashArray: "4 4",
        }).addTo(accuracyLayer);
      }
      // Raw GPS dot — drawn when the position was snapped to the route,
      // so the user can see where the raw GPS fix was vs. the snapped position.
      if (v.rawCoords) {
        L.circleMarker([v.rawCoords.lat, v.rawCoords.lng], {
          radius: 4,
          color: "#fbbf24",
          fillColor: "#fbbf24",
          fillOpacity: 0.6,
          weight: 1,
        }).addTo(accuracyLayer);
        // Dashed line from raw GPS to snapped position
        L.polyline(
          [
            [v.rawCoords.lat, v.rawCoords.lng],
            [v.coords.lat, v.coords.lng],
          ],
          { color: "#fbbf24", weight: 1, opacity: 0.5, dashArray: "3 3" }
        ).addTo(accuracyLayer);
      }
    }
  }, [vehicles]);

  // Draw route line + origin/destination markers + boarding stops
  useEffect(() => {
    const map = mapRef.current;
    const stopLayer = stopLayerRef.current;
    const routeLayer = routeLayerRef.current;
    const originDestLayer = originDestLayerRef.current;
    if (!map || !stopLayer || !routeLayer || !originDestLayer) return;
    stopLayer.clearLayers();
    routeLayer.clearLayers();
    originDestLayer.clearLayers();

    if (!showRouteForVehicleId) return;
    const v = vehicles.find((x) => x.id === showRouteForVehicleId);
    if (!v || !v.routeNo) return;

    const stops = getRouteStopsWithCoords(v.routeNo);
    if (stops.length === 0) return;

    // Origin coordinates (first stop)
    const originCoords = stops[0].coords || RIT_CAMPUS_COORDS;
    // Destination = RIT Campus
    const destCoords = RIT_CAMPUS_COORDS;

    // Draw the route line — orange dashed (like shared project: origin → stops → destination)
    const latlngs: L.LatLngExpression[] = stops.map((s) => {
      const c = s.coords || RIT_CAMPUS_COORDS;
      return [c.lat, c.lng];
    });

    // Draw the full route as an orange dashed line
    L.polyline(latlngs, {
      color: "#f59e0b", weight: 3, opacity: 0.6, dashArray: "8 8",
    }).addTo(routeLayer);

    // Draw origin marker (red pin)
    const originIcon = buildOriginIcon();
    L.marker([originCoords.lat, originCoords.lng], { icon: originIcon, zIndexOffset: 500 })
      .addTo(originDestLayer)
      .bindPopup(`<div style="min-width: 140px;"><div style="font-weight: 700; font-size: 13px; color: #ef4444;">START</div><div style="font-size: 12px; margin-top: 4px;">${stops[0].stop}</div><div style="font-size: 11px; color: #64748b; margin-top: 2px;">Departure: ${stops[0].time}</div></div>`);

    // Draw destination marker (RIT Campus — red with flag)
    const destIcon = buildDestIcon();
    L.marker([destCoords.lat, destCoords.lng], { icon: destIcon, zIndexOffset: 500 })
      .addTo(originDestLayer)
      .bindPopup(`<div style="min-width: 140px;"><div style="font-weight: 700; font-size: 13px; color: #dc2626;">FINAL DESTINATION</div><div style="font-size: 12px; margin-top: 4px;">RIT Campus</div><div style="font-size: 11px; color: #64748b; margin-top: 2px;">Arrival: ${stops[stops.length - 1]?.time || "7.40 am"}</div></div>`);

    // Draw boarding stop markers (skip first and last — those are origin/dest)
    stops.forEach((s, i) => {
      if (i === 0 || i === stops.length - 1) return; // skip origin & destination (already drawn)
      const c = s.coords || RIT_CAMPUS_COORDS;
      const isCrossed = crossedStopNames.includes(s.stop);
      const icon = buildStopIcon(isCrossed);
      const marker = L.marker([c.lat, c.lng], { icon }).addTo(stopLayer);
      marker.bindPopup(`
        <div style="min-width: 160px;">
          <div style="font-weight: 700; font-size: 13px;">${i + 1}. ${s.stop}</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">Time: <span style="font-family: monospace;">${s.time}</span></div>
          <div style="font-size: 11px; opacity: 0.6; margin-top: 2px;">${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</div>
          ${isCrossed ? '<div style="font-size: 11px; color: #10b981; margin-top: 4px; font-weight: 600;">✓ Crossed</div>' : '<div style="font-size: 11px; color: #06b6d4; margin-top: 4px; font-weight: 600;">Upcoming</div>'}
        </div>
      `);
    });

    // Fit bounds to include origin, bus, and destination ONLY (not all stops)
    const selectedVehicle = vehicles.find((x) => x.id === showRouteForVehicleId);
    const busCoords = selectedVehicle ? selectedVehicle.coords : originCoords;
    const allBounds = L.latLngBounds([
      [originCoords.lat, originCoords.lng],
      [destCoords.lat, destCoords.lng],
      [busCoords.lat, busCoords.lng],
    ]);
    map.fitBounds(allBounds, { padding: [80, 80], maxZoom: 13 });

    // Hide non-selected bus markers when a route is being viewed
    // (only show the selected bus on the map, hide the others to reduce clutter)
    for (const [id, marker] of markersRef.current.entries()) {
      if (id !== showRouteForVehicleId) {
        marker.setOpacity(0); // hide non-selected buses
      } else {
        marker.setOpacity(1); // show selected bus
      }
    }
  }, [showRouteForVehicleId, vehicles, crossedStopNames]);

  // Restore all bus markers when no route is selected
  useEffect(() => {
    if (showRouteForVehicleId) return;
    for (const [, marker] of markersRef.current.entries()) {
      marker.setOpacity(1);
    }
  }, [showRouteForVehicleId]);

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
