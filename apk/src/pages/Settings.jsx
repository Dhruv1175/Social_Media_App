import React from 'react';
import { useTheme } from '../context/ThemeContext';
import '../styles/Settings.css';
import { Sun, Moon } from 'lucide-react';

const Settings = () => {
  const { theme, toggleTheme, isTransitioning } = useTheme();

  return (
    <div className="settings-container">
      <h1 className="settings-title">Settings</h1>
      
      <div className="settings-section">
        <h2 className="section-title">Appearance</h2>
        
        <div className="settings-item">
          <div className="settings-item-content">
            <div className="settings-item-label">
              <span>Theme</span>
              <p className="settings-item-description">
                {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
              </p>
            </div>
            
            <button 
              className={`theme-toggle-btn ${isTransitioning ? 'theme-toggling' : ''}`}
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <div className="theme-toggle-icon">
                {theme === 'dark' ? (
                  <Sun strokeWidth={1.5} />
                ) : (
                  <Moon strokeWidth={1.5} />
                )}
              </div>
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="settings-section">
        <h2 className="section-title">Account</h2>
        
        <div className="settings-item">
          <div className="settings-item-content">
            <div className="settings-item-label">
              <span>Privacy</span>
              <p className="settings-item-description">
                Manage your account privacy settings
              </p>
            </div>
            <button className="settings-btn">Manage</button>
          </div>
        </div>
        
        <div className="settings-item">
          <div className="settings-item-content">
            <div className="settings-item-label">
              <span>Notifications</span>
              <p className="settings-item-description">
                Control how you receive notifications
              </p>
            </div>
            <button className="settings-btn">Configure</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 