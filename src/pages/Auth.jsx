import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Sparkles } from "lucide-react";

const Auth = ({ onNavigate }) => {
  const { login, signup, loginAsGuest } = useAuth();
  
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      return setError("Please fill in all fields");
    }

    if (!isLoginTab && password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    try {
      setLoading(true);
      if (isLoginTab) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      onNavigate("dashboard");
    } catch (err) {
      console.error(err);
      let readableError = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/email-already-in-use") {
        readableError = "This email is already in use.";
      } else if (err.code === "auth/weak-password") {
        readableError = "Password should be at least 6 characters.";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        readableError = "Incorrect email or password.";
      }
      setError(readableError);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await loginAsGuest();
      onNavigate("dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to start guest session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-1"></div>
      
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand">
            <span className="brand-logo-glow"></span>
            <h2>lumora</h2>
          </div>
          <p className="auth-subtitle">IoT Fruit Preservation Portal</p>
        </div>

        {/* Tab Selection */}
        <div className="auth-tabs">
          <button 
            className={`auth-tab-btn ${isLoginTab ? "active" : ""}`}
            onClick={() => {
              setIsLoginTab(true);
              setError("");
            }}
          >
            <LogIn size={16} />
            <span>Login</span>
          </button>
          <button 
            className={`auth-tab-btn ${!isLoginTab ? "active" : ""}`}
            onClick={() => {
              setIsLoginTab(false);
              setError("");
            }}
          >
            <UserPlus size={16} />
            <span>Register</span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="auth-error-box">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input 
                id="email"
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input 
                id="password"
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {!isLoginTab && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input 
                  id="confirmPassword"
                  type="password" 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <span>{isLoginTab ? "Sign In" : "Create Account"}</span>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* Guest Demo Access */}
        <button 
          type="button" 
          className="auth-guest-btn" 
          onClick={handleGuestLogin}
          disabled={loading}
        >
          <Sparkles size={16} className="text-amber" />
          <span>View Dashboard as Guest (Demo)</span>
        </button>
        
        <p className="guest-note">
          Guest mode runs locally and lets you interact with the real-time simulation immediately!
        </p>
      </div>
    </div>
  );
};

export default Auth;
