const db = require('./models');

async function checkWallet() {
    const address = '0x66c630b6b1c44dd9b07a9482d64718fd45824aed';
    const electionId = 'arew'; // as per logs
    try {
        const wallet = await db.Wallet.findOne({
            where: {
                wallet_address: address,
                election_id: electionId
            }
        });

        console.log(`--- Wallet Debug Info for Election: ${electionId} ---`);
        if (wallet) {
            console.log('Address:', wallet.wallet_address);
            console.log('Election ID:', wallet.election_id);
            console.log('Role:', wallet.role);
            console.log('Authority ID:', wallet.authority_id);
        } else {
            console.log('Wallet NOT FOUND for this election.');

            // Check if it exists for ANY election
            const anyWallet = await db.Wallet.findOne({ where: { wallet_address: address } });
            if (anyWallet) {
                console.log(`(However, this wallet exists for election: ${anyWallet.election_id})`);
            }
        }
        console.log('-------------------------');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

checkWallet();
