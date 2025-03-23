import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import { Send, User, ArrowLeft } from 'lucide-react';
import '../styles/MessagingPage.css';

const MessagingPage = () => {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  // Connect to socket.io server
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      navigate('/');
      return;
    }

    // Connect to socket.io server
    const newSocket = io('http://localhost:3080');
    setSocket(newSocket);

    // Clean up on component unmount
    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [navigate]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // Join personal room
    socket.emit('join_room', userId);

    // Event listeners
    socket.on('receive_message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    socket.on('typing_indicator', (data) => {
      if (selectedContact && data.senderId === selectedContact._id) {
        setIsTyping(data.isTyping);
      }
    });

    // Clean up event listeners
    return () => {
      socket.off('receive_message');
      socket.off('typing_indicator');
    };
  }, [socket, selectedContact]);

  // Fetch user data and contacts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');

        if (!userId || !token) {
          navigate('/');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch user profile
        const userResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers }
        );

        // Fetch user's followers and following to get contacts
        const followersResponse = await axios.get(
          `http://localhost:3080/user/${userId}/followers`,
          { headers }
        );

        const followingResponse = await axios.get(
          `http://localhost:3080/user/${userId}/following`,
          { headers }
        );

        setUser(userResponse.data.exist);

        // Combine followers and following to create contacts list
        const followers = followersResponse.data.followersList || [];
        const following = followingResponse.data.followingsList || [];

        // Create a unique list of contacts
        const uniqueContacts = {};
        
        followers.forEach(follower => {
          if (follower.follower) {
            uniqueContacts[follower.follower._id] = follower.follower;
          }
        });
        
        following.forEach(follow => {
          if (follow.following) {
            uniqueContacts[follow.following._id] = follow.following;
          }
        });
        
        setContacts(Object.values(uniqueContacts));
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch messages when selecting a contact
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedContact) return;

      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch messages between current user and selected contact
        const response = await axios.get(
          `http://localhost:3080/user/${userId}/${selectedContact._id}/message/get`,
          { headers }
        );

        setMessages(response.data.messagedetails || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedContact]);

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    setIsTyping(false);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (!socket || !selectedContact) return;

    // Clear previous timeout
    if (typingTimeout) clearTimeout(typingTimeout);

    // Send typing indicator
    socket.emit('typing', {
      senderId: user?._id,
      receiverId: selectedContact._id,
      isTyping: true
    });

    // Set timeout to stop typing indicator
    const timeout = setTimeout(() => {
      socket.emit('typing', {
        senderId: user?._id,
        receiverId: selectedContact._id,
        isTyping: false
      });
    }, 2000);

    setTypingTimeout(timeout);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket || !selectedContact) return;

    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // Send message via socket
    socket.emit('send_message', {
      senderId: userId,
      receiverId: selectedContact._id,
      content: newMessage
    });

    // Optimistically update UI
    setMessages([
      ...messages,
      {
        sender: userId,
        receiver: selectedContact._id,
        content: newMessage,
        timestamp: new Date()
      }
    ]);

    // Clear input field
    setNewMessage('');

    // Stop typing indicator
    socket.emit('typing', {
      senderId: userId,
      receiverId: selectedContact._id,
      isTyping: false
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="messaging-page">
      <Sidebar user={user} />
      <div className="messaging-container">
        <div className="contacts-sidebar">
          <div className="contacts-header">
            <h2>Messages</h2>
          </div>
          <div className="contacts-list">
            {contacts.length > 0 ? (
              contacts.map((contact) => (
                <div
                  key={contact._id}
                  className={`contact-item ${selectedContact && selectedContact._id === contact._id ? 'active' : ''}`}
                  onClick={() => handleContactSelect(contact)}
                >
                  <div className="contact-avatar">
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div className="contact-info">
                    <h3>{contact.name}</h3>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-contacts">
                <p>No contacts yet. Follow users to message them.</p>
              </div>
            )}
          </div>
        </div>

        <div className="chat-container">
          {selectedContact ? (
            <>
              <div className="chat-header">
                <button 
                  className="back-button" 
                  onClick={() => setSelectedContact(null)}
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="contact-avatar">
                  {selectedContact.avatar ? (
                    <img src={selectedContact.avatar} alt={selectedContact.name} />
                  ) : (
                    <User size={24} />
                  )}
                </div>
                <h3>{selectedContact.name}</h3>
              </div>
              
              <div className="messages-container">
                {messages.length > 0 ? (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`message ${message.sender === user?._id ? 'sent' : 'received'}`}
                    >
                      <div className="message-content">{message.content}</div>
                      <div className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-messages">
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                )}
                {isTyping && (
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form className="message-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                />
                <button type="submit" disabled={!newMessage.trim()}>
                  <Send size={20} />
                </button>
              </form>
            </>
          ) : (
            <div className="select-conversation">
              <div className="select-conversation-content">
                <h2>Select a conversation</h2>
                <p>Choose a contact to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage; 