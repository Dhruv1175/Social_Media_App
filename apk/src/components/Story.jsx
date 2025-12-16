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
    // Renamed for clarity: this holds the user story *group* from the feed
    const [currentUserStoryGroup, setCurrentUserStoryGroup] = useState(null); 
    const [showViews, setShowViews] = useState(false);
    const [storyViewers, setStoryViewers] = useState([]);
    
    const fileInputRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const storyTimeoutRef = useRef(null);
    
    const getAuthHeaders = () => {
        const token = localStorage.getItem('accessToken');
        return { Authorization: `Bearer ${token}` };
    };

    const fetchData = async () => { 
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
            
            // 1. Fetch user profile
            const userResponse = await axios.get(`${BASE_URL}/profile/${userId}`, { headers });
            setCurrentUser(userResponse.data.exist);
            
            // 2. Fetch story feed (includes current user and followed users)
            const storyFeedResponse = await axios.get(`${BASE_URL}/story/feed`, { headers });
            const feedData = storyFeedResponse.data;
            
            // 3. Separate current user's stories for easier access and sorting logic
            const currentUserId = userResponse.data.exist._id;
            const currentUserStories = feedData.find(s => s.userId === currentUserId);
            setCurrentUserStoryGroup(currentUserStories);
            
            // Filter out current user's group from the main list if it exists, as it's handled separately in rendering
            const otherStories = feedData.filter(s => s.userId !== currentUserId);

            // Create the final sorted list: [Your Story, Other Stories]
            const sortedStories = currentUserStories ? [currentUserStories, ...otherStories] : otherStories;
            
            setStories(sortedStories);
        } catch (error) {
            console.error('Error fetching data:', error.response?.data?.message || error.message);
            setStories([]);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
        };
    }, [navigate]);

    const markStoryAsViewedAPI = async (storyId) => { 
        try {
            await axios.post(`${BASE_URL}/story/${storyId}/view`, {}, { headers: getAuthHeaders() });
        } catch (error) {
            console.error('Error marking story as viewed:', error.response?.data?.message || error.message);
        }
    };

    const fetchStoryViewers = useCallback(async (storyId) => {
        if (!currentUser || !storyId) return;
        try {
            const response = await axios.get(`${BASE_URL}/story/${storyId}/views`, { headers: getAuthHeaders() });
            setStoryViewers(response.data.viewers || []);
        } catch (error) {
            console.error('Error fetching story views:', error.response?.data?.message || error.message);
            setStoryViewers([]);
        }
    }, [currentUser]);


    useEffect(() => { 
        if (viewingStory) {
            const currentStory = viewingStory.stories[activeStoryIndex];
            
            if (currentStory) {
                // If it's a new story for the user, mark it as viewed
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
                    
                    if (viewingStory.userId === currentUser?._id) {
                        setCurrentUserStoryGroup(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                stories: prev.stories.map((story, index) => 
                                    index === activeStoryIndex ? { ...story, viewed: true } : story
                                )
                            };
                        });
                    }
                    
                    markStoryAsViewedAPI(currentStory.id);
                }
                
                // Fetch viewers only for the current user's own stories
                if (viewingStory.userId === currentUser?._id) {
                    fetchStoryViewers(currentStory.id);
                } else {
                    setStoryViewers([]);
                }
            }


            setStoryProgress(0);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
            
            progressIntervalRef.current = setInterval(() => {
                setStoryProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(progressIntervalRef.current);
                        storyTimeoutRef.current = setTimeout(() => {
                            handleNextStory();
                        }, 200); 
                        return 100;
                    }
                    return prev + (100 / (50 * 5)); // 5 seconds per story
                });
            }, 100); 
        } else {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
        }
        
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
        };
    }, [viewingStory, activeStoryIndex, currentUser, fetchStoryViewers]);

    const handleViewStory = (userIndex, storyStartIndex = 0) => { 
        setViewingStory(stories[userIndex]);
        setActiveStoryIndex(storyStartIndex);
        setStoryProgress(0);
        setShowViews(false); // Hide views panel when switching stories
    };
    
    const handleCloseStory = () => { 
        setViewingStory(null);
        setActiveStoryIndex(0);
        setStoryProgress(0);
        setShowViews(false);
        setStoryViewers([]);
        
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
        
        fetchData(); // Refresh the feed data to update viewed/unviewed status
    };
    
    const handleNextStory = () => { 
        if (!viewingStory) return;
        
        if (activeStoryIndex < viewingStory.stories.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
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
        if (!viewingStory) return;
        
        if (activeStoryIndex > 0) {
            setActiveStoryIndex(activeStoryIndex - 1);
        } else {
            const currentUserId = viewingStory.userId;
            const currentUserIndex = stories.findIndex(user => user.userId === currentUserId);
            const prevUserIndex = currentUserIndex - 1;
            
            if (prevUserIndex >= 0) {
                handleViewStory(prevUserIndex, stories[prevUserIndex].stories.length - 1);
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
        setStoryPreview(null);
        setStoryCaption('');
        setUploadProgress(0);
        setIsUploading(false);
        setCurrentMediaType(null); 
        if (storyPreview) URL.revokeObjectURL(storyPreview);
    };
    
    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (storyPreview) URL.revokeObjectURL(storyPreview);

        setStoryFile(file);
        
        const fileType = file.type.startsWith('video/') ? 'video' : (file.type.startsWith('image/') ? 'image' : null);
        
        if (!fileType) {
             alert("Unsupported file type selected.");
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
            alert("Authentication Error or missing media file. Please log in or reselect the file.");
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
                throw new Error("Firebase upload failed or returned an empty URL.");
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
                throw new Error(`Server status ${response.status}: ${response.data?.message || 'Unknown error from server.'}`);
            }

            setUploadProgress(100);
            
            // Re-fetch data to update the feed and include the new story
            await fetchData();
            
            setTimeout(() => {
                handleCloseCreateStory();
                
                // Immediately view the newly created story
                const userIndex = stories.findIndex(s => s.userId === userId);
                if (userIndex !== -1) {
                    handleViewStory(userIndex, stories[userIndex].stories.length); // Try to view the last story (the new one)
                } 
            }, 500);
            
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message;
            console.error('Error uploading story:', errorMessage);
            alert(`Failed to share story. Reason: ${errorMessage}.`);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };
    
    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const storyTime = new Date(timestamp);
        const diffInSeconds = Math.floor((now - storyTime) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const hasUnviewedStories = (userStories) => {
        return userStories && userStories.stories && userStories.stories.some(story => !story.viewed);
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
        
        return (
            <>
                {/* Your Story Button - Always first if user is logged in */}
                {currentUser && (
                    <div 
                        className="story-item create-story" 
                        onClick={() => {
                            const userIndex = stories.findIndex(s => s.userId === currentUser._id);
                            const hasStories = currentUserStoryGroup && currentUserStoryGroup.stories.length > 0;
                            
                            if (hasStories && userIndex !== -1) {
                                handleViewStory(userIndex); // View existing stories
                            } else {
                                handleOpenCreateStory(); // Create new story
                            }
                        }}
                    >
                        <div className={`story-avatar-border ${currentUserStoryGroup && !hasUnviewedStories(currentUserStoryGroup) ? 'viewed' : ''} create`}>
                            <div className="story-avatar-container">
                                <img 
                                    src={currentUser.profileImageUrl || currentUser.avatar || DEFAULT_AVATAR}
                                    alt="Your Story"
                                    className="story-avatar"
                                    onError={(e) => { e.target.src = DEFAULT_AVATAR }}
                                />
                                {/* Show plus icon only if the user doesn't have stories OR if the border isn't already viewed */}
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
                    .filter(userStory => userStory.userId !== currentUser?._id)
                    .map((userStory, index) => {
                        // Find the original index in the full list for navigation (important!)
                        const originalIndex = stories.findIndex(s => s.userId === userStory.userId);
                        
                        return (
                            <div 
                                className="story-item" 
                                key={userStory.userId}
                                onClick={() => handleViewStory(originalIndex)}
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
                        );
                    })}
            </>
        );
    };

    const currentStory = viewingStory?.stories[activeStoryIndex];
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
                        <div className="viewer-item" key={viewer.id}>
                            <img 
                                src={viewer.profileImageUrl || DEFAULT_AVATAR} 
                                alt={viewer.username} 
                                className="viewer-avatar"
                                onError={(e) => { e.target.src = DEFAULT_AVATAR }}
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
                                    loop
                                    playsInline
                                    key={currentStory.id} // Important for video to reset on index change
                                />
                            ) : (
                                <img 
                                    src={currentStory.mediaUrl || DEFAULT_STORY} 
                                    className="story-media" 
                                    alt="Story content"
                                    onError={(e) => { e.target.src = DEFAULT_STORY }}
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
                                                loop
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