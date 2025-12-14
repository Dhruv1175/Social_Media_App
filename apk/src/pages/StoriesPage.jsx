import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Send, Heart, Camera, Upload, Plus } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import '../styles/StoriesPage.css';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_STORY = '/assets/default-post.svg';

const StoriesPage = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingStory, setViewingStory] = useState(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [creatingStory, setCreatingStory] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState(null);
  const [storyCaption, setStoryCaption] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // References
  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const storyTimeoutRef = useRef(null);
  
  useEffect(() => {
    fetchData();
    
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (viewingStory) {
      // Start progress
      setStoryProgress(0);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      // Create progress interval
      progressIntervalRef.current = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressIntervalRef.current);
            
            // Move to next story after completed
            storyTimeoutRef.current = setTimeout(() => {
              handleNextStory();
            }, 200);
            
            return 100;
          }
          return prev + 1;
        });
      }, 50); // 5 seconds total duration (50ms x 100)
    } else {
      // Clear intervals when not viewing
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    }
    
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    };
  }, [viewingStory, activeStoryIndex]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        navigate('/login');
        return;
      }
      
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch user profile
      const userResponse = await axios.get(
        `http://localhost:30801/user/profile/${userId}`,
        { headers }
      );
      
      setUser(userResponse.data.exist || null);
      
      // In a real app, we would fetch stories from an API endpoint
      // For now, we'll generate mock stories
      const mockStories = generateMockStories(userResponse.data.exist || { _id: userId });
      setStories(mockStories);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Fallback to mock data
      const mockUser = {
        _id: 'current-user-id',
        username: 'current_user',
        name: 'Current User',
        profileImageUrl: 'https://randomuser.me/api/portraits/women/44.jpg'
      };
      setUser(mockUser);
      setStories(generateMockStories(mockUser));
    } finally {
      setLoading(false);
    }
  };
  
  const generateMockStories = (user) => {
    // Your story (if any)
    const yourStories = {
      userId: user._id,
      username: user.username || user.name,
      name: user.name || user.username,
      profileImageUrl: user.profileImageUrl || user.avatar || DEFAULT_AVATAR,
      stories: [
        {
          id: 'your-story-1',
          imageUrl: 'https://source.unsplash.com/random/800x1200?nature',
          videoUrl: null,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          viewed: false,
          caption: 'My latest adventure!'
        }
      ]
    };
    
    // Mock following users with stories
    const followingStories = [
      {
        userId: 'user1',
        username: 'traveler',
        name: 'World Traveler',
        profileImageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
        stories: [
          {
            id: 'story1',
            imageUrl: 'https://source.unsplash.com/random/800x1200?travel',
            videoUrl: null,
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            viewed: false,
            caption: 'Exploring new places!'
          },
          {
            id: 'story2',
            imageUrl: null,
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            viewed: false,
            caption: 'Check out this view!'
          }
        ]
      },
      {
        userId: 'user2',
        username: 'foodie',
        name: 'Food Lover',
        profileImageUrl: 'https://randomuser.me/api/portraits/women/65.jpg',
        stories: [
          {
            id: 'story3',
            imageUrl: 'https://source.unsplash.com/random/800x1200?food',
            videoUrl: null,
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            viewed: false,
            caption: 'Delicious dinner tonight!'
          }
        ]
      },
      {
        userId: 'user3',
        username: 'photographer',
        name: 'Pro Photographer',
        profileImageUrl: 'https://randomuser.me/api/portraits/men/29.jpg',
        stories: [
          {
            id: 'story4',
            imageUrl: 'https://source.unsplash.com/random/800x1200?photography',
            videoUrl: null,
            timestamp: new Date(Date.now() - 5400000).toISOString(),
            viewed: false,
            caption: 'New camera setup!'
          }
        ]
      },
      {
        userId: 'user4',
        username: 'artist',
        name: 'Creative Artist',
        profileImageUrl: 'https://randomuser.me/api/portraits/women/22.jpg',
        stories: [
          {
            id: 'story5',
            imageUrl: 'https://source.unsplash.com/random/800x1200?art',
            videoUrl: null,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            viewed: false,
            caption: 'Working on a new project!'
          }
        ]
      },
      {
        userId: 'user5',
        username: 'fitness',
        name: 'Fitness Coach',
        profileImageUrl: 'https://randomuser.me/api/portraits/men/43.jpg',
        stories: [
          {
            id: 'story6',
            imageUrl: 'https://source.unsplash.com/random/800x1200?fitness',
            videoUrl: null,
            timestamp: new Date(Date.now() - 2700000).toISOString(),
            viewed: false,
            caption: "Today's workout was intense!"
          }
        ]
      }
    ];
    
    return [yourStories, ...followingStories];
  };
  
  const handleViewStory = (userIndex) => {
    setViewingStory(stories[userIndex]);
    setActiveStoryIndex(0);
    setStoryProgress(0);
  };
  
  const handleCloseStory = () => {
    setViewingStory(null);
    setActiveStoryIndex(0);
    setStoryProgress(0);
    
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
  };
  
  const handleNextStory = () => {
    if (!viewingStory) return;
    
    // Mark current story as viewed
    const updatedStories = [...stories];
    const userIndex = stories.findIndex(user => user.userId === viewingStory.userId);
    
    if (userIndex !== -1) {
      updatedStories[userIndex].stories[activeStoryIndex].viewed = true;
    }
    
    // Reset progress
    setStoryProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    // Check if there are more stories from this user
    if (activeStoryIndex < viewingStory.stories.length - 1) {
      // Next story from same user
      setActiveStoryIndex(activeStoryIndex + 1);
    } else {
      // Move to next user's stories
      const nextUserIndex = stories.findIndex(user => user.userId === viewingStory.userId) + 1;
      
      if (nextUserIndex < stories.length) {
        // Next user has stories
        setViewingStory(stories[nextUserIndex]);
        setActiveStoryIndex(0);
      } else {
        // No more stories, close the viewer
        handleCloseStory();
      }
    }
    
    setStories(updatedStories);
  };
  
  const handlePrevStory = () => {
    if (!viewingStory) return;
    
    // Reset progress
    setStoryProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    // Check if there are previous stories from this user
    if (activeStoryIndex > 0) {
      // Previous story from same user
      setActiveStoryIndex(activeStoryIndex - 1);
    } else {
      // Move to previous user's stories
      const prevUserIndex = stories.findIndex(user => user.userId === viewingStory.userId) - 1;
      
      if (prevUserIndex >= 0) {
        // Previous user has stories
        setViewingStory(stories[prevUserIndex]);
        setActiveStoryIndex(stories[prevUserIndex].stories.length - 1);
      } else {
        // No more previous stories, stay at first
        setActiveStoryIndex(0);
      }
    }
  };

  const handleOpenCreateStory = () => {
    setCreatingStory(true);
    setStoryFile(null);
    setStoryPreview(null);
    setStoryCaption('');
    setUploadProgress(0);
  };
  
  const handleCloseCreateStory = () => {
    setCreatingStory(false);
    setStoryFile(null);
    setStoryPreview(null);
    setStoryCaption('');
    setUploadProgress(0);
    setIsUploading(false);
  };
  
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setStoryFile(file);
    
    // Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setStoryPreview(objectUrl);
    
    // Determine if it's video or image
    const isVideo = file.type.startsWith('video/');
    
    return () => URL.revokeObjectURL(objectUrl);
  };
  
  const handleCreateStory = async () => {
    if (!storyFile) return;
    
    setIsUploading(true);
    
    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        
        // Add to stories array
        const isVideo = storyFile.type.startsWith('video/');
        const newStory = {
          id: `new-story-${Date.now()}`,
          imageUrl: isVideo ? null : storyPreview,
          videoUrl: isVideo ? storyPreview : null,
          timestamp: new Date().toISOString(),
          viewed: false,
          caption: storyCaption
        };
        
        // Update stories array
        const updatedStories = [...stories];
        const currentUserIndex = updatedStories.findIndex(user => user.userId === user?._id);
        
        if (currentUserIndex !== -1) {
          updatedStories[currentUserIndex].stories.unshift(newStory);
        } else {
          // Create new user entry if not exists
          const newUserStory = {
            userId: user._id,
            username: user.username || user.name,
            name: user.name || user.username,
            profileImageUrl: user.profileImageUrl || user.avatar || DEFAULT_AVATAR,
            stories: [newStory]
          };
          updatedStories.unshift(newUserStory);
        }
        
        setStories(updatedStories);
        
        // Close create story modal
        setTimeout(() => {
          handleCloseCreateStory();
          // You'd then view the story
          handleViewStory(0);
        }, 500);
      }
    }, 100);
    
    // In a real app, you would use axios to upload to Firebase:
    /*
    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', storyFile);
      formData.append('caption', storyCaption);
      
      await axios.post(`http://localhost:30801/user/story/create`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      // Refresh stories
      fetchData();
      handleCloseCreateStory();
    } catch (error) {
      console.error('Error uploading story:', error);
      setIsUploading(false);
    }
    */
  };
  
  // Format timestamp to relative time
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const storyTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - storyTime) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Calculate which stories are unviewed
  const hasUnviewedStories = (userStories) => {
    return userStories.stories.some(story => !story.viewed);
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading stories...</p>
      </div>
    );
  }

  return (
    <div className="stories-page">
      <Sidebar user={user} />
      
      <div className="stories-page-content">
        <div className="stories-page-header">
          <h1>Stories</h1>
          <button className="create-story-btn" onClick={handleOpenCreateStory}>
            <Plus size={20} />
            <span>Create Story</span>
          </button>
        </div>
        
        <div className="stories-grid">
          {stories.map((userStory, index) => (
            <div 
              className="story-grid-item" 
              key={userStory.userId}
              onClick={() => handleViewStory(index)}
            >
              <div className={`story-preview-border ${hasUnviewedStories(userStory) ? '' : 'viewed'}`}>
                <div className="story-preview-container">
                  {userStory.stories[0].videoUrl ? (
                    <video 
                      src={userStory.stories[0].videoUrl} 
                      className="story-preview-media" 
                    />
                  ) : (
                    <img 
                      src={userStory.stories[0].imageUrl || DEFAULT_STORY} 
                      alt={userStory.username}
                      className="story-preview-media"
                      onError={(e) => { e.target.src = DEFAULT_STORY }}
                    />
                  )}
                  
                  <div className="story-preview-user">
                    <div className="story-preview-avatar">
                      <img 
                        src={userStory.profileImageUrl || DEFAULT_AVATAR} 
                        alt={userStory.username}
                        onError={(e) => { e.target.src = DEFAULT_AVATAR }}
                      />
                    </div>
                    <span className="story-preview-username">{userStory.username}</span>
                    <span className="story-preview-time">
                      {formatTimeAgo(userStory.stories[0].timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Story Viewing Modal */}
      {viewingStory && (
        <div className="story-modal">
          <div className="story-view-container">
            {/* Progress Bars */}
            <div className="story-progress-container">
              {viewingStory.stories.map((story, index) => (
                <div className="story-progress" key={story.id}>
                  <div 
                    className="story-progress-bar" 
                    style={{ 
                      width: index === activeStoryIndex ? `${storyProgress}%` : 
                             index < activeStoryIndex ? '100%' : '0%' 
                    }}
                  ></div>
                </div>
              ))}
            </div>
            
            {/* Story Header */}
            <div className="story-header">
              <div className="story-user-info">
                <div className="story-user-avatar">
                  <img 
                    src={viewingStory.profileImageUrl || DEFAULT_AVATAR} 
                    alt={viewingStory.username}
                    onError={(e) => { e.target.src = DEFAULT_AVATAR }}
                  />
                </div>
                <span className="story-user-name">{viewingStory.username}</span>
                <span className="story-timestamp">
                  {formatTimeAgo(viewingStory.stories[activeStoryIndex].timestamp)}
                </span>
              </div>
              <button className="story-close-btn" onClick={handleCloseStory}>
                <X size={24} color="white" />
              </button>
            </div>
            
            {/* Story Content */}
            <div className="story-content">
              {viewingStory.stories[activeStoryIndex].videoUrl ? (
                <video 
                  src={viewingStory.stories[activeStoryIndex].videoUrl} 
                  className="story-media" 
                  autoPlay 
                  muted 
                  loop
                  playsInline
                />
              ) : (
                <img 
                  src={viewingStory.stories[activeStoryIndex].imageUrl || DEFAULT_STORY} 
                  className="story-media" 
                  alt="Story content"
                  onError={(e) => { e.target.src = DEFAULT_STORY }}
                />
              )}
              
              {viewingStory.stories[activeStoryIndex].caption && (
                <div className="story-caption">
                  {viewingStory.stories[activeStoryIndex].caption}
                </div>
              )}
            </div>
            
            {/* Story Navigation */}
            <button className="story-nav prev" onClick={handlePrevStory}>
              <ChevronLeft size={24} color="white" />
            </button>
            <button className="story-nav next" onClick={handleNextStory}>
              <ChevronRight size={24} color="white" />
            </button>
            
            {/* Story Actions */}
            <div className="story-actions">
              <div className="story-reply-box">
                <input type="text" placeholder={`Reply to ${viewingStory.username}...`} />
                <button className="story-send-btn">
                  <Send size={20} color="white" />
                </button>
              </div>
              
              <div className="story-reactions">
                <button className="story-reaction-btn">
                  <Heart size={24} color="white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Story Creation Modal */}
      {creatingStory && (
        <div className="story-creation-modal">
          <div className="story-creation-container">
            <div className="story-creation-header">
              <h3>Create Story</h3>
              <button onClick={handleCloseCreateStory}>
                <X size={24} color="#262626" />
              </button>
            </div>
            
            <div className="story-creation-content">
              {!storyPreview ? (
                <div className="story-upload-placeholder">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*, video/*" 
                    style={{ display: 'none' }} 
                  />
                  <button className="upload-btn" onClick={handleFileSelect}>
                    <Upload size={48} color="#0095f6" />
                    <span>Upload photo or video</span>
                  </button>
                  <p className="upload-hint">Share a photo or video to create a story</p>
                </div>
              ) : (
                <>
                  <div className="story-preview">
                    {storyFile && storyFile.type.startsWith('video/') ? (
                      <video 
                        src={storyPreview} 
                        className="story-preview-media" 
                        autoPlay 
                        muted 
                        loop
                        playsInline
                        controls
                      />
                    ) : (
                      <img 
                        src={storyPreview} 
                        className="story-preview-media" 
                        alt="Story preview" 
                      />
                    )}
                  </div>
                  
                  <div className="story-caption-input">
                    <textarea 
                      placeholder="Write a caption..." 
                      value={storyCaption}
                      onChange={(e) => setStoryCaption(e.target.value)}
                      maxLength={2200}
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="story-creation-actions">
              <button 
                className="story-cancel-btn" 
                onClick={handleCloseCreateStory}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                className="story-create-btn" 
                onClick={handleCreateStory}
                disabled={!storyPreview || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Share to Story'}
              </button>
            </div>
            
            {isUploading && (
              <div className="story-upload-progress">
                <div 
                  className="story-upload-progress-bar" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesPage; 