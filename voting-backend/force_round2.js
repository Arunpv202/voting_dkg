const db = require('./models');

async function setRound2() {
    const electionId = 'arew';
    try {
        const crypto = await db.ElectionCrypto.findByPk(electionId);
        if (crypto) {
            crypto.status = 'round2';
            crypto.round1_end_time = new Date(); // End round 1 now
            await crypto.save();
            console.log(`✅ Election '${electionId}' status set to 'round2'.`);
        } else {
            console.log('Election not found.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

setRound2();
