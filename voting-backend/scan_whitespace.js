const db = require('./models');

async function scanWhitespace() {
    try {
        console.log('--- Scanning DB for Whitespace ---');
        const wallets = await db.Wallet.findAll();
        let dirty = 0;
        wallets.forEach(w => {
            if (w.wallet_address !== w.wallet_address.trim()) {
                console.log(`[DIRTY] '${w.wallet_address}' (Role: ${w.role})`);
                dirty++;
            }
        });

        if (dirty === 0) {
            console.log('✅ Database is clean. No whitespace found in wallet addresses.');
        } else {
            console.log(`⚠️ Found ${dirty} records with whitespace.`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

scanWhitespace();
