import notificationmodel from "../models/NotificationModel.js";


export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const { userid } = req.params;
        await notificationmodel.updateMany({ user: userid, isRead: false }, { isRead: true });

        res.status(200).send({ success: true, message: "All notifications marked as read." });
    } catch (error) {
        res.status(500).send({ success: false, message: "Something went wrong." });
    }
};