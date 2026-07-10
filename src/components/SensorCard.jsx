import React from "react";

const SensorCard = ({ title, value, unit, icon: Icon, status, statusType, description, glowColor }) => {
  // Determine color theme based on statusType
  const getStatusClass = () => {
    switch (statusType) {
      case "success": return "status-success";
      case "warning": return "status-warning";
      case "danger": return "status-danger";
      case "info": return "status-info";
      default: return "status-normal";
    }
  };

  const glowStyle = glowColor ? {
    boxShadow: `0 8px 32px rgba(255, 255, 255, 0.05), 0 0 16px ${glowColor}22`,
    borderLeft: `4px solid ${glowColor}`
  } : {};

  return (
    <div className="sensor-card" style={glowStyle}>
      <div className="sensor-header">
        <div className="sensor-title-group">
          <span className="sensor-title-text">{title}</span>
          <span className="sensor-desc">{description}</span>
        </div>
        <div className="sensor-icon-wrapper" style={{ color: glowColor || 'var(--primary-color)' }}>
          <Icon size={22} />
        </div>
      </div>
      
      <div className="sensor-value-container">
        <div className="sensor-value-row">
          <span className="sensor-value">{value}</span>
          <span className="sensor-unit">{unit}</span>
        </div>
        <span className={`sensor-status-badge ${getStatusClass()}`}>
          {status}
        </span>
      </div>
    </div>
  );
};

export default SensorCard;
