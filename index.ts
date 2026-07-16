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
            if (k === "better-auth.session_token") {
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

// app.post('/wishlist', verifySession, async (req, res) => {
//     const { userId, userEmail, gameId, game } = req.body;
//     if (!userId || !gameId || !game) {
//         return res.status(400).send({ message: "userId, gameId, and game details are required" });
//     }
//     try {
//         const query = { userId, gameId };
//         const exists = await wishlistCollection.findOne(query);
//         if (exists) {
//             return res.status(409).send({ message: "Game already in wishlist" });
//         }

//         const isOwned = await libraryCollection.findOne({ userId, gameId });
//         if (isOwned) {
//             return res.status(400).send({ message: "You already own this game, cannot add to wishlist" });
//         }

//         const newWishlistItem = {
//             userId,
//             userEmail,
//             gameId,
//             game,
//             addedAt: new Date()
//         };
//         const result = await wishlistCollection.insertOne(newWishlistItem);
//         res.status(201).send(result);
//     } catch (error) {
//         console.error("Error adding to wishlist:", error);
//         res.status(500).send({ message: "Failed to add to wishlist" });
//     }
// });

// app.get('/wishlist', verifySession, async (req, res) => {
//     const { userId } = req.query;
//     if (!userId) {
//         return res.status(400).send({ message: "userId query parameter is required" });
//     }
//     try {
//         const query = { userId: String(userId) };
//         const result = await wishlistCollection.find(query).sort({ addedAt: -1 }).toArray();
//         res.send(result);
//     } catch (error) {
//         console.error("Error retrieving wishlist:", error);
//         res.status(500).send({ message: "Failed to retrieve wishlist" });
//     }
// });

// app.delete('/wishlist', verifySession, async (req, res) => {
//     const { userId, gameId } = req.query;
//     if (!userId || !gameId) {
//         return res.status(400).send({ message: "userId and gameId query parameters are required" });
//     }
//     try {
//         const query = { userId: String(userId), gameId: String(gameId) };
//         const result = await wishlistCollection.deleteOne(query);
//         if (result.deletedCount === 0) {
//             return res.status(404).send({ message: "Wishlist item not found" });
//         }
//         res.send({ success: true, message: "Item removed from wishlist", result });
//     } catch (error) {
//         console.error("Error deleting from wishlist:", error);
//         res.status(500).send({ message: "Failed to remove from wishlist" });
//     }
// });

// app.post('/library', verifySession, async (req, res) => {
//     const { userId, userEmail, gameId, game } = req.body;
//     if (!userId || !gameId || !game) {
//         return res.status(400).send({ message: "userId, gameId, and game details are required" });
//     }
//     try {
//         const query = { userId, gameId };
//         const exists = await libraryCollection.findOne(query);
//         if (exists) {
//             return res.status(409).send({ message: "Game already owned in library" });
//         }

//         const newLibraryItem = {
//             userId,
//             userEmail,
//             gameId,
//             game,
//             downloadStatus: "not downloaded",
//             purchasedAt: new Date()
//         };
//         const result = await libraryCollection.insertOne(newLibraryItem);
//         await wishlistCollection.deleteOne({ userId, gameId });
//         res.status(201).send(result);
//     } catch (error) {
//         console.error("Error adding to library:", error);
//         res.status(500).send({ message: "Failed to add to library" });
//     }
// });

// app.patch('/library/download', verifySession, async (req, res) => {
//     const { userId, gameId, downloadStatus } = req.body;
//     if (!userId || !gameId || !downloadStatus) {
//         return res.status(400).send({ message: "userId, gameId, and downloadStatus are required" });
//     }
//     try {
//         const filter = { userId, gameId };
//         const update = {
//             $set: { downloadStatus }
//         };
//         const result = await libraryCollection.updateOne(filter, update);
//         if (result.matchedCount === 0) {
//             return res.status(404).send({ message: "Library item not found" });
//         }
//         res.send({ success: true, message: "Download status updated successfully", result });
//     } catch (error) {
//         console.error("Error updating download status:", error);
//         res.status(500).send({ message: "Failed to update download status" });
//     }
// });

// app.get('/library', verifySession, async (req, res) => {
//     const { userId } = req.query;
//     if (!userId) {
//         return res.status(400).send({ message: "userId query parameter is required" });
//     }
//     try {
//         const query = { userId: String(userId) };
//         const result = await libraryCollection.find(query).sort({ purchasedAt: -1 }).toArray();
//         res.send(result);
//     } catch (error) {
//         console.error("Error retrieving library:", error);
//         res.status(500).send({ message: "Failed to retrieve library" });
//     }
// });

// app.post('/reviews', verifySession, async (req, res) => {
//     const { gameId, userId, author, rating, comment } = req.body;
//     if (!gameId || !userId || !author || !rating || !comment) {
//         return res.status(400).send({ message: "gameId, userId, author, rating, and comment are required" });
//     }
//     try {
//         const isOwned = await libraryCollection.findOne({ userId, gameId });
//         if (!isOwned) {
//             return res.status(403).send({ message: "Only players who own this game can post reviews." });
//         }

//         const newReview = {
//             gameId,
//             userId,
//             author,
//             rating: Number(rating),
//             comment,
//             date: new Date().toISOString().split("T")[0],
//             createdAt: new Date()
//         };
//         const result = await reviewsCollection.insertOne(newReview);
//         res.status(201).send(result);
//     } catch (error) {
//         console.error("Error adding review:", error);
//         res.status(500).send({ message: "Failed to add review" });
//     }
// });

// app.get('/reviews', async (req, res) => {
//     const { gameId, userId } = req.query;
//     if (!gameId && !userId) {
//         return res.status(400).send({ message: "Either gameId or userId query parameter is required" });
//     }

//     // Verify session for user reviews queries
//     if (userId) {
//         const authHeader = req.headers.authorization || req.headers.Authorization;
//         if (!authHeader || !authHeader.toString().startsWith("Bearer ")) {
//             return res.status(401).send({ message: "Unauthorized: Missing or invalid token" });
//         }
//         const token = authHeader.toString().split(" ")[1];
//         try {
//             const session = await sessionCollection.findOne({ token });
//             if (!session || new Date(session.expiresAt) < new Date()) {
//                 return res.status(401).send({ message: "Unauthorized: Invalid or expired session" });
//             }
//         } catch (error) {
//             return res.status(500).send({ message: "Failed to verify session" });
//         }
//     }

//     try {
//         const query: any = {};
//         if (gameId) query.gameId = String(gameId);
//         if (userId) query.userId = String(userId);

//         const reviews = await reviewsCollection.find(query).sort({ createdAt: -1 }).toArray();

//         // If we are getting reviews for a user, enrich them with game details
//         if (userId) {
//             const enrichedReviews = await Promise.all(
//                 reviews.map(async (review) => {
//                     let gameDetails = null;
//                     try {
//                         if (review.gameId) {
//                             gameDetails = await gamesCollection.findOne({ _id: new ObjectId(review.gameId) });
//                         }
//                     } catch (e) {
//                         // ignore invalid ObjectIds or database query errors
//                     }
//                     return {
//                         ...review,
//                         game: gameDetails ? {
//                             title: gameDetails.title,
//                             coverUrl: gameDetails.coverUrl,
//                             genre: gameDetails.genre
//                         } : null
//                     };
//                 })
//             );
//             return res.send(enrichedReviews);
//         }

//         res.send(reviews);
//     } catch (error) {
//         console.error("Error retrieving reviews:", error);
//         res.status(500).send({ message: "Failed to retrieve reviews" });
//     }
// });

// app.put('/reviews/:id', verifySession, async (req, res) => {
//     const { id } = req.params;
//     const { rating, comment } = req.body;
//     if (rating === undefined || comment === undefined) {
//         return res.status(400).send({ message: "rating and comment are required" });
//     }
//     try {
//         const filter = { _id: new ObjectId(id) };
//         const update = {
//             $set: {
//                 rating: Number(rating),
//                 comment,
//                 updatedAt: new Date()
//             }
//         };
//         const result = await reviewsCollection.updateOne(filter, update);
//         if (result.matchedCount === 0) {
//             return res.status(404).send({ message: "Review not found" });
//         }
//         res.send({ success: true, message: "Review updated successfully", result });
//     } catch (error) {
//         console.error("Error updating review:", error);
//         res.status(500).send({ message: "Failed to update review" });
//     }
// });

// app.delete('/reviews/:id', verifySession, async (req, res) => {
//     const { id } = req.params;
//     try {
//         const filter = { _id: new ObjectId(id) };
//         const result = await reviewsCollection.deleteOne(filter);
//         if (result.deletedCount === 0) {
//             return res.status(404).send({ message: "Review not found" });
//         }
//         res.send({ success: true, message: "Review deleted successfully", result });
//     } catch (error) {
//         console.error("Error deleting review:", error);
//         res.status(500).send({ message: "Failed to delete review" });
//     }
// });

// app.get('/games', async (req, res) => {
//     let sortOptions: any = {};
//     const setQuery: any = {};
//     const { query } = req;

//     // 1. Filter: Genre
//     if (query.genre) {
//         setQuery.genre = query.genre;
//     }

//     // 2. Filter: Platform
//     if (query.platform) {
//         setQuery.platforms = query.platform;
//     }

//     // 3. Filter: Search (Title or Description)
//     if (query.search) {
//         const searchStr = String(query.search);
//         setQuery.$or = [
//             { title: { $regex: searchStr, $options: "i" } },
//             { description: { $regex: searchStr, $options: "i" } }
//         ];
//     }

//     // 4. Sorting Logic
//     if (query.sort === 'price-asc') {
//         sortOptions = { price: 1 };
//     } else if (query.sort === 'price-desc') {
//         sortOptions = { price: -1 };
//     } else if (query.sort === 'rating') {
//         sortOptions = { rating: -1 };
//     } else {
//         // Default: Sort by newest first
//         sortOptions = { createdAt: -1 };
//     }

//     let limitValue = 0;
//     if (query.limit) {
//         limitValue = parseInt(String(query.limit), 10);
//     }

//     try {
//         let cursor = gamesCollection.find(setQuery).sort(sortOptions);
//         if (limitValue > 0) {
//             cursor = cursor.limit(limitValue);
//         }
//         const result = await cursor.toArray();
//         res.send(result);
//     } catch (error) {
//         console.error("Database Error:", error);
//         res.status(500).send({ message: "Failed to retrieve games" });
//     }
// });

// app.get('/games/:id', async (req, res) => {
//     const { id } = req.params;
//     try {
//         const query = { _id: new ObjectId(id) };
//         const result = await gamesCollection.findOne(query);
//         if (!result) {
//             return res.status(404).send({ message: "Game not found" });
//         }
//         res.send(result);
//     } catch (error) {
//         console.error("Error retrieving game:", error);
//         res.status(500).send({ message: "Invalid ID or failed to retrieve game" });
//     }
// });

app.post('/games', verifySession, async (req, res) => {
    const game = req.body;
    game.createdAt = new Date();
    game.rating = 5.0;
    game.releaseDate = new Date().toISOString().split("T")[0];
    try {
        const result = await gamesCollection.insertOne(game);
        res.status(201).send(result);
    } catch (error) {
        console.error("Error inserting game:", error);
        res.status(500).send({ message: "Failed to add game" });
    }
});

// app.get('/my-games', verifySession, async (req, res) => {
//     const { userId } = req.query;
//     if (!userId) {
//         return res.status(400).send({ message: "userId query parameter is required" });
//     }
//     try {
//         const query = { "creator.id": String(userId) };
//         const result = await gamesCollection.find(query).sort({ createdAt: -1 }).toArray();
//         res.send(result);
//     } catch (error) {
//         console.error("Error retrieving my games:", error);
//         res.status(500).send({ message: "Failed to retrieve games" });
//     }
// });

// app.put('/games/:id', verifySession, async (req, res) => {
//     const { id } = req.params;
//     const updateInfo = req.body;
//     try {
//         const filter = { _id: new ObjectId(id) };
//         const update = {
//             $set: updateInfo
//         };
//         const result = await gamesCollection.updateOne(filter, update);
//         if (result.matchedCount === 0) {
//             return res.status(404).send({ message: "Game not found" });
//         }
//         res.send({ success: true, message: "Game updated successfully", result });
//     } catch (error) {
//         console.error("Error updating game:", error);
//         res.status(500).send({ message: "Failed to update game" });
//     }
// });

// app.delete('/games/:id', verifySession, async (req, res) => {
//     const { id } = req.params;
//     try {
//         const filter = { _id: new ObjectId(id) };
//         const result = await gamesCollection.deleteOne(filter);
//         if (result.deletedCount === 0) {
//             return res.status(404).send({ message: "Game not found" });
//         }
//         res.send({ success: true, message: "Game deleted successfully", result });
//     } catch (error) {
//         console.error("Error deleting game:", error);
//         res.status(500).send({ message: "Failed to delete game" });
//     }
// });

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});
