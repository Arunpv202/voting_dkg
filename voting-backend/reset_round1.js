const db = require('./models');

async function resetRound1() {
    const electionId = 'lklk';
    try {
        const crypto = await db.ElectionCrypto.findByPk(electionId);

        if (crypto) {
            console.log(`Found election. Current Status: ${crypto.status}`);
            crypto.status = 'round1';
            // Extend time to ensure it doesn't expire immediately (though disabled in code, good practice for DB consistency)
            const now = new Date();
            const oneHour = 60 * 60 * 1000;
            crypto.round1_start_time = now;
            crypto.round1_end_time = new Date(now.getTime() + oneHour);

            await crypto.save();
            console.log('✅ Successfully reset election to ROUND 1');
        } else {
            console.log('❌ Election not found.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

resetRound1();
