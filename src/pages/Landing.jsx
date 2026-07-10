import React from "react";
import logo from "../assets/logo.png";
import { Shield, Sparkles, Thermometer, Zap, ArrowRight, Activity } from "lucide-react";

const Landing = ({ onNavigate }) => {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-glow hero-glow-1"></div>
        <div className="hero-glow hero-glow-2"></div>
        
        <div className="container hero-container">
          <div className="hero-logo-box">
            <img src={logo} alt="Lumora Logo" className="hero-logo-img" />
          </div>
          
          <h1 className="hero-title">
            lumora
          </h1>
          <p className="hero-tagline">
            where light meets freshness
          </p>
          
          <p className="hero-description">
            A state-of-the-art IoT-driven fruit preservation system. 
            By combining precision microclimate monitoring with automated germicidal light cycles, 
            we extend fruit shelf life naturally—without chemical preservatives.
          </p>
          
          <div className="hero-actions">
            <button className="btn-primary-glow btn-lg" onClick={() => onNavigate("dashboard")}>
              <span>Enter Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Smart Preservation Pillars</h2>
          <p className="section-subtitle">How Lumora integrates IoT hardware and intelligent software to keep produce fresh.</p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-box temp-color">
                <Thermometer size={24} />
              </div>
              <h3>Climate Control Monitoring</h3>
              <p>
                Continuous tracking of internal temperature and relative humidity via high-precision DHT sensors. 
                Maintaining the golden zone (2°C - 6°C, 80-90% RH) prevents fruit dehydration and cell structural breakdown.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box gas-color">
                <Activity size={24} />
              </div>
              <h3>Gas Analysis (MQ135)</h3>
              <p>
                An MQ135 air quality sensor sniffs out ethylene emissions (the ripening hormone) and toxic organic gases 
                emitted during early stages of fruit decay, alerting you before spoilage spreads.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box uv-color">
                <Zap size={24} />
              </div>
              <h3>UV Germicidal Cycles</h3>
              <p>
                Integrated UV-C light sanitization engages automatically for 15 minutes every 3 hours. 
                This targeted radiation neutralizes airborne bacteria and mold spores on fruit skins without heat or chemical residue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* IoT Architecture / Science Section */}
      <section className="science-section">
        <div className="container science-container">
          <div className="science-text">
            <h2 className="section-title left-aligned">Preservation Without Additives</h2>
            <p>
              Traditional preservation relies on synthetic coatings, wax, or sulfites to prolong transport times. 
              <strong> Lumora</strong> replaces chemicals with technology. 
            </p>
            <div className="science-bullets">
              <div className="bullet-item">
                <div className="bullet-bullet"><Shield size={16} /></div>
                <div>
                  <strong>Ethylene Tracking:</strong> Ethylene accumulation accelerates rot. By notifying users when gas levels peak, fruits can be ventilated.
                </div>
              </div>
              <div className="bullet-item">
                <div className="bullet-bullet"><Sparkles size={16} /></div>
                <div>
                  <strong>Eco-Friendly Disinfection:</strong> UV sterilizers break down fungal DNA, reducing decay rates by up to 40% while preserving nutritional profiles.
                </div>
              </div>
            </div>
          </div>
          <div className="science-graphics-placeholder">
            <div className="science-circle-graphic">
              <div className="sci-core">
                <Sparkles size={32} className="sci-pulse-icon" />
                <span>Active UV Protection</span>
              </div>
              <div className="sci-ring outer-ring"></div>
              <div className="sci-ring mid-ring"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <p>© 2026 Lumora Project. IoT Preservation Management System.</p>
          <p className="footer-tagline">Where light meets freshness.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
