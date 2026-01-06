const db = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const ElectionCrypto = db.ElectionCrypto;
const Wallet = db.Wallet;
const EncryptedShare = db.EncryptedShare;

// Internal helper for Ristretto
async function getRistretto() {
    return import('@noble/curves/ed25519.js').then(m => m.ristretto255);
}

// Schnorr Verification Helper
async function verifySchnorr(pkHex, proof, electionId) {
    if (!proof || !proof.R || !proof.s) return false;
    const { R, s } = proof;
    const ristretto255 = await getRistretto();

    try {
        // Reconstruct Challenge c = Hash(pk || R || electionId)
        const challengeInput =
            pkHex + R + String(electionId);

        const hash = crypto.createHash('sha256').update(challengeInput).digest();
        const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
        const c = BigInt('0x' + hash.toString('hex')) % L;

        // Verify: s*G == R + c*PK
        const sG = ristretto255.Point.BASE.multiply(BigInt('0x' + s));

        const R_point = ristretto255.Point.fromHex(R);
        const P_point = ristretto255.Point.fromHex(pkHex);
        const cP = P_point.multiply(c);
        const RHS = R_point.add(cP);

        return sG.equals(RHS);
    } catch (e) {
        console.error("ZKP Verify Error:", e);
        return false;
    }
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
        const threeMinutes = 3 * 60 * 1000;
        const endTime = new Date(now.getTime() + threeMinutes);

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

        // Set 3-minute timer for checking/transitioning to Round 2
        // Note: This timer lives in memory. If server restarts, this might be lost 
        // unless we have a startup check. For now, we implement the memory timer as requested.
        // User requested to remove time constraints for testing.
        /*
        setTimeout(() => {
            triggerRound2(election_id);
        }, threeMinutes);
        */

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
        const { election_id, wallet_address, pk, proof } = req.body;

        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election Crypto not found' });

        // Strict check disabled for testing flexibility as per user request
        /*
        if (crypto.status !== 'round1') {
            return res.status(400).json({ message: `Round 1 is not active. Current status: ${crypto.status}` });
        }
        */

        const now = new Date();
        // User requested to remove time constraints
        /*
        if (crypto.round1_end_time && now > crypto.round1_end_time) {
            return res.status(400).json({ message: 'Round 1 time has expired' });
        }
        */

        if (!wallet_address) {
            return res.status(400).json({ message: 'Wallet address is required' });
        }

        // Verify ZKP
        const isValid = await verifySchnorr(pk, proof, election_id);
        if (!isValid) {
            console.warn(`[DKG] Invalid ZKP for ${wallet_address} in election ${election_id}`);
            return res.status(400).json({ message: 'Invalid Zero-Knowledge Proof. You verify as the owner of this key.' });
        }

        console.log(`[DKG Debug] submitPublicKey received: Election=${election_id}, Wallet=${wallet_address}`);

        // Fix for Multi-Role Compoosite Keys:
        // Fetch ALL rows for this user/election, then find the authority role in memory.
        // This avoids Sequelize findOne ambiguity with composite keys.
        const allRoles = await Wallet.findAll({
            where: {
                election_id,
                wallet_address
            }
        });

        const authority = allRoles.find(w => w.role === 'authority' || w.role === 'admin');

        console.log(`[DKG Debug] Wallet Lookup: Found ${allRoles.length} rows. Authority Record:`, authority ? 'YES' : 'NO');
        if (allRoles.length > 0) {
            console.log('[DKG Debug] Roles found:', allRoles.map(r => r.role).join(', '));
        }

        console.log(`[DKG Debug] Wallet Lookup Result:`, authority ? `Found ID ${authority.authority_id}` : 'Not Found');

        if (!authority) {
            // If strictly must be authority to submit logic
            return res.status(404).json({ message: 'Authority wallet not found' });
        }

        // CHECK: Prevent duplicate submission
        if (authority.pk) {
            return res.status(400).json({ message: 'You have already submitted your Public Key.' });
        }

        // ZKP Verified at start of function

        // Save Public Key

        // Save Public Key
        authority.pk = pk;
        await authority.save();

        res.json({
            message: 'Public key verified and submitted successfully',
            authority_id: authority.authority_id
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.submitRound2 = async (req, res) => {
    try {
        const { election_id, wallet_address, commitments, shares } = req.body;

        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election not found' });

        // Strict status check disabled for testing
        /*
        if (crypto.status !== 'round2') {
            return res.status(400).json({ message: `Round 2 is not active. Status: ${crypto.status}` });
        }
        */

        const allRoles = await Wallet.findAll({
            where: {
                election_id,
                wallet_address
            }
        });
        const authority = allRoles.find(w => w.role === 'authority');

        if (!authority) return res.status(404).json({ message: 'Authority not found or user is not an authority for this election' });

        // Store Commitments (Feldman VSS)
        // Input: commitments = [C0, C1, ... Ct] (Array of Hex Strings)
        // Storage: Store as JSON string in `commitment` TEXT field
        if (commitments && Array.isArray(commitments)) {
            authority.commitment = JSON.stringify(commitments);
        } else {
            // Fallback for single commitment if legacy or minimal
            // But for full VSS we require the array.
            // We'll proceed but log warning.
            console.warn("Received Round 2 submission without polynomial commitments list.");
        }

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

        // Check if everyone has submitted (non-null commitment)
        const allCommitted = authorities.every(a => a.commitment != null);

        if (allCommitted) {
            console.log(`[DKG] All authorities committed for ${election_id}. Computing Election PK...`);

            // Sum C_0 from everyone to get Election PK
            // C_0 is the first element of the stored JSON array
            const ristretto255 = await getRistretto();
            let sumPoint = ristretto255.Point.ZERO;

            for (const auth of authorities) {
                let C0_Hex;
                try {
                    const parsed = JSON.parse(auth.commitment);
                    if (Array.isArray(parsed)) {
                        C0_Hex = parsed[0];
                    } else {
                        // Legacy fallback if it was a simple string
                        C0_Hex = auth.commitment;
                    }
                } catch (e) {
                    C0_Hex = auth.commitment; // Assuming raw hex string if parse fails
                }

                if (C0_Hex) {
                    const point = ristretto255.Point.fromHex(C0_Hex);
                    sumPoint = sumPoint.add(point);
                }
            }

            const electionPK = sumPoint.toHex();

            crypto.election_pk = electionPK;
            crypto.status = 'completed';
            await crypto.save();
            console.log(`[DKG] Election PK Computed: ${electionPK}`);
        }

        res.json({ message: 'Round 2 submission successful with VSS Commitments' });

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
            attributes: ['authority_id', 'pk', 'wallet_address', 'commitment']
        });
        res.json({ authorities });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

exports.initRound2 = async (req, res) => {
    try {
        const { election_id, wallet_address } = req.body;

        // 1. Check Election Status
        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election not found' });

        if (crypto.status !== 'round2') {
            return res.status(400).json({ message: `Round 2 is not active. Current status: ${crypto.status}` });
        }

        // 2. Find My Authority ID
        const myAuth = await Wallet.findOne({
            where: {
                election_id,
                wallet_address,
                role: {
                    [Op.in]: ['authority', 'admin']
                }
            }
        });

        if (!myAuth) {
            return res.status(403).json({ message: 'You are not an authority in this election.' });
        }

        // 3. Get Other Authorities (Peers)
        const peers = await Wallet.findAll({
            where: {
                election_id,
                role: {
                    [Op.in]: ['authority', 'admin']
                },
                authority_id: { [db.Sequelize.Op.ne]: myAuth.authority_id } // Exclude self
            },
            attributes: ['authority_id', 'pk', 'commitment'] // Return commitments for VSS
        });

        res.json({
            authority_id: myAuth.authority_id,
            peers
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
