import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, AlertCircle, Info, Sparkles, Brain, Loader2 } from "lucide-react";

const FreshnessAlert = ({ temperature, humidity, gasLevel, uvStatus }) => {
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Reset AI result when sensor values change to keep data in sync
  useEffect(() => {
    setAiResult(null);
    setError(false);
  }, [temperature, humidity, gasLevel, uvStatus]);

  // Local Rule-Based Fallback calculation (Instant feedback)
  let score = 100;
  let status = "Optimal Freshness";
  let daysFresh = 12;
  let statusType = "success"; // success, warning, danger
  let recommendations = [];

  // 1. Temperature Check (Ideal: 2°C to 6°C)
  if (temperature < 1.0) {
    score -= 15;
    recommendations.push("Temperature is freezing! Increase temperature slightly to prevent frost damage to cell walls.");
  } else if (temperature > 6.0 && temperature <= 10.0) {
    score -= 20;
    recommendations.push("Fridge temperature is slightly warm. Lower it below 6°C to slow bacterial growth.");
  } else if (temperature > 10.0) {
    score -= 40;
    recommendations.push("CRITICAL TEMP: Temperature is too high! Cool down immediately to prevent rapid spoilage.");
  }

  // 2. Humidity Check (Ideal: 80% to 90% RH)
  if (humidity < 60) {
    score -= 15;
    recommendations.push("Humidity is very dry. Fruits may dehydrate and shrivel. Cover them or adjust humidity controls.");
  } else if (humidity >= 60 && humidity < 80) {
    score -= 5;
    recommendations.push("Humidity is slightly low. Ideal moisture is 80-90% for fresh produce.");
  } else if (humidity > 95) {
    score -= 10;
    recommendations.push("Humidity is extremely high. Excess condensation can speed up mold development.");
  }

  // 3. MQ135 Gas Quality Check (Ideal: < 180 PPM)
  if (gasLevel >= 180 && gasLevel < 350) {
    score -= 30;
    recommendations.push("Ripening gases (Ethylene/CO2) are rising. Some fruits are ripening rapidly. Ensure ventilation.");
  } else if (gasLevel >= 350) {
    score -= 60;
    recommendations.push("TOXIC SPOILAGE DETECTED: Organic gases or rot detected! Inspect and remove spoiled fruit immediately.");
  }

  if (!uvStatus) {
    score -= 5;
  }

  if (score >= 80) {
    status = "Optimal Freshness";
    statusType = "success";
    daysFresh = Math.max(7, Math.round((score / 100) * 12));
  } else if (score >= 45) {
    status = "Ripening / Monitor";
    statusType = "warning";
    daysFresh = Math.max(2, Math.round((score / 100) * 8));
  } else {
    status = "Spoilage / Toxic Risk";
    statusType = "danger";
    daysFresh = 0;
  }

  if (recommendations.length === 0) {
    recommendations.push("All systems running optimally. UV light sterilization is actively eliminating bacteria and mold spores.");
  }

  // Groq API Call
  const analyzeWithAI = async () => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      setError("Groq API Key is not set. Add VITE_GROQ_API_KEY to your .env file.");
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are Lumora AI, an advanced IoT fruit preservation assistant. Analyze the provided sensor data (Temperature, Humidity, Gas Level, UV Status) and return a JSON object. The JSON object must contain exactly these keys: 'score' (number 0-100 representing safety index), 'status' (string matching the rating), 'statusType' (string: success/warning/danger), 'daysFresh' (number representing estimated shelf life), 'aiInsights' (string explaining biological/chemical decay or preservation factors), 'recommendations' (array of strings. You MUST include explicit preservation tips detailing what specific adjustments to temperature, humidity, gas levels, and UV status the user should perform to prolong the fruit's freshness for additional days. Provide exact target ranges and shelf-life extension estimates, e.g., 'Lower temperature to 2°C - 5°C to gain +4 days of freshness', 'Set humidity to 80-90% to avoid shriveling', 'Turn on UV sterilizer cycles to suppress bacterial activity')."
            },
            {
              role: "user",
              content: `JSON Sensor telemetry inputs:\n- Temperature: ${temperature}°C\n- Humidity: ${humidity}%\n- MQ135 Spoilage Gas: ${gasLevel} PPM\n- UV Sterilizer: ${uvStatus ? "ON" : "OFF"}`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.choices[0].message.content;
      const parsed = JSON.parse(rawText);

      setAiResult(parsed);
    } catch (err) {
      console.error(err);
      setError("AI service unavailable. Make sure your Groq key is valid and you are online.");
    } finally {
      setLoading(false);
    }
  };

  // Determine current display values (AI vs Rule Engine)
  const displayScore = aiResult ? aiResult.score : score;
  const displayStatus = aiResult ? aiResult.status : status;
  const displayStatusType = aiResult ? aiResult.statusType : statusType;
  const displayDaysFresh = aiResult ? aiResult.daysFresh : daysFresh;
  const displayRecommendations = aiResult ? aiResult.recommendations : recommendations;

  const getIcon = () => {
    switch (displayStatusType) {
      case "success":
        return <ShieldCheck size={36} className="text-success" />;
      case "warning":
        return <AlertTriangle size={36} className="text-warning" />;
      case "danger":
        return <AlertCircle size={36} className="text-danger" />;
      default:
        return <Info size={36} />;
    }
  };

  const alertBgClass = `freshness-alert-card bg-${displayStatusType}`;
  const apiKeyExists = !!import.meta.env.VITE_GROQ_API_KEY;

  return (
    <div className={alertBgClass}>
      <div className="alert-top-section">
        <div className="alert-icon-area">
          {getIcon()}
        </div>
        <div className="alert-text-area">
          <div className="alert-heading">
            <h4>
              Fruit Health Condition:{" "}
              <span className={`condition-tag condition-${displayStatusType}`}>
                {displayStatus}
              </span>
            </h4>
          </div>

          <div className="shelf-life-display">
            <span className="shelf-life-label">Estimated Shelf Life: </span>
            <span className={`shelf-life-value text-${displayStatusType}`}>
              {displayDaysFresh > 0 ? `${displayDaysFresh} Days` : "Expired / Immediate Action"}
            </span>
          </div>
        </div>

        {/* AI Action Area */}
        <div className="ai-diagnostic-actions">
          {loading ? (
            <button className="btn-ai-diagnostic active" disabled>
              <Loader2 size={16} className="animate-spin" />
              <span>Analyzing...</span>
            </button>
          ) : (
            <button
              className={`btn-ai-diagnostic ${aiResult ? "ai-complete" : ""}`}
              onClick={analyzeWithAI}
              title="Queries Groq AI to calculate freshness dynamics"
            >
              <Brain size={16} />
              <span>{aiResult ? "Diagnostics Loaded" : "Run Groq AI Diagnosis"}</span>
            </button>
          )}
        </div>

        <div className="alert-score-gauge">
          <div className="score-ring" style={{
            background: `conic-gradient(var(--status-${displayStatusType}-color) ${displayScore}%, rgba(255,255,255,0.06) 0)`
          }}>
            <div className="score-inner">
              <span className="score-val">{displayScore}%</span>
              <span className="score-lbl">Index</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="ai-alert-error">
          <Sparkles size={14} className="text-warning animate-pulse" />
          <span>{error}</span>
        </div>
      )}

      {!apiKeyExists && !aiResult && (
        <div className="ai-alert-helper">
          <span>💡 Optional: Set <code>VITE_GROQ_API_KEY</code> in <code>.env</code> for AI recommendations & bio-chemical insights.</span>
        </div>
      )}

      {aiResult && aiResult.aiInsights && (
        <div className="ai-insights-block">
          <div className="ai-insights-header">
            <Sparkles size={14} className="text-amber" />
            <span>Groq LLM Chemical Diagnostics</span>
          </div>
          <p className="ai-insights-text">{aiResult.aiInsights}</p>
        </div>
      )}

      <div className="alert-divider"></div>

      <div className="alert-recommendations">
        <h5>Preservation Insights & Target Controls:</h5>
        <ul>
          {displayRecommendations.map((rec, index) => (
            <li key={index}>
              <span className="rec-bullet">•</span>
              <span className="rec-text">{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FreshnessAlert;
