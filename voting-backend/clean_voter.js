const db = require('./models');

async function cleanVoter() {
    const address = '0x66c630b6b1c44dd9b07a9482d64718fd45824aed';
    const electionId = 'arew';

    try {
        const voter = await db.Wallet.findOne({
            where: {
                wallet_address: address,
                election_id: electionId,
                role: 'voter'
            }
        });

        if (voter) {
            console.log(`Found voter. Authority ID is: ${voter.authority_id}`);
            if (voter.authority_id !== null) {
                voter.authority_id = null;
                await voter.save();
                console.log('✅ Cleared authority_id for this voter.');
            } else {
                console.log('Authority ID is already null.');
            }
        } else {
            console.log('Voter row not found.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

cleanVoter();
