const db = require('./models');

async function createAuthRow() {
    const address = '0xde4eb2c0ccd138ce18e0a862399e866985f82b5b'; // Address from user logs
    const electionId = 'arew';

    try {
        console.log(`Creating Authority row for: ${address} in election: ${electionId}`);

        // 1. Check if it already exists to avoid PK collision error (though we expect it missing)
        const check = await db.Wallet.findOne({
            where: {
                wallet_address: address,
                election_id: electionId,
                role: 'authority'
            }
        });

        if (check) {
            console.log('Authority row ALREADY EXISTS. Updating ID/PK just in case.');
            check.authority_id = 2; // Assuming ID 2 based on user screenshot/order
            // Ensure data is clean
            await check.save();
        } else {
            console.log('Authority row missing. Creating NEW row...');
            await db.Wallet.create({
                wallet_address: address,
                election_id: electionId,
                role: 'authority',
                authority_id: 2
            });
            console.log('✅ Created Authority row.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

createAuthRow();
