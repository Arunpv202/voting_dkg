const db = require('./models');

async function debugLookup() {
    const address = '0xde4eb2c0ccd138ce18e0a862399e866985f82b5b';
    const electionId = 'arew';

    try {
        // 0. Check DB Connection
        const config = db.sequelize.config;
        console.log(`[DEBUG] Connecting to Database: ${config.database} on ${config.host}`);

        // 1. Raw SQL Check - ALL rows for election 'arew'
        console.log(`--- 1. Raw SQL Query (All rows for election "${electionId}") ---`);
        const [results, metadata] = await db.sequelize.query(
            "SELECT wallet_address, role, authority_id FROM Wallets WHERE election_id = :elec",
            {
                replacements: { elec: electionId }
            }
        );
        console.log(`Found ${results.length} total rows for election '${electionId}'.`);
        results.forEach(r => console.log(`${r.wallet_address} | ${r.role} | AuthID: ${r.authority_id}`));

        // 2. Specific Address Filter check
        const specific = results.filter(r => r.wallet_address === address);
        console.log(`\nFiltering for user's address: ${address}`);
        console.log(`Matches found in set: ${specific.length}`);
        specific.forEach(r => console.log(` >> ${r.role}`));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

debugLookup();
