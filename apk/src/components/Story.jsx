import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Plus, X, ChevronLeft, ChevronRight, Send, Heart, Upload, Eye } from 'lucide-react';
import '../styles/Story.css';
import { useNavigate } from 'react-router-dom';
import { uploadMediaToFirebase } from '../utils/MediaUploadService';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_STORY = '/assets/default-post.svg';
const BASE_URL = 'http://localhost:30801/user';

const Story = () => {
    const navigate = useNavigate();
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
    const [currentMediaType, setCurrentMediaType] = useState(null);
    const [showViews, setShowViews] = useState(false);
    const [storyViewers, setStoryViewers] = useState([]);
    
    const fileInputRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const storyTimeoutRef = useRef(null);
    const lastFetchRef = useRef(0);
    
    const getAuthHeaders = () => {
        const token = localStorage.getItem('accessToken');
        return { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    const fetchData = useCallback(async () => {
        // Prevent rapid successive calls
        const now = Date.now();
        if (now - lastFetchRef.current < 1000) {
            return;
        }
        lastFetchRef.current = now;
        
        setLoading(true);
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('accessToken');
            if (!userId || !token) {
                console.warn("Authentication data missing. Cannot fetch feed.");
                navigate('/login');
                return;
            }
            const headers = getAuthHeaders();
            
            // Fetch user profile
            const userResponse = await axios.get(`${BASE_URL}/profile/${userId}`, { headers });
            const currentUserData = userResponse.data.exist || userResponse.data;
            if (!currentUserData || !currentUserData._id) {
                throw new Error('Invalid user data received');
            }
            setCurrentUser(currentUserData);
            
            // Fetch story feed
            const storyFeedResponse = await axios.get(`${BASE_URL}/story/feed`, { headers });
            let feedData = storyFeedResponse.data;
            
            // Ensure feedData is an array
            if (!Array.isArray(feedData)) {
                console.error('Feed data is not an array:', feedData);
                feedData = [];
            }
            
            console.log('Raw feed data:', feedData);
            
            // Sort stories: current user first, then users with unviewed stories, then others
            const sortedStories = feedData.sort((a, b) => {
                // Put current user first
                if (a.userId === currentUserData._id) return -1;
                if (b.userId === currentUserData._id) return 1;
                
                // Then sort by unviewed stories
                const aHasUnviewed = a.stories?.some(s => !s.viewed) || false;
                const bHasUnviewed = b.stories?.some(s => !s.viewed) || false;
                
                if (aHasUnviewed && !bHasUnviewed) return -1;
                if (!aHasUnviewed && bHasUnviewed) return 1;
                
                // Finally by newest story timestamp
                const aNewest = a.stories?.length > 0 
                    ? Math.max(...a.stories.map(s => new Date(s.timestamp).getTime()))
                    : 0;
                const bNewest = b.stories?.length > 0 
                    ? Math.max(...b.stories.map(s => new Date(s.timestamp).getTime()))
                    : 0;
                
                return bNewest - aNewest;
            });
            
            console.log('Processed stories count:', sortedStories.length);
            sortedStories.forEach((story, idx) => {
                console.log(`Story ${idx}:`, {
                    userId: story.userId,
                    username: story.username || 'No username',
                    storyCount: story.stories?.length || 0,
                    hasStories: story.stories && story.stories.length > 0,
                    isCurrentUser: story.userId === currentUserData._id
                });
            });
            
            setStories(sortedStories);
        } catch (error) {
            console.error('Error fetching data:', error.response?.data?.message || error.message);
            setStories([]);
        } finally {
            setLoading(false);
        }
    }, [navigate]);
    
    useEffect(() => {
        fetchData();
        
        // Cleanup function
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (storyTimeoutRef.current) {
                clearTimeout(storyTimeoutRef.current);
            }
            if (storyPreview) {
                URL.revokeObjectURL(storyPreview);
            }
        };
    }, [fetchData]);

    const markStoryAsViewedAPI = async (storyId) => {
        try {
            await axios.post(`${BASE_URL}/story/${storyId}/view`, {}, { 
                headers: getAuthHeaders() 
            });
        } catch (error) {
            console.error('Error marking story as viewed:', error.response?.data?.message || error.message);
        }
    };

    const fetchStoryViewers = useCallback(async (storyId) => {
        if (!currentUser || !storyId) return;
        try {
            const response = await axios.get(`${BASE_URL}/story/${storyId}/views`, { 
                headers: getAuthHeaders() 
            });
            setStoryViewers(response.data.viewers || []);
        } catch (error) {
            console.error('Error fetching story views:', error.response?.data?.message || error.message);
            setStoryViewers([]);
        }
    }, [currentUser]);

    useEffect(() => {
        if (viewingStory && viewingStory.stories && viewingStory.stories[activeStoryIndex]) {
            const currentStory = viewingStory.stories[activeStoryIndex];
            
            // Mark story as viewed if not already viewed
            if (!currentStory.viewed) {
                setStories(prevStories => prevStories.map(userStory => {
                    if (userStory.userId === viewingStory.userId) {
                        return {
                            ...userStory,
                            stories: userStory.stories.map((story, index) => 
                                index === activeStoryIndex ? { ...story, viewed: true } : story
                            )
                        };
                    }
                    return userStory;
                }));
                
                // API call to mark as viewed
                markStoryAsViewedAPI(currentStory.id);
            }
            
            // Fetch viewers only for the current user's own stories
            if (viewingStory.userId === currentUser?._id) {
                fetchStoryViewers(currentStory.id);
            } else {
                setStoryViewers([]);
            }

            // Reset and start progress
            setStoryProgress(0);
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (storyTimeoutRef.current) {
                clearTimeout(storyTimeoutRef.current);
            }
            
            progressIntervalRef.current = setInterval(() => {
                setStoryProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(progressIntervalRef.current);
                        storyTimeoutRef.current = setTimeout(() => {
                            handleNextStory();
                        }, 200);
                        return 100;
                    }
                    return prev + (100 / (5 * 10)); // 5 seconds per story (10 intervals per second)
                });
            }, 100);
        } else {
            // Cleanup intervals
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (storyTimeoutRef.current) {
                clearTimeout(storyTimeoutRef.current);
            }
        }
        
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (storyTimeoutRef.current) {
                clearTimeout(storyTimeoutRef.current);
            }
        };
    }, [viewingStory, activeStoryIndex, currentUser, fetchStoryViewers]);

    const handleViewStory = (userIndex, storyStartIndex = 0) => {
        const userStory = stories[userIndex];
        
        if (!userStory || !userStory.stories || userStory.stories.length === 0) {
            console.warn('No stories available for this user');
            return;
        }
        
        setViewingStory(userStory);
        setActiveStoryIndex(storyStartIndex);
        setStoryProgress(0);
        setShowViews(false);
    };
    
    const handleCloseStory = () => {
        setViewingStory(null);
        setActiveStoryIndex(0);
        setStoryProgress(0);
        setShowViews(false);
        setStoryViewers([]);
        
        // Cleanup intervals
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        if (storyTimeoutRef.current) {
            clearTimeout(storyTimeoutRef.current);
        }
        
        // Refresh data
        fetchData();
    };
    
    const handleNextStory = () => {
        if (!viewingStory || !viewingStory.stories) return;
        
        if (activeStoryIndex < viewingStory.stories.length - 1) {
            setActiveStoryIndex(prev => prev + 1);
        } else {
            const currentUserId = viewingStory.userId;
            const currentUserIndex = stories.findIndex(user => user.userId === currentUserId);
            const nextUserIndex = currentUserIndex + 1;
            
            if (nextUserIndex < stories.length) {
                handleViewStory(nextUserIndex);
            } else {
                handleCloseStory();
            }
        }
    };
    
    const handlePrevStory = () => {
        if (!viewingStory || !viewingStory.stories) return;
        
        if (activeStoryIndex > 0) {
            setActiveStoryIndex(prev => prev - 1);
        } else {
            const currentUserId = viewingStory.userId;
            const currentUserIndex = stories.findIndex(user => user.userId === currentUserId);
            const prevUserIndex = currentUserIndex - 1;
            
            if (prevUserIndex >= 0) {
                const prevUserStories = stories[prevUserIndex].stories;
                handleViewStory(prevUserIndex, prevUserStories ? prevUserStories.length - 1 : 0);
            } else {
                setActiveStoryIndex(0);
            }
        }
    };

    const handleOpenCreateStory = () => {
        if (!currentUser) {
            alert("Please log in to create a story.");
            return;
        }
        setCreatingStory(true);
        setStoryFile(null);
        setStoryPreview(null);
        setStoryCaption('');
        setUploadProgress(0);
        setCurrentMediaType(null);
    };
    
    const handleCloseCreateStory = () => {
        setCreatingStory(false);
        setStoryFile(null);
        if (storyPreview) {
            URL.revokeObjectURL(storyPreview);
        }
        setStoryPreview(null);
        setStoryCaption('');
        setUploadProgress(0);
        setIsUploading(false);
        setCurrentMediaType(null);
    };
    
    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Clean up previous preview URL
        if (storyPreview) {
            URL.revokeObjectURL(storyPreview);
        }

        setStoryFile(file);
        
        // Determine file type
        const fileType = file.type.startsWith('video/') ? 'video' 
            : (file.type.startsWith('image/') ? 'image' : null);
        
        if (!fileType) {
            alert("Unsupported file type selected. Please select an image or video.");
            setStoryFile(null);
            setStoryPreview(null);
            return;
        }

        setCurrentMediaType(fileType);

        // Create preview URL
        const objectUrl = URL.createObjectURL(file);
        setStoryPreview(objectUrl);
    };
    
    const handleCreateStory = async () => {
        const userId = localStorage.getItem('userId');
        
        if (!storyFile || !currentUser || !userId) {
            alert("Authentication error or missing media file.");
            setIsUploading(false);
            return;
        }
        
        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            // Upload to Firebase
            const uploadedMediaUrl = await uploadMediaToFirebase(
                storyFile, 
                'stories', 
                setUploadProgress
            );
            
            if (!uploadedMediaUrl) {
                throw new Error("Failed to upload media. Please try again.");
            }

            const storyData = {
                mediaUrl: uploadedMediaUrl,
                mediaType: currentMediaType,
                caption: storyCaption,
            };
            
            // Save to backend
            const response = await axios.post(
                `${BASE_URL}/story/create`, 
                storyData, 
                { headers: getAuthHeaders() }
            );

            if (response.status !== 201) {
                throw new Error(`Server error: ${response.data?.message || 'Unknown error'}`);
            }

            setUploadProgress(100);
            
            // Refresh stories
            await fetchData();
            
            setTimeout(() => {
                handleCloseCreateStory();
                
                // Find and view the new story
                const currentUserIndex = stories.findIndex(s => s.userId === userId);
                if (currentUserIndex !== -1) {
                    const updatedUserStories = stories[currentUserIndex];
                    if (updatedUserStories && updatedUserStories.stories) {
                        handleViewStory(currentUserIndex, updatedUserStories.stories.length - 1);
                    }
                }
            }, 500);
            
        } catch (error) {
            console.error('Error uploading story:', error);
            alert(`Failed to share story: ${error.response?.data?.message || error.message}`);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };
    
    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'just now';
        
        const now = new Date();
        const storyTime = new Date(timestamp);
        const diffInSeconds = Math.floor((now - storyTime) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const hasUnviewedStories = (userStories) => {
        return userStories && 
               userStories.stories && 
               userStories.stories.some(story => !story.viewed);
    };
    
    const renderStoryItems = () => {
        if (loading) {
            return Array(4).fill().map((_, index) => (
                <div className="story-item stories-loading" key={`loading-${index}`}>
                    <div className="story-avatar-border create">
                        <div className="story-avatar-container skeleton"></div>
                    </div>
                    <div className="story-username-skeleton"></div>
                </div>
            ));
        }
        
        const currentUserStories = stories.find(s => s.userId === currentUser?._id);
        const hasCurrentUserStories = currentUserStories && currentUserStories.stories && currentUserStories.stories.length > 0;
        
        return (
            <>
                {/* Your Story Button - Always first if user is logged in */}
                {currentUser && (
                    <div 
                        className="story-item create-story" 
                        onClick={() => {
                            if (hasCurrentUserStories) {
                                const userIndex = stories.findIndex(s => s.userId === currentUser._id);
                                handleViewStory(userIndex);
                            } else {
                                handleOpenCreateStory();
                            }
                        }}
                    >
                        <div className={`story-avatar-border ${hasCurrentUserStories && !hasUnviewedStories(currentUserStories) ? 'viewed' : ''} create`}>
                            <div className="story-avatar-container">
                                <img 
                                    src={currentUser.profileImageUrl || currentUser.avatar || DEFAULT_AVATAR}
                                    alt="Your Story"
                                    className="story-avatar"
                                    onError={(e) => { 
                                        e.target.onerror = null; 
                                        e.target.src = DEFAULT_AVATAR;
                                    }}
                                />
                                <div className="story-plus-icon">
                                    <Plus size={14} color="white" />
                                </div>
                            </div>
                        </div>
                        <span className="story-username">Your Story</span>
                    </div>
                )}
                
                {/* Render other users' stories */}
                {stories
                    .filter(userStory => userStory.userId !== currentUser?._id) // Exclude current user (already shown)
                    .filter(userStory => userStory.stories && userStory.stories.length > 0) // Only users with stories
                    .map((userStory, index) => {
                        const originalIndex = stories.findIndex(s => s.userId === userStory.userId);
                        
                        return (
                            <div 
                                className="story-item" 
                                key={userStory.userId || `story-${index}`}
                                onClick={() => handleViewStory(originalIndex)}
                            >
                                <div className={`story-avatar-border ${hasUnviewedStories(userStory) ? '' : 'viewed'}`}>
                                    <div className="story-avatar-container">
                                        <img 
                                            src={userStory.profileImageUrl || DEFAULT_AVATAR} 
                                            alt={userStory.username}
                                            className="story-avatar"
                                            onError={(e) => { 
                                                e.target.onerror = null; 
                                                e.target.src = DEFAULT_AVATAR;
                                            }}
                                        />
                                    </div>
                                </div>
                                <span className="story-username">{userStory.username || 'User'}</span>
                            </div>
                        );
                    })}
            </>
        );
    };

    const currentStory = viewingStory?.stories?.[activeStoryIndex];
    const isOwnerViewing = viewingStory?.userId === currentUser?._id;

    const ViewersPanel = ({ viewers, onClose }) => (
        <div className={`story-viewers-panel ${showViews ? 'visible' : ''}`}>
            <div className="viewers-header">
                <h3>Viewers ({viewers.length})</h3>
                <button onClick={onClose}><X size={20} color="#262626" /></button>
            </div>
            <div className="viewers-list">
                {viewers.length > 0 ? (
                    viewers.map(viewer => (
                        <div className="viewer-item" key={viewer._id || viewer.id}>
                            <img 
                                src={viewer.profileImageUrl || DEFAULT_AVATAR} 
                                alt={viewer.username} 
                                className="viewer-avatar"
                                onError={(e) => { 
                                    e.target.onerror = null; 
                                    e.target.src = DEFAULT_AVATAR;
                                }}
                            />
                            <span className="viewer-username">{viewer.username}</span>
                        </div>
                    ))
                ) : (
                    <p className="no-viewers">No viewers yet.</p>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Stories Container */}
            <div className="stories-container">
                {renderStoryItems()}
            </div>
            
            {/* Story Viewing Modal */}
            {viewingStory && currentStory && (
                <div className="story-modal">
                    <div className="story-view-container">
                        
                        {/* Story Navigation Click Areas */}
                        <button className="story-nav prev" onClick={handlePrevStory}>
                            <ChevronLeft size={24} color="white" />
                        </button>
                        <button className="story-nav next" onClick={handleNextStory}>
                            <ChevronRight size={24} color="white" />
                        </button>

                        {/* Progress Bars */}
                        <div className="story-progress-container">
                            {viewingStory.stories.map((story, index) => (
                                <div className="story-progress" key={story.id || index}>
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
                                        onError={(e) => { 
                                            e.target.onerror = null; 
                                            e.target.src = DEFAULT_AVATAR;
                                        }}
                                    />
                                </div>
                                <span className="story-user-name">{viewingStory.username || 'User'}</span>
                                <span className="story-timestamp">
                                    {formatTimeAgo(currentStory.timestamp)}
                                </span>
                            </div>
                            <div className="story-header-actions">
                                {/* Add New Story button for current user */}
                                {isOwnerViewing && (
                                    <button 
                                        className="story-add-btn" 
                                        onClick={() => {
                                            handleCloseStory();
                                            handleOpenCreateStory();
                                        }}
                                        title="Add to your story"
                                    >
                                        <Plus size={20} color="white" />
                                    </button>
                                )}
                                <button className="story-close-btn" onClick={handleCloseStory}>
                                    <X size={24} color="white" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Story Content */}
                        <div className="story-content">
                            {currentStory.mediaType === 'video' ? (
                                <video 
                                    src={currentStory.mediaUrl} 
                                    className="story-media" 
                                    autoPlay 
                                    muted 
                                    playsInline
                                    key={currentStory.id}
                                />
                            ) : (
                                <img 
                                    src={currentStory.mediaUrl || DEFAULT_STORY} 
                                    className="story-media" 
                                    alt="Story content"
                                    onError={(e) => { 
                                        e.target.onerror = null; 
                                        e.target.src = DEFAULT_STORY;
                                    }}
                                />
                            )}
                            
                            {currentStory.caption && (
                                <div className="story-caption">
                                    {currentStory.caption}
                                </div>
                            )}
                        </div>
                        
                        {/* Story Actions / Footer */}
                        <div className="story-actions">
                            {isOwnerViewing ? (
                                // Story Owner View
                                <button 
                                    className="story-views-toggle" 
                                    onClick={() => setShowViews(prev => !prev)}
                                >
                                    <Eye size={20} color="white" />
                                    <span>{storyViewers.length} Views</span>
                                </button>
                            ) : (
                                // Viewer/Friend View
                                <>
                                    <div className="story-reply-box">
                                        <input 
                                            type="text" 
                                            placeholder={`Reply to ${viewingStory.username || 'this story'}...`} 
                                        />
                                        <button className="story-send-btn">
                                            <Send size={20} color="white" />
                                        </button>
                                    </div>
                                    <div className="story-reactions">
                                        <button className="story-reaction-btn">
                                            <Heart size={24} color="white" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* Viewers Panel (Overlay) */}
                        {isOwnerViewing && (
                            <ViewersPanel 
                                viewers={storyViewers} 
                                onClose={() => setShowViews(false)}
                            />
                        )}
                        
                    </div>
                </div>
            )}
            
            {/* Story Creation Modal */}
            {creatingStory && (
                <div className="story-creation-modal">
                    <div className="story-creation-container">
                        <div className="story-creation-header">
                            <h3>Create Story</h3>
                            <button onClick={handleCloseCreateStory} disabled={isUploading}>
                                <X size={24} color="#262626" />
                            </button>
                        </div>
                        
                        <div className="story-creation-content">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept="image/*, video/*" 
                                style={{ display: 'none' }} 
                                disabled={isUploading}
                            />
                            
                            {!storyFile ? (
                                <div className="story-upload-placeholder">
                                    <button className="upload-btn" onClick={handleFileSelect} disabled={isUploading}>
                                        <Upload size={48} color="#0095f6" />
                                        <span>Upload photo or video</span>
                                    </button>
                                    <p className="upload-hint">Supported formats: JPG, PNG, MP4, MOV</p>
                                </div>
                            ) : (
                                <div className="creation-preview-box">
                                    <div className="story-preview-media-container" onClick={handleFileSelect}>
                                        {currentMediaType === 'video' ? (
                                            <video 
                                                src={storyPreview} 
                                                className="story-preview-media" 
                                                autoPlay 
                                                muted 
                                                playsInline
                                            />
                                        ) : (
                                            <img 
                                                src={storyPreview} 
                                                className="story-preview-media" 
                                                alt="Story preview" 
                                            />
                                        )}
                                        <div className="reupload-overlay">
                                            <Upload size={24} color="white" />
                                            <span>Change Media</span>
                                        </div>
                                    </div>
                                    
                                    <div className="story-caption-input">
                                        <textarea 
                                            placeholder="Write a caption..." 
                                            value={storyCaption}
                                            onChange={(e) => setStoryCaption(e.target.value)}
                                            maxLength={2200}
                                            disabled={isUploading}
                                        />
                                    </div>
                                </div>
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
                                disabled={!storyFile || isUploading}
                            >
                                {isUploading ? `Uploading ${Math.round(uploadProgress)}%...` : 'Share to Story'}
                            </button>
                        </div>
                        
                        {isUploading && uploadProgress > 0 && (
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