import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import SensorCard from "../components/SensorCard";
import FreshnessAlert from "../components/FreshnessAlert";
import TrendChart from "../components/TrendChart";
import SimulatorPanel from "../components/SimulatorPanel";
import AutomationPanel from "../components/AutomationPanel";
import GasBreakdownCard from "../components/GasBreakdownCard";
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Zap, 
  Cpu, 
  Database,
  CloudLightning,
  AlertTriangle,
  Download
} from "lucide-react";

const Dashboard = () => {
  const { isGuest } = useAuth();
  
  // Real-time sensor states — matches FruitPreservation Firebase schema
  const [sensorData, setSensorData] = useState({
    temperature: 0,
    humidity: 0,
    mq135: 0,
    uvStatus: "OFF",
    timestamp: Date.now()
  });

  // History state for Recharts
  const [historyData, setHistoryData] = useState([]);
  
  // Status states
  const [dbConnected, setDbConnected] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If the user signed in as guest, use local demo mode instead of Firebase
    if (isGuest) {
      setDbConnected(false);
      setUsingFallback(true);
      setLoading(false);
      
      // Initialize some dummy historical data for local guest mode
      const dummyHistory = [];
      const now = Date.now();
      for (let i = 10; i >= 0; i--) {
        dummyHistory.push({
          timestamp: now - i * 60000,
          temperature: 4.0 + Math.sin(i) * 0.5,
          humidity: 85 + Math.cos(i) * 2,
          mq135: 110 + (10 - i) * 5,
          uvStatus: i % 3 === 0 ? "ON" : "OFF"
        });
      }
      setHistoryData(dummyHistory);
      return;
    }

    // 1. Listen to FruitPreservation node — real sensor data path
    const statusRef = ref(db, "FruitPreservation");
    
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setSensorData(data);
        setDbConnected(true);
        setUsingFallback(false);
        console.log("[Firebase] FruitPreservation data received:", data);
      } else {
        // Node exists in DB but has no data yet — wait for sensor to push
        console.warn("[Firebase] FruitPreservation node is empty. Waiting for sensor data...");
        setDbConnected(true);
        setUsingFallback(false);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Firebase RTDB read blocked or failed. Using local simulation state.", error);
      setDbConnected(false);
      setUsingFallback(true);
      setLoading(false);
    });

    // 2. Listen to sensor history node (if you log history separately)
    const historyRef = ref(db, "sensor_history");
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert object map to sorted array
        const historyList = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => a.timestamp - b.timestamp);
        setHistoryData(historyList);
      }
    }, (error) => {
      console.warn("Could not load history data from Firebase.", error);
    });

    // Timeout loading state if Firebase takes too long
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    return () => {
      unsubscribeStatus();
      unsubscribeHistory();
      clearTimeout(timer);
    };
  }, [isGuest]);

  // Local state modifier for local demo mode simulator
  // Since guest users don't write to Firebase, we let the simulator update local state directly
  useEffect(() => {
    if (usingFallback) {
      // Whenever local state is simulated in Guest mode
      // We can hook a listener in window, or pass updater
      const handleLocalSimUpdate = (e) => {
        const { type, value } = e.detail;
        setSensorData(prev => {
          const updated = { ...prev, [type]: value, timestamp: Date.now() };
          
          // If a new historical log was requested
          if (e.detail.logHistory) {
            setHistoryData(oldHist => [
              ...oldHist,
              {
                timestamp: Date.now(),
                temperature: updated.temperature,
                humidity: updated.humidity,
                mq135: updated.mq135,
                uvStatus: updated.uvStatus
              }
            ]);
          }
          return updated;
        });
      };

      window.addEventListener("localSimUpdate", handleLocalSimUpdate);
      return () => window.removeEventListener("localSimUpdate", handleLocalSimUpdate);
    }
  }, [usingFallback]);

  // Handle local state updates from the simulator
  const handleLocalChange = (newTemp, newHum, newGas, newUv, shouldLog = false) => {
    if (usingFallback) {
      // Dispatches event to update state locally
      const event = new CustomEvent("localSimUpdate", {
        detail: {
          temperature: parseFloat(newTemp),
          humidity: parseFloat(newHum),
          mq135: parseInt(newGas),
          uvStatus: newUv ? "ON" : "OFF",
          logHistory: shouldLog
        }
      });
      window.dispatchEvent(event);
    }
  };

  // Safe variables computation — mapped to FruitPreservation Firebase fields
  const temp = parseFloat(sensorData.temperature ?? 0);
  const humidity = parseFloat(sensorData.humidity ?? 0);
  const gasLevel = parseInt(sensorData.mq135 ?? 0);
  const uvStatus = (sensorData.uvStatus === "ON" || sensorData.uvStatus === true);
  const lastUpdated = sensorData.timestamp ? new Date(sensorData.timestamp) : new Date();

  // UV Status description
  const getUVStatusDescription = () => {
    if (uvStatus) return "Sterilization ON (UV-C active)";
    return "Sterilization Idle (Next cycle: ~2 hrs)";
  };

  const downloadCSV = () => {
    if (historyData.length === 0) {
      alert("No sensor history data available to export.");
      return;
    }
    
    const headers = [
      "Timestamp", 
      "Date", 
      "Time", 
      "Temperature (C)", 
      "Humidity (% RH)", 
      "MQ135 Gas (PPM)", 
      "UV Sterilizer Status"
    ];
    
    const pad = (num) => String(num).padStart(2, "0");
    const rows = historyData.map(item => {
      const d = new Date(item.timestamp);
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      return [
        item.timestamp,
        dateStr,
        timeStr,
        item.temperature,
        item.humidity,
        item.gas_level,
        item.uv_status ? "ON" : "OFF"
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lumora_sensor_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-large"></div>
        <p>Connecting to Lumora Core IoT Node...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="container dashboard-container">
        
        {/* Connection Status Bar */}
        <div className="dashboard-status-bar">
          <div className="status-item">
            <Cpu size={16} className="status-icon pulse-active" />
            <span>IoT System: <strong className="text-success">Active</strong></span>
          </div>

          <div className="status-item">
            {dbConnected ? (
              <>
                <Database size={16} className="status-icon text-success" />
                <span>Source: <strong className="text-success">Firebase Realtime DB</strong></span>
              </>
            ) : (
              <>
                <CloudLightning size={16} className="status-icon text-warning animate-bounce" />
                <span>Source: <strong className="text-warning">Local Simulator (Guest Mode)</strong></span>
              </>
            )}
          </div>

          <div className="status-item last-updated" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Last Sync: {lastUpdated.toLocaleTimeString()}</span>
            <button 
              onClick={downloadCSV} 
              className="btn-secondary-glow" 
              style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', height: '28px' }}
              title="Download overall sensor working details in CSV"
            >
              <Download size={12} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {usingFallback && (
          <div className="local-mode-warning">
            <AlertTriangle size={18} />
            <span>
              Running in **Local Simulation mode**. You can use the sliders below to test dashboard alerts and shelf-life predictions in real time.
            </span>
          </div>
        )}

        {/* Column layout: Top is overall alert */}
        <div className="dashboard-row full-width">
          <FreshnessAlert 
            temperature={temp} 
            humidity={humidity} 
            gasLevel={gasLevel} 
            uvStatus={uvStatus} 
          />
        </div>

        {/* Column layout: Sensor Gauges */}
        <div className="dashboard-sensor-grid">
          <SensorCard 
            title="Temperature"
            value={temp.toFixed(1)}
            unit="°C"
            icon={Thermometer}
            status={temp >= 2.0 && temp <= 6.0 ? "Ideal" : temp > 6.0 ? "Too Warm" : "Freezing"}
            statusType={temp >= 2.0 && temp <= 6.0 ? "success" : temp > 10.0 ? "danger" : "warning"}
            description="Continuous Cooling"
            glowColor="var(--accent-color)"
          />

          <SensorCard 
            title="Humidity"
            value={Math.round(humidity)}
            unit="% RH"
            icon={Droplets}
            status={humidity >= 80 && humidity <= 90 ? "Optimal" : humidity > 90 ? "High Damp" : "Dry Air"}
            statusType={humidity >= 80 && humidity <= 90 ? "success" : humidity < 60 ? "danger" : "warning"}
            description="Produce Moisture"
            glowColor="#3498db"
          />

          <SensorCard 
            title="MQ135 Gas Index"
            value={gasLevel}
            unit="PPM"
            icon={Wind}
            status={gasLevel < 180 ? "Clean Air" : gasLevel < 350 ? "Ethylene Alert" : "Toxic Spoilage"}
            statusType={gasLevel < 180 ? "success" : gasLevel < 350 ? "warning" : "danger"}
            description="Organic Gas Sniffer"
            glowColor={gasLevel >= 350 ? "#e74c3c" : gasLevel >= 180 ? "#f39c12" : "#2ecc71"}
            rawKey="mq135"
          />

          <SensorCard 
            title="UV Sterilizer"
            value={uvStatus ? "ACTIVE" : "RESTING"}
            unit=""
            icon={Zap}
            status={uvStatus ? "Eliminating Germs" : "Cycles Idle"}
            statusType={uvStatus ? "success" : "info"}
            description="15m on / 3h cycle"
            glowColor={uvStatus ? "#9b59b6" : "rgba(255,255,255,0.1)"}
          />
        </div>

        {/* Gas Composition Breakdown from MQ135 */}
        <div className="dashboard-row full-width" style={{ marginTop: "0" }}>
          <GasBreakdownCard mq135Ppm={gasLevel} />
        </div>

        {/* Bottom grid: Chart on Left, Simulator on Right */}
        <div className="dashboard-grid-two-cols">
          <div className="grid-col-chart" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <TrendChart historyData={historyData} />
            <AutomationPanel historyData={historyData} isGuest={isGuest} />
          </div>
          
          <div className="grid-col-simulator">
            {/* We pass a custom implementation in case of Local Simulation */}
            {usingFallback ? (
              <LocalSimulatorWrapper 
                temp={temp} 
                humidity={humidity} 
                gas={gasLevel} 
                uv={uvStatus}
                onChange={handleLocalChange}
              />
            ) : (
              <SimulatorPanel currentData={sensorData} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// A sub-component helper when Firebase is unavailable
const LocalSimulatorWrapper = ({ temp, humidity, gas, uv, onChange }) => {
  const [localTemp, setLocalTemp] = useState(temp);
  const [localHumidity, setLocalHumidity] = useState(humidity);
  const [localGas, setLocalGas] = useState(gas);
  const [localUv, setLocalUv] = useState(uv);
  const [feedback, setFeedback] = useState("");

  const handleSlider = (type, val) => {
    let t = localTemp, h = localHumidity, g = localGas, u = localUv;
    if (type === "temp") { setLocalTemp(parseFloat(val)); t = parseFloat(val); }
    if (type === "humidity") { setLocalHumidity(parseFloat(val)); h = parseFloat(val); }
    if (type === "gas") { setLocalGas(parseInt(val)); g = parseInt(val); }
    if (type === "uv") { setLocalUv(val); u = val; }

    onChange(t, h, g, u, false);
  };

  const loadPreset = (presetName) => {
    let t = 4.0, h = 85.0, g = 110, u = false;
    if (presetName === "spoiled") {
      t = 12.5; h = 98.0; g = 420; u = false;
    } else if (presetName === "dry") {
      t = 5.0; h = 45.0; g = 100; u = true;
    } else if (presetName === "optimal") {
      t = 3.5; h = 86.0; g = 90; u = true;
    }
    
    setLocalTemp(t);
    setLocalHumidity(h);
    setLocalGas(g);
    setLocalUv(u);
    onChange(t, h, g, u, false);
    triggerFeedback("Preset loaded");
  };

  const triggerFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 2500);
  };

  const handleLog = () => {
    onChange(localTemp, localHumidity, localGas, localUv, true);
    triggerFeedback("Logged to local chart history");
  };

  return (
    <div className="simulator-card local-sim-ui">
      <div className="sim-header">
        <div className="sim-title">
          <Zap size={20} className="sim-icon text-warning" />
          <h4>Local Simulation Engine</h4>
        </div>
        <span className="sim-subtitle text-warning">Firebase configuration bypassed for sandbox testing</span>
      </div>

      <div className="sim-body">
        <div className="sim-control-group">
          <div className="slider-header">
            <span>Temp (Sandbox): <strong>{localTemp}°C</strong></span>
          </div>
          <input 
            type="range" min="0" max="30" step="0.5"
            value={localTemp}
            onChange={(e) => handleSlider("temp", e.target.value)}
            className="sim-slider slider-temp"
          />
        </div>

        <div className="sim-control-group">
          <div className="slider-header">
            <span>Humidity (Sandbox): <strong>{localHumidity}%</strong></span>
          </div>
          <input 
            type="range" min="20" max="100" step="1"
            value={localHumidity}
            onChange={(e) => handleSlider("humidity", e.target.value)}
            className="sim-slider slider-humidity"
          />
        </div>

        <div className="sim-control-group">
          <div className="slider-header">
            <span>Gas (Sandbox): <strong>{localGas} PPM</strong></span>
          </div>
          <input 
            type="range" min="50" max="600" step="10"
            value={localGas}
            onChange={(e) => handleSlider("gas", e.target.value)}
            className="sim-slider slider-gas"
          />
        </div>

        <div className="sim-toggle-row">
          <div className="toggle-container">
            <span className="toggle-label">UV Sterilizer:</span>
            <button 
              className={`sim-toggle-btn ${localUv ? "active" : ""}`}
              onClick={() => handleSlider("uv", !localUv)}
            >
              <div className="toggle-handle"></div>
              <span className="toggle-state-text">{localUv ? "ON" : "OFF"}</span>
            </button>
          </div>

          <button onClick={handleLog} className="btn-secondary-glow">
            <span>Log Data Point</span>
          </button>
        </div>

        <div className="preset-row">
          <span className="preset-label">Presets:</span>
          <div className="preset-buttons">
            <button className="preset-btn" onClick={() => loadPreset("optimal")}>Optimal</button>
            <button className="preset-btn warning" onClick={() => loadPreset("dry")}>Dry Air</button>
            <button className="preset-btn danger" onClick={() => loadPreset("spoiled")}>Rot Risk</button>
          </div>
        </div>

        {feedback && (
          <div className="sim-feedback local-feedback">
            <span>{feedback}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
