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
        required: true,
    },
    // Type of media: 'image' or 'video'
    mediaType: {
        type: String,
        enum: ['image', 'video'],
        required: false,
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
    // REMOVE the expires field from here
    // Let the query handle the 24/48 hour logic
    createdAt: {
        type: Date,
        default: Date.now,
        // REMOVE: expires: 60 * 60 * 24, 
    },
}, { 
    timestamps: true 
});

// If you want automatic cleanup after 24 hours, add this instead:
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // 24 hours

const Story = mongoose.model('Story', storySchema);
export default Story;