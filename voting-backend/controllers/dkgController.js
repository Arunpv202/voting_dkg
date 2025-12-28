const db = require('../models');
const ElectionCrypto = db.ElectionCrypto;
const Wallet = db.Wallet;
const EncryptedShare = db.EncryptedShare;

// Internal helper for Ristretto
async function getRistretto() {
    return import('@noble/curves/ed25519.js').then(m => m.ristretto255);
}

// Internal helper to trigger Round 2 transition
const triggerRound2 = async (election_id) => {
    try {
        const crypto = await ElectionCrypto.findByPk(election_id);
        if (crypto && crypto.status === 'round1') {
            crypto.status = 'round2';
            await crypto.save();
            console.log(`[DKG] Auto-transitioned Election ${election_id} to Round 2`);
        }
    } catch (error) {
        console.error(`[DKG] Error transitioning to Round 2 for ${election_id}:`, error);
    }
};

// Exported helper to start Round 1 (called by electionController)
exports.triggerRound1 = async (election_id) => {
    try {
        console.log(`[DKG] Triggering Round 1 for Election ${election_id}`);
        const now = new Date();
        const twoMinutes = 2 * 60 * 1000;
        const endTime = new Date(now.getTime() + twoMinutes);

        // Update ElectionCrypto status
        /* 
           Note: We assume the ElectionCrypto record might already exist 
           or needs to be created. upsert is safest if we aren't sure.
           However, commonly it might be created here or just updated.
        */
        const [crypto, created] = await ElectionCrypto.upsert({
            election_id,
            status: 'round1',
            round1_start_time: now,
            round1_end_time: endTime
        });

        console.log(`[DKG] Round 1 started. Ends at ${endTime.toISOString()}`);

        // Set 2-minute timer for checking/transitioning to Round 2
        // Note: This timer lives in memory. If server restarts, this might be lost 
        // unless we have a startup check. For now, we implement the memory timer as requested.
        setTimeout(() => {
            triggerRound2(election_id);
        }, twoMinutes);

    } catch (error) {
        console.error(`[DKG] Error triggering Round 1 for ${election_id}:`, error);
    }
};

exports.getDkgStatus = async (req, res) => {
    try {
        const { election_id } = req.params;
        const crypto = await ElectionCrypto.findByPk(election_id);

        if (!crypto) {
            return res.status(404).json({ message: 'DKG process not initialized' });
        }

        res.json({
            status: crypto.status,
            round1_start_time: crypto.round1_start_time,
            round1_end_time: crypto.round1_end_time,
            polynomial_degree: crypto.polynomial_degree
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.submitPublicKey = async (req, res) => {
    try {
        const { election_id, wallet_address, pk } = req.body;

        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election Crypto not found' });

        if (crypto.status !== 'round1') {
            return res.status(400).json({ message: `Round 1 is not active. Current status: ${crypto.status}` });
        }

        const now = new Date();
        if (crypto.round1_end_time && now > crypto.round1_end_time) {
            return res.status(400).json({ message: 'Round 1 time has expired' });
        }

        if (!wallet_address) {
            return res.status(400).json({ message: 'Wallet address is required' });
        }

        const authority = await Wallet.findOne({
            where: {
                election_id,
                wallet_address,
                role: 'authority' // STRICT CHECK to ensure we get the authority record
            }
        });

        if (!authority) {
            return res.status(404).json({ message: 'Authority wallet not found' });
        }

        // Save Public Key
        authority.pk = pk;
        await authority.save();

        res.json({
            message: 'Public key submitted successfully',
            authority_id: authority.authority_id
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.submitRound2 = async (req, res) => {
    try {
        const { election_id, wallet_address, commitment, shares } = req.body;

        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election not found' });

        if (crypto.status !== 'round2') {
            return res.status(400).json({ message: `Round 2 is not active. Status: ${crypto.status}` });
        }

        const authority = await Wallet.findOne({
            where: {
                election_id,
                wallet_address,
                role: 'authority' // User emphasized strictly finding the authority record
            }
        });
        if (!authority) return res.status(404).json({ message: 'Authority not found or user is not an authority for this election' });

        // Store Commitment
        authority.commitment = commitment; // Storing as hex string
        await authority.save();

        // Store Encrypted Shares
        if (shares && Array.isArray(shares)) {
            const shareRecords = shares.map(s => ({
                election_id,
                from_authority_id: authority.authority_id,
                to_authority_id: s.to_authority_id,
                encrypted_share: s.encrypted_share
            }));
            await EncryptedShare.bulkCreate(shareRecords);
        }

        // Check if ALL authorities have submitted commitments
        const authorities = await Wallet.findAll({
            where: {
                election_id,
                authority_id: { [db.Sequelize.Op.ne]: null }
            }
        });

        const allCommitted = authorities.every(a => a.commitment);

        if (allCommitted) {
            console.log(`[DKG] All authorities committed for ${election_id}. Computing Election PK...`);

            // Sum commitments to get Election PK
            const ristretto255 = await getRistretto();
            let sumPoint = ristretto255.Point.ZERO;

            for (const auth of authorities) {
                const point = ristretto255.Point.fromHex(auth.commitment);
                sumPoint = sumPoint.add(point);
            }

            const electionPK = sumPoint.toHex();

            crypto.election_pk = electionPK;
            crypto.status = 'completed';
            await crypto.save();
            console.log(`[DKG] Election PK Computed: ${electionPK}`);
        }

        res.json({ message: 'Round 2 submission successful' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getShares = async (req, res) => {
    try {
        const { election_id, authority_id } = req.params;

        const shares = await EncryptedShare.findAll({
            where: {
                election_id,
                to_authority_id: authority_id
            }
        });

        res.json({ shares });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


exports.getAuthorities = async (req, res) => {
    try {
        const { election_id } = req.params;
        const authorities = await Wallet.findAll({
            where: {
                election_id,
                authority_id: { [db.Sequelize.Op.ne]: null }
            },
            attributes: ['authority_id', 'pk', 'wallet_address']
        });
        res.json({ authorities });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
