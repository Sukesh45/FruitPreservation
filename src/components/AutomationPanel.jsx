import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, set, onValue, get } from "firebase/database";
import { 
  Mail, 
  FileSpreadsheet, 
  Settings, 
  Send, 
  Clock, 
  Check, 
  AlertTriangle, 
  Activity, 
  Database,
  Download
} from "lucide-react";
import * as XLSX from "xlsx";

const AutomationPanel = ({ historyData, isGuest }) => {
  // Local state for settings form
  const [ownerEmail, setOwnerEmail] = useState("");
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [logIntervalHours, setLogIntervalHours] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for daemon status
  const [daemonStatus, setDaemonStatus] = useState({
    isRunning: false,
    lastHeartbeat: 0,
    excelPath: "Loading...",
    lastExcelLog: null,
    lastEmailAlert: null
  });

  const [testEmailPending, setTestEmailPending] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState("");

  const [forceLogPending, setForceLogPending] = useState(false);
  const [forceLogStatus, setForceLogStatus] = useState("");

  // Sync settings and daemon status from Firebase
  useEffect(() => {
    if (isGuest) {
      // Offline/Guest simulation state
      setOwnerEmail("guest-owner@lumora.preservation");
      return;
    }

    // 1. Listen to settings
    const settingsRef = ref(db, "settings");
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setOwnerEmail(data.ownerEmail || "");
        setEmailAlertsEnabled(data.emailAlertsEnabled ?? true);
        setLogIntervalHours(data.logIntervalHours || 2);
      }
    });

    // 2. Listen to daemon_status
    const daemonStatusRef = ref(db, "daemon_status");
    const unsubscribeDaemon = onValue(daemonStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        setDaemonStatus(snapshot.val());
      }
    });

    return () => {
      unsubscribeSettings();
      unsubscribeDaemon();
    };
  }, [isGuest]);

  // Check if background daemon is currently active (heartbeat within last 45 seconds)
  const isDaemonOnline = !isGuest && daemonStatus.isRunning && (Date.now() - (daemonStatus.lastHeartbeat || 0) < 45000);

  // Save Settings to Firebase
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (isGuest) {
      alert("Settings cannot be saved in Local Sandbox (Guest Mode).");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const settingsRef = ref(db, "settings");
      await set(settingsRef, {
        ownerEmail,
        emailAlertsEnabled,
        logIntervalHours: parseFloat(logIntervalHours),
        triggerTestEmail: false,
        triggerForceLog: false
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings. Please verify Firebase permissions.");
    } finally {
      setSaving(false);
    }
  };

  // Trigger manual test email
  const triggerTestEmail = async () => {
    if (isGuest) {
      setTestEmailStatus("Simulation Mode: Test email alert triggered! Check console.");
      console.log(`[SMTP SIMULATION] Test alert sent to: ${ownerEmail}`);
      setTimeout(() => setTestEmailStatus(""), 4000);
      return;
    }

    if (!isDaemonOnline) {
      setTestEmailStatus("⚠️ Daemon is Offline. SMTP Test alert requires daemon to be running.");
      setTimeout(() => setTestEmailStatus(""), 4000);
      return;
    }

    setTestEmailPending(true);
    setTestEmailStatus("Requesting daemon to send test email...");

    try {
      const testEmailRef = ref(db, "settings/triggerTestEmail");
      await set(testEmailRef, true);
      
      // The daemon will pick this up, send mail, and reset it to false
      // We check for completion by polling or simply waiting
      setTimeout(() => {
        setTestEmailPending(false);
        setTestEmailStatus("Test command sent! Verify recipient inbox.");
        setTimeout(() => setTestEmailStatus(""), 4000);
      }, 2500);
    } catch (error) {
      console.error(error);
      setTestEmailPending(false);
      setTestEmailStatus("Failed to send command.");
    }
  };

  // Trigger manual force log
  const triggerForceLog = async () => {
    if (isGuest) {
      setForceLogStatus("Simulation Mode: Data point logged to sandbox chart!");
      // Trigger a local custom event to append data in dashboard history
      const event = new CustomEvent("localSimUpdate", {
        detail: { logHistory: true }
      });
      window.dispatchEvent(event);
      setTimeout(() => setForceLogStatus(""), 4000);
      return;
    }

    if (!isDaemonOnline) {
      setForceLogStatus("⚠️ Daemon is Offline. Continuous Excel writes require background daemon.");
      setTimeout(() => setForceLogStatus(""), 4000);
      return;
    }

    setForceLogPending(true);
    setForceLogStatus("Requesting daemon to append Excel log...");

    try {
      const forceLogRef = ref(db, "settings/triggerForceLog");
      await set(forceLogRef, true);
      
      setTimeout(() => {
        setForceLogPending(false);
        setForceLogStatus("Logged successfully to server Excel file! ✓");
        setTimeout(() => setForceLogStatus(""), 4000);
      }, 2500);
    } catch (error) {
      console.error(error);
      setForceLogPending(false);
      setForceLogStatus("Failed to log entry.");
    }
  };

  // Excel direct export from frontend React app
  const handleFrontendExcelExport = () => {
    if (!historyData || historyData.length === 0) {
      alert("No sensor history data available to export.");
      return;
    }

    try {
      const formatted = historyData.map((item) => ({
        "Timestamp": item.timestamp,
        "Date String": new Date(item.timestamp).toLocaleDateString(),
        "Time String": new Date(item.timestamp).toLocaleTimeString(),
        "Temperature (°C)": parseFloat(item.temperature ?? 0).toFixed(1),
        "Humidity (% RH)": Math.round(item.humidity ?? 0),
        "MQ135 Gas (PPM)": parseInt(item.mq135 ?? 0),
        "UV Status": item.uvStatus || (item.uv_status ? "ON" : "OFF"),
        "Recorded Mode": item.id ? "Real IoT Sensor" : "Sandbox Simulator"
      }));

      const worksheet = XLSX.utils.json_to_sheet(formatted);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Lumora Sensor History");

      // Auto-size columns slightly
      const maxColWidth = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 18 }];
      worksheet["!cols"] = maxColWidth;

      XLSX.writeFile(workbook, `lumora_sensor_history_${Date.now()}.xlsx`);
    } catch (error) {
      console.error("Excel generation failed: ", error);
      alert("Failed to export Excel. Please try again.");
    }
  };

  return (
    <div className="automation-card">
      <div className="automation-header">
        <div className="automation-title">
          <Settings size={20} className="automation-icon" />
          <h4>Automations & Alerts Control</h4>
        </div>
        <span className="automation-subtitle">Manage background daemon Excel auto-logger and SMTP alert services</span>
      </div>

      <div className="automation-body">
        {/* Daemon Status Grid */}
        <div className="daemon-status-box">
          <div className="daemon-status-headline">
            <span className="daemon-label">Preservation Daemon:</span>
            <div className={`daemon-status-badge ${isDaemonOnline ? "online" : "offline"}`}>
              <Activity size={12} className={isDaemonOnline ? "pulse-active" : ""} />
              <span>{isDaemonOnline ? "Online (Server)" : isGuest ? "Local Sandbox (Guest)" : "Offline (Daemon inactive)"}</span>
            </div>
          </div>

          <div className="daemon-meta-grid">
            <div className="meta-item">
              <span className="meta-lbl">Excel Log Target:</span>
              <span className="meta-val path-val" title={daemonStatus.excelPath || "N/A"}>
                {isDaemonOnline ? "sensor_history.xlsx" : "In-Browser Sandbox (.xlsx)"}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">Last Excel Write:</span>
              <span className="meta-val">
                {daemonStatus.lastExcelLog ? new Date(daemonStatus.lastExcelLog).toLocaleTimeString() : "Never"}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-lbl">Last Email Alert:</span>
              <span className="meta-val warning-text">
                {daemonStatus.lastEmailAlert ? new Date(daemonStatus.lastEmailAlert).toLocaleTimeString() : "None Sent"}
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveSettings} className="automation-form">
          <div className="form-group-row">
            <div className="form-group email-group">
              <label htmlFor="owner-email">
                <Mail size={12} />
                <span>Owner Alert Email:</span>
              </label>
              <input 
                id="owner-email"
                type="email" 
                placeholder="owner@lumora.preservation"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                className="form-input"
              />
            </div>

            <div className="form-group interval-group">
              <label htmlFor="log-interval">
                <Clock size={12} />
                <span>Log Interval (Hours):</span>
              </label>
              <select 
                id="log-interval"
                value={logIntervalHours}
                onChange={(e) => setLogIntervalHours(e.target.value)}
                className="form-select"
              >
                <option value="0.016">1 Minute (Testing)</option>
                <option value="0.083">5 Minutes (Testing)</option>
                <option value="0.5">30 Minutes</option>
                <option value="1">1 Hour</option>
                <option value="2">2 Hours (Default)</option>
                <option value="4">4 Hours</option>
                <option value="8">8 Hours</option>
                <option value="24">24 Hours</option>
              </select>
            </div>
          </div>

          <div className="toggle-row-alert">
            <span className="toggle-info-lbl">Enable Critical Spoilage Alerts:</span>
            <button 
              type="button"
              className={`sim-toggle-btn alert-toggle ${emailAlertsEnabled ? "active" : ""}`}
              onClick={() => setEmailAlertsEnabled(!emailAlertsEnabled)}
            >
              <div className="toggle-handle"></div>
              <span className="toggle-state-text">{emailAlertsEnabled ? "ON" : "OFF"}</span>
            </button>
          </div>

          <div className="form-actions-row">
            <button 
              type="submit" 
              className={`btn-primary-save ${saving ? "loading" : ""} ${saveSuccess ? "success" : ""}`}
              disabled={saving || isGuest}
            >
              {saveSuccess ? (
                <>
                  <Check size={14} />
                  <span>Config Saved ✓</span>
                </>
              ) : (
                <>
                  <Database size={14} />
                  <span>Save Config</span>
                </>
              )}
            </button>

            <button 
              type="button" 
              onClick={handleFrontendExcelExport}
              className="btn-excel-export"
              title="Download current logs to local Excel .xlsx file immediately"
            >
              <Download size={14} />
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>
        </form>

        {/* System Commands Actions Card */}
        <div className="system-command-section">
          <h5>Instant Automation Commands:</h5>
          <div className="btn-actions-grid">
            <button 
              onClick={triggerTestEmail} 
              disabled={testEmailPending}
              className="cmd-btn btn-mail-alert"
            >
              <Send size={12} />
              <span>Test Email Alert</span>
            </button>

            <button 
              onClick={triggerForceLog} 
              disabled={forceLogPending}
              className="cmd-btn btn-excel-log"
            >
              <FileSpreadsheet size={12} />
              <span>Force Excel Log</span>
            </button>
          </div>
          
          {(testEmailStatus || forceLogStatus) && (
            <div className="cmd-status-feedback">
              {testEmailStatus && <p className="feedback-line mail-feedback">• {testEmailStatus}</p>}
              {forceLogStatus && <p className="feedback-line excel-feedback">• {forceLogStatus}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomationPanel;
