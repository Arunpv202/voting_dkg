const db = require('./models');

async function promoteWallet() {
    const address = '0x66c630b6b1c44dd9b07a9482d64718fd45824aed';
    try {
        const wallet = await db.Wallet.findOne({
            where: { wallet_address: address }
        });

        if (wallet) {
            console.log(`Found wallet. Current Role: ${wallet.role}`);
            wallet.role = 'authority';
            wallet.authority_id = 4; // Assigning ID 4 as requested/observed
            await wallet.save();
            console.log('✅ Successfully promoted wallet to AUTHORITY (ID: 4)');
        } else {
            console.log('❌ Wallet not found.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

promoteWallet();
