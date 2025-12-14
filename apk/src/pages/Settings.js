import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import '../styles/Settings.css';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="settings-container">
      <header className="settings-header">
        <Link to="/home" className="back-button">
          <i className="fas fa-arrow-left"></i> Back to Home
        </Link>
        <h1 className="settings-title">Settings</h1>
      </header>

      <div className="settings-section">
        <h2 className="section-title">Appearance</h2>
        <div className="setting-option">
          <div className="setting-label">
            <span>Theme</span>
            <span className="setting-value">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <button 
            className={`theme-toggle ${theme}`} 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div className="toggle-slider"></div>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="section-title">Account</h2>
        <div className="setting-option">
          <span className="setting-label">Change Password</span>
          <button className="settings-button">Update</button>
        </div>
        <div className="setting-option">
          <span className="setting-label">Email Notifications</span>
          <label className="switch">
            <input type="checkbox" defaultChecked />
            <span className="slider round"></span>
          </label>
        </div>
        <div className="setting-option">
          <span className="setting-label">Privacy Settings</span>
          <button className="settings-button">Manage</button>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="section-title">About</h2>
        <div className="setting-option">
          <span className="setting-label">Version</span>
          <span className="setting-value">1.0.0</span>
        </div>
        <div className="setting-option">
          <span className="setting-label">Terms of Service</span>
          <Link to="/terms" className="settings-link">View</Link>
        </div>
        <div className="setting-option">
          <span className="setting-label">Privacy Policy</span>
          <Link to="/privacy" className="settings-link">View</Link>
        </div>
      </div>

      <div className="danger-zone">
        <h2 className="section-title">Danger Zone</h2>
        <button className="danger-button">Logout</button>
        <button className="danger-button">Delete Account</button>
      </div>
    </div>
  );
};

export default Settings; 