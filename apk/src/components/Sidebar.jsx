import React, { useEffect, useState } from 'react';
import '../styles/Sidebar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Instagram, Home, Compass, MessageCircle, Heart, PlusSquare, Menu, LogOut, User, Search } from 'lucide-react';
import axios from 'axios';

const Sidebar = ({ user: propUser }) => {
  const [user, setUser] = useState(propUser || null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is provided as a prop, use that
    if (propUser) {
      setUser(propUser);
      return;
    }

    // Otherwise fetch user data
    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!userId || !token) {
          console.error('User ID or token not found');
          return;
        }

        const response = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setUser(response.data.exist);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
  }, [propUser]);

  const handleLogout = () => {
    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    
    // Redirect to login
    window.location.href = '/';
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Instagram className="logo-icon" />
        <span className="logo-text">Rizzit</span>
      </div>
      
      <nav className="sidebar-nav">
        <Link to="/home" className={`nav-item ${isActive('/home') ? 'active' : ''}`}>
          <Home className="nav-icon" />
          <span className="nav-text">Home</span>
        </Link>
        
        <Link to="/search" className={`nav-item ${isActive('/search') ? 'active' : ''}`}>
          <Search className="nav-icon" />
          <span className="nav-text">Search</span>
        </Link>
        
        <Link to="#" className="nav-item">
          <Compass className="nav-icon" />
          <span className="nav-text">Explore</span>
        </Link>
        
        <Link to="/messages" className={`nav-item ${isActive('/messages') ? 'active' : ''}`}>
          <MessageCircle className="nav-icon" />
          <span className="nav-text">Messages</span>
        </Link>
        
        <Link to="#" className="nav-item">
          <Heart className="nav-icon" />
          <span className="nav-text">Notifications</span>
        </Link>
        
        <Link to="#" className="nav-item">
          <PlusSquare className="nav-icon" />
          <span className="nav-text">Create</span>
        </Link>
        
        <Link to="/profile" className={`nav-item ${isActive('/profile') ? 'active' : ''}`}>
          {user && user.avatar ? (
            <img src={user.avatar} alt="Profile" className="nav-icon profile-pic" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
          ) : (
            <User className="nav-icon" size={24} />
          )}
          <span className="nav-text">{user?.name || 'Profile'}</span>
        </Link>
      </nav>
      
      <div className="sidebar-footer">
        <Link to="#" className="nav-item" onClick={handleLogout}>
          <LogOut className="nav-icon" />
          <span className="nav-text">Logout</span>
        </Link>
        
        <Link to="#" className="nav-item">
          <Menu className="nav-icon" />
          <span className="nav-text">More</span>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
