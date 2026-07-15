import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { BarChart3, LineChart as LineIcon } from "lucide-react";

const TrendChart = ({ historyData }) => {
  const [activeMetric, setActiveMetric] = useState("all"); // 'all', 'temp', 'humidity', 'gas'

  // Format history data for chart
  const formattedData = historyData
    .map((item) => {
      const date = new Date(item.timestamp || Date.now());
      return {
        ...item,
        timeLabel: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        dateLabel: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      };
    })
    // Sort chronologically just in case
    .sort((a, b) => a.timestamp - b.timestamp)
    // Take the last 15 data points to avoid crowding
    .slice(-15);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-chart-tooltip">
          <p className="tooltip-time">{payload[0].payload.dateLabel} - {payload[0].payload.timeLabel}</p>
          <div className="tooltip-divider"></div>
          {payload.map((pld, index) => (
            <p key={index} style={{ color: pld.color }} className="tooltip-item">
              <span className="tooltip-dot" style={{ backgroundColor: pld.color }}></span>
              {pld.name}: {pld.value} {pld.unit || ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (formattedData.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>No historical data points available yet.</p>
        <span className="empty-sub">Use the "Log Data Point" button in the simulator to add logs.</span>
      </div>
    );
  }

  return (
    <div className="chart-container-card">
      <div className="chart-header">
        <div className="chart-title-group">
          <div className="chart-icon-wrap">
            <LineIcon size={18} />
          </div>
          <h4>Environmental Trends</h4>
        </div>

        <div className="chart-metric-selector">
          <button 
            className={`metric-tab ${activeMetric === "all" ? "active" : ""}`}
            onClick={() => setActiveMetric("all")}
          >
            All
          </button>
          <button 
            className={`metric-tab ${activeMetric === "temp" ? "active" : ""}`}
            onClick={() => setActiveMetric("temp")}
            style={{ borderBottomColor: "var(--accent-color)" }}
          >
            Temp
          </button>
          <button 
            className={`metric-tab ${activeMetric === "humidity" ? "active" : ""}`}
            onClick={() => setActiveMetric("humidity")}
            style={{ borderBottomColor: "#3498db" }}
          >
            Humidity
          </button>
          <button 
            className={`metric-tab ${activeMetric === "gas" ? "active" : ""}`}
            onClick={() => setActiveMetric("gas")}
            style={{ borderBottomColor: "#e74c3c" }}
          >
            Gas (MQ135)
          </button>
        </div>
      </div>

      <div className="chart-body">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey="timeLabel" 
              stroke="#888" 
              fontSize={10}
              tickLine={false}
            />
            <YAxis stroke="#888" fontSize={10} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
            
            {(activeMetric === "all" || activeMetric === "temp") && (
              <Line
                type="monotone"
                dataKey="temperature"
                name="Temperature"
                unit="°C"
                stroke="var(--accent-color)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--accent-color)" }}
                activeDot={{ r: 6 }}
              />
            )}
            
            {(activeMetric === "all" || activeMetric === "humidity") && (
              <Line
                type="monotone"
                dataKey="humidity"
                name="Humidity"
                unit="%"
                stroke="#3498db"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3498db" }}
                activeDot={{ r: 6 }}
              />
            )}

            {(activeMetric === "all" || activeMetric === "gas") && (
              <Line
                type="monotone"
                dataKey="mq135"
                name="MQ135 Gas"
                unit=" PPM"
                stroke="#e74c3c"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#e74c3c" }}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
