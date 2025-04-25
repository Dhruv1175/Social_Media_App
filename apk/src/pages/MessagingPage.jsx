import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import { Send, User, ArrowLeft, ExternalLink } from 'lucide-react';
import '../styles/MessagingPage.css';

const MessagingPage = () => {
  const location = useLocation();
  const initialContact = location.state?.selectedContact || null;
  
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(initialContact);
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
    const newSocket = io('http://localhost:30801');
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
      console.log('Received message via socket:', data);
      
      // Only add the message if it's from the currently selected contact
      if (selectedContact && (data.sender === selectedContact._id || data.senderId === selectedContact._id)) {
        setMessages((prevMessages) => {
          // Check if this message is already in the list to avoid duplicates
          const isDuplicate = prevMessages.some(
            msg => msg._id === data._id || 
                  (msg.content === data.content && 
                   msg.sender === data.sender && 
                   new Date(msg.timestamp).getTime() === new Date(data.timestamp).getTime())
          );
          
          if (isDuplicate) {
            return prevMessages;
          }
          
          // Add the new message
          return [...prevMessages, data];
        });
      } else {
        // If message is from someone else, we could show a notification
        console.log('New message from non-active contact:', data);
        // Implement notification here if needed
      }
    });

    socket.on('typing_indicator', (data) => {
      if (selectedContact && (data.senderId === selectedContact._id)) {
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
          `http://localhost:30801/user/profile/${userId}`,
          { headers }
        );

        setUser(userResponse.data.exist);

        // Fetch contacts with message history
        const messageContactsResponse = await axios.get(
          `http://localhost:30801/user/${userId}/messages/contacts`,
          { headers }
        );

        if (messageContactsResponse.data && messageContactsResponse.data.success) {
          console.log("Message contacts:", messageContactsResponse.data.users);
          const messageContacts = messageContactsResponse.data.users || [];
          
          // Fetch user's followers and following to add potential contacts who haven't messaged yet
          const followersResponse = await axios.get(
            `http://localhost:30801/user/${userId}/followers`,
            { headers }
          );

          const followingResponse = await axios.get(
            `http://localhost:30801/user/${userId}/following`,
            { headers }
          );

          // Combine followers and following to create contacts list
          const followers = followersResponse.data.followersList || [];
          const following = followingResponse.data.followingsList || [];

          // Create a map of contacts with message history for quick lookup
          const messageContactsMap = new Map(
            messageContacts.map(contact => [contact._id, contact])
          );

          // Add followers and following who aren't in message contacts
          followers.forEach(follower => {
            if (follower.follower && !messageContactsMap.has(follower.follower._id)) {
              messageContacts.push({
                ...follower.follower,
                hasMessaged: false
              });
            }
          });
          
          following.forEach(follow => {
            if (follow.following && !messageContactsMap.has(follow.following._id)) {
              messageContacts.push({
                ...follow.following,
                hasMessaged: false
              });
            }
          });

          // Ensure contacts have hasMessaged property
          const enhancedContacts = messageContacts.map(contact => ({
            ...contact,
            hasMessaged: !!contact.lastMessage
          }));

          setContacts(enhancedContacts);
        } else {
          // Fallback to only followers/following if message contacts fails
          const followersResponse = await axios.get(
            `http://localhost:30801/user/${userId}/followers`,
            { headers }
          );

          const followingResponse = await axios.get(
            `http://localhost:30801/user/${userId}/following`,
            { headers }
          );

          // Combine followers and following to create contacts list
          const followers = followersResponse.data.followersList || [];
          const following = followingResponse.data.followingsList || [];

          // Create a unique list of contacts
          const uniqueContacts = {};
          
          followers.forEach(follower => {
            if (follower.follower) {
              uniqueContacts[follower.follower._id] = {
                ...follower.follower,
                hasMessaged: false
              };
            }
          });
          
          following.forEach(follow => {
            if (follow.following) {
              uniqueContacts[follow.following._id] = {
                ...follow.following,
                hasMessaged: false
              };
            }
          });
          
          const contactsList = Object.values(uniqueContacts);
          setContacts(contactsList);
        }

        // If we have an initial contact from navigation state, make sure it's selected
        if (initialContact) {
          setSelectedContact(initialContact);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, initialContact]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch messages when selecting a contact
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedContact) return;

      try {
        setLoading(true);
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');

        if (!userId || !token) {
          navigate('/');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        console.log(`Fetching messages between ${userId} and ${selectedContact._id}`);

        // Fetch messages between current user and selected contact
        const response = await axios.get(
          `http://localhost:30801/user/${userId}/${selectedContact._id}/message/get`,
          { headers }
        );

        console.log('API response:', response.data);

        if (response.data && response.data.messagedetails) {
          const fetchedMessages = response.data.messagedetails;
          console.log(`Loaded ${fetchedMessages.length} messages:`, fetchedMessages);
          
          // Format messages to ensure proper display
          const formattedMessages = fetchedMessages.map(message => ({
            _id: message._id,
            sender: message.sender,
            receiver: message.receiver,
            content: message.content,
            timestamp: message.timestamp
          }));
          
          setMessages(formattedMessages);
        } else {
          console.warn('No messages found or unexpected response format:', response.data);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error fetching messages:', error.response || error);
        // Show an error message to the user
        alert('Could not load messages. Please try again later.');
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedContact) {
      fetchMessages();
    }
  }, [selectedContact, navigate]);

  const handleContactSelect = (contact) => {
    // Clear current messages to avoid showing previous conversation
    setMessages([]);
    setIsTyping(false);
    setSelectedContact(contact);
    
    // Focus on input field after selecting a contact
    setTimeout(() => {
      document.querySelector('.message-input-form input')?.focus();
    }, 100);
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
    
    if (!newMessage.trim() || !selectedContact) return;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    
    if (!userId || !token) return;

    try {
      // Temporary optimistic message ID for easy replacement
      const tempId = `temp-${Date.now()}`;
      
      // Create optimistic message object
      const optimisticMessage = {
        _id: tempId,
        sender: userId,
        receiver: selectedContact._id,
        content: newMessage,
        timestamp: new Date(),
        isOptimistic: true // Flag to identify optimistic messages
      };

      // Optimistically update UI
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);

      // Clear input field
      setNewMessage('');

      // Send message via HTTP request to ensure persistence
      const response = await axios.post(
        `http://localhost:30801/user/${userId}/receiver/${selectedContact._id}/message/send`,
        { content: newMessage },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('Message send response:', response.data);

      // Replace the optimistic message with the actual saved message
      if (response.data.success && response.data.messageDetails) {
        const savedMessage = response.data.messageDetails;
        
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            // If this is our optimistic message, replace it with the real one
            msg._id === tempId ? {
              _id: savedMessage._id,
              sender: savedMessage.sender,
              receiver: savedMessage.receiver,
              content: savedMessage.content,
              timestamp: savedMessage.timestamp
            } : msg
          )
        );
      }

      // Only emit via socket if we have an active connection
      if (socket) {
        // Send message via socket for real-time delivery
        socket.emit('send_message', {
          senderId: userId,
          receiverId: selectedContact._id,
          content: newMessage,
          _id: response.data.messageDetails?._id // Include the actual message ID
        });

        // Stop typing indicator
        socket.emit('typing', {
          senderId: userId,
          receiverId: selectedContact._id,
          isTyping: false
        });
      }
    } catch (error) {
      console.error('Error sending message:', error.response || error);
      // Remove the optimistic message
      setMessages(prevMessages => prevMessages.filter(msg => !msg.isOptimistic));
      // Notify user of error
      alert('Failed to send message. Please try again.');
    }
  };

  // Format time as relative (e.g., "2h ago")
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    // Less than a minute
    if (seconds < 60) {
      return 'now';
    }
    
    // Less than an hour
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    
    // Less than a day
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    
    // Less than a week
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days}d ago`;
    }
    
    // Format as date
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  // Function to navigate to user profile
  const navigateToProfile = () => {
    if (selectedContact && selectedContact._id) {
      navigate(`/profile/${selectedContact._id}`);
    }
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
              // Group and sort contacts: messaged contacts first, sorted by most recent
              [...contacts]
                .sort((a, b) => {
                  // First criteria: contacts with messages come before those without
                  if (a.hasMessaged && !b.hasMessaged) return -1;
                  if (!a.hasMessaged && b.hasMessaged) return 1;
                  
                  // Second criteria: sort by most recent message
                  if (a.lastMessage && b.lastMessage) {
                    return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
                  }
                  
                  // If neither has messages, sort by name
                  return (a.name || '').localeCompare(b.name || '');
                })
                .map((contact) => (
                <div
                  key={contact._id}
                  className={`contact-item ${selectedContact && selectedContact._id === contact._id ? 'active' : ''} ${contact.hasMessaged ? 'has-messages' : ''}`}
                  onClick={() => handleContactSelect(contact)}
                >
                  <div className="contact-avatar">
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} />
                    ) : (
                      <User size={28} />
                    )}
                  </div>
                  <div className="contact-info">
                    <h3>{contact.name}</h3>
                    {contact.lastMessage && (
                      <div className="contact-last-message">
                        <span className={`message-preview ${contact.lastMessage.isFromUser ? 'sent' : 'received'}`}>
                          {contact.lastMessage.isFromUser ? 'You: ' : ''}
                          {contact.lastMessage.content.length > 25 
                            ? `${contact.lastMessage.content.substring(0, 25)}...` 
                            : contact.lastMessage.content}
                        </span>
                        <span className="message-time">
                          {formatTimeAgo(contact.lastMessage.timestamp)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-contacts">
                <p>No contacts available</p>
                <span>Follow users to start messaging them</span>
              </div>
            )}
          </div>
        </div>

        {selectedContact ? (
          <div className="chat-container">
            <div className="chat-header">
              <div 
                className="contact-info"
                onClick={navigateToProfile}
              >
                <div className="contact-avatar">
                  {selectedContact.avatar ? (
                    <img src={selectedContact.avatar} alt={selectedContact.name} />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <h3>{selectedContact.name}</h3>
              </div>
            </div>
            <div className="messages-container">
              {messages.length > 0 ? (
                messages.map((message, index) => {
                  const userId = localStorage.getItem('userId');
                  const isSent = message.sender === userId;
                  return (
                    <div
                      key={index}
                      className={`message ${isSent ? 'sent' : 'received'}`}
                    >
                      <div className="message-content">{message.content}</div>
                      <div className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-messages">
                  <p>No messages yet. Say hello!</p>
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
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleInputChange}
              />
              <button type="submit">
                <Send size={24} />
              </button>
            </form>
          </div>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <h3>Select a conversation</h3>
              <p>Choose a person from your contacts to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagingPage; 