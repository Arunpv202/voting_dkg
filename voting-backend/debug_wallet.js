const db = require('./models');

async function checkWallet() {
    const address = '0x66c630b6b1c44dd9b07a9482d64718fd45824aed';
    try {
        const wallet = await db.Wallet.findOne({
            where: { wallet_address: address }
        });

        console.log('--- Wallet Debug Info ---');
        if (wallet) {
            console.log('Address:', wallet.wallet_address);
            console.log('Election ID:', wallet.election_id);
            console.log('Role:', wallet.role);
            console.log('Authority ID:', wallet.authority_id);
            console.log('Public Key (Round 1):', wallet.pk ? wallet.pk.substring(0, 10) + '...' : 'None');
            console.log('Commitment:', wallet.commitment ? 'Present' : 'None');
        } else {
            console.log('Wallet NOT FOUND in database.');
        }
        console.log('-------------------------');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

checkWallet();
