import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI || "";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

client.connect()
    .then(() => {
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    })
    .catch(console.dir);

const db = client.db("questforge");
const gamesCollection = db.collection("games");
const wishlistCollection = db.collection("wishlist");
const libraryCollection = db.collection("library");
const reviewsCollection = db.collection("reviews");
const sessionCollection = db.collection("session");
const userCollection = db.collection("user");
const roleRequestsCollection = db.collection("role_requests");
const ordersCollection = db.collection("orders");

const verifySession = async (req: any, res: any, next: any) => {
    let token = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && authHeader.toString().startsWith("Bearer ")) {
        token = authHeader.toString().split(" ")[1];
    }

    // Fallback: try parsing session token cookie
    if (!token && req.headers.cookie) {
        const cookiesList = req.headers.cookie.split(';');
        for (let c of cookiesList) {
            const [k, v] = c.trim().split('=');
            if (k === "better-auth.session_token" || k === "__secure-better-auth.session_token") {
                token = v;
                break;
            }
        }
    }

    if (!token) {
        return res.status(401).send({ message: "Unauthorized: Missing or invalid token" });
    }

    try {
        const session = await sessionCollection.findOne({ token });
        if (!session) {
            return res.status(401).send({ message: "Unauthorized: Invalid session" });
        }
        if (new Date(session.expiresAt) < new Date()) {
            return res.status(401).send({ message: "Unauthorized: Session expired" });
        }
        req.session = session;
        req.userId = session.userId.toString();
        next();
    } catch (error) {
        console.error("Session verification error:", error);
        res.status(500).send({ message: "Internal Server Error in authentication" });
    }
};

app.get('/', (req, res) => {
    res.send('Hello World!')
});

app.post('/wishlist', verifySession, async (req, res) => {
    const { userId, userEmail, gameId, game } = req.body;
    if (!userId || !gameId || !game) {
        return res.status(400).send({ message: "userId, gameId, and game details are required" });
    }
    try {
        const query = { userId, gameId };
        const exists = await wishlistCollection.findOne(query);
        if (exists) {
            return res.status(409).send({ message: "Game already in wishlist" });
        }

        const isOwned = await libraryCollection.findOne({ userId, gameId });
        if (isOwned) {
            return res.status(400).send({ message: "You already own this game, cannot add to wishlist" });
        }

        const newWishlistItem = {
            userId,
            userEmail,
            gameId,
            game,
            addedAt: new Date()
        };
        const result = await wishlistCollection.insertOne(newWishlistItem);
        res.status(201).send(result);
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).send({ message: "Failed to add to wishlist" });
    }
});

app.get('/wishlist', verifySession, async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).send({ message: "userId query parameter is required" });
    }
    try {
        const query = { userId: String(userId) };
        const result = await wishlistCollection.find(query).sort({ addedAt: -1 }).toArray();
        res.send(result);
    } catch (error) {
        console.error("Error retrieving wishlist:", error);
        res.status(500).send({ message: "Failed to retrieve wishlist" });
    }
});

app.delete('/wishlist', verifySession, async (req, res) => {
    const { userId, gameId } = req.query;
    if (!userId || !gameId) {
        return res.status(400).send({ message: "userId and gameId query parameters are required" });
    }
    try {
        const query = { userId: String(userId), gameId: String(gameId) };
        const result = await wishlistCollection.deleteOne(query);
        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Wishlist item not found" });
        }
        res.send({ success: true, message: "Item removed from wishlist", result });
    } catch (error) {
        console.error("Error deleting from wishlist:", error);
        res.status(500).send({ message: "Failed to remove from wishlist" });
    }
});

app.post('/library', verifySession, async (req, res) => {
    const { userId, userEmail, gameId, game } = req.body;
    if (!userId || !gameId || !game) {
        return res.status(400).send({ message: "userId, gameId, and game details are required" });
    }
    try {
        const query = { userId, gameId };
        const exists = await libraryCollection.findOne(query);
        if (exists) {
            return res.status(409).send({ message: "Game already owned in library" });
        }

        const newLibraryItem = {
            userId,
            userEmail,
            gameId,
            game,
            downloadStatus: "not downloaded",
            purchasedAt: new Date()
        };
        const result = await libraryCollection.insertOne(newLibraryItem);
        await wishlistCollection.deleteOne({ userId, gameId });
        res.status(201).send(result);
    } catch (error) {
        console.error("Error adding to library:", error);
        res.status(500).send({ message: "Failed to add to library" });
    }
});

app.patch('/library/download', verifySession, async (req, res) => {
    const { userId, gameId, downloadStatus } = req.body;
    if (!userId || !gameId || !downloadStatus) {
        return res.status(400).send({ message: "userId, gameId, and downloadStatus are required" });
    }
    try {
        const filter = { userId, gameId };
        const update = {
            $set: { downloadStatus }
        };
        const result = await libraryCollection.updateOne(filter, update);
        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Library item not found" });
        }
        res.send({ success: true, message: "Download status updated successfully", result });
    } catch (error) {
        console.error("Error updating download status:", error);
        res.status(500).send({ message: "Failed to update download status" });
    }
});

app.get('/library', verifySession, async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).send({ message: "userId query parameter is required" });
    }
    try {
        const query = { userId: String(userId) };
        const result = await libraryCollection.find(query).sort({ purchasedAt: -1 }).toArray();
        res.send(result);
    } catch (error) {
        console.error("Error retrieving library:", error);
        res.status(500).send({ message: "Failed to retrieve library" });
    }
});

const updateGameRating = async (gameId: string) => {
    try {
        const stats = await reviewsCollection.aggregate([
            { $match: { gameId: String(gameId) } },
            {
                $group: {
                    _id: "$gameId",
                    avgRating: { $avg: "$rating" },
                    reviewsCount: { $sum: 1 }
                }
            }
        ]).toArray();

        let rating = 0;
        let reviewsCount = 0;
        if (stats.length > 0) {
            rating = Math.round(stats[0].avgRating * 10) / 10;
            reviewsCount = stats[0].reviewsCount;
        }

        let gQuery: any = {};
        try {
            gQuery = { _id: new ObjectId(gameId) };
        } catch {
            gQuery = { _id: gameId };
        }

        await gamesCollection.updateOne(
            gQuery,
            { $set: { rating, reviewsCount } }
        );
    } catch (e) {
        console.error("Error updating game rating:", e);
    }
};

const syncAllGameRatings = async () => {
    try {
        const stats = await reviewsCollection.aggregate([
            {
                $group: {
                    _id: "$gameId",
                    avgRating: { $avg: "$rating" },
                    reviewsCount: { $sum: 1 }
                }
            }
        ]).toArray();

        const statsMap = new Map();
        stats.forEach((s: any) => {
            if (s._id) {
                statsMap.set(String(s._id), {
                    rating: Math.round(s.avgRating * 10) / 10,
                    reviewsCount: s.reviewsCount
                });
            }
        });

        const games = await gamesCollection.find().toArray();
        for (const game of games) {
            const idStr = game._id.toString();
            const stat = statsMap.get(idStr);
            const rating = stat ? stat.rating : 0;
            const reviewsCount = stat ? stat.reviewsCount : 0;
            if (game.rating !== rating || game.reviewsCount !== reviewsCount) {
                await gamesCollection.updateOne(
                    { _id: game._id },
                    { $set: { rating, reviewsCount } }
                );
            }
        }
    } catch (err) {
        console.error("Failed to sync game ratings:", err);
    }
};

app.post('/reviews', verifySession, async (req, res) => {
    const { gameId, userId, author, rating, comment } = req.body;
    if (!gameId || !userId || !author || !rating || !comment) {
        return res.status(400).send({ message: "gameId, userId, author, rating, and comment are required" });
    }
    try {
        const isOwned = await libraryCollection.findOne({ userId, gameId });
        if (!isOwned) {
            return res.status(403).send({ message: "Only players who own this game can post reviews." });
        }

        const newReview = {
            gameId,
            userId,
            author,
            rating: Number(rating),
            comment,
            date: new Date().toISOString().split("T")[0],
            createdAt: new Date()
        };
        const result = await reviewsCollection.insertOne(newReview);
        await updateGameRating(gameId);
        res.status(201).send(result);
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).send({ message: "Failed to add review" });
    }
});

app.get('/reviews', async (req, res) => {
    const { gameId, userId, limit } = req.query;

    // Verify session only for specific user reviews queries if requested
    if (userId && !gameId) {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader || !authHeader.toString().startsWith("Bearer ")) {
            return res.status(401).send({ message: "Unauthorized: Missing or invalid token" });
        }
        const token = authHeader.toString().split(" ")[1];
        try {
            const session = await sessionCollection.findOne({ token });
            if (!session || new Date(session.expiresAt) < new Date()) {
                return res.status(401).send({ message: "Unauthorized: Invalid or expired session" });
            }
        } catch (error) {
            return res.status(500).send({ message: "Failed to verify session" });
        }
    }

    try {
        const query: any = {};
        if (gameId) query.gameId = String(gameId);
        if (userId) query.userId = String(userId);

        let cursor = reviewsCollection.find(query).sort({ createdAt: -1 });
        if (limit) {
            cursor = cursor.limit(parseInt(String(limit), 10));
        }

        const reviews = await cursor.toArray();

        // Enrich reviews with both game details and user info
        const enrichedReviews = await Promise.all(
            reviews.map(async (review) => {
                let gameDetails = null;
                try {
                    if (review.gameId) {
                        gameDetails = await gamesCollection.findOne({ _id: new ObjectId(review.gameId) });
                    }
                } catch (e) {
                    // ignore invalid ObjectIds or database query errors
                }

                let userDetails = null;
                try {
                    if (review.userId) {
                        let uQuery: any = {};
                        try {
                            uQuery = { _id: new ObjectId(review.userId) };
                        } catch (e) {
                            uQuery = { _id: review.userId };
                        }
                        userDetails = await userCollection.findOne(uQuery);
                        if (!userDetails) {
                            userDetails = await userCollection.findOne({ id: review.userId });
                        }
                    }
                } catch (e) {
                    // ignore invalid ObjectIds
                }

                return {
                    ...review,
                    author: userDetails?.name || review.author || "Community Player",
                    user: userDetails ? {
                        id: userDetails._id ? userDetails._id.toString() : userDetails.id,
                        name: userDetails.name,
                        email: userDetails.email,
                        image: userDetails.image,
                        role: userDetails.role
                    } : null,
                    userImage: userDetails?.image || null,
                    userRole: userDetails?.role || null,
                    game: gameDetails ? {
                        id: gameDetails._id.toString(),
                        title: gameDetails.title,
                        coverUrl: gameDetails.coverUrl,
                        genre: gameDetails.genre
                    } : null
                };
            })
        );

        res.send(enrichedReviews);
    } catch (error) {
        console.error("Error retrieving reviews:", error);
        res.status(500).send({ message: "Failed to retrieve reviews" });
    }
});

app.put('/reviews/:id', verifySession, async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    if (rating === undefined || comment === undefined) {
        return res.status(400).send({ message: "rating and comment are required" });
    }
    try {
        const filter = { _id: new ObjectId(id) };
        const existingReview = await reviewsCollection.findOne(filter);
        if (!existingReview) {
            return res.status(404).send({ message: "Review not found" });
        }
        const update = {
            $set: {
                rating: Number(rating),
                comment,
                updatedAt: new Date()
            }
        };
        const result = await reviewsCollection.updateOne(filter, update);
        await updateGameRating(existingReview.gameId);
        res.send({ success: true, message: "Review updated successfully", result });
    } catch (error) {
        console.error("Error updating review:", error);
        res.status(500).send({ message: "Failed to update review" });
    }
});

app.delete('/reviews/:id', verifySession, async (req, res) => {
    const { id } = req.params;
    try {
        const filter = { _id: new ObjectId(id) };
        const existingReview = await reviewsCollection.findOne(filter);
        if (!existingReview) {
            return res.status(404).send({ message: "Review not found" });
        }
        const result = await reviewsCollection.deleteOne(filter);
        await updateGameRating(existingReview.gameId);
        res.send({ success: true, message: "Review deleted successfully", result });
    } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).send({ message: "Failed to delete review" });
    }
});

app.get('/games', async (req, res) => {
    let sortOptions: any = {};
    const setQuery: any = {};
    const { query } = req;

    // 1. Filter: Genre
    if (query.genre) {
        setQuery.genre = query.genre;
    }

    // 2. Filter: Platform
    if (query.platform) {
        setQuery.platforms = query.platform;
    }

    // 3. Filter: Search (Title or Description)
    if (query.search) {
        const searchStr = String(query.search);
        setQuery.$or = [
            { title: { $regex: searchStr, $options: "i" } },
            { description: { $regex: searchStr, $options: "i" } }
        ];
    }

    // 4. Sorting Logic
    if (query.sort === 'price-asc') {
        sortOptions = { price: 1 };
    } else if (query.sort === 'price-desc') {
        sortOptions = { price: -1 };
    } else if (query.sort === 'rating') {
        sortOptions = { rating: -1, reviewsCount: -1, createdAt: -1 };
    } else {
        // Default: Sort by newest first
        sortOptions = { createdAt: -1 };
    }

    let limitValue = 0;
    if (query.limit) {
        limitValue = parseInt(String(query.limit), 10);
    }

    try {
        let cursor = gamesCollection.find(setQuery).sort(sortOptions);
        if (limitValue > 0) {
            cursor = cursor.limit(limitValue);
        }
        const result = await cursor.toArray();
        res.send(result);
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).send({ message: "Failed to retrieve games" });
    }
});

app.get('/games/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = { _id: new ObjectId(id) };
        const result = await gamesCollection.findOne(query);
        if (!result) {
            return res.status(404).send({ message: "Game not found" });
        }
        res.send(result);
    } catch (error) {
        console.error("Error retrieving game:", error);
        res.status(500).send({ message: "Invalid ID or failed to retrieve game" });
    }
});

app.post('/games', verifySession, async (req, res) => {
    const game = req.body;
    game.createdAt = new Date();
    game.rating = 0;
    game.reviewsCount = 0;
    game.releaseDate = new Date().toISOString().split("T")[0];
    try {
        const result = await gamesCollection.insertOne(game);
        res.status(201).send(result);
    } catch (error) {
        console.error("Error inserting game:", error);
        res.status(500).send({ message: "Failed to add game" });
    }
});

app.get('/my-games', verifySession, async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).send({ message: "userId query parameter is required" });
    }
    try {
        const query = { "creator.id": String(userId) };
        const result = await gamesCollection.find(query).sort({ createdAt: -1 }).toArray();
        res.send(result);
    } catch (error) {
        console.error("Error retrieving my games:", error);
        res.status(500).send({ message: "Failed to retrieve games" });
    }
});

app.put('/games/:id', verifySession, async (req, res) => {
    const { id } = req.params;
    const updateInfo = { ...req.body };
    delete updateInfo._id;
    delete updateInfo.id;
    updateInfo.updatedAt = new Date();
    try {
        const filter = { _id: new ObjectId(id) };
        const update = {
            $set: updateInfo
        };
        const result = await gamesCollection.updateOne(filter, update);
        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Game not found" });
        }
        res.send({ success: true, message: "Game updated successfully", result });
    } catch (error) {
        console.error("Error updating game:", error);
        res.status(500).send({ message: "Failed to update game" });
    }
});

app.delete('/games/:id', verifySession, async (req, res) => {
    const { id } = req.params;
    try {
        const filter = { _id: new ObjectId(id) };
        const result = await gamesCollection.deleteOne(filter);
        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Game not found" });
        }
        res.send({ success: true, message: "Game deleted successfully", result });
    } catch (error) {
        console.error("Error deleting game:", error);
        res.status(500).send({ message: "Failed to delete game" });
    }
});

// User submits role change request (non-admin only, cannot request admin)
app.post('/role-request', verifySession, async (req: any, res: any) => {
    const { requestedRole, userId, userName, userEmail } = req.body;
    const sessionUserId = req.userId || userId;

    if (!sessionUserId || !requestedRole) {
        return res.status(400).send({ message: "UserId and requestedRole are required" });
    }

    try {
        let currentUser = null;
        try {
            currentUser = await userCollection.findOne({ _id: new ObjectId(sessionUserId) });
        } catch (e) {}

        const currentRole = currentUser?.role || "buyer";

        if (currentRole === "admin") {
            return res.status(400).send({ message: "Administrators do not need to request role changes." });
        }

        // Strictly disallow requesting Admin role
        if (requestedRole === "admin") {
            return res.status(403).send({ message: "You cannot request to become an Administrator." });
        }

        if (!["buyer", "seller"].includes(requestedRole)) {
            return res.status(400).send({ message: "Invalid role requested. Must be buyer or seller." });
        }

        if (requestedRole === currentRole) {
            return res.status(400).send({ message: `Your active account role is already ${currentRole.toUpperCase()}.` });
        }

        const newRequest = {
            userId: sessionUserId,
            userName: userName || currentUser?.name || "User",
            userEmail: userEmail || currentUser?.email || "",
            currentRole,
            requestedRole,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await roleRequestsCollection.updateOne(
            { userId: sessionUserId, status: "pending" },
            { $set: newRequest },
            { upsert: true }
        );

        res.status(201).send({
            success: true,
            message: `Role change request to ${requestedRole.toUpperCase()} submitted for Admin approval.`,
            result
        });
    } catch (error) {
        console.error("Error submitting role change request:", error);
        res.status(500).send({ message: "Failed to submit role change request" });
    }
});

// User retrieves active pending role request
app.get('/role-request', verifySession, async (req: any, res: any) => {
    const { userId } = req.query;
    const queryUserId = req.userId || String(userId);

    if (!queryUserId) {
        return res.status(400).send({ message: "userId query parameter is required" });
    }

    try {
        const pendingRequest = await roleRequestsCollection.findOne({
            userId: String(queryUserId),
            status: "pending"
        });
        res.send({ request: pendingRequest || null });
    } catch (error) {
        console.error("Error fetching role request:", error);
        res.status(500).send({ message: "Failed to fetch role request" });
    }
});

// Admin retrieves all role requests
app.get('/admin/role-requests', verifySession, async (req: any, res: any) => {
    try {
        const adminUser = await userCollection.findOne({ _id: new ObjectId(req.userId) });
        if (adminUser?.role !== "admin") {
            return res.status(403).send({ message: "Forbidden: Administrator access required" });
        }

        const requests = await roleRequestsCollection.find().sort({ createdAt: -1 }).toArray();
        res.send({ requests: requests || [] });
    } catch (error) {
        console.error("Error retrieving role requests:", error);
        res.status(500).send({ message: "Failed to retrieve role requests" });
    }
});

// Admin approves or rejects role request
app.post('/admin/role-requests/action', verifySession, async (req: any, res: any) => {
    const { requestId, action } = req.body;
    if (!requestId || !["approve", "reject"].includes(action)) {
        return res.status(400).send({ message: "requestId and valid action (approve/reject) are required" });
    }

    try {
        const adminUser = await userCollection.findOne({ _id: new ObjectId(req.userId) });
        if (adminUser?.role !== "admin") {
            return res.status(403).send({ message: "Forbidden: Administrator access required" });
        }

        const roleReqDoc = await roleRequestsCollection.findOne({ _id: new ObjectId(requestId) });
        if (!roleReqDoc) {
            return res.status(404).send({ message: "Role request not found" });
        }

        if (action === "approve") {
            // Update user role in MongoDB user collection
            await userCollection.updateOne(
                { _id: new ObjectId(roleReqDoc.userId) },
                { $set: { role: roleReqDoc.requestedRole, updatedAt: new Date() } }
            );

            await roleRequestsCollection.updateOne(
                { _id: new ObjectId(requestId) },
                { $set: { status: "approved", approvedAt: new Date() } }
            );

            res.send({
                success: true,
                message: `Request approved! User role changed to ${roleReqDoc.requestedRole.toUpperCase()}.`
            });
        } else {
            await roleRequestsCollection.updateOne(
                { _id: new ObjectId(requestId) },
                { $set: { status: "rejected", rejectedAt: new Date() } }
            );

            res.send({
                success: true,
                message: "Role request rejected."
            });
        }
    } catch (error) {
        console.error("Error processing role request action:", error);
        res.status(500).send({ message: "Failed to process role request action" });
    }
});

// Buyer submits an Order Request for a Game
app.post('/orders', verifySession, async (req: any, res: any) => {
    const { gameId, gameTitle, gameCoverUrl, price, buyerId, buyerName, buyerEmail, sellerId, sellerEmail } = req.body;
    const sessionUserId = req.userId || buyerId;

    if (!gameId || !sessionUserId) {
        return res.status(400).send({ message: "gameId and buyer details are required" });
    }

    try {
        // Check if buyer already owns this game
        const alreadyOwned = await libraryCollection.findOne({ userId: String(sessionUserId), gameId: String(gameId) });
        if (alreadyOwned) {
            return res.status(400).send({ message: "You already own this game in your library." });
        }

        // Check if pending order already exists
        const existingPending = await ordersCollection.findOne({
            buyerId: String(sessionUserId),
            gameId: String(gameId),
            status: "pending"
        });
        if (existingPending) {
            return res.status(400).send({ message: "An order request for this game is already pending seller delivery." });
        }

        let targetSellerId = sellerId;
        let targetSellerEmail = sellerEmail;
        try {
            const gameDoc = await gamesCollection.findOne({ _id: new ObjectId(gameId) });
            if (gameDoc?.creator?.id) {
                targetSellerId = gameDoc.creator.id;
                targetSellerEmail = gameDoc.creator.email || targetSellerEmail;
            }
        } catch (e) {}

        const newOrder = {
            gameId: String(gameId),
            gameTitle: gameTitle || "Game Listing",
            gameCoverUrl: gameCoverUrl || "",
            price: Number(price) || 0,
            buyerId: String(sessionUserId),
            buyerName: buyerName || "Buyer",
            buyerEmail: buyerEmail || "",
            sellerId: targetSellerId || "all_sellers",
            sellerEmail: targetSellerEmail || "",
            status: "pending",
            licenseKey: null,
            orderedAt: new Date(),
            updatedAt: new Date()
        };

        const result = await ordersCollection.insertOne(newOrder);
        const createdOrder = { ...newOrder, _id: result.insertedId };
        res.status(201).send({
            success: true,
            message: `Order request placed successfully! Awaiting seller delivery.`,
            orderId: result.insertedId,
            order: createdOrder
        });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).send({ message: "Failed to place order request" });
    }
});

// Helper function for dynamic timeline buckets (supports 7d, 30d, 6m, 1y)
function generateTimelineBuckets(timeRange: string = "6m") {
    const buckets: Array<{ key: string; label: string; month: string; start: Date; end: Date }> = [];
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (timeRange === "7d") {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
            const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
            const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            buckets.push({ key, label, month: label, start, end });
        }
    } else if (timeRange === "30d") {
        for (let i = 29; i >= 0; i -= 5) {
            const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Math.max(0, i - 4), 23, 59, 59, 999);
            const label = `${monthNames[dStart.getMonth()]} ${dStart.getDate()}`;
            const key = `w-${i}`;
            buckets.push({ key, label, month: label, start: dStart, end: dEnd });
        }
    } else if (timeRange === "1y") {
        for (let i = 11; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            const label = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
            const key = `${start.getFullYear()}-${start.getMonth()}`;
            buckets.push({ key, label, month: label, start, end });
        }
    } else {
        // default 6m
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            const label = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
            const key = `${start.getFullYear()}-${start.getMonth()}`;
            buckets.push({ key, label, month: label, start, end });
        }
    }
    return buckets;
}

// Retrieve orders (by buyerId/buyerEmail or sellerId/sellerEmail or all for seller dashboard)
app.get('/orders', verifySession, async (req: any, res: any) => {
    const { buyerId, buyerEmail, sellerId, sellerEmail } = req.query;
    try {
        const query: any = {};
        if (buyerId || buyerEmail) {
            const orConditions: any[] = [];
            if (buyerId) orConditions.push({ buyerId: String(buyerId) });
            if (buyerEmail) orConditions.push({ buyerEmail: String(buyerEmail) });
            query.$or = orConditions;
        } else if (sellerId || sellerEmail) {
            const orConditions: any[] = [{ sellerId: "all_sellers" }];
            if (sellerId) orConditions.push({ sellerId: String(sellerId) });
            if (sellerEmail) orConditions.push({ sellerEmail: String(sellerEmail) });
            query.$or = orConditions;
        }

        const orders = await ordersCollection.find(query).sort({ orderedAt: -1 }).toArray();
        res.send(orders || []);
    } catch (error) {
        console.error("Error retrieving orders:", error);
        res.status(500).send({ message: "Failed to retrieve orders" });
    }
});

// Platform Dynamic Analytics (Recharts endpoint)
app.get('/analytics', async (req: any, res: any) => {
    const timeRange = (req.query.timeRange as string) || "6m";
    try {
        const users = await userCollection.find().toArray();
        const sales = await libraryCollection.find().toArray();
        const games = await gamesCollection.find().toArray();
        const orders = await ordersCollection.find().toArray();

        const buyerUsers = users.filter((u: any) => !u.role || u.role === "buyer");
        const sellerUsers = users.filter((u: any) => u.role === "seller");
        const adminUsers = users.filter((u: any) => u.role === "admin");

        // Compute total revenue and genre breakdown directly from real database records
        let totalRevenue = 0;
        const genreRevenueMap: Record<string, number> = {};
        const genreCountMap: Record<string, number> = {};

        const countedOrderKeys = new Set<string>();

        sales.forEach((sale: any) => {
            const price = Number(sale.game?.price) || 0;
            totalRevenue += price;
            const genre = sale.game?.genre || "Uncategorized";
            genreRevenueMap[genre] = (genreRevenueMap[genre] || 0) + price;
            genreCountMap[genre] = (genreCountMap[genre] || 0) + 1;
            if (sale.gameId) countedOrderKeys.add(`${sale.userId}_${sale.gameId}`);
        });

        // Also add delivered orders not already represented in library collection
        orders.filter((o: any) => o.status === "delivered").forEach((ord: any) => {
            const key = `${ord.buyerId}_${ord.gameId}`;
            if (!countedOrderKeys.has(key)) {
                const price = Number(ord.price) || 0;
                totalRevenue += price;
                const genre = "Uncategorized";
                genreRevenueMap[genre] = (genreRevenueMap[genre] || 0) + price;
                genreCountMap[genre] = (genreCountMap[genre] || 0) + 1;
                countedOrderKeys.add(key);
            }
        });

        // Generate dynamic timeline buckets for Recharts
        const buckets = generateTimelineBuckets(timeRange);

        const monthlyStats = buckets.map(b => {
            const bBuyers = buyerUsers.filter((u: any) => {
                if (!u.createdAt) return false;
                const d = new Date(u.createdAt);
                return d >= b.start && d <= b.end;
            }).length;

            const bSellers = sellerUsers.filter((u: any) => {
                if (!u.createdAt) return false;
                const d = new Date(u.createdAt);
                return d >= b.start && d <= b.end;
            }).length;

            const bSales = sales.filter((s: any) => {
                const d = s.purchasedAt ? new Date(s.purchasedAt) : (s.createdAt ? new Date(s.createdAt) : null);
                return d ? (d >= b.start && d <= b.end) : false;
            });

            const bOrders = orders.filter((o: any) => {
                const d = o.orderedAt ? new Date(o.orderedAt) : (o.createdAt ? new Date(o.createdAt) : null);
                return d ? (d >= b.start && d <= b.end) : false;
            });

            const salesCount = bSales.length + bOrders.length;
            const revenue = bSales.reduce((acc: number, curr: any) => acc + (Number(curr.game?.price) || 0), 0) +
                            bOrders.filter((o: any) => o.status === "delivered").reduce((acc: number, curr: any) => acc + (Number(curr.price) || 0), 0);

            return {
                month: b.label,
                label: b.label,
                buyers: bBuyers,
                sellers: bSellers,
                salesCount,
                revenue: Number(revenue.toFixed(2))
            };
        });

        const genreBreakdown = Object.entries(genreRevenueMap).map(([name, value]) => ({
            name,
            value: Number(value.toFixed(2)),
            count: genreCountMap[name] || 0
        }));

        // Dynamic User Roles Pie Chart dataset (No static fallbacks)
        const userRolesPieData = [
            { name: "Buyer Accounts", value: buyerUsers.length, color: "#10b981" },
            { name: "Seller Accounts", value: sellerUsers.length, color: "#f59e0b" },
            { name: "Admin Accounts", value: adminUsers.length, color: "#8b5cf6" },
        ];

        const recentBuyers = buyerUsers.map((u: any) => ({
            id: u._id.toString(),
            name: u.name || u.email?.split("@")[0] || "Buyer Account",
            email: u.email || "",
            role: "buyer",
            createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString()
        }));

        const recentSellers = sellerUsers.map((u: any) => ({
            id: u._id.toString(),
            name: u.name || u.email?.split("@")[0] || "Seller Account",
            email: u.email || "",
            role: "seller",
            createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString()
        }));

        const recentSales = sales.map((s: any) => ({
            id: s._id.toString(),
            gameTitle: s.game?.title || "Game Purchase",
            userEmail: s.userEmail || "Buyer",
            price: Number(s.game?.price) || 0,
            purchasedAt: s.purchasedAt ? new Date(s.purchasedAt).toISOString() : (s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString())
        }));

        res.send({
            summary: {
                totalRevenue: Number(totalRevenue.toFixed(2)),
                totalSalesCount: sales.length + orders.length,
                totalBuyers: buyerUsers.length,
                totalSellers: sellerUsers.length,
                totalAdmins: adminUsers.length,
                totalGames: games.length
            },
            monthlyStats,
            genreBreakdown,
            userRolesPieData,
            recentBuyers,
            recentSellers,
            recentSales
        });
    } catch (error: any) {
        console.error("Error generating analytics:", error);
        res.status(500).send({ message: "Failed to generate analytics data" });
    }
});

// Seller-Specific Dynamic Analytics (Recharts endpoint)
app.get('/analytics/seller', async (req: any, res: any) => {
    const { sellerId, sellerEmail, timeRange = "6m" } = req.query;
    try {
        const queryGames: any = {};
        if (sellerId || sellerEmail) {
            const orList: any[] = [];
            if (sellerId) orList.push({ "creator.id": String(sellerId) });
            if (sellerEmail) orList.push({ "creator.email": String(sellerEmail) });
            queryGames.$or = orList;
        }

        const myGames = await gamesCollection.find(queryGames).toArray();

        // Find orders for this seller
        const orderOr: any[] = [{ sellerId: "all_sellers" }];
        if (sellerId) orderOr.push({ sellerId: String(sellerId) });
        if (sellerEmail) orderOr.push({ sellerEmail: String(sellerEmail) });
        const orders = await ordersCollection.find({ $or: orderOr }).sort({ orderedAt: -1 }).toArray();

        // Find library purchases for this seller's games
        const gameIds = myGames.map((g: any) => g._id.toString());
        const libOr: any[] = [];
        if (gameIds.length > 0) libOr.push({ gameId: { $in: gameIds } });
        if (sellerId) libOr.push({ "game.creator.id": String(sellerId) });
        if (sellerEmail) libOr.push({ "game.creator.email": String(sellerEmail) });

        const libSales = libOr.length > 0 ? await libraryCollection.find({ $or: libOr }).toArray() : [];

        const deliveredOrders = orders.filter((o: any) => o.status === "delivered");
        const pendingOrders = orders.filter((o: any) => o.status === "pending");

        const orderRevenue = deliveredOrders.reduce((acc: number, o: any) => acc + (Number(o.price) || 0), 0);
        const libRevenue = libSales.reduce((acc: number, s: any) => acc + (Number(s.game?.price) || 0), 0);
        const totalSalesRevenue = Number((orderRevenue + libRevenue).toFixed(2));

        // Generate timeline buckets
        const buckets = generateTimelineBuckets(timeRange as string);
        const monthlySalesData = buckets.map(b => {
            const bOrders = orders.filter((o: any) => {
                const d = o.orderedAt ? new Date(o.orderedAt) : (o.createdAt ? new Date(o.createdAt) : null);
                return d ? (d >= b.start && d <= b.end) : false;
            });
            const bSales = libSales.filter((s: any) => {
                const d = s.purchasedAt ? new Date(s.purchasedAt) : (s.createdAt ? new Date(s.createdAt) : null);
                return d ? (d >= b.start && d <= b.end) : false;
            });

            const count = bOrders.length + bSales.length;
            const rev = bOrders.filter((o: any) => o.status === "delivered").reduce((acc: number, o: any) => acc + (Number(o.price) || 0), 0) +
                        bSales.reduce((acc: number, s: any) => acc + (Number(s.game?.price) || 0), 0);

            return {
                month: b.label,
                orders: count,
                revenue: Number(rev.toFixed(2))
            };
        });

        // Genre breakdown of seller's published games
        const genreCounts: Record<string, number> = {};
        myGames.forEach((g: any) => {
            const cat = g.genre || "Other";
            genreCounts[cat] = (genreCounts[cat] || 0) + 1;
        });

        const COLOR_PALETTE = ["#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#3b82f6", "#ef4444"];
        const genrePieData = Object.keys(genreCounts).map((key, idx) => ({
            name: key,
            value: genreCounts[key],
            color: COLOR_PALETTE[idx % COLOR_PALETTE.length]
        }));

        res.send({
            totalGamesCount: myGames.length,
            totalSalesRevenue,
            pendingOrdersCount: pendingOrders.length,
            deliveredOrdersCount: deliveredOrders.length,
            monthlySalesData,
            genrePieData,
            ordersList: orders
        });
    } catch (error: any) {
        console.error("Error generating seller analytics:", error);
        res.status(500).send({ message: "Failed to generate seller analytics" });
    }
});

// Buyer-Specific Dynamic Analytics (Recharts endpoint)
app.get('/analytics/buyer', async (req: any, res: any) => {
    const { buyerId, buyerEmail, timeRange = "6m" } = req.query;
    try {
        const libOr: any[] = [];
        if (buyerId) libOr.push({ userId: String(buyerId) });
        if (buyerEmail) libOr.push({ userEmail: String(buyerEmail) });
        const libraryItems = libOr.length > 0 ? await libraryCollection.find({ $or: libOr }).toArray() : [];

        const orderOr: any[] = [];
        if (buyerId) orderOr.push({ buyerId: String(buyerId) });
        if (buyerEmail) orderOr.push({ buyerEmail: String(buyerEmail) });
        const orders = orderOr.length > 0 ? await ordersCollection.find({ $or: orderOr }).sort({ orderedAt: -1 }).toArray() : [];

        const totalSpent = Number((
            libraryItems.reduce((acc: number, item: any) => acc + (Number(item.game?.price) || 0), 0)
        ).toFixed(2));

        const buckets = generateTimelineBuckets(timeRange as string);
        const monthlySpendingData = buckets.map(b => {
            const bLib = libraryItems.filter((item: any) => {
                const d = item.purchasedAt ? new Date(item.purchasedAt) : (item.createdAt ? new Date(item.createdAt) : null);
                return d ? (d >= b.start && d <= b.end) : false;
            });

            const bOrders = orders.filter((ord: any) => {
                const d = ord.orderedAt ? new Date(ord.orderedAt) : (ord.createdAt ? new Date(ord.createdAt) : null);
                return d ? (d >= b.start && d <= b.end) : false;
            });

            const spent = bLib.reduce((acc: number, item: any) => acc + (Number(item.game?.price) || 0), 0);
            const count = bOrders.length > 0 ? bOrders.length : bLib.length;

            return {
                month: b.label,
                spent: Number(spent.toFixed(2)),
                orders: count
            };
        });

        const genreCounts: Record<string, number> = {};
        libraryItems.forEach((item: any) => {
            const cat = item.game?.genre || "Action";
            genreCounts[cat] = (genreCounts[cat] || 0) + 1;
        });

        const COLOR_PALETTE = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899", "#3b82f6", "#ef4444"];
        const genrePieData = Object.keys(genreCounts).map((key, idx) => ({
            name: key,
            value: genreCounts[key],
            color: COLOR_PALETTE[idx % COLOR_PALETTE.length]
        }));

        res.send({
            totalSpent,
            libraryCount: libraryItems.length,
            ordersCount: orders.length,
            monthlySpendingData,
            genrePieData,
            ordersList: orders
        });
    } catch (error: any) {
        console.error("Error generating buyer analytics:", error);
        res.status(500).send({ message: "Failed to generate buyer analytics" });
    }
});

// Seller delivers the order by providing a License Key
app.patch('/orders/:id/deliver', verifySession, async (req: any, res: any) => {
    const { id } = req.params;
    const { licenseKey, deliveryNotes } = req.body;

    try {
        let orderDoc: any = null;
        try {
            orderDoc = await ordersCollection.findOne({ _id: new ObjectId(id) });
        } catch (e) {
            orderDoc = await ordersCollection.findOne({ _id: id as any });
        }

        if (!orderDoc) {
            return res.status(404).send({ message: "Order not found" });
        }

        if (orderDoc.status === "delivered") {
            return res.status(400).send({ message: "Order has already been delivered." });
        }

        const generatedKey = licenseKey && licenseKey.trim()
            ? licenseKey.trim()
            : `QF-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        // Update order status to delivered
        await ordersCollection.updateOne(
            { _id: orderDoc._id },
            {
                $set: {
                    status: "delivered",
                    licenseKey: generatedKey,
                    deliveryNotes: deliveryNotes || "Delivered by Seller",
                    deliveredAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        // Add game directly to buyer's library vault
        const libraryItem = {
            userId: orderDoc.buyerId,
            userEmail: orderDoc.buyerEmail,
            gameId: orderDoc.gameId,
            game: {
                id: orderDoc.gameId,
                title: orderDoc.gameTitle,
                coverUrl: orderDoc.gameCoverUrl,
                price: orderDoc.price
            },
            licenseKey: generatedKey,
            downloadStatus: "not downloaded",
            purchasedAt: new Date()
        };

        await libraryCollection.updateOne(
            { userId: orderDoc.buyerId, gameId: orderDoc.gameId },
            { $set: libraryItem },
            { upsert: true }
        );

        // Clean up buyer's wishlist if present
        await wishlistCollection.deleteOne({ userId: orderDoc.buyerId, gameId: orderDoc.gameId });

        res.send({
            success: true,
            message: `Order delivered successfully! License key: ${generatedKey}`,
            licenseKey: generatedKey
        });
    } catch (error) {
        console.error("Error delivering order:", error);
        res.status(500).send({ message: "Failed to deliver order" });
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});

export default app;
