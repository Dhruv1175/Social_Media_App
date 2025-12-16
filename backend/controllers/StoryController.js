import Story from '../models/StoryModel.js';
import User from '../models/UserModel.js'; 

// --- Helper function to aggregate stories by user (FIXED for views) ---
const aggregateStoriesByUser = (stories, currentUserId) => {
    const groupedStories = new Map();

    stories.forEach(story => {
        if (!story.user || !story.user._id) return;
        
        const userId = story.user._id.toString();
        
        if (!groupedStories.has(userId)) {
            groupedStories.set(userId, {
                userId: userId,
                username: story.user.username,
                profileImageUrl: story.user.profileImageUrl || story.user.avatar, 
                stories: [],
            });
        }
        
        // Filter out null/undefined entries before calling .toString()
        const validViews = story.views.filter(v => v !== null && v !== undefined);
        const isViewed = validViews.map(v => v.toString()).includes(currentUserId.toString());

        groupedStories.get(userId).stories.push({
            id: story._id.toString(),
            mediaUrl: story.mediaUrl,
            mediaType: story.mediaType,
            caption: story.caption,
            timestamp: story.createdAt,
            viewed: isViewed, // Correctly checks if the current user has viewed the story
        });
    });
    
    const feed = Array.from(groupedStories.values());
    
    // Sort: current user first, then users with unviewed stories, then others (The correct display order)
    feed.sort((a, b) => {
        const aIsCurrentUser = a.userId === currentUserId.toString();
        const bIsCurrentUser = b.userId === currentUserId.toString();
        
        if (aIsCurrentUser && !bIsCurrentUser) return -1;
        if (!aIsCurrentUser && bIsCurrentUser) return 1;
        
        const aHasUnviewed = a.stories.some(s => !s.viewed);
        const bHasUnviewed = b.stories.some(s => !s.viewed);
        
        if (aHasUnviewed && !bHasUnviewed) return -1;
        if (!aHasUnviewed && bHasUnviewed) return 1;
        
        // Secondary sort to ensure newest stories from followers are higher
        if (a.stories.length > 0 && b.stories.length > 0) {
            const aNewest = Math.max(...a.stories.map(s => new Date(s.timestamp).getTime()));
            const bNewest = Math.max(...b.stories.map(s => new Date(s.timestamp).getTime()));
            return bNewest - aNewest;
        }
        
        return 0;
    });

    return feed;
};

// --- Controller Methods ---

/**
 * @desc Create a new story
 * @route POST /user/story/create
 * @access Private
 */
export const createStory = async (req, res) => {
    const authenticatedId = req.user?.id; 
    let { mediaUrl, mediaType, caption } = req.body; 

    if (!mediaUrl || !authenticatedId) {
        return res.status(400).json({ 
            message: 'Media URL and authentication are required.' 
        });
    }
    
    // Auto-detect media type if not provided
    if (!mediaType || !['image', 'video'].includes(mediaType)) {
        const urlLower = mediaUrl.toLowerCase();
        if (urlLower.endsWith('.mp4') || urlLower.endsWith('.mov') || urlLower.endsWith('.webm') || urlLower.includes('video')) {
            mediaType = 'video';
        } else {
            mediaType = 'image';
        }
    }

    try {
        // Check if user exists
        const userExists = await User.findById(authenticatedId);
        if (!userExists) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const newStory = new Story({
            user: authenticatedId, 
            mediaUrl,
            mediaType: mediaType, 
            caption: caption || '',
        });

        await newStory.save();

        res.status(201).json({ 
            message: 'Story created successfully.', 
            story: {
                id: newStory._id,
                mediaUrl: newStory.mediaUrl,
                mediaType: newStory.mediaType,
                caption: newStory.caption,
                timestamp: newStory.createdAt,
                viewed: false, 
            }
        });
    } catch (error) {
        console.error('SERVER ERROR creating story:', error);
        
        if (error.name === 'ValidationError' || error.name === 'CastError') { 
             return res.status(400).json({ 
                 message: `Validation failed: ${error.message}`,
                 details: error.message
             });
        }
        res.status(500).json({ message: 'Internal Server Error during story creation.' });
    }
};

/**
 * @desc Get the story feed for the authenticated user
 * @route GET /user/story/feed
 * @access Private
 */
export const getStoryFeed = async (req, res) => {
    const currentUserId = req.user._id || req.user.id;

    try {
        // Fetch user profile to get following list
        const userProfile = await User.findById(currentUserId).select('following').lean();
        const followingIds = userProfile?.following || [];
        
        // Include the current user's ID to fetch their own stories
        const userIdsToFetch = [currentUserId, ...followingIds];

        // Fetch stories from the last 24 hours only
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const stories = await Story.find({
            user: { $in: userIdsToFetch },
            createdAt: { $gte: twentyFourHoursAgo }
        })
        .sort({ createdAt: 1 }) // Sort oldest first to maintain chronological order within the group
        .populate('user', 'username profileImageUrl avatar _id') 
        .lean(); 

        // Aggregate and sort the stories using the helper function
        const aggregatedFeed = aggregateStoriesByUser(stories, currentUserId);

        res.status(200).json(aggregatedFeed);

    } catch (error) {
        console.error('SERVER ERROR fetching story feed:', error);
        res.status(500).json({ message: 'Internal Server Error fetching story feed.' });
    }
};

/**
 * @desc Mark a story as viewed by the authenticated user
 * @route POST /user/story/:storyId/view
 * @access Private
 */
export const markStoryAsViewed = async (req, res) => {
    const { storyId } = req.params;
    const userId = req.user._id || req.user.id;

    try {
        // Check if story exists
        const story = await Story.findById(storyId);
        if (!story) {
            return res.status(404).json({ message: 'Story not found.' });
        }

        // Use $addToSet to ensure the userId is only added once
        const result = await Story.updateOne(
            { _id: storyId, views: { $ne: userId } },
            { $addToSet: { views: userId } }
        );

        if (result.matchedCount === 0 && result.modifiedCount === 0) {
             return res.status(200).json({ message: 'Story already viewed.' });
        }

        res.status(200).json({ message: 'Story marked as viewed.' });
    } catch (error) {
        console.error('SERVER ERROR marking story as viewed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

/**
 * @desc Get views count for a specific story (for the creator)
 * @route GET /user/story/:storyId/views
 * @access Private (Owner Only)
 */
export const getStoryViews = async (req, res) => {
    const { storyId } = req.params;
    const currentUserId = req.user._id || req.user.id;

    try {
        // Populate views with necessary user info for the panel
        const story = await Story.findById(storyId).populate('views', 'username profileImageUrl');

        if (!story) {
            return res.status(404).json({ message: 'Story not found.' });
        }

        // Security check: Only the story creator can view the insights
        if (story.user.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        res.status(200).json({
            viewCount: story.views.length,
            viewers: story.views.map(user => ({
                id: user._id,
                username: user.username,
                profileImageUrl: user.profileImageUrl,
            }))
        });
    } catch (error) {
        console.error('Error fetching story views:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};