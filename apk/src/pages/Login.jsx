import React, { useState } from "react";
import '../styles/Login.css';
import axios from 'axios';
import logo from '../assets/logo.png'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';

function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Login Data Submitted:", formData);
    
    try {
      const response = await axios.post('http://localhost:3080/user/login', formData);
      const { token } = response.data; // Assuming the token is returned in the response
      alert(response.data.message);
      
      // Store the token in local storage or set it in the headers for future requests
      localStorage.setItem('accessToken', token);  // Optionally, store it in localStorage
      axios.defaults.headers['Authorization'] = `Bearer ${token}`; // Set token globally for axios requests

      // Redirect after login (to dashboard or homepage, for example)
      window.location.href = "/home"; // Modify this to your desired route
    } catch (error) {
      alert(error.response?.data?.message || "Login failed. Please try again.");
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
            <button type="submit">Log In</button>
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
