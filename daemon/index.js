import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, get } from "firebase/database";
import xlsx from "xlsx";
import nodemailer from "nodemailer";

// Load environment variables from project root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log("=========================================");
console.log(" LUMORA AUTOMATION DAEMON STARTING UP ");
console.log("=========================================");

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Validate firebase config
if (!firebaseConfig.databaseURL) {
  console.error("[CRITICAL] Firebase Database URL is missing in environment variables (.env). Exiting.");
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
console.log(`[Firebase] Connected to RTDB: ${firebaseConfig.databaseURL}`);

// Paths
const EXCEL_PATH = path.resolve(__dirname, "../sensor_history.xlsx");

// State memory
let currentTelemetry = null;
let appSettings = {
  ownerEmail: process.env.OWNER_EMAIL || "ksvsanjai20@gmail.com",
  emailAlertsEnabled: true,
  logIntervalHours: 2
};
let isAlertActive = false; // Transition lock to avoid spamming alerts
let logTimer = null;
let alertResendTimer = null; // Resend timer for unstable alerts
let lastExcelLogTime = null;
let lastEmailAlertTime = null;

// Initialize settings node in Firebase if empty
async function initSettingsNode() {
  try {
    const settingsRef = ref(db, "settings");
    const snapshot = await get(settingsRef);
    if (!snapshot.exists()) {
      await set(settingsRef, appSettings);
      console.log("[Firebase] Initialized settings node with default configs.");
    } else {
      appSettings = { ...appSettings, ...snapshot.val() };
      console.log("[Firebase] Settings loaded:", appSettings);
    }
  } catch (error) {
    console.error("[Firebase] Error initializing settings:", error);
  }
}

// Excel Logger
function logToExcel(data) {
  try {
    const newRow = {
      "Timestamp ID": data.timestamp || Date.now(),
      "Date/Time": new Date(data.timestamp || Date.now()).toLocaleString(),
      "Temperature (°C)": parseFloat(data.temperature ?? 0).toFixed(1),
      "Humidity (% RH)": Math.round(data.humidity ?? 0),
      "Gas Level (MQ135 PPM)": parseInt(data.mq135 ?? 0),
      "UV Sterilizer Status": data.uvStatus || "OFF",
      "Condition Status": data.condition || "Optimal Freshness"
    };

    let workbook;
    let worksheet;

    if (fs.existsSync(EXCEL_PATH)) {
      workbook = xlsx.readFile(EXCEL_PATH);
      const sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      const sheetData = xlsx.utils.sheet_to_json(worksheet);
      sheetData.push(newRow);
      const updatedWorksheet = xlsx.utils.json_to_sheet(sheetData);
      workbook.Sheets[sheetName] = updatedWorksheet;
    } else {
      workbook = xlsx.utils.book_new();
      worksheet = xlsx.utils.json_to_sheet([newRow]);
      xlsx.utils.book_append_sheet(workbook, worksheet, "Lumora Sensor Log");
    }

    xlsx.writeFile(workbook, EXCEL_PATH);
    lastExcelLogTime = Date.now();
    console.log(`[Excel] Excel file updated successfully at ${EXCEL_PATH}`);
    
    // Update daemon status in Firebase
    updateDaemonStatus();
  } catch (err) {
    console.error("[Excel] Failed writing to Excel file:", err);
  }
}

// SMTP Transporter
function getMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: parseInt(process.env.SMTP_PORT || "465") === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Send Email Alert
async function sendEmailAlert(isTest = false) {
  const recipient = appSettings.ownerEmail;
  if (!recipient) {
    console.warn("[Email] Owner email is not configured. Alert aborted.");
    return;
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || pass === "somepasswordhere") {
    console.warn("[Email] SMTP Auth credentials are not set in .env. Email alerting is in SIMULATION mode.");
    console.log(`[SMTP SIMULATION] Would send alert to: ${recipient}`);
    lastEmailAlertTime = Date.now();
    updateDaemonStatus();
    return;
  }

  const transporter = getMailTransporter();

  const title = isTest ? "[TEST] Lumora IoT Alert System" : "Notification: Preservation Alert - Spoilage Risk Detected";
  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f39c12; border-radius: 8px; background-color: #fffaf0;">
      <h2 style="color: #f39c12; border-bottom: 2px solid #f39c12; padding-bottom: 10px;">
        ${isTest ? "Lumora Test Alert" : "Preservation Alert Notification"}
      </h2>
      <p style="font-size: 16px; color: #333;">
        ${isTest ? "This is a test notification from your Fruit Preservation system. Your SMTP configurations are working perfectly!" : "<strong>Notice:</strong> The environmental metrics inside the preservation storage indicate that the fruits are outside their optimal freshness settings."}
      </p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background-color: #f8d7da; color: #721c24; text-align: left;">
            <th style="padding: 10px; border: 1px solid #ddd;">Metric</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Current Reading</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Ideal Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Temperature</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: ${currentTelemetry?.temperature > 10 ? '#e74c3c' : '#27ae60'};">${currentTelemetry?.temperature ?? "N/A"} °C</td>
            <td style="padding: 10px; border: 1px solid #ddd;">2.0°C - 6.0°C</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Humidity</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: ${currentTelemetry?.humidity < 60 || currentTelemetry?.humidity > 95 ? '#e74c3c' : '#27ae60'};">${currentTelemetry?.humidity ?? "N/A"} % RH</td>
            <td style="padding: 10px; border: 1px solid #ddd;">80% - 90% RH</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Spoilage Gas (MQ135)</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: ${currentTelemetry?.mq135 >= 350 ? '#e74c3c' : '#27ae60'}; font-weight: bold;">${currentTelemetry?.mq135 ?? "N/A"} PPM</td>
            <td style="padding: 10px; border: 1px solid #ddd;">&lt; 180 PPM</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UV Sterilizer</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${currentTelemetry?.uvStatus || "OFF"}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">ON (during cycles)</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #fdf2e2; border-left: 4px solid #f39c12; padding: 12px; margin: 20px 0; font-size: 14px;">
        <strong>Immediate Actions Suggested:</strong>
        <ul style="margin: 6px 0 0 18px; padding: 0;">
          <li>Lower temperature below 6.0°C.</li>
          <li>Examine the fridge and discard any spoiled or moldy fruits immediately to avoid ethylene spread.</li>
          <li>Verify if the UV sterilizer is active to combat bacteria.</li>
        </ul>
      </div>

      <p style="font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
        Lumora Smart Fruit Preservation System • Automated IoT Notification
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Lumora Core System" <${user}>`,
      to: recipient,
      subject: title,
      html: bodyHtml
    });
    console.log(`[Email] Alert email sent successfully to ${recipient}`);
    lastEmailAlertTime = Date.now();
    updateDaemonStatus();
  } catch (error) {
    console.error("[Email] Failed sending alert email via SMTP:", error);
  }
}

// Send Environmental Stabilization Recovery Email
async function sendResolvedEmail() {
  const recipient = appSettings.ownerEmail;
  if (!recipient) {
    console.warn("[Email] Owner email is not configured. Resolved notice aborted.");
    return;
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || pass === "somepasswordhere") {
    console.warn("[Email] SMTP Auth credentials are not set in .env. Email alerting is in SIMULATION mode.");
    console.log(`[SMTP SIMULATION] Would send recovery notice to: ${recipient}`);
    return;
  }

  const transporter = getMailTransporter();

  const title = "✅ RESOLVED: Storage Environment Stabilized - Fruit preservation system safe";
  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #27ae60; border-radius: 8px; background-color: #f2faf4;">
      <h2 style="color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">
        Preservation Environment Restored
      </h2>
      <p style="font-size: 16px; color: #333;">
        <strong>Now in Safe Zone:</strong> The storage climate has returned to normal operational limits. The preservation environment has stabilized and the problem is successfully rectified.
      </p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background-color: #d4edda; color: #155724; text-align: left;">
            <th style="padding: 10px; border: 1px solid #ddd;">Metric</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Restored Reading</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Safe Range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Temperature</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #27ae60; font-weight: bold;">${currentTelemetry?.temperature ?? "N/A"} °C</td>
            <td style="padding: 10px; border: 1px solid #ddd;">2.0°C - 6.0°C</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Humidity</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #27ae60; font-weight: bold;">${currentTelemetry?.humidity ?? "N/A"} % RH</td>
            <td style="padding: 10px; border: 1px solid #ddd;">80% - 90% RH</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Spoilage Gas (MQ135)</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #27ae60; font-weight: bold;">${currentTelemetry?.mq135 ?? "N/A"} PPM</td>
            <td style="padding: 10px; border: 1px solid #ddd;">&lt; 180 PPM</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UV Sterilizer</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${currentTelemetry?.uvStatus || "OFF"}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">ON (during cycles)</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #eef7f2; border-left: 4px solid #2ecc71; padding: 12px; margin: 20px 0; font-size: 14px; color: #1e5631;">
        <strong>System Status:</strong> All monitored parameters have returned to the optimal zone. Germicidal sterilization remains active to prevent future bacterial proliferation.
      </div>

      <p style="font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
        Lumora Smart Fruit Preservation System • Automated IoT Notification
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Lumora Core System" <${user}>`,
      to: recipient,
      subject: title,
      html: bodyHtml
    });
    console.log(`[Email] Recovery notice sent successfully to ${recipient}`);
  } catch (error) {
    console.error("[Email] Failed sending recovery email via SMTP:", error);
  }
}

// Calculate score based on telemetry (mirrors frontend)
function checkTelemetryCondition(data) {
  if (!data) return "Unknown";
  
  let score = 100;
  const temp = parseFloat(data.temperature ?? 0);
  const humidity = parseFloat(data.humidity ?? 0);
  const gasLevel = parseInt(data.mq135 ?? 0);

  if (temp < 1.0) score -= 15;
  else if (temp > 6.0 && temp <= 10.0) score -= 20;
  else if (temp > 10.0) score -= 40;

  if (humidity < 60) score -= 15;
  else if (humidity >= 60 && humidity < 80) score -= 5;
  else if (humidity > 95) score -= 10;

  if (gasLevel >= 180 && gasLevel < 350) score -= 30;
  else if (gasLevel >= 350) score -= 60;

  if (score >= 80) return "Optimal Freshness";
  if (score >= 45) return "Ripening / Monitor";
  return "Spoilage / Toxic Risk";
}

// Write status back to Firebase for dashboard UI
async function updateDaemonStatus() {
  try {
    const statusRef = ref(db, "daemon_status");
    await set(statusRef, {
      isRunning: true,
      lastHeartbeat: Date.now(),
      excelPath: EXCEL_PATH,
      lastExcelLog: lastExcelLogTime,
      lastEmailAlert: lastEmailAlertTime,
      activeIntervalMs: appSettings.logIntervalHours * 60 * 60 * 1000
    });
  } catch (error) {
    console.error("[Firebase] Error updating daemon status:", error);
  }
}

// Update the scheduler timer based on the settings
function resetLoggingTimer() {
  if (logTimer) {
    clearInterval(logTimer);
  }

  const intervalMs = appSettings.logIntervalHours * 60 * 60 * 1000;
  console.log(`[Scheduler] Setting auto-logger interval to ${appSettings.logIntervalHours} hours (${intervalMs} ms).`);
  
  logTimer = setInterval(() => {
    if (currentTelemetry) {
      console.log("[Scheduler] Auto-logging cycle triggered.");
      const condition = checkTelemetryCondition(currentTelemetry);
      logToExcel({ ...currentTelemetry, condition });
    } else {
      console.log("[Scheduler] Auto-log skipped: No current telemetry available.");
    }
  }, intervalMs);

  updateDaemonStatus();
}

// Heartbeat Loop (keeps the daemon status active on the dashboard)
setInterval(() => {
  updateDaemonStatus();
}, 20000);

// Main startup routine
async function main() {
  await initSettingsNode();

  // Listen to Settings updates in real-time
  const settingsRef = ref(db, "settings");
  onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const intervalChanged = data.logIntervalHours !== appSettings.logIntervalHours;
      
      appSettings = { ...appSettings, ...data };
      console.log("[Firebase] Settings updated in database:", appSettings);
      
      if (intervalChanged || !logTimer) {
        resetLoggingTimer();
      }
      updateDaemonStatus();
    }
  });

  // Listen to Command flags in settings (e.g. trigger test email, force excel log)
  const triggerTestEmailRef = ref(db, "settings/triggerTestEmail");
  onValue(triggerTestEmailRef, async (snapshot) => {
    if (snapshot.exists() && snapshot.val() === true) {
      console.log("[Command] Manual test email trigger received.");
      await sendEmailAlert(true);
      await set(triggerTestEmailRef, false); // Reset trigger
    }
  });

  const triggerForceLogRef = ref(db, "settings/triggerForceLog");
  onValue(triggerForceLogRef, async (snapshot) => {
    if (snapshot.exists() && snapshot.val() === true) {
      console.log("[Command] Manual force Excel log trigger received.");
      if (currentTelemetry) {
        const condition = checkTelemetryCondition(currentTelemetry);
        logToExcel({ ...currentTelemetry, condition });
      } else {
        console.warn("[Command] Force log failed: No current telemetry.");
      }
      await set(triggerForceLogRef, false); // Reset trigger
    }
  });

  // Listen to FruitPreservation real-time telemetry node
  const telemetryRef = ref(db, "FruitPreservation");
  onValue(telemetryRef, async (snapshot) => {
    if (snapshot.exists()) {
      currentTelemetry = snapshot.val();
      console.log("[Firebase] New telemetry event received:", currentTelemetry);

      const condition = checkTelemetryCondition(currentTelemetry);
      
      // Check condition and send alert email if very bad
      if (condition === "Spoilage / Toxic Risk") {
        if (!isAlertActive) {
          isAlertActive = true; // Lock alert immediately to prevent duplicate concurrent triggers
          console.log("[Preservation Alert] Spoilage risk detected! Triggering alert email.");
          if (appSettings.emailAlertsEnabled) {
            await sendEmailAlert(false);
            
            // Set up a 10-minute resend timer if condition is not resolved
            if (!alertResendTimer) {
              console.log("[Preservation Alert] Starting 10-minute resend timer for unstable conditions.");
              alertResendTimer = setInterval(async () => {
                if (currentTelemetry) {
                  const currentCondition = checkTelemetryCondition(currentTelemetry);
                  if (currentCondition === "Spoilage / Toxic Risk" && appSettings.emailAlertsEnabled) {
                    console.log("[Preservation Alert] Environment remains unstable. Re-sending alert email.");
                    await sendEmailAlert(false);
                  }
                }
              }, 10 * 60 * 1000); // 10 minutes interval
            }
          } else {
            console.log("[Preservation Alert] Email alerts are disabled in settings.");
          }
        }
      } else {
        // Reset alert block if condition returns to normal
        if (isAlertActive) {
          console.log("[Preservation Alert] Environmental status stabilized. Alert reset.");
          
          // Clear resend timer
          if (alertResendTimer) {
            clearInterval(alertResendTimer);
            alertResendTimer = null;
            console.log("[Preservation Alert] Resend timer cleared.");
          }
          
          isAlertActive = false;
          
          // Send recovery email
          if (appSettings.emailAlertsEnabled) {
            console.log("[Preservation Alert] Sending environment restored notice to owner.");
            await sendResolvedEmail();
          }
        }
      }
    }
  });

  // Perform initial Excel log on startup if telemetry is already present
  setTimeout(async () => {
    try {
      const snap = await get(telemetryRef);
      if (snap.exists()) {
        currentTelemetry = snap.val();
        const condition = checkTelemetryCondition(currentTelemetry);
        console.log("[Startup] Performing initial startup Excel log.");
        logToExcel({ ...currentTelemetry, condition });
      }
    } catch (e) {
      console.warn("[Startup] Initial startup Excel log skipped.", e.message);
    }
  }, 3000);
}

main().catch(console.error);

// Clean exit handling
process.on("SIGINT", async () => {
  console.log("\n[Shutdown] Cleaning up connection and marking offline...");
  try {
    const statusRef = ref(db, "daemon_status");
    await set(statusRef, {
      isRunning: false,
      lastHeartbeat: Date.now()
    });
  } catch (e) {}
  process.exit(0);
});
