import React, { useState } from "react";
import '../styles/Login.css';
import axios from 'axios';
import logo from '../assets/logo.png'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    setError(""); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const response = await axios.post('http://localhost:30801/user/login', formData);
      
      // Check if login was successful
      if (response.data.success) {
        const {accesstoken, userId} = response.data;
        
        // Store the token in local storage
        localStorage.setItem('accessToken', accesstoken);
        localStorage.setItem('userId', userId);
        
        // Set token for axios requests
        axios.defaults.headers['Authorization'] = `Bearer ${accesstoken}`;
        
        // Navigate to home page
        navigate("/home");
      } else {
        // If the login failed, show error message
        setError(response.data.message || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="left-column">
        <img src={logo} alt="Login" className="login-image" />
      </div>
      <div className="right-column">
        <div className="login-box">
          <h1>Rizzit</h1>
          <form onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <span
                className="password-toggle-icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ?<VisibilityIcon />  :<VisibilityOffIcon /> }
              </span>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
          <div className="divider">
            <span>OR</span>
          </div>
          <p className="signup-link">
            Don't have an account? <a href="/register">Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
