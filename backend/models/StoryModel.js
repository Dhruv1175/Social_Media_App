// models/StoryModel.js
import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
    // Reference to the User who created the story
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true,
    },
    // URL for the image or video file
    mediaUrl: {
        type: String,
        required: true, // MUST remain required since a story must have media
    },
    // Type of media: 'image' or 'video'
    mediaType: {
        type: String,
        enum: ['image', 'video'],
        required: false, // <-- CRITICAL FIX
    },
    caption: {
        type: String,
        maxlength: 2200, 
        default: '',
    },
    views: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24, 
    },
}, { 
    timestamps: true 
});

const Story = mongoose.model('Story', storySchema);

export default Story;