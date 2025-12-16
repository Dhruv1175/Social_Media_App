import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, X, ChevronLeft, ChevronRight, Send, Heart, MessageCircle, Upload } from 'lucide-react';
import '../styles/Story.css';
import { useNavigate } from 'react-router-dom';
import { uploadMediaToFirebase } from '../utils/MediaUploadService'; 

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_STORY = '/assets/default-post.svg';
const BASE_URL = 'http://localhost:30801/user'; 

const StoriesPage = () => {
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
    const [currentMediaType, setCurrentMediaType] = useState(null); // Keep for UI rendering logic
    
    const fileInputRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const storyTimeoutRef = useRef(null);
    
    const getAuthHeaders = () => {
        const token = localStorage.getItem('accessToken');
        return { Authorization: `Bearer ${token}` };
    };

    const fetchData = async () => { /* ... unchanged ... */
        setLoading(true);
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('accessToken');
            if (!userId || !token) {
                console.warn("Authentication data missing. Cannot fetch feed.");
                return;
            }
            const headers = getAuthHeaders();
            const userResponse = await axios.get(`${BASE_URL}/profile/${userId}`, { headers });
            setCurrentUser(userResponse.data.exist);
            const storyFeedResponse = await axios.get(`${BASE_URL}/story/feed`, { headers });
            setStories(storyFeedResponse.data);
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
    }, []);

    const markStoryAsViewedAPI = async (storyId) => { /* ... unchanged ... */
        try {
            await axios.post(`${BASE_URL}/story/${storyId}/view`, {}, { headers: getAuthHeaders() });
        } catch (error) {
            console.error('Error marking story as viewed:', error.response?.data?.message || error.message);
        }
    };

    useEffect(() => { /* ... unchanged ... */
        if (viewingStory) {
            const currentStory = viewingStory.stories[activeStoryIndex];
            
            if (currentStory && !currentStory.viewed) {
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

            setStoryProgress(0);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            
            progressIntervalRef.current = setInterval(() => {
                setStoryProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(progressIntervalRef.current);
                        storyTimeoutRef.current = setTimeout(() => {
                            handleNextStory();
                        }, 200); 
                        return 100;
                    }
                    return prev + 1;
                });
            }, 50); 
        } else {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
        }
        
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
        };
    }, [viewingStory, activeStoryIndex]);

    const handleViewStory = (userIndex) => { /* ... unchanged ... */
        setViewingStory(stories[userIndex]);
        setActiveStoryIndex(0);
        setStoryProgress(0);
    };
    
    const handleCloseStory = () => { /* ... unchanged ... */
        setViewingStory(null);
        setActiveStoryIndex(0);
        setStoryProgress(0);
        
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (storyTimeoutRef.current) clearTimeout(storyTimeoutRef.current);
        
        fetchData(); 
    };
    
    const handleNextStory = () => { /* ... unchanged ... */
        if (!viewingStory) return;
        
        if (activeStoryIndex < viewingStory.stories.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
        } else {
            const currentUserId = viewingStory.userId;
            const currentUserIndex = stories.findIndex(user => user.userId === currentUserId);
            const nextUserIndex = currentUserIndex + 1;
            
            if (nextUserIndex < stories.length) {
                setViewingStory(stories[nextUserIndex]);
                setActiveStoryIndex(0);
            } else {
                handleCloseStory(); 
            }
        }
    };
    
    const handlePrevStory = () => { /* ... unchanged ... */
        if (!viewingStory) return;
        
        if (activeStoryIndex > 0) {
            setActiveStoryIndex(activeStoryIndex - 1);
        } else {
            const currentUserId = viewingStory.userId;
            const currentUserIndex = stories.findIndex(user => user.userId === currentUserId);
            const prevUserIndex = currentUserIndex - 1;
            
            if (prevUserIndex >= 0) {
                setViewingStory(stories[prevUserIndex]);
                setActiveStoryIndex(stories[prevUserIndex].stories.length - 1);
            } else {
                setActiveStoryIndex(0); 
            }
        }
    };

    const handleOpenCreateStory = () => { /* ... unchanged ... */
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
    
    const handleCloseCreateStory = () => { /* ... unchanged ... */
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

        // NOTE: We keep setting this state for UI preview logic, even if backend infers.
        setCurrentMediaType(fileType); 

        const objectUrl = URL.createObjectURL(file);
        setStoryPreview(objectUrl);
    };
    
    // Handle Story Creation (Finalized error check)
    const handleCreateStory = async () => {
        const userId = localStorage.getItem('userId');
        
        // 1. Pre-flight checks 
        if (!storyFile || !currentUser || !userId) {
            alert("Authentication Error or missing media file. Please log in or reselect the file.");
            setIsUploading(false);
            return;
        }
        
        setIsUploading(true);
        setUploadProgress(0);
        let uploadedMediaUrl = null;
        
        try {
            // 2. Upload file to Firebase Storage
            uploadedMediaUrl = await uploadMediaToFirebase(
                storyFile, 
                'stories', 
                setUploadProgress
            ); 
            
            if (!uploadedMediaUrl) {
                throw new Error("Firebase upload failed or returned an empty URL.");
            }

            // 3. Post story metadata to the backend
            // **We now send the mediaType as well, but the backend is robust enough to handle it.**
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

            // 4. Success handling
            if (response.status !== 201) {
                 throw new Error(`Server status ${response.status}: ${response.data?.message || 'Unknown error from server.'}`);
            }

            setUploadProgress(100);
            await fetchData(); 
            
            setTimeout(() => {
                handleCloseCreateStory();
                if (stories.length > 0) {
                    handleViewStory(0);
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
    
    // --- Utility Functions (omitted for brevity) ---
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
        return userStories.stories && userStories.stories.some(story => !story.viewed);
    };
    
    // --- Rendering Logic (omitted for brevity, assumed unchanged) ---
    const renderStoryItems = () => {
        if (loading) {
            return Array(4).fill().map((_, index) => (
                <div className="stories-loading" key={`loading-${index}`}>
                    <div className="story-avatar-skeleton"></div>
                    <div className="story-username-skeleton"></div>
                </div>
            ));
        }
        
        const currentUserStories = stories.find(s => s.userId === currentUser?._id);

        return (
            <>
                {/* Your Story Button (Always first) */}
                {currentUser && (
                    <div className="story-item create-story" onClick={handleOpenCreateStory}>
                        <div className="story-avatar-border create">
                            <div className="story-avatar-container">
                                <img 
                                    src={currentUser.profileImageUrl || currentUser.avatar || DEFAULT_AVATAR}
                                    alt="Your Story"
                                    className="story-avatar"
                                    onError={(e) => { e.target.src = DEFAULT_AVATAR }}
                                />
                                <div className="story-plus-icon">
                                    <Plus size={14} color="white" />
                                </div>
                            </div>
                        </div>
                        <span className="story-username">Your Story</span>
                    </div>
                )}
                
                {/* Render other users' stories (filtered by backend sorting) */}
                {stories
                    .filter(userStory => userStory.userId !== (currentUser?._id || '')) 
                    .map((userStory, index) => (
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

    const currentStory = viewingStory?.stories[activeStoryIndex];

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
                            <button className="story-close-btn" onClick={handleCloseStory}>
                                <X size={24} color="white" />
                            </button>
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
                            <div className="story-upload-placeholder">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept="image/*, video/*" 
                                    style={{ display: 'none' }} 
                                />
                                {!storyFile ? (
                                    <button className="upload-btn" onClick={handleFileSelect}>
                                        <Upload size={48} color="#0095f6" />
                                        <span>Upload photo or video</span>
                                    </button>
                                ) : (
                                    <>
                                        <div className="story-preview">
                                            {currentMediaType === 'video' ? (
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

export default StoriesPage;