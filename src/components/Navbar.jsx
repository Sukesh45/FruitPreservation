import React from "react";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import { LogOut, Home, LayoutDashboard, User } from "lucide-react";

const Navbar = ({ currentTab, setCurrentTab }) => {
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentTab("home");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo" onClick={() => setCurrentTab("home")}>
          <img src={logo} alt="Lumora Logo" className="logo-img" />
          <div className="logo-text-group">
            <span className="logo-text">lumora</span>
            <span className="logo-tagline">where light meets freshness</span>
          </div>
        </div>

        <div className="nav-links">
          <button 
            className={`nav-btn ${currentTab === "home" ? "active" : ""}`}
            onClick={() => setCurrentTab("home")}
          >
            <Home size={18} />
            <span>Home</span>
          </button>

          {currentUser ? (
            <>
              <button 
                className={`nav-btn ${currentTab === "dashboard" ? "active" : ""}`}
                onClick={() => setCurrentTab("dashboard")}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </button>
              
              <div className="nav-user-info">
                <User size={16} className="user-icon" />
                <span className="user-email" title={currentUser.email}>
                  {currentUser.email.split('@')[0]}
                </span>
                <button className="logout-btn" onClick={handleLogout} title="Log Out">
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <button 
              className={`nav-btn btn-primary ${currentTab === "auth" ? "active" : ""}`}
              onClick={() => setCurrentTab("auth")}
            >
              <span>Login / Sign Up</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
