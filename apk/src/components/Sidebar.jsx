import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Instagram, Home, Search, Compass, MessageCircle, Heart, PlusSquare, Settings } from 'lucide-react';
import { Link } from 'react-router-dom'; // Import Link for routing

const Sidebar = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get(
          `http://localhost:3080/user/profile/${localStorage.getItem('userId')}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`, // Use appropriate auth method
            },
          }
        );

        setUser(response.data.exist); // Ensure 'exist' has the correct structure for user data
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
  }, []);

  return (
    <aside style={{ width: '250px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <Instagram size={32} />
        <h1 style={{ fontSize: '20px', marginLeft: '10px' }}>Rizzit</h1>
      </div>
      <nav>
        <div style={{ marginBottom: '15px' }}>
          <Link to="/home" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
            <Home size={20} /> Home
          </Link>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <Search size={20} /> Search
        </div>
        <div style={{ marginBottom: '15px' }}>
          <Compass size={20} /> Explore
        </div>
        <div style={{ marginBottom: '15px' }}>
          <MessageCircle size={20} /> Messages
        </div>
        <div style={{ marginBottom: '15px' }}>
          <Heart size={20} /> Notifications
        </div>
        <div style={{ marginBottom: '15px' }}>
          <PlusSquare size={20} /> Create
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <Link 
            to="/profile" 
            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
          >
            {user ? (
              <>
                <img
                  src={user.avatar || 'default-avatar.png'}
                  alt="Profile"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    marginRight: '10px',
                    objectFit: 'cover',
                  }}
                />
                <span>{user.username || 'Profile'}</span>
              </>
            ) : (
              <span>Loading...</span>
            )}
          </Link>
        </div>
      </nav>
      <div style={{ marginTop: 'auto' }}>
        <Settings size={20} /> Settings
      </div>
    </aside>
  );
};

export default Sidebar;
