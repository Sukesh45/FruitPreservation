import React, { useState } from "react";
import { db } from "../firebase";
import { ref, set, push } from "firebase/database";
import { Play, Sparkles, Sliders, Check } from "lucide-react";

const SimulatorPanel = ({ currentData }) => {
  const [temp, setTemp] = useState(currentData?.temperature || 4.0);
  const [humidity, setHumidity] = useState(currentData?.humidity || 85.0);
  const [gas, setGas] = useState(currentData?.gas_level || 120);
  const [uv, setUv] = useState(currentData?.uv_status || false);
  const [simulating, setSimulating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Sync with current data if it updates externally
  React.useEffect(() => {
    if (currentData) {
      setTemp(currentData.temperature);
      setHumidity(currentData.humidity);
      setGas(currentData.gas_level);
      setUv(currentData.uv_status);
    }
  }, [currentData]);

  const updateFirebase = async (newTemp, newHum, newGas, newUv) => {
    try {
      const statusRef = ref(db, "fridge_status");
      await set(statusRef, {
        temperature: parseFloat(newTemp),
        humidity: parseFloat(newHum),
        gas_level: parseInt(newGas),
        uv_status: newUv,
        last_updated: Date.now()
      });
      showFeedback("Synced with Firebase RTDB");
    } catch (error) {
      console.error("Error writing to Firebase:", error);
    }
  };

  const showFeedback = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleSliderChange = (type, val) => {
    let t = temp, h = humidity, g = gas, u = uv;
    if (type === "temp") { setTemp(val); t = val; }
    if (type === "humidity") { setHumidity(val); h = val; }
    if (type === "gas") { setGas(val); g = val; }
    if (type === "uv") { setUv(val); u = val; }
    
    updateFirebase(t, h, g, u);
  };

  const addHistoryPoint = async () => {
    try {
      const historyRef = ref(db, "sensor_history");
      const newPointRef = push(historyRef);
      await set(newPointRef, {
        timestamp: Date.now(),
        temperature: parseFloat(temp),
        humidity: parseFloat(humidity),
        gas_level: parseInt(gas),
        uv_status: uv
      });
      showFeedback("Added data point to history!");
    } catch (error) {
      console.error("Error adding history entry:", error);
    }
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
    
    setTemp(t);
    setHumidity(h);
    setGas(g);
    setUv(u);
    updateFirebase(t, h, g, u);
  };

  return (
    <div className="simulator-card">
      <div className="sim-header">
        <div className="sim-title">
          <Sliders size={20} className="sim-icon" />
          <h4>IoT Device Simulator</h4>
        </div>
        <span className="sim-subtitle">Simulate real-time sensor events in the fridge</span>
      </div>

      <div className="sim-body">
        {/* Sliders */}
        <div className="sim-control-group">
          <div className="slider-header">
            <span>Temperature: <strong>{temp}°C</strong></span>
            <span className="range-label">0°C - 20°C</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="20" 
            step="0.5"
            value={temp}
            onChange={(e) => handleSliderChange("temp", e.target.value)}
            className="sim-slider slider-temp"
          />
        </div>

        <div className="sim-control-group">
          <div className="slider-header">
            <span>Humidity: <strong>{humidity}% RH</strong></span>
            <span className="range-label">20% - 100%</span>
          </div>
          <input 
            type="range" 
            min="20" 
            max="100" 
            step="1"
            value={humidity}
            onChange={(e) => handleSliderChange("humidity", e.target.value)}
            className="sim-slider slider-humidity"
          />
        </div>

        <div className="sim-control-group">
          <div className="slider-header">
            <span>MQ135 Spoilage Gas: <strong>{gas} PPM</strong></span>
            <span className="range-label">50 PPM - 600 PPM</span>
          </div>
          <input 
            type="range" 
            min="50" 
            max="600" 
            step="10"
            value={gas}
            onChange={(e) => handleSliderChange("gas", e.target.value)}
            className="sim-slider slider-gas"
          />
        </div>

        {/* Toggles */}
        <div className="sim-toggle-row">
          <div className="toggle-container">
            <span className="toggle-label">UV Sterilizer Light:</span>
            <button 
              className={`sim-toggle-btn ${uv ? "active" : ""}`}
              onClick={() => handleSliderChange("uv", !uv)}
            >
              <div className="toggle-handle"></div>
              <span className="toggle-state-text">{uv ? "ON" : "OFF"}</span>
            </button>
          </div>

          <button onClick={addHistoryPoint} className="btn-secondary-glow">
            <Play size={14} />
            <span>Log Data Point</span>
          </button>
        </div>

        <div className="preset-row">
          <span className="preset-label">Quick Presets:</span>
          <div className="preset-buttons">
            <button className="preset-btn" onClick={() => loadPreset("optimal")}>Optimal</button>
            <button className="preset-btn warning" onClick={() => loadPreset("dry")}>Dry Air</button>
            <button className="preset-btn danger" onClick={() => loadPreset("spoiled")}>Rot Risk</button>
          </div>
        </div>

        {successMsg && (
          <div className="sim-feedback">
            <Check size={14} />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulatorPanel;
