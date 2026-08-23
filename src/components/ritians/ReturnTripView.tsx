"use client";

import { useMemo, useState } from "react";
import { routes, getReturnTrip, getReturnArrival, getReturnTripDuration, AFTERNOON_DEPARTURE } from "@/lib/ritians/data";

interface ReturnTripViewProps {
  onOpenRoute: (routeNo: string) => void;
}

export function ReturnTripView({ onOpenRoute }: ReturnTripViewProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("arrival-asc");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = routes.filter((r) => {
      const txt = `${r.no} ${r.routeNo} ${r.routeName} ${r.start}`;
      return txt.toLowerCase().includes(q);
    });
    if (sort === "arrival-asc") {
      arr = [...arr].sort(
        (a, b) => tripDurationMinutes(a.routeNo) - tripDurationMinutes(b.routeNo)
      );
    } else if (sort === "arrival-desc") {
      arr = [...arr].sort(
        (a, b) => tripDurationMinutes(b.routeNo) - tripDurationMinutes(a.routeNo)
      );
    } else if (sort === "route-asc") {
      arr = [...arr].sort((a, b) => a.routeNo.localeCompare(b.routeNo));
    } else if (sort === "route-desc") {
      arr = [...arr].sort((a, b) => b.routeNo.localeCompare(a.routeNo));
    }
    return arr;
  }, [query, sort]);

  // Aggregate stats
  const stats = useMemo(() => {
    const durations = routes.map((r) => getReturnTripDuration(r.routeNo));
    const total = routes.length;
    const minDur = durations.length ? Math.min(...durations) : 0;
    const maxDur = durations.length ? Math.max(...durations) : 0;
    const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return {
      total,
      earliest: formatMinsToTime(15 * 60 + 40 + minDur),
      latest: formatMinsToTime(15 * 60 + 40 + maxDur),
      avg: `${Math.floor(avgDur / 60)}h ${avgDur % 60}m`,
    };
  }, []);

  return (
    <div className="rt-page-content">
      {/* Banner */}
      <div className="rt-return-banner">
        <div className="icon">
          <i className="fas fa-arrow-right-from-bracket" />
        </div>
        <div className="info">
          <h3>Afternoon Departure Schedule</h3>
          <p>
            All {stats.total} college buses depart from <strong style={{ color: "var(--text)" }}>RIT Campus at {AFTERNOON_DEPARTURE}</strong> and follow the morning route in reverse, dropping students back at their boarding points.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="val">{stats.total}</div>
            <div className="lbl">Buses</div>
          </div>
          <div className="stat">
            <div className="val">{stats.earliest}</div>
            <div className="lbl">First Arrival</div>
          </div>
          <div className="stat">
            <div className="val">{stats.latest}</div>
            <div className="lbl">Last Arrival</div>
          </div>
          <div className="stat">
            <div className="val">{stats.avg}</div>
            <div className="lbl">Avg Duration</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rt-panel rt-return-table">
        <div className="rt-panel-head">
          <div>
            <h3>Return Trip — All Bus Routes</h3>
            <p>Departs RIT Campus at {AFTERNOON_DEPARTURE} · Click a row for the full afternoon schedule.</p>
          </div>
          <div className="rt-search-row">
            <div className="rt-search-box">
              <i className="fas fa-search" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by route, area…"
              />
            </div>
            <select
              className="rt-styled-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="arrival-asc">Shortest Trip First</option>
              <option value="arrival-desc">Longest Trip First</option>
              <option value="route-asc">Route A → Z</option>
              <option value="route-desc">Route Z → A</option>
            </select>
          </div>
        </div>
        <div className="rt-panel-body" style={{ paddingTop: 0 }}>
          <div className="rt-table-wrap">
            <table className="rt-routes-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Route No</th>
                  <th>Route Name</th>
                  <th>Departure</th>
                  <th>Final Arrival</th>
                  <th>Trip Duration</th>
                  <th>Stops</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const dur = getReturnTripDuration(r.routeNo);
                  const durStr = `${Math.floor(dur / 60)}h ${dur % 60}m`;
                  const arrival = getReturnArrival(r.routeNo);
                  const stops = getReturnTrip(r.routeNo).length;
                  return (
                    <tr
                      key={r.routeNo}
                      onClick={() => onOpenRoute(r.routeNo)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{r.no}</td>
                      <td>{r.routeNo}</td>
                      <td>{r.routeName}</td>
                      <td>{AFTERNOON_DEPARTURE}</td>
                      <td>{arrival}</td>
                      <td>{durStr}</td>
                      <td>{stops}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="rt-no-results">
                <i className="fas fa-bus-simple" />
                <p>No routes match your search.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function tripDurationMinutes(routeNo: string): number {
  return getReturnTripDuration(routeNo);
}

function formatMinsToTime(min: number): string {
  if (min < 0) min += 24 * 60;
  if (min >= 24 * 60) min -= 24 * 60;
  let hr = Math.floor(min / 60);
  const mi = min % 60;
  const suffix = hr >= 12 ? "pm" : "am";
  let h12 = hr % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}.${mi.toString().padStart(2, "0")} ${suffix}`;
}
