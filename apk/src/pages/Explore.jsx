import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import '../styles/Explore.css';
import { useInView } from 'react-intersection-observer';
import { 
    Heart, MessageCircle, Bookmark, MoreVertical, Globe, 
    Users, TrendingUp, Play, Pause, Volume2, VolumeX, 
    Search, Video, Image, Send, Smile, User, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const Explore = () => {
    const [posts, setPosts] = useState([]);
    const [reels, setReels] = useState([]);
    const [page, setPage] = useState({ posts: 1, reels: 1 });
    const [loading, setLoading] = useState({ posts: false, reels: false });
    const [hasMore, setHasMore] = useState({ posts: true, reels: true });
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [activeTab, setActiveTab] = useState('all');
    const [playingVideo, setPlayingVideo] = useState(null);
    const [mutedVideos, setMutedVideos] = useState({});
    const [showComments, setShowComments] = useState({});
    const [postComments, setPostComments] = useState({});
    const [newCommentText, setNewCommentText] = useState({});
    const [commentUsers, setCommentUsers] = useState({});
    const [isLoadingComments, setIsLoadingComments] = useState({});
    const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const videoRefs = useRef({});
    const commentsRef = useRef({});
    const observerRefs = useRef({});
    
    const { ref: postsRef, inView: postsInView } = useInView();
    const { ref: reelsRef, inView: reelsInView } = useInView();
    
    const [user, setUser] = useState(null);

    // Real-time refresh interval (5 seconds)
    const REAL_TIME_INTERVAL = 5000;

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userId = localStorage.getItem('userId');
                const token = localStorage.getItem('accessToken');
                
                if (!userId || !token) return;
                
                const response = await axios.get(
                    `http://localhost:30801/user/profile/${userId}`,
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
    }, []);

    // Real-time data refresh effect
    useEffect(() => {
        const refreshData = async () => {
            if (isRefreshing) return;
            
            try {
                setIsRefreshing(true);
                const token = localStorage.getItem('accessToken');
                
                // Only refresh if there's new content
                const response = await axios.get('http://localhost:30801/user/posts/get', {
                    params: { 
                        page: 1, 
                        limit: 1,
                        timestamp: lastUpdateTime,
                        postType: 'post'
                    },
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (response.data.newContent) {
                    // If new content detected, refresh the current tab
                    if (activeTab === 'posts' || activeTab === 'all') {
                        await fetchContent(1, 'posts', true);
                    }
                    if (activeTab === 'reels' || activeTab === 'all') {
                        await fetchContent(1, 'reels', true);
                    }
                    setLastUpdateTime(Date.now());
                }
            } catch (error) {
                console.error('Error refreshing data:', error);
            } finally {
                setIsRefreshing(false);
            }
        };

        const interval = setInterval(refreshData, REAL_TIME_INTERVAL);
        return () => clearInterval(interval);
    }, [activeTab, lastUpdateTime, isRefreshing]);

    const fetchCommentUser = async (userId) => {
        if (!userId) return null;
        
        if (commentUsers[userId]) {
            return commentUsers[userId];
        }
        
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(
                `http://localhost:30801/user/profile/${userId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success && response.data.exist) {
                const userData = {
                    _id: response.data.exist._id,
                    name: response.data.exist.name || 'User',
                    avatar: response.data.exist.avatar || null,
                    username: response.data.exist.username || response.data.exist.name || 'User'
                };
                
                setCommentUsers(prev => ({
                    ...prev,
                    [userId]: userData
                }));
                
                return userData;
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
        return null;
    };

    const fetchComments = async (postId) => {
        if (isLoadingComments[postId]) return;
        
        setIsLoadingComments(prev => ({ ...prev, [postId]: true }));
        
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(
                `http://localhost:30801/user/post/userpost/${postId}/comment/get`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success && response.data.comdata) {
                const userIds = new Set();
                response.data.comdata.forEach(comment => {
                    if (comment.user) {
                        userIds.add(comment.user);
                    }
                });
                
                const userFetchPromises = Array.from(userIds).map(userId => 
                    fetchCommentUser(userId)
                );
                
                await Promise.all(userFetchPromises);
                
                const processedComments = await Promise.all(
                    response.data.comdata.map(async (comment) => {
                        let userData = null;
                        const userId = comment.user;
                        
                        if (userId && commentUsers[userId]) {
                            userData = commentUsers[userId];
                        } else if (userId) {
                            userData = await fetchCommentUser(userId);
                        }
                        
                        return {
                            ...comment,
                            user: userData || { 
                                _id: userId || 'unknown', 
                                name: 'User', 
                                username: 'user',
                                avatar: null 
                            },
                            createdAt: comment.createdAt || comment.date || new Date().toISOString(),
                            likes: comment.likes || [],
                            isLiked: comment.likes?.includes(user?._id) || false
                        };
                    })
                );
                
                setPostComments(prev => ({
                    ...prev,
                    [postId]: processedComments
                }));
            }
        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setIsLoadingComments(prev => ({ ...prev, [postId]: false }));
        }
    };

    const toggleComments = async (postId, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const newShowState = !showComments[postId];
        setShowComments(prev => ({
            ...prev,
            [postId]: newShowState
        }));

        if (newShowState && !postComments[postId]) {
            await fetchComments(postId);
        }
    };

    const postComment = async (postId, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const commentText = newCommentText[postId]?.trim();
        if (!commentText || !user?._id) return;

        try {
            const token = localStorage.getItem('accessToken');
            await axios.post(
                `http://localhost:30801/user/${user._id}/post/userpost/${postId}/comment/add`,
                { text: commentText },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setNewCommentText(prev => ({ ...prev, [postId]: '' }));
            await fetchComments(postId);
        } catch (error) {
            console.error('Error posting comment:', error);
        }
    };

    const fetchContent = useCallback(async (pageNum, type = 'posts', reset = false) => {
        try {
            setLoading(prev => ({ ...prev, [type]: true }));
            const token = localStorage.getItem('accessToken');
            
            const params = { 
                page: pageNum, 
                limit: 12,
                postType: type === 'reels' ? 'reel' : 'post'
            };
            
            // Apply category filter if not 'all'
            if (selectedCategory !== 'all') {
                params.category = selectedCategory;
            }
            
            // Add timestamp for real-time updates
            if (!reset) {
                params.timestamp = lastUpdateTime;
            }

            const response = await axios.get('http://localhost:30801/user/posts/get', {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.posts) {
                const content = response.data.posts || [];
                
                if (type === 'posts') {
                    if (reset || pageNum === 1) {
                        setPosts(content);
                    } else {
                        setPosts(prev => [...prev, ...content]);
                    }
                    setHasMore(prev => ({ ...prev, posts: content.length === 12 }));
                } else if (type === 'reels') {
                    if (reset || pageNum === 1) {
                        setReels(content);
                    } else {
                        setReels(prev => [...prev, ...content]);
                    }
                    setHasMore(prev => ({ ...prev, reels: content.length === 12 }));
                }
            }
        } catch (error) {
            console.error('Error fetching content:', error);
        } finally {
            setLoading(prev => ({ ...prev, [type]: false }));
        }
    }, [selectedCategory, lastUpdateTime]);

    useEffect(() => {
        fetchContent(1, 'posts', true);
        fetchContent(1, 'reels', true);
        setPage({ posts: 1, reels: 1 });
    }, [selectedCategory, fetchContent]);

    useEffect(() => {
        if (postsInView && hasMore.posts && !loading.posts && (activeTab === 'all' || activeTab === 'posts')) {
            const nextPage = page.posts + 1;
            fetchContent(nextPage, 'posts');
            setPage(prev => ({ ...prev, posts: nextPage }));
        }
    }, [postsInView, hasMore.posts, loading.posts, page.posts, fetchContent, activeTab]);

    useEffect(() => {
        if (reelsInView && hasMore.reels && !loading.reels && (activeTab === 'all' || activeTab === 'reels')) {
            const nextPage = page.reels + 1;
            fetchContent(nextPage, 'reels');
            setPage(prev => ({ ...prev, reels: nextPage }));
        }
    }, [reelsInView, hasMore.reels, loading.reels, page.reels, fetchContent, activeTab]);

    const handleLike = async (postId, type = 'posts') => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = user?._id || localStorage.getItem('userId');
            
            const response = await axios.post(
                `http://localhost:30801/user/${userId}/post/userpost/${postId}/like`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                if (type === 'posts') {
                    setPosts(prev => prev.map(post => 
                        post._id === postId 
                            ? { 
                                ...post, 
                                isLiked: response.data.isLiked, 
                                likes: response.data.likes,
                                likesCount: response.data.likes?.length || 0
                            } 
                            : post
                    ));
                } else {
                    setReels(prev => prev.map(reel => 
                        reel._id === postId 
                            ? { 
                                ...reel, 
                                isLiked: response.data.isLiked, 
                                likes: response.data.likes,
                                likesCount: response.data.likes?.length || 0
                            } 
                            : reel
                    ));
                }
            }
        } catch (error) {
            console.error('Error liking post:', error);
        }
    };

    const handleSave = async (postId, type = 'posts') => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = user?._id || localStorage.getItem('userId');
            
            const response = await axios.post(
                `http://localhost:30801/user/post/${userId}/${postId}/save`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                if (type === 'posts') {
                    setPosts(prev => prev.map(post => 
                        post._id === postId 
                            ? { ...post, isSaved: response.data.isSaved }
                            : post
                    ));
                } else {
                    setReels(prev => prev.map(reel => 
                        reel._id === postId 
                            ? { ...reel, isSaved: response.data.isSaved }
                            : reel
                    ));
                }
            }
        } catch (error) {
            console.error('Error saving post:', error);
        }
    };

    const toggleVideoPlay = (postId) => {
        const videoElement = videoRefs.current[postId];
        if (!videoElement) return;

        if (playingVideo === postId) {
            videoElement.pause();
            setPlayingVideo(null);
        } else {
            // Pause any currently playing video
            if (playingVideo && videoRefs.current[playingVideo]) {
                videoRefs.current[playingVideo].pause();
            }
            
            videoElement.play();
            setPlayingVideo(postId);
        }
    };

    const toggleVideoMute = (postId, e) => {
        e.stopPropagation();
        setMutedVideos(prev => ({
            ...prev,
            [postId]: !prev[postId]
        }));
    };

    const handleVideoClick = (postId) => {
        toggleVideoPlay(postId);
    };

    const handleVideoEnded = (postId) => {
        setPlayingVideo(null);
    };

    const categories = [
        { id: 'all', label: 'For You', icon: <Globe size={16} /> },
        { id: 'fashion', label: 'Fashion', icon: <Users size={16} /> },
        { id: 'travel', label: 'Travel', icon: <TrendingUp size={16} /> },
        { id: 'food', label: 'Food' },
        { id: 'art', label: 'Art' },
        { id: 'fitness', label: 'Fitness' },
    ];

    const trendingTags = [
        '#fashion', '#photography', '#art', '#travel', '#food', '#fitness', '#nature', '#music'
    ];

    const handleManualRefresh = () => {
        fetchContent(1, 'posts', true);
        fetchContent(1, 'reels', true);
        setPage({ posts: 1, reels: 1 });
        setLastUpdateTime(Date.now());
    };

    const renderCommentsSection = (postId, postType) => {
        const comments = postComments[postId] || [];
        const currentCommentText = newCommentText[postId] || '';
        
        return (
            <div className="explore-comments-section">
                <div className="explore-comments-header">
                    <h4>Comments ({comments.length})</h4>
                    <button 
                        className="close-comments-btn"
                        onClick={(e) => toggleComments(postId, e)}
                    >
                        ✕
                    </button>
                </div>
                
                <div 
                    className="explore-comments-list"
                    ref={el => commentsRef.current[postId] = el}
                >
                    {isLoadingComments[postId] ? (
                        <div className="loading-comments">
                            <div className="spinner"></div>
                            <span>Loading comments...</span>
                        </div>
                    ) : comments.length > 0 ? (
                        comments.map(comment => (
                            <div key={comment._id} className="explore-comment-item">
                                <div className="explore-comment-avatar">
                                    {comment.user?.avatar ? (
                                        <img src={comment.user.avatar} alt={comment.user.name} />
                                    ) : (
                                        <div className="avatar-fallback">
                                            <User size={14} />
                                        </div>
                                    )}
                                </div>
                                <div className="explore-comment-content">
                                    <div className="explore-comment-user">
                                        <span className="explore-comment-username">
                                            {comment.user?.name}
                                        </span>
                                        <span className="explore-comment-text">
                                            {comment.text}
                                        </span>
                                    </div>
                                    <div className="explore-comment-actions">
                                        <button 
                                            className={`explore-comment-like ${comment.isLiked ? 'liked' : ''}`}
                                            onClick={() => {
                                                // Handle comment like
                                            }}
                                        >
                                            <Heart size={12} />
                                            <span>{comment.likes?.length || 0}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-comments">
                            <p>No comments yet. Be the first!</p>
                        </div>
                    )}
                </div>
                
                <div className="explore-comment-input">
                    <input
                        type="text"
                        placeholder="Add a comment..."
                        value={currentCommentText}
                        onChange={(e) => setNewCommentText(prev => ({
                            ...prev,
                            [postId]: e.target.value
                        }))}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                postComment(postId, e);
                            }
                        }}
                    />
                    <button 
                        className="explore-comment-send"
                        onClick={(e) => postComment(postId, e)}
                        disabled={!currentCommentText.trim()}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        );
    };

    const renderPostCard = (post, type = 'posts') => (
        <div 
            key={post._id} 
            className="explore-card"
            style={{ animationDelay: `${Math.random() * 0.5}s` }}
        >
            <div className="card-media-container">
                {post.postType === 'reel' && (
                    <div className="reel-badge">
                        <Video size={12} />
                        <span>REEL</span>
                    </div>
                )}
                
                {post.image ? (
                    <img 
                        src={post.image} 
                        alt="Post" 
                        loading="lazy" 
                        className="media-content"
                    />
                ) : post.video ? (
                    <div 
                        className="video-container"
                        onClick={() => handleVideoClick(post._id)}
                    >
                        <video
                            ref={el => videoRefs.current[post._id] = el}
                            src={post.video}
                            muted={mutedVideos[post._id]}
                            loop
                            playsInline
                            onEnded={() => handleVideoEnded(post._id)}
                            className="media-content"
                        />
                        
                        <div className="video-controls-overlay">
                            <button 
                                className="video-play-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleVideoClick(post._id);
                                }}
                            >
                                {playingVideo === post._id ? (
                                    <Pause size={24} />
                                ) : (
                                    <Play size={24} />
                                )}
                            </button>
                            
                            <button 
                                className="video-mute-btn"
                                onClick={(e) => toggleVideoMute(post._id, e)}
                            >
                                {mutedVideos[post._id] ? (
                                    <VolumeX size={18} />
                                ) : (
                                    <Volume2 size={18} />
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="no-media">
                        <Image size={32} />
                        <span>No media</span>
                    </div>
                )}
                
                <div className="stats-overlay">
                    <div className="stats-content">
                        <button 
                            className="stat-item"
                            onClick={() => handleLike(post._id, type)}
                        >
                            <Heart className={post.isLiked ? 'liked' : ''} size={20} />
                            <span>{post.likesCount || post.likes?.length || 0}</span>
                        </button>
                        <button 
                            className="stat-item"
                            onClick={(e) => toggleComments(post._id, e)}
                        >
                            <MessageCircle size={20} />
                            <span>{post.commentsCount || 0}</span>
                        </button>
                        <button 
                            className="stat-item save-btn"
                            onClick={() => handleSave(post._id, type)}
                        >
                            <Bookmark className={post.isSaved ? 'saved' : ''} size={20} />
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="card-info">
                <Link to={`/profile/${post.user?._id}`} className="user-info">
                    {post.user?.avatar && (
                        <img 
                            src={post.user.avatar} 
                            alt={post.user.name} 
                            className="user-avatar" 
                        />
                    )}
                    <div className="user-details">
                        <span className="username">{post.user?.name}</span>
                        {post.location && (
                            <span className="location">{post.location}</span>
                        )}
                    </div>
                </Link>
                {post.text && (
                    <p className="caption">{post.text.substring(0, 80)}...</p>
                )}
            </div>
            
            {showComments[post._id] && renderCommentsSection(post._id, type)}
        </div>
    );

    return (
        <div className="explore-page">
            <Sidebar user={user} />
            
            <main className="explore-main-content">
                <div className="explore-header">
                    <h1>Explore</h1>
                    <div className="explore-header-actions">
                        <div className="search-bar">
                            <input 
                                type="text" 
                                placeholder="Search for posts, tags, or people..." 
                            />
                            <Search size={20} />
                        </div>
                        <button 
                            className="refresh-btn"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                <div className="trending-tags-section">
                    <h3>Trending Now</h3>
                    <div className="trending-tags">
                        {trendingTags.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                        ))}
                    </div>
                </div>

                <div className="category-filters-section">
                    <h3>Categories</h3>
                    <div className="category-filters">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(category.id)}
                            >
                                {category.icon}
                                <span>{category.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="content-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Content
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('posts')}
                    >
                        <Image size={16} />
                        Posts
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'reels' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reels')}
                    >
                        <Video size={16} />
                        Reels
                    </button>
                </div>

                {/* Reels Section with Instagram-like Infinite Scroll */}
                {(activeTab === 'all' || activeTab === 'reels') && (
                    <div className="reels-infinite-section">
                        <h3>{activeTab === 'all' ? 'Popular Reels' : 'All Reels'}</h3>
                        <div className="reels-infinite-container">
                            {reels.map((reel, index) => {
                                // Create a new observer for each reel
                                if (!observerRefs.current[reel._id]) {
                                    observerRefs.current[reel._id] = React.createRef();
                                }
                                
                                return (
                                    <div 
                                        key={reel._id} 
                                        ref={observerRefs.current[reel._id]}
                                        className="reel-item"
                                    >
                                        {renderPostCard(reel, 'reels')}
                                        {index === reels.length - 1 && hasMore.reels && !loading.reels && (
                                            <div ref={reelsRef} className="reel-scroll-trigger"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {loading.reels && (
                            <div className="loading-indicator">
                                <div className="spinner"></div>
                                <span>Loading more reels...</span>
                            </div>
                        )}

                        {!hasMore.reels && reels.length > 0 && (
                            <div className="no-more-content">
                                <p>You've seen all reels for now! Check back later for more.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Posts Section */}
                {(activeTab === 'all' || activeTab === 'posts') && (
                    <div className="posts-grid-section">
                        <h3>{activeTab === 'posts' ? 'Posts' : 'Recommended Posts'}</h3>
                        <div className="explore-grid">
                            {posts.map(post => renderPostCard(post, 'posts'))}
                        </div>
                        
                        {loading.posts && (
                            <div className="loading-indicator">
                                <div className="spinner"></div>
                                <span>Loading more posts...</span>
                            </div>
                        )}

                        {hasMore.posts && !loading.posts && (
                            <div ref={postsRef} className="scroll-trigger"></div>
                        )}

                        {!hasMore.posts && posts.length > 0 && (
                            <div className="no-more-content">
                                <p>You've seen all posts for now! Check back later for more.</p>
                            </div>
                        )}
                    </div>
                )}

                {posts.length === 0 && reels.length === 0 && !loading.posts && !loading.reels && (
                    <div className="no-content">
                        <div className="no-content-icon">
                            <Globe size={64} />
                        </div>
                        <h3>No content to explore</h3>
                        <p>Follow more users to see their posts and reels here</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Explore;