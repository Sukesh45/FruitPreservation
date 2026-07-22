import React from "react";
import { Wind, Leaf, FlaskConical, Activity } from "lucide-react";

/**
 * GasBreakdownCard
 * Derives estimated CO2, Ethylene, and O2 concentrations
 * from a raw MQ135 PPM composite gas-index reading.
 *
 * MQ135 responds to NH3, NOx, Alcohol, Benzene, Smoke, CO2, Ethylene, etc.
 * These estimations are based on typical fruit-storage sensor profiles:
 *   - CO2  approx 65% of composite PPM (dominant gas in produce storage)
 *   - C2H4 approx 8-15% of composite PPM (ethylene, ripening signal)
 *   - O2   derived inversely; normal air = 20.9% vol, drops as CO2 rises
 */

const deriveGases = (mq135Ppm) => {
  const ppm = Math.max(0, mq135Ppm);

  // CO2 estimation: baseline 400 ppm (ambient), rises with spoilage gas
  const co2Base = 400;
  const co2Estimate = Math.round(co2Base + ppm * 0.65);

  // Ethylene estimation: very low in fresh air, rises sharply when ripening
  const c2h4Base = 0.01;
  const c2h4Estimate = parseFloat((c2h4Base + 0.00010 * Math.pow(ppm, 1.38)).toFixed(3));

  // Oxygen estimation: normal ~20.9%, drops as CO2 rises (simplified)
  const o2Normal = 20.9;
  const co2Surplus = Math.max(0, co2Estimate - 400);
  const o2Estimate = parseFloat(Math.max(17.0, o2Normal - (co2Surplus / 1000) * 0.5).toFixed(1));

  return { co2: co2Estimate, ethylene: c2h4Estimate, o2: o2Estimate };
};

// Status thresholds — all inputs are now in % ─────────────────────────────

// CO2 % thresholds  (normal air = 0.04%, safe limit ~0.1%, danger >0.2%)
const getCO2Status = (co2Pct) => {
  if (co2Pct < 0.06)  return { label: "Optimal",     type: "success", color: "#2ecc71" };
  if (co2Pct < 0.10)  return { label: "Elevated",    type: "info",    color: "#3498db" };
  if (co2Pct < 0.20)  return { label: "High - Vent", type: "warning", color: "#f39c12" };
  return               { label: "Critical",    type: "danger",  color: "#e74c3c" };
};

// Ethylene % thresholds  (fresh < 0.000001%, over-ripe > 0.00002%)
const getEthyleneStatus = (ethPct) => {
  if (ethPct < 0.000001)  return { label: "Trace - Fresh",    type: "success", color: "#2ecc71" };
  if (ethPct < 0.000005)  return { label: "Low Ripening",     type: "info",    color: "#3498db" };
  if (ethPct < 0.00002)   return { label: "Active Ripening",  type: "warning", color: "#f39c12" };
  return                   { label: "Over-Ripe / Spoil", type: "danger",  color: "#e74c3c" };
};

// O2 % thresholds  (normal = 20.9%)
const getO2Status = (o2) => {
  if (o2 >= 20.0) return { label: "Normal",         type: "success", color: "#2ecc71" };
  if (o2 >= 18.5) return { label: "Slightly Low",   type: "info",    color: "#3498db" };
  if (o2 >= 17.5) return { label: "Low - Vent Now", type: "warning", color: "#f39c12" };
  return              { label: "Deficient",      type: "danger",  color: "#e74c3c" };
};

const GasRow = ({ icon: Icon, label, valueStr, barPercent, barColor, statusLabel, statusType, unit, hint }) => (
  <div className="gas-row">
    <div className="gas-row-header">
      <div className="gas-row-label-group">
        <Icon size={16} style={{ color: barColor, flexShrink: 0 }} />
        <span className="gas-row-label">{label}</span>
        <span className="gas-row-hint">{hint}</span>
      </div>
      <div className="gas-row-right">
        <span className="gas-row-value">
          {valueStr}
          <span className="gas-row-unit"> {unit}</span>
        </span>
        <span className={`gas-status-badge status-${statusType}`}>{statusLabel}</span>
      </div>
    </div>
    <div className="gas-progress-track">
      <div
        className="gas-progress-fill"
        style={{
          width: `${Math.min(100, barPercent)}%`,
          background: barColor,
          boxShadow: `0 0 8px ${barColor}66`
        }}
      />
    </div>
  </div>
);

const GasBreakdownCard = ({ mq135Ppm }) => {
  const ppm = Math.max(0, parseInt(mq135Ppm ?? 0));
  const { co2, ethylene, o2 } = deriveGases(ppm);

  // Convert to % for display ─────────────────────────────────────────────
  const co2Pct = co2 / 10000;          // PPM → %   e.g. 465 PPM = 0.0465%
  const ethPct = ethylene / 10000;     // PPM → %   e.g. 0.03 PPM = 0.000003%
  const o2Pct  = o2;                   // already vol%  e.g. 20.9%

  const co2Status      = getCO2Status(co2Pct);
  const ethyleneStatus = getEthyleneStatus(ethPct);
  const o2Status       = getO2Status(o2Pct);

  // Progress bar percentages (relative to danger ceiling) ─────────────────
  const co2Bar = Math.min(100, (co2Pct / 0.25) * 100);         // 0.25% = ceiling
  const ethBar = Math.min(100, (ethPct / 0.000025) * 100);     // 0.000025% = ceiling
  const o2Bar  = Math.min(100, ((o2Pct - 17.0) / (21.0 - 17.0)) * 100);

  const overallDanger  = co2Status.type === "danger"  || ethyleneStatus.type === "danger"  || o2Status.type === "danger";
  const overallWarning = co2Status.type === "warning" || ethyleneStatus.type === "warning" || o2Status.type === "warning";
  const overallType    = overallDanger ? "danger" : overallWarning ? "warning" : "success";
  const overallGlow    = overallDanger ? "#e74c3c" : overallWarning ? "#f39c12" : "#2ecc71";

  return (
    <div
      className="gas-breakdown-card"
      style={{
        borderLeft: `4px solid ${overallGlow}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.2), 0 0 20px ${overallGlow}18`
      }}
    >
      <div className="gas-breakdown-header">
        <div className="gas-breakdown-title-group">
          <div className="gas-breakdown-icon-wrap" style={{ color: overallGlow }}>
            <Activity size={20} />
          </div>
          <div>
            <span className="gas-breakdown-title">Gas Composition Analysis</span>
            <span className="gas-breakdown-sub">
              Derived from MQ135 &middot; Raw Index: <strong>{ppm} PPM</strong>
            </span>
          </div>
        </div>
        <span className={`gas-overall-badge status-${overallType}`}>
          {overallDanger ? "⚠ Critical" : overallWarning ? "△ Monitor" : "✓ Stable"}
        </span>
      </div>

      <div className="gas-breakdown-divider" />

      <div className="gas-rows-container">
        <GasRow
          icon={Wind}
          label="Carbon Dioxide (CO2)"
          valueStr={co2Pct.toFixed(4)}
          unit="%"
          barPercent={co2Bar}
          barColor={co2Status.color}
          statusLabel={co2Status.label}
          statusType={co2Status.type}
          hint="Respiration & fermentation byproduct"
        />
        <GasRow
          icon={Leaf}
          label="Ethylene (C2H4)"
          valueStr={ethPct.toFixed(7)}
          unit="%"
          barPercent={ethBar}
          barColor={ethyleneStatus.color}
          statusLabel={ethyleneStatus.label}
          statusType={ethyleneStatus.type}
          hint="Plant hormone — triggers ripening"
        />
        <GasRow
          icon={FlaskConical}
          label="Oxygen (O2)"
          valueStr={o2Pct.toFixed(2)}
          unit="%"
          barPercent={o2Bar}
          barColor={o2Status.color}
          statusLabel={o2Status.label}
          statusType={o2Status.type}
          hint="Atmospheric O2 — drops as CO2 rises"
        />
      </div>

      <div className="gas-breakdown-footer">
        <span>
          Values are statistically estimated from MQ135 composite index. For lab-grade accuracy, use dedicated CO2 / ethylene sensors.
        </span>
      </div>
    </div>
  );
};

export default GasBreakdownCard;
