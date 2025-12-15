import Story from '../models/StoryModel.js';
import User from '../models/UserModel.js'; // Assuming you have a User model

// --- Helper function to aggregate stories by user (like the UI expects) ---
const aggregateStoriesByUser = (stories, currentUserId) => {
    const groupedStories = new Map();

    stories.forEach(story => {
        // Ensure story.user is populated and accessible
        if (!story.user || !story.user._id) return;
        
        const userId = story.user._id.toString();
        
        if (!groupedStories.has(userId)) {
            // Initialize the group with user info
            groupedStories.set(userId, {
                userId: userId,
                username: story.user.username,
                profileImageUrl: story.user.profileImageUrl || story.user.avatar, 
                stories: [],
            });
        }
        
        // Determine if the current user has viewed this specific story
        const isViewed = story.views.map(v => v.toString()).includes(currentUserId.toString());

        // Push the story details into the group
        groupedStories.get(userId).stories.push({
            id: story._id.toString(),
            mediaUrl: story.mediaUrl,
            mediaType: story.mediaType,
            caption: story.caption,
            timestamp: story.createdAt,
            viewed: isViewed,
        });
    });

    // Final sorting logic for the feed
    const feed = Array.from(groupedStories.values());
    
    // Sort feed: Current user first, then users with unviewed stories
    feed.sort((a, b) => {
        const aIsCurrentUser = a.userId === currentUserId.toString();
        const bIsCurrentUser = b.userId === currentUserId.toString();
        const aHasUnviewed = a.stories.some(s => !s.viewed);
        const bHasUnviewed = b.stories.some(s => !s.viewed);

        if (aIsCurrentUser && !bIsCurrentUser) return -1;
        if (!aIsCurrentUser && bIsCurrentUser) return 1;
        if (aHasUnviewed && !bHasUnviewed) return -1;
        if (!aHasUnviewed && bHasUnviewed) return 1;
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
    // req.user._id is set by verifyToken middleware
    const userId = req.user._id; 
    const { mediaUrl, mediaType, caption } = req.body;

    // IMPORTANT CHECK: Ensure mediaUrl and mediaType are present (Fixes 500 Error if they were missing)
    if (!mediaUrl || !mediaType || !userId) {
        return res.status(400).json({ message: 'User, Media URL, and Media Type are required.' });
    }
    
    try {
        const newStory = new Story({
            user: userId,
            mediaUrl,
            mediaType,
            caption: caption || '',
        });

        await newStory.save();

        // Return a simplified story object
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
        res.status(500).json({ message: 'Internal Server Error during story creation.' });
    }
};

/**
 * @desc Get the story feed for the authenticated user
 * @route GET /user/story/feed
 * @access Private
 */
export const getStoryFeed = async (req, res) => {
    const currentUserId = req.user._id;

    try {
        // Fetch user profile to get following list
        const userProfile = await User.findById(currentUserId).select('following').lean();
        const followingIds = userProfile?.following || [];
        
        // Include the current user's ID to fetch their own stories
        const userIdsToFetch = [currentUserId, ...followingIds];

        // Fetch all non-expired stories from these users
        const stories = await Story.find({
            user: { $in: userIdsToFetch }
        })
        .sort({ createdAt: -1 }) // Sort newest first
        .populate('user', 'username profileImageUrl avatar') 
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
    const userId = req.user._id;

    try {
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
 * @route GET /api/story/:storyId/views
 * @access Private (Owner Only)
 */
export const getStoryViews = async (req, res) => {
    const { storyId } = req.params;
    const currentUserId = req.user._id;

    try {
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