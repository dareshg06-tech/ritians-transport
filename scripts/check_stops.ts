import { getRouteStopsWithCoords } from "../src/lib/ritians/fleet";
const stops = getRouteStopsWithCoords("R01");
stops.forEach((s, i) => {
  console.log(`${i+1}. ${s.stop} — lat: ${s.coords?.lat.toFixed(5)}, lng: ${s.coords?.lng.toFixed(5)}`);
});
