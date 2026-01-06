const db = require('./models');

async function fixWhitespace() {
    try {
        console.log('--- Checking for Whitespace Issues ---');

        // Fetch all wallets
        const wallets = await db.Wallet.findAll();
        console.log(`Scanning ${wallets.length} wallets...`);

        let fixedCount = 0;

        for (const w of wallets) {
            const original = w.wallet_address;
            const trimmed = original.trim();

            if (original !== trimmed) {
                console.log(`[FIXING] Found whitespace in: '${original}' -> '${trimmed}' (Role: ${w.role})`);

                // We cannot just update the PK field easily in Sequelize if strictly enforced,
                // but let's try a direct SQL update to avoid Model PK limitations if possible,
                // or try to destroy and recreate. 
                // Direct SQL is safer for data correction without triggering Sequelize PK checks.

                await db.sequelize.query(
                    "UPDATE Wallets SET wallet_address = :trimmed WHERE wallet_address = :original AND election_id = :elec AND role = :role",
                    {
                        replacements: {
                            trimmed: trimmed,
                            original: original,
                            elec: w.election_id,
                            role: w.role
                        }
                    }
                );
                fixedCount++;
            }
        }

        console.log(`--- Done. Fixed ${fixedCount} records. ---`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

fixWhitespace();
