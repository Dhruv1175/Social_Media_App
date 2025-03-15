import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check } from 'lucide-react';

const Posts = ({ posts, user }) => {
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedPostText, setEditedPostText] = useState({});

  const toggleEditPost = (postId, currentText) => {
    if (editingPostId === postId) {
      console.log('Save post:', postId, editedPostText[postId]);
      setEditingPostId(null); // Exit edit mode
    } else {

      setEditingPostId(postId);
      setEditedPostText((prev) => ({ ...prev, [postId]: currentText }));
    }
  };

  const handleTextChange = (postId, text) => {
    setEditedPostText((prev) => ({ ...prev, [postId]: text }));
  };

  return (
    <div className="posts-grid">
      {posts?.length > 0 ? (
        posts.map((post) => (
          <div key={post._id} className="post-card">
            <div className="post-header">
              <img
                src={user?.avatar || 'default-avatar.png'}
                alt={user?.name || 'User'}
                className="post-user-avatar"
              />
              <div>
                <div className="post-user-name">{user?.name || 'User'}</div>
                <div className="post-date">{new Date(post.date).toLocaleString()}</div>
              </div>
              <button
                onClick={() => toggleEditPost(post._id, post.text)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {editingPostId === post._id ? <Check size={20} /> : <Edit size={20} />}
              </button>
            </div>
            {post.image && <img src={post.image} alt="Post" className="post-image" />}
            <div className="post-actions">
              <div className="post-icons">
                <Heart size={20} /> <MessageCircle size={20} /> <Share2 size={20} />
              </div>
              <Bookmark size={20} />
            </div>
            <div className="post-likes">{post.likes || 0} likes</div>
            <div className="post-text">
              {editingPostId === post._id ? (
                <textarea
                  value={editedPostText[post._id] || ''}
                  onChange={(e) => handleTextChange(post._id, e.target.value)}
                  style={{ width: '100%', padding: '5px', borderRadius: '5px' }}
                />
              ) : (
                <>
                  <span className="post-user-name">{user?.name || 'User'}</span> {post.text || ''}
                </>
              )}
            </div>
            <div className="post-comments">{post.comments?.length || 0} comments</div>
          </div>
        ))
      ) : (
        <p className="no-posts">No posts yet</p>
      )}
    </div>
  );
};

export default Posts;
