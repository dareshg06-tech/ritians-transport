"use client";

interface LandingProps {
  onOpenDashboard: () => void;
  onOpenDriver: () => void;
}

export function Landing({ onOpenDashboard, onOpenDriver }: LandingProps) {
  return (
    <div className="rt-landing">
      <div className="rt-landing-hero">
        <div className="rt-landing-badge">
          <span className="pulse" /> LIVE FLEET TRACKING SYSTEM
        </div>
        <h1>
          Live Vehicle <span className="accent">Tracking</span>
          <br />& Driver GPS Portal
        </h1>
        <p>
          Monitor your entire bus fleet in real time. Live GPS positions, boarding-stop
          tracking ("Where Is My Bus"), arrival notifications, and AI-powered assistance —
          all in one premium fleet dashboard.
        </p>
        <div className="rt-landing-actions">
          <button className="rt-landing-cta rt-landing-cta-primary" onClick={onOpenDashboard}>
            <i className="fas fa-satellite-dish" /> Open Dashboard
          </button>
          <button className="rt-landing-cta rt-landing-cta-secondary" onClick={onOpenDriver}>
            <i className="fas fa-location-arrow" /> Driver GPS Portal
          </button>
        </div>
      </div>

      <div className="rt-landing-stats">
        <div className="rt-landing-stat">
          <div className="val" style={{ color: "var(--accent2)" }}>10</div>
          <div className="lbl">Vehicles</div>
        </div>
        <div className="rt-landing-stat">
          <div className="val" style={{ color: "#5EEAB0" }}>51</div>
          <div className="lbl">Routes</div>
        </div>
        <div className="rt-landing-stat">
          <div className="val" style={{ color: "var(--accent)" }}>500+</div>
          <div className="lbl">Boarding Stops</div>
        </div>
        <div className="rt-landing-stat">
          <div className="val" style={{ color: "var(--purple)" }}>AI</div>
          <div className="lbl">Chat Assistant</div>
        </div>
      </div>
    </div>
  );
}
