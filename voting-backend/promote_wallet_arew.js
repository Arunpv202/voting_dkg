const db = require('./models');

async function promoteWalletArew() {
    const address = '0x66c630b6b1c44dd9b07a9482d64718fd45824aed';
    const electionId = 'arew';
    try {
        const wallet = await db.Wallet.findOne({
            where: {
                wallet_address: address,
                election_id: electionId
            }
        });

        if (wallet) {
            console.log(`Found wallet. Current Role: ${wallet.role}`);
            wallet.role = 'authority';
            wallet.authority_id = 1; // Assigning ID 1 for testing (since it's a new election)
            await wallet.save();
            console.log(`✅ Successfully promoted wallet to AUTHORITY (ID: 1) for election '${electionId}'`);
        } else {
            console.log('❌ Wallet not found.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

promoteWalletArew();
