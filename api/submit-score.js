// api/submit-score.js - Runs securely on Vercel's server

import fetch from 'node-fetch'; // Vercel supports this for server-side fetches

// Load the secrets from the environment variables configured in Step 2.
// These are only available on the server and are NOT exposed to the client.
const JSONBIN_SECRET_KEY = process.env.JSONBIN_SECRET_KEY;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const LEADERBOARD_API = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// This is the function Vercel calls when the endpoint is hit
export default async function handler(req, res) {
    // 1. **Check for POST Request**
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Vercel helper automatically parses the JSON body for you (in req.body)
        const { name, shrimps } = req.body;

        // 2. **Secure Validation/Anti-Cheat Check**
        // A simple check to prevent obviously bad data. You can add more complex checks here.
        if (!name || typeof shrimps !== 'number' || shrimps < 1 || name.length > 20) {
             return res.status(400).json({ error: 'Invalid score data.' });
        }
        
        // --- Core Logic: Load, Process, and Update the Leaderboard ---

        // A. FETCH the current leaderboard data from JSONBin
        const getResponse = await fetch(LEADERBOARD_API, {
            headers: {
                'X-Master-Key': JSONBIN_SECRET_KEY,
            }
        });
        
        if (!getResponse.ok) {
            console.error('Failed to fetch existing leaderboard:', await getResponse.text());
            return res.status(500).json({ error: 'Failed to retrieve current leaderboard.' });
        }
        
        const currentData = await getResponse.json();
        // Assuming your bin structure is like { "record": { "leaders": [...] } }
        let leaders = currentData.record.leaders || [];
        
        // B. PROCESS the new score with the existing leaders (e.g., replace if higher, sort, limit)
        // This logic is critical for maintaining an accurate, secure leaderboard.
        const newScore = { name, shrimps, date: new Date().toISOString() };
        
        // --- Add your processing/sorting logic here ---
        // For simplicity, we'll just add the new score and sort/limit to 10
        leaders.push(newScore);
        leaders.sort((a, b) => b.shrimps - a.shrimps);
        leaders = leaders.slice(0, 10);
        // --- End processing logic ---

        // C. PUT the updated leaderboard back to JSONBin (using the secure key)
        const putResponse = await fetch(LEADERBOARD_API, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_SECRET_KEY, // The secret is used here!
                'X-Bin-Versioning': 'false' // Recommended to prevent rapid versioning
            },
            body: JSON.stringify({ leaders })
        });

        if (!putResponse.ok) {
            console.error('Failed to update leaderboard:', await putResponse.text());
            return res.status(500).json({ error: 'Failed to update leaderboards.' });
        }

        return res.status(200).json({ message: 'Score submitted and leaderboard updated successfully.' });

    } catch (error) {
        console.error('Serverless function error:', error);
        return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
}
