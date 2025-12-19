import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Plus, X, ChevronLeft, ChevronRight, Send, Heart, Upload, Eye, Clock, Users, Sparkles } from 'lucide-react';
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
            
            if (!Array.isArray(feedData)) {
                console.error('Feed data is not an array:', feedData);
                feedData = [];
            }
            
            // Sort stories
            const sortedStories = feedData.sort((a, b) => {
                if (a.userId === currentUserData._id) return -1;
                if (b.userId === currentUserData._id) return 1;
                
                const aHasUnviewed = a.stories?.some(s => !s.viewed) || false;
                const bHasUnviewed = b.stories?.some(s => !s.viewed) || false;
                
                if (aHasUnviewed && !bHasUnviewed) return -1;
                if (!aHasUnviewed && bHasUnviewed) return 1;
                
                const aNewest = a.stories?.length > 0 
                    ? Math.max(...a.stories.map(s => new Date(s.timestamp).getTime()))
                    : 0;
                const bNewest = b.stories?.length > 0 
                    ? Math.max(...b.stories.map(s => new Date(s.timestamp).getTime()))
                    : 0;
                
                return bNewest - aNewest;
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
                
                markStoryAsViewedAPI(currentStory.id);
            }
            
            if (viewingStory.userId === currentUser?._id) {
                fetchStoryViewers(currentStory.id);
            } else {
                setStoryViewers([]);
            }

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
                    return prev + (100 / (5 * 10));
                });
            }, 100);
        } else {
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
        
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        if (storyTimeoutRef.current) {
            clearTimeout(storyTimeoutRef.current);
        }
        
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
        
        if (storyPreview) {
            URL.revokeObjectURL(storyPreview);
        }

        setStoryFile(file);
        
        const fileType = file.type.startsWith('video/') ? 'video' 
            : (file.type.startsWith('image/') ? 'image' : null);
        
        if (!fileType) {
            alert("Unsupported file type selected. Please select an image or video.");
            setStoryFile(null);
            setStoryPreview(null);
            return;
        }

        setCurrentMediaType(fileType);

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
            
            const response = await axios.post(
                `${BASE_URL}/story/create`, 
                storyData, 
                { headers: getAuthHeaders() }
            );

            if (response.status !== 201) {
                throw new Error(`Server error: ${response.data?.message || 'Unknown error'}`);
            }

            setUploadProgress(100);
            
            await fetchData();
            
            setTimeout(() => {
                handleCloseCreateStory();
                
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
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return `${Math.floor(diffInSeconds / 86400)}d`;
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
                {/* Your Story Button */}
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
                                    <Plus size={16} />
                                </div>
                            </div>
                        </div>
                        <span className="story-username">Your Story</span>
                    </div>
                )}
                
                {/* Other users' stories */}
                {stories
                    .filter(userStory => userStory.userId !== currentUser?._id)
                    .filter(userStory => userStory.stories && userStory.stories.length > 0)
                    .map((userStory, index) => {
                        const originalIndex = stories.findIndex(s => s.userId === userStory.userId);
                        
                        return (
                            <div 
                                className="story-item" 
                                key={userStory.userId || `story-${index}`}
                                onClick={() => handleViewStory(originalIndex)}
                            >
                                <div className={`story-avatar-border ${hasUnviewedStories(userStory) ? 'unviewed' : 'viewed'}`}>
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
                <div className="viewers-title">
                    <Users size={20} />
                    <h3>Story Views ({viewers.length})</h3>
                </div>
                <button className="close-viewers-btn" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>
            <div className="viewers-list">
                {viewers.length > 0 ? (
                    viewers.map(viewer => (
                        <div className="viewer-item" key={viewer._id || viewer.id}>
                            <div className="viewer-avatar-container">
                                <img 
                                    src={viewer.profileImageUrl || DEFAULT_AVATAR} 
                                    alt={viewer.username} 
                                    className="viewer-avatar"
                                    onError={(e) => { 
                                        e.target.onerror = null; 
                                        e.target.src = DEFAULT_AVATAR;
                                    }}
                                />
                            </div>
                            <div className="viewer-info">
                                <span className="viewer-username">{viewer.username}</span>
                                <span className="viewer-name">{viewer.name || ''}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-viewers">
                        <Eye size={48} />
                        <p>No views yet</p>
                        <span>Be the first to view this story</span>
                    </div>
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
                                <div className="story-user-details">
                                    <span className="story-user-name">{viewingStory.username || 'User'}</span>
                                    <span className="story-timestamp">
                                        <Clock size={12} />
                                        {formatTimeAgo(currentStory.timestamp)}
                                    </span>
                                </div>
                            </div>
                            <div className="story-header-actions">
                                {isOwnerViewing && (
                                    <button 
                                        className="story-add-btn" 
                                        onClick={() => {
                                            handleCloseStory();
                                            handleOpenCreateStory();
                                        }}
                                        title="Add to your story"
                                    >
                                        <Plus size={20} />
                                    </button>
                                )}
                                <button className="story-close-btn" onClick={handleCloseStory}>
                                    <X size={20} />
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
                        
                        {/* Story Actions */}
                        <div className="story-actions">
                            {isOwnerViewing ? (
                                <button 
                                    className="story-views-toggle" 
                                    onClick={() => setShowViews(prev => !prev)}
                                >
                                    <Eye size={20} />
                                    <span>{storyViewers.length}</span>
                                </button>
                            ) : (
                                <>
                                    <div className="story-reply-box">
                                        <input 
                                            type="text" 
                                            placeholder={`Reply to ${viewingStory.username || 'this story'}...`} 
                                        />
                                        <button className="story-send-btn">
                                            <Send size={20} />
                                        </button>
                                    </div>
                                    <button className="story-reaction-btn">
                                        <Heart size={24} />
                                    </button>
                                </>
                            )}
                        </div>
                        
                        {/* Navigation Arrows */}
                        <button className="story-nav prev" onClick={handlePrevStory}>
                            <ChevronLeft size={24} />
                        </button>
                        <button className="story-nav next" onClick={handleNextStory}>
                            <ChevronRight size={24} />
                        </button>
                        
                        {/* Viewers Panel */}
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
                            <div className="header-content">
                                <Sparkles size={20} />
                                <h3>Create New Story</h3>
                            </div>
                            <button 
                                className="close-creation-btn" 
                                onClick={handleCloseCreateStory} 
                                disabled={isUploading}
                            >
                                <X size={24} />
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
                                    <div className="upload-icon-container">
                                        <Upload size={60} />
                                    </div>
                                    <button 
                                        className="upload-btn" 
                                        onClick={handleFileSelect} 
                                        disabled={isUploading}
                                    >
                                        Select Photo or Video
                                    </button>
                                    <p className="upload-hint">Drag & drop or click to upload</p>
                                    <div className="format-hint">
                                        <span>JPG, PNG, GIF, MP4, MOV</span>
                                        <span>Max 50MB</span>
                                    </div>
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
                                            <Upload size={24} />
                                            <span>Change media</span>
                                        </div>
                                    </div>
                                    
                                    <div className="story-caption-input">
                                        <div className="caption-header">
                                            <span>Add a caption</span>
                                            <span>{storyCaption.length}/2200</span>
                                        </div>
                                        <textarea 
                                            placeholder="Share what's on your mind..." 
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
                                {isUploading ? (
                                    <>
                                        <span className="upload-spinner"></span>
                                        {Math.round(uploadProgress)}%
                                    </>
                                ) : 'Share Story'}
                            </button>
                        </div>
                        
                        {isUploading && uploadProgress > 0 && (
                            <div className="story-upload-progress">
                                <div className="progress-label">
                                    <span>Uploading...</span>
                                    <span>{Math.round(uploadProgress)}%</span>
                                </div>
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