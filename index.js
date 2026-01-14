const admin = require("firebase-admin");

// ==========================================
// 🔐 SECURITY SETUP (Env Variable se Key lo)
// ==========================================
const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountRaw) {
    console.error("❌ ERROR: FIREBASE_SERVICE_ACCOUNT secret missing hai!");
    process.exit(1);
}

// Secret JSON ko parse karo
const serviceAccount = JSON.parse(serviceAccountRaw);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // 👇 APNI DATABASE URL YAHAN REPLACE KAREIN
  databaseURL: "https://starx-network-default-rtdb.firebaseio.com"
});

const db = admin.database();

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const MAX_WINNERS = 20;

// Reward Logic (Ranking dikhane ke liye)
function getRewardAmount(rank) {
    if (rank === 1) return 500;
    if (rank === 2) return 300;
    if (rank === 3) return 150;
    if (rank <= 10) return 50;
    if (rank <= 20) return 20;
    return 0;
}

// ==========================================
// 🚀 MAIN LOGIC
// ==========================================
async function updateLeaderboard() {
    console.log(`\n[${new Date().toLocaleString()}] 🔄 Starting Leaderboard Update via GitHub Actions...`);

    try {
        const usersRef = db.ref("users");
        const snapshot = await usersRef.once("value");

        if (!snapshot.exists()) {
            console.log("⚠️ No users found in database.");
            return;
        }

        let allUsers = [];

        snapshot.forEach((child) => {
            const userData = child.val();
            let inviteCount = 0;

            if (userData.dailyInvites) {
                inviteCount = Object.keys(userData.dailyInvites).length;
            }

            if (inviteCount > 0) {
                allUsers.push({
                    uid: child.key,
                    username: userData.username || "Unknown",
                    invites: inviteCount
                });
            }
        });

        // Sort: Highest Invites First
        allUsers.sort((a, b) => b.invites - a.invites);

        // Top 20
        const topUsers = allUsers.slice(0, MAX_WINNERS);

        // Format
        const formattedList = topUsers.map((user, index) => {
            return {
                uid: user.uid,
                username: user.username,
                invites: user.invites,
                rank: index + 1,
                reward: getRewardAmount(index + 1)
            };
        });

        // Save to Firebase
        await db.ref("leaderboard").set({
            lastUpdated: Date.now(),
            list: formattedList
        });

        console.log(`✅ SUCCESS: Leaderboard updated with ${formattedList.length} users.`);
        process.exit(0); // Kaam khatam, script band

    } catch (error) {
        console.error("❌ ERROR:", error.message);
        process.exit(1); // Error ke sath band
    }
}

updateLeaderboard();

