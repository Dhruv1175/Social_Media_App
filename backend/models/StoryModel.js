import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
    // Reference to the User who created the story
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming your User model is named 'User'
        required: true,
    },
    // URL for the image or video file
    mediaUrl: {
        type: String,
        required: true,
    },
    // Type of media: 'image' or 'video'
    mediaType: {
        type: String,
        enum: ['image', 'video'],
        required:false ,
    },
    caption: {
        type: String,
        maxlength: 2200, // Max length for Instagram stories text is generous
        default: '',
    },
    // Array of user IDs who have viewed this specific story
    views: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    // Array of user IDs who have liked this specific story (optional feature)
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    // Timestamp for when the story was created
    createdAt: {
        type: Date,
        default: Date.now,
        // **TTL Index:** Stories will automatically be deleted 24 hours (86400 seconds) after creation
        expires: 60 * 60 * 24, // 86400 seconds
    },
}, { 
    timestamps: true 
});

const Story = mongoose.model('Story', storySchema);

export default Story;