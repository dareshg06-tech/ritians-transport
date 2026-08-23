"use client";

interface InfoModalProps {
  open: boolean;
  title: string;
  icon: string;
  iconColor?: string;
  subtitle?: string;
  body: React.ReactNode;
  onClose: () => void;
}

export function InfoModal({ open, title, icon, iconColor, subtitle, body, onClose }: InfoModalProps) {
  if (!open) return null;
  return (
    <div className="rt-modal-overlay" onClick={onClose}>
      <div className="rt-modal-box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <button className="rt-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-xmark" />
        </button>
        <div className="rt-modal-header">
          <div
            className="rt-modal-icon-ring"
            style={iconColor ? { background: `linear-gradient(135deg, ${iconColor}, ${iconColor})` } : undefined}
          >
            <i className={icon} />
          </div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="rt-modal-body">{body}</div>
      </div>
    </div>
  );
}

export function ComingSoonContent({ feature }: { feature: string }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 4px" }}>
      <div style={{
        width: 60, height: 60, borderRadius: 18, margin: "0 auto 14px",
        background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, color: "var(--accent2)",
      }}>
        <i className="fas fa-screwdriver-wrench" />
      </div>
      <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 8, lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text)" }}>{feature}</strong> is part of the original Ritians Transport system and
        requires backend services (live GPS streaming, Firebase Messaging, face recognition).
      </p>
      <p style={{ fontSize: 12, color: "var(--text3)" }}>
        This clone preserves the full dashboard UI — student/admin/driver views, route management, parking board,
        and stops explorer are all fully functional.
      </p>
    </div>
  );
}
