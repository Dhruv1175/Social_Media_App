import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Plus } from 'lucide-react';
import '../styles/Story.css';

const Story = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!userId || !token) {
          console.error('User ID or token not found');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch current user
        const userResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers }
        );
        
        setCurrentUser(userResponse.data.exist);
        
        // For now, since we don't have a stories API yet,
        // we'll use followers/following as mock stories
        const followingResponse = await axios.get(
          `http://localhost:3080/user/${userId}/following`,
          { headers }
        );
        
        // Transform following data into stories format
        const mockStories = followingResponse.data.followingsList
          ? followingResponse.data.followingsList
            .filter(item => item.following)
            .map((item, index) => ({
              id: item.following._id,
              user: item.following,
              viewed: index % 3 === 0, // Randomly mark some as viewed
              timestamp: new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)), // Random time in last 24h
            }))
          : [];
        
        setStories(mockStories);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching story data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewStory = (storyId) => {
    // In a real app, we would mark the story as viewed
    // and show a fullscreen story view
    console.log(`Viewing story ${storyId}`);
    
    // For demo purposes, let's update the viewed status
    setStories(stories.map(story => 
      story.id === storyId ? { ...story, viewed: true } : story
    ));
  };

  const handleCreateStory = () => {
    // This would open a story creation UI
    alert('Story creation would open here');
  };

  if (loading) {
    return (
      <div className="stories-container">
        <div className="story-item">
          <div className="story-avatar-border">
            <div className="story-avatar-container">
              <div className="story-avatar" style={{ backgroundColor: '#f0f0f0' }}></div>
            </div>
          </div>
          <span className="story-username">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stories-container">
      {/* Create Story Button */}
      <div className="create-story-button" onClick={handleCreateStory}>
        <div className="create-story-icon">
          {currentUser && currentUser.avatar ? (
            <img src={currentUser.avatar} alt="Your profile" className="story-avatar" />
          ) : (
            <User size={32} color="#262626" />
          )}
          <div className="plus-icon">
            <Plus size={14} />
          </div>
        </div>
        <span className="story-username">Your story</span>
      </div>
      
      {/* User Stories */}
      {stories.map((story) => (
        <div 
          key={story.id} 
          className="story-item" 
          onClick={() => handleViewStory(story.id)}
        >
          <div className={`story-avatar-border ${story.viewed ? 'viewed' : ''}`}>
            <div className="story-avatar-container">
              {story.user && story.user.avatar ? (
                <img 
                  src={story.user.avatar} 
                  alt={story.user.name} 
                  className="story-avatar" 
                />
              ) : (
                <User size={32} color="#262626" />
              )}
            </div>
          </div>
          <span className="story-username">
            {story.user ? story.user.name : 'User'}
          </span>
        </div>
      ))}
      
      {/* If no stories, show placeholder */}
      {stories.length === 0 && (
        <div className="story-item">
          <div className="story-avatar-border viewed">
            <div className="story-avatar-container">
              <User size={32} color="#8e8e8e" />
            </div>
          </div>
          <span className="story-username">No stories</span>
        </div>
      )}
    </div>
  );
};

export default Story; 