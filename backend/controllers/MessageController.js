import messagemodel from "../models/MessageModel.js";



export const sendMessage = async (req,res) => {
    try{
        const {userid, receiverid} = req.params;
        const {content} = req.body;
        
        console.log(`Creating message from user ${userid} to ${receiverid}: "${content}"`);
        
        const messagedetails = new messagemodel({
            sender: userid,
            receiver: receiverid,
            content: content
        });
        
        await messagedetails.save();
        
        console.log(`Message saved with ID: ${messagedetails._id}`);
        
        // Return the created message with its ID for client-side handling
        res.status(200).send({
            success: true,
            message: 'Message sent successfully',
            messageDetails: messagedetails
        });
    }
    catch(error){
        console.error('Error in sendMessage controller:', error);
        res.status(500).send({
            message: "Something Went Wrong", 
            success: false
        });
    }
}

export const getMessage = async (req,res) => {
    try{
        const {userid} = req.params;
        
        console.log(`Fetching all messages for user ${userid}`);
        
        // Fetch messages where user is receiver
        const messagesAsReceiver = await messagemodel
            .find({receiver: userid})
            .populate('sender', 'name avatar')
            .populate('receiver', 'name avatar');
            
        // Fetch messages where user is sender
        const messagesAsSender = await messagemodel
            .find({sender: userid})
            .populate('sender', 'name avatar')
            .populate('receiver', 'name avatar');
            
        // Combine all messages
        const allMessages = [...messagesAsReceiver, ...messagesAsSender]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest first
            
        console.log(`Found total of ${allMessages.length} messages for user ${userid}`);
        
        res.status(200).send({
            messagedetails: allMessages,
            success: true
        });
    }
    catch(error){
        console.error('Error in getMessage controller:', error);
        res.status(500).send({
            message: "Something Went Wrong",
            success: false
        });
    }
}

export const DirectMessage = async (req,res) => {
    try{
        const {userid, senderid} = req.params;
        
        console.log(`Fetching messages between users ${userid} and ${senderid}`);
        
        // Fetch messages where current user is receiver and other user is sender
        const incomingMessages = await messagemodel.find({
            receiver: userid,
            sender: senderid
        });
        
        console.log(`Found ${incomingMessages.length} incoming messages`);
        
        // Fetch messages where current user is sender and other user is receiver
        const outgoingMessages = await messagemodel.find({
            receiver: senderid,
            sender: userid
        });
        
        console.log(`Found ${outgoingMessages.length} outgoing messages`);
        
        // Combine and sort messages by timestamp
        const allMessages = [...incomingMessages, ...outgoingMessages]
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        console.log(`Total messages: ${allMessages.length}`);
        
        res.status(200).send({
            messagedetails: allMessages,
            success: true
        });
    }
    catch(error) {
        console.error('Error in DirectMessage controller:', error);
        res.status(500).send({
            message: "Something Went Wrong",
            success: false
        });
    }
}

export const getMessagedUsers = async (req, res) => {
    try {
        const { userid } = req.params;
        
        console.log(`Fetching all users who have exchanged messages with user ${userid}`);
        
        // Find all messages where the user is either sender or receiver
        const sentMessages = await messagemodel
            .find({ sender: userid })
            .distinct('receiver');
            
        const receivedMessages = await messagemodel
            .find({ receiver: userid })
            .distinct('sender');
            
        // Combine unique user IDs
        const uniqueUserIds = [...new Set([...sentMessages, ...receivedMessages])];
        
        console.log(`Found ${uniqueUserIds.length} users with message history`);
        
        // Populate user details for these IDs
        const populatedUsers = await messagemodel.model('User')
            .find({ _id: { $in: uniqueUserIds } })
            .select('_id name username email avatar');
            
        // For each user, get their most recent message
        const usersWithLastMessage = await Promise.all(populatedUsers.map(async (user) => {
            // Get the latest message between the current user and this user
            const latestMessage = await messagemodel
                .findOne({
                    $or: [
                        { sender: userid, receiver: user._id },
                        { sender: user._id, receiver: userid }
                    ]
                })
                .sort({ timestamp: -1 })
                .limit(1);
                
            return {
                ...user.toObject(),
                lastMessage: latestMessage ? {
                    content: latestMessage.content,
                    timestamp: latestMessage.timestamp,
                    isFromUser: latestMessage.sender.toString() === userid
                } : null
            };
        }));
        
        // Sort by the timestamp of the last message (most recent first)
        const sortedUsers = usersWithLastMessage.sort((a, b) => {
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
        });
        
        res.status(200).send({
            users: sortedUsers,
            success: true
        });
    }
    catch (error) {
        console.error('Error in getMessagedUsers controller:', error);
        res.status(500).send({
            message: "Something went wrong retrieving message contacts",
            success: false
        });
    }
}