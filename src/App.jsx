import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

// View Router Component that respects Auth Guard
const ViewRouter = ({ currentTab, setCurrentTab }) => {
  const { currentUser } = useAuth();

  // Navigation Guard: Redirect to auth if trying to access dashboard while logged out
  const handleNavigation = (tab) => {
    if (tab === "dashboard" && !currentUser) {
      setCurrentTab("auth");
    } else {
      setCurrentTab(tab);
    }
  };

  const renderView = () => {
    switch (currentTab) {
      case "home":
        return <Landing onNavigate={handleNavigation} />;
      case "auth":
        // If already logged in, redirect home
        if (currentUser) {
          setCurrentTab("dashboard");
          return <Dashboard />;
        }
        return <Auth onNavigate={handleNavigation} />;
      case "dashboard":
        if (!currentUser) {
          setCurrentTab("auth");
          return <Auth onNavigate={handleNavigation} />;
        }
        return <Dashboard />;
      default:
        return <Landing onNavigate={handleNavigation} />;
    }
  };

  return (
    <div className="app-wrapper">
      <Navbar currentTab={currentTab} setCurrentTab={handleNavigation} />
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
};

function App() {
  const [currentTab, setCurrentTab] = useState("home");

  return (
    <AuthProvider>
      <ViewRouter currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </AuthProvider>
  );
}

export default App;
