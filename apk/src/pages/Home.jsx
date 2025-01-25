import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Posts from '../components/Post';

function Home1() {
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  // Fetch data from the database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userId = localStorage.getItem('userId');

        const postsResponse = await axios.get(
          `http://localhost:3080/user/post/${userId}/feed`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const userResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setPosts(postsResponse.data.posts || []); // Ensure an array
        setUser(userResponse.data.exist || null); // Ensure an object or null
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      {/* Sidebar */}
      <Sidebar user={user} />

      {/* Main Content */}
      <main style={{ flex: 1, padding: '20px' }}>
        {/* Stories */}
        <div style={{ display: 'flex', overflowX: 'scroll', marginBottom: '20px' }}>
          {stories.length === 0 && <p>No stories to show</p>}
          {stories.map((story) => (
            <div key={story.id || 'default-id'} style={{ marginRight: '10px', textAlign: 'center' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundImage: story.isWatched
                    ? 'none'
                    : 'linear-gradient(to top right, orange, red)',
                  padding: '3px',
                }}
              >
                <img
                  src={story.avatar || 'default-avatar.png'}
                  alt={story.username || 'Unknown'}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '2px solid white',
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>{story.username || 'Anonymous'}</div>
            </div>
          ))}
        </div>

        {/* Posts */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
          <Posts posts={posts} user={user} />
        </div>
      </main>
    </div>
  );
}

export default Home1;
