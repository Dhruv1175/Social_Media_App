import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Image, Plus, X, ChevronLeft, ChevronRight, Send, Heart, MessageCircle, Upload, Camera } from 'lucide-react';
import '../styles/Story.css';
import { useNavigate } from 'react-router-dom';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_STORY = '/assets/default-post.svg';

const Story = () => {
  // States for stories data and UI control
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
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
  
  // Fetch user data and stories
  useEffect(() => {
    fetchData();
  }, []);
  
  // Clean up intervals and timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
    };
  }, []);
  
  // Manage story auto-advancement
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
      // Get current user from local storage
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        throw new Error('Authentication required');
      }
      
      // Fetch current user profile and following list
      const response = await axios.get(`http://localhost:30801/user/profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentUser(response.data.exist);
      
      // If you have a stories API endpoint, fetch stories here
      // For now, we'll generate mock stories
      const mockStories = generateMockStories(response.data.exist);
      setStories(mockStories);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Fallback to mock data if API fails
      const mockUser = {
        _id: 'current-user-id',
        username: 'current_user',
        name: 'Current User',
        profileImageUrl: 'https://randomuser.me/api/portraits/women/44.jpg'
      };
      setCurrentUser(mockUser);
      setStories(generateMockStories(mockUser));
    } finally {
      setLoading(false);
    }
  };
  
  // Generate mock stories for demonstration
  const generateMockStories = (user) => {
    // Your story (if any)
    const yourStories = {
      userId: user._id,
      username: user.username || user.name,
      name: user.name || user.username,
      profileImageUrl: user.profileImageUrl || user.avatar,
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
        const currentUserIndex = updatedStories.findIndex(user => user.userId === currentUser._id);
        
        if (currentUserIndex !== -1) {
          updatedStories[currentUserIndex].stories.unshift(newStory);
        } else {
          // Create new user entry if not exists
          const newUserStory = {
            userId: currentUser._id,
            username: currentUser.username || currentUser.name,
            name: currentUser.name || currentUser.username,
            profileImageUrl: currentUser.profileImageUrl || currentUser.avatar,
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
  
  // Render story items
  const renderStoryItems = () => {
    if (loading) {
      // Loading skeleton
      return Array(4).fill().map((_, index) => (
        <div className="stories-loading" key={`loading-${index}`}>
          <div className="story-avatar-skeleton"></div>
          <div className="story-username-skeleton"></div>
        </div>
      ));
    }
    
    if (stories.length === 0) {
      return <div className="empty-stories-message">No stories available</div>;
    }
    
    return (
      <>
        {/* Create Story Button */}
        <div className="story-item create-story" onClick={handleOpenCreateStory}>
          <div className="story-avatar-border create">
            <div className="story-avatar-container">
              <div className="empty-avatar">
                <Camera size={24} color="#8e8e8e" />
              </div>
              <div className="story-plus-icon">
                <Plus size={14} color="white" />
              </div>
            </div>
          </div>
          <span className="story-username">Create</span>
        </div>
        
        {/* Stories List */}
        {stories.map((userStory, index) => (
          <div 
            className="story-item" 
            key={userStory.userId}
            onClick={() => handleViewStory(index)}
          >
            <div className={`story-avatar-border ${hasUnviewedStories(userStory) ? '' : 'viewed'}`}>
              <div className="story-avatar-container">
                <img 
                  src={userStory.profileImageUrl || DEFAULT_AVATAR} 
                  alt={userStory.username}
                  className="story-avatar"
                  onError={(e) => { e.target.src = DEFAULT_AVATAR }}
                />
              </div>
            </div>
            <span className="story-username">{userStory.username}</span>
          </div>
        ))}
      </>
    );
  };

  return (
    <>
      {/* Stories Container */}
      <div className="stories-container">
        {renderStoryItems()}
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
                <button className="story-reaction-btn">
                  <MessageCircle size={24} color="white" />
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
    </>
  );
};

export default Story; 