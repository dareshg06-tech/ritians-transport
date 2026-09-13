"use client";

interface HeroProps {
  total: number;
  earliest: string;
  latest: string;
  parkingCount: number;
  onDriverLogin: () => void;
  onFaceRegister: () => void;
}

export function Hero({ total, earliest, latest, parkingCount, onDriverLogin, onFaceRegister }: HeroProps) {
  return (
    <section className="rt-hero">
      <div className="rt-hero-grid">
        <div>
          <div className="rt-hero-eyebrow">Live Schedule Portal</div>
          <h1>Track your bus,<br/><span>plan your day.</span></h1>
          <p className="rt-hero-desc">
            View all {total} college bus routes, boarding points, detailed stops, and real-time campus parking updates — all in one place.
          </p>
          <div className="rt-hero-tags">
            <span className="rt-hero-tag"><i className="fas fa-shield-halved"></i> Admin-verified schedule</span>
            <span className="rt-hero-tag"><i className="fas fa-location-dot"></i> Live parking board</span>
            <span className="rt-hero-tag"><i className="fas fa-route"></i> Detailed stop listings</span>
          </div>
          <div className="rt-hero-actions">
            <button className="rt-hero-cta rt-hero-cta-secondary" onClick={onDriverLogin}>
              <i className="fas fa-location-arrow" />
              <span>Driver Login</span>
            </button>
            <button className="rt-hero-cta rt-hero-cta-face" onClick={onFaceRegister}>
              <i className="fas fa-face-viewfinder" />
              <span>Register Face</span>
              <i className="fas fa-arrow-right" style={{ fontSize: 10 }} />
            </button>
          </div>
        </div>
        <div className="rt-stat-grid">
          <div className="rt-stat-card">
            <div className="rt-stat-label">Total Routes</div>
            <div className="rt-stat-val accent">{total}</div>
          </div>
          <div className="rt-stat-card">
            <div className="rt-stat-label">Earliest Bus</div>
            <div className="rt-stat-val teal">{earliest}</div>
          </div>
          <div className="rt-stat-card">
            <div className="rt-stat-label">Latest Bus</div>
            <div className="rt-stat-val">{latest}</div>
          </div>
          <div className="rt-stat-card">
            <div className="rt-stat-label">Parking Updates</div>
            <div className="rt-stat-val accent">{parkingCount}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
