import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config()

export const verifyToken = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        
        if (!token) {
            return res.status(401).json({ 
                message: "Access denied. No token provided.", 
                success: false 
            });
        }

        // Verify token
        jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
            if (err) {
                console.error("Token verification error:", err.message);
                return res.status(401).json({ 
                    message: "Invalid or expired token.", 
                    success: false 
                });
            }
            
            // Store decoded user info in request object for later use
            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({ 
            message: "Authentication error", 
            success: false 
        });
    }
}