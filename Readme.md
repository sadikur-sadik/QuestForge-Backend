Here is a professional and structured README.md file designed for your project.

QuestForge-Backend

QuestForge-Backend is a Node.js and Express-based REST API designed to power the
QuestForge digital gaming platform. It provides endpoints for managing a game
directory, user libraries, wishlists, customer reviews, and session-based
authentication using MongoDB.

Description

This backend service acts as the core database interface and business logic
controller for the QuestForge platform. It manages inventory, user-specific data
states (like owned games and wishlisted titles), and feedback loops such as
ratings and reviews. Security and session integrity are handled via a
database-linked token validation middleware, ensuring that user-specific
operations are securely verified.

Features

1. Authentication & Session Verification

  - Session Middleware: Validates requests using an authorization header (Bearer
    <token>) or a fallback cookie parser (better-auth.session_token).
  - Expiration Control: Automatically rejects requests if the session token is
    invalid or past its expiresAt timestamp in the database.

2. Game Directory Management

  - Flexible Filtering: Retrieve games filtered by genre, platform, or
    text-based search queries matching the title or description.
  - Sorting Capabilities: Sort game listings by price (ascending/descending),
    rating, or creation date (defaulting to the newest first).
  - Creator Management: Endpoints to add, update, retrieve, or delete games
    created by specific developer profiles.

3. Wishlist Management

  - Validation Checks: Prevents duplicate entries on the wishlist and blocks
    users from adding games they already own in their library.
  - Automatic Cleanup: Removes titles from the wishlist automatically once they
    are purchased or moved to the user's library.

4. Game Library & Download Tracking

  - Purchase Processing: Stores records of acquired games, logging details such
    as purchase time and ownership state.
  - Download Status updates: Tracks local file status updates (e.g.,
    "downloaded" vs. "not downloaded") per game in a user's library.

5. Review & Rating System

  - Ownership Verification: Restricts review creation exclusively to users who
    verified ownership of the game in their database library.
  - Metadata Enrichment: Merges game schema details (title, genre, cover image)
    with the raw review data when querying user-specific reviews.
  - Full CRUD Operations: Allows players to modify or delete their previous
    reviews.

Technologies

  - Runtime Environment: Node.js
  - Web Framework: Express (using TypeScript-compatible syntax)
  - Database: MongoDB (utilizing the official mongodb native driver)
  - Security & Configuration:
      - CORS (Cross-Origin Resource Sharing)
      - dotenv (environment variable management)

API Endpoints Reference

Public Endpoints

  - GET / — Check API status.
  - GET /games — Retrieve, search, sort, and filter games.
  - GET /games/:id — Get detailed metadata for a single game.
  - GET /reviews — Retrieve reviews filtered by gameId or userId.

Protected Endpoints (Requires valid Token/Session)

  - Wishlist:
      - POST /wishlist — Add a game to the user's wishlist.
      - GET /wishlist?userId=<ID> — Fetch the user's wishlisted games.
      - DELETE /wishlist?userId=<ID>&gameId=<ID> — Remove a game from the
        wishlist.
  - Library:
      - POST /library — Add a game to the user's owned library.
      - GET /library?userId=<ID> — Get the list of owned games.
      - PATCH /library/download — Update a game's local download status.
  - Reviews:
      - POST /reviews — Post a new review (restricted to game owners).
      - PUT /reviews/:id — Update an existing review rating and comment.
      - DELETE /reviews/:id — Remove a review.
  - My Inventory (Creators):
      - POST /games — Publish a new game.
      - GET /my-games?userId=<ID> — Fetch games created by the current user.
      - PUT /games/:id — Update game information.
      - DELETE /games/:id — Delete a game from the platform.

Installation and Setup

1.  Clone the repository:

    git clone https://github.com/your-username/QuestForge-Backend.git
    cd QuestForge-Backend

2.  Install dependencies:

    npm install

3.  Configure Environment Variables: Create a .env file in the root directory:

    PORT=5000
    MONGODB_URI=your_mongodb_connection_string

4.  Start the server:

    # Start development server
    npm run dev

    # Or run with Node
    node index.js
