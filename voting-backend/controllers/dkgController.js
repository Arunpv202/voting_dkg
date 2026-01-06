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
// Schnorr Verification Helper
// Protocol: s * G = R + c * PK
// c = H(DomSep || R || PK || M)
// Schnorr Verification Helper
// Protocol: s * G = R + c * PK
// c = H(DomSep || R || PK || M)
async function verifySchnorr(pkHex, proof, electionId) {
    if (!proof || !proof.R || !proof.s) return false;
    const { R, s } = proof;
    const ristretto255 = await getRistretto();

    try {
        // Validate Hex Inputs
        if (!/^[0-9a-fA-F]{64}$/.test(pkHex) || !/^[0-9a-fA-F]{64}$/.test(R) || !/^[0-9a-fA-F]{64}$/.test(s)) {
            console.warn("Invalid Hex Format in ZKP");
            return false;
        }

        const R_point = ristretto255.Point.fromHex(R);
        const P_point = ristretto255.Point.fromHex(pkHex);

        // Domain Separated Challenge
        const hash = crypto.createHash('sha256');
        hash.update('Voting_Schnorr_Proof_v1'); // Domain Separation Tag
        hash.update(Buffer.from(R, 'hex'));
        hash.update(Buffer.from(pkHex, 'hex'));
        hash.update(Buffer.from(String(electionId)));

        const digest = hash.digest();

        // FIX: Hardcoded Group Order for Ristretto255 (same as Ed25519 scalar field)
        const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

        const c_hex = digest.toString('hex');
        const c = BigInt('0x' + c_hex) % L;

        // Verify: s*G == R + c*PK
        const sG = ristretto255.Point.BASE.multiply(BigInt('0x' + s));
        const cP = P_point.multiply(c);
        const RHS = R_point.add(cP);

        const result = sG.equals(RHS);
        if (!result) {
            console.log("[ZKP Debug] Verification Failed:");
            console.log("  PK:", pkHex);
            console.log("  ElectionID:", electionId);
            console.log("  Computed Challenge (c):", c.toString(16));
            console.log("  LHS (s*G):", sG.toHex());
            console.log("  RHS (R+c*P):", RHS.toHex());
        }
        return result;

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

// Exported helper to trigger Round 1
// Supports dual signature: (election_id) OR (req, res)
exports.triggerRound1 = async (arg1, res) => {
    let election_id;
    let isHttp = false;

    try {
        if (arg1 && arg1.body && arg1.body.election_id) {
            election_id = arg1.body.election_id;
            isHttp = true;
        } else if (typeof arg1 === 'string' || typeof arg1 === 'number') {
            election_id = arg1;
        } else {
            throw new Error('Invalid arguments to triggerRound1');
        }

        console.log(`[DKG] Triggering Round 1 for Election ${election_id}`);
        const now = new Date();
        const threeMinutes = 3 * 60 * 1000;
        const endTime = new Date(now.getTime() + threeMinutes);

        const [crypto, created] = await ElectionCrypto.upsert({
            election_id,
            status: 'round1',
            round1_start_time: now,
            round1_end_time: endTime
        });

        console.log(`[DKG] Round 1 started. Ends at ${endTime.toISOString()}`);

        if (isHttp && res) {
            res.json({ message: 'Round 1 Triggered successfully' });
        }

    } catch (error) {
        console.error(`[DKG] Error triggering Round 1 for ${election_id}:`, error);
        if (isHttp && res) {
            res.status(500).json({ message: error.message });
        }
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

exports.triggerRound2 = async (req, res) => {
    try {
        const { election_id } = req.body;
        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election not found' });

        crypto.status = 'round2';
        // crypto.round1_end_time = new Date(); // Update timestamps if tracking
        await crypto.save();
        res.json({ message: 'Round 2 manually triggered' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.submitPublicKey = async (req, res) => {
    try {
        const { election_id, wallet_address, pk, proof } = req.body;

        // 1. Basic Validation
        if (!election_id || !wallet_address || !pk || !proof) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        if (!/^[0-9a-fA-F]{64}$/.test(pk)) {
            return res.status(400).json({ message: 'Invalid Public Key Format' });
        }

        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election Crypto not found' });

        // 2. Lookup Authority (Using findAll workaround for safety)
        const allRoles = await Wallet.findAll({
            where: { election_id, wallet_address: wallet_address.trim() } // Ensure trimmed
        });
        const authority = allRoles.find(w => w.role === 'authority' || w.role === 'admin');

        if (!authority) {
            return res.status(403).json({ message: 'Authority wallet not found in election roster.' });
        }

        // 3. Prevent Duplicate Submission Logic
        if (authority.pk && authority.pk !== pk) {
            return res.status(409).json({ message: 'A different Public Key is already registered for this authority.' });
        }
        if (authority.pk === pk) {
            // Idempotent success
            return res.json({ message: 'Public Key already submitted', authority_id: authority.authority_id });
        }

        // 4. Verify ZKP
        const isValid = await verifySchnorr(pk, proof, election_id);
        if (!isValid) {
            console.warn(`[DKG] Invalid ZKP for ${wallet_address} in election ${election_id}`);
            return res.status(400).json({ message: 'Zero-Knowledge Proof Verification Failed.' });
        }

        // 5. Success - Save
        authority.pk = pk;
        await authority.save();

        console.log(`[DKG] PK Submitted for AuthID ${authority.authority_id}`);

        res.json({
            message: 'Public key verified and submitted successfully',
            authority_id: authority.authority_id
        });

    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};

exports.submitRound2 = async (req, res) => {
    try {
        const { election_id, wallet_address, commitments, shares } = req.body;

        // 1. Validate Inputs
        if (!commitments || !Array.isArray(commitments) || commitments.length === 0) {
            return res.status(400).json({ message: 'Invalid commitments. Must be a non-empty array of hex strings.' });
        }
        // Basic Hex Check for Commitments
        if (!commitments.every(c => /^[0-9a-fA-F]{64}$/.test(c))) {
            return res.status(400).json({ message: 'Commitments must be valid 32-byte hex strings.' });
        }

        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election not found' });

        // 2. Auth Lookup
        const allRoles = await Wallet.findAll({
            where: { election_id, wallet_address: wallet_address.trim() }
        });
        const authority = allRoles.find(w => w.role === 'authority' || w.role === 'admin');

        if (!authority) return res.status(403).json({ message: 'Authority not found' });

        // 3. Store Commitments and Shares
        authority.commitment = JSON.stringify(commitments);
        await authority.save();

        // Overwrite existing shares if re-submitting to prevent duplicates/ghost shares
        if (shares && Array.isArray(shares)) {
            // Transactional delete + create is better, but simple approaches:
            await EncryptedShare.destroy({
                where: {
                    election_id,
                    from_authority_id: authority.authority_id
                }
            });
            const shareRecords = shares.map(s => ({
                election_id,
                from_authority_id: authority.authority_id,
                to_authority_id: s.to_authority_id,
                encrypted_share: s.encrypted_share
            }));
            await EncryptedShare.bulkCreate(shareRecords);
        }

        // 4. Aggregation Check (Is Round 2 Done?)
        // Fetch all authorities who act as key holders
        const authorities = await Wallet.findAll({
            where: {
                election_id,
                role: { [Op.in]: ['authority', 'admin'] }
            }
        });

        // Verify if everyone has committed
        const allCommitted = authorities.every(a => a.commitment != null);

        if (allCommitted && authorities.length > 0) {
            console.log(`[DKG] All ${authorities.length} authorities committed. Computing Election PK...`);

            const ristretto255 = await getRistretto();
            let sumPoint = ristretto255.Point.ZERO;
            let success = true;

            for (const auth of authorities) {
                try {
                    const parsed = JSON.parse(auth.commitment);
                    const C0_Hex = parsed[0]; // C0 = a0*G = Public Key Share
                    if (!C0_Hex) throw new Error("Missing C0");
                    const point = ristretto255.Point.fromHex(C0_Hex);
                    sumPoint = sumPoint.add(point);
                } catch (e) {
                    console.error(`[DKG] Failed to aggregate from AuthID ${auth.authority_id}:`, e);
                    success = false; // Cannot compute valid PK if one is bad
                    break;
                }
            }

            if (success) {
                const electionPK = sumPoint.toHex();
                crypto.election_pk = electionPK;
                crypto.status = 'completed';
                await crypto.save();
                console.log(`[DKG] Election PK Computed: ${electionPK}`);
            } else {
                console.warn("[DKG] Aggregation failed due to corrupted commitment data.");
            }
        }

        res.json({ message: 'Round 2 submission accepted.' });

    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};

exports.getShares = async (req, res) => {
    try {
        const { election_id, authority_id } = req.params;

        const shares = await EncryptedShare.findAll({
            where: {
                election_id,
                to_authority_id: authority_id
            },
            raw: true
        });

        // Enhance shares with Sender's Commitment
        // We fetching all authorities for this election to map commitments
        // This is efficient enough for small N
        const authorities = await Wallet.findAll({
            where: { election_id, role: { [Op.in]: ['authority', 'admin'] } },
            attributes: ['authority_id', 'commitment', 'pk']
        });

        const enhancedShares = shares.map(share => {
            const sender = authorities.find(a => String(a.authority_id) === String(share.from_authority_id));
            if (sender) {
                // We fake the structure expected by frontend (which expects 'shares' but looks up 'sender' in 'peers')
                // Actually, Frontend looks up sender in 'peers' list.
                // BUT, if we add 'commitment' to the share object itself, we can modify Frontend to use it?
                // The current Frontend (Round2.jsx) does: 
                //    const sender = allLookups.find(p => p.authority_id === item.from_authority_id);
                //    if (sender.commitment) ...

                // So updating Backend here DOES NOT automatically fix Frontend unless Frontend uses this data.
                // However, since Frontend logic is "find sender in list", we are Stuck with Stale List on Frontend.

                // WAIT. I can't easily change Frontend state from here.
                // BUT, if I update 'getShares' response...
                // AND I update Frontend to PREFER the info from 'getShares' if available?
                // Or I can just make 'Round2.jsx' fetch fresh peers before calc?

                // Let's do BOTH.
                // But specifically for this tool call, I will enhance the response.
                // AND I will modify the Frontend in the next step to usage this enhanced data or refresh peers.
                return {
                    ...share,
                    sender_commitment: sender.commitment,
                    sender_pk: sender.pk
                };
            }
            return share;
        });

        res.json({ shares: enhancedShares });
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

        // Temporarily allow if completed too, to let users re-enter to see shares
        if (crypto.status !== 'round2' && crypto.status !== 'completed') {
            return res.status(400).json({ message: `Round 2 is not active. Current status: ${crypto.status}` });
        }

        // 2. Find My Authority ID
        const myAuth = await Wallet.findOne({
            where: {
                election_id,
                wallet_address: wallet_address.trim(), // fix spaces
                role: { [Op.in]: ['authority', 'admin'] }
            }
        });

        if (!myAuth) {
            return res.status(403).json({ message: 'You are not an authority in this election.' });
        }

        // 3. Get Other Authorities (Peers)
        const peers = await Wallet.findAll({
            where: {
                election_id,
                role: { [Op.in]: ['authority', 'admin'] },
                authority_id: { [db.Sequelize.Op.ne]: myAuth.authority_id } // Exclude self
            },
            attributes: ['authority_id', 'pk', 'commitment'] // Return commitments for VSS
        });

        res.json({
            authority_id: myAuth.authority_id,
            peers
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
}

exports.getAdminStatus = async (req, res) => {
    try {
        const { election_id } = req.params;

        // Fetch Election Crypto Status
        const crypto = await ElectionCrypto.findByPk(election_id);

        // Fetch all potential authorities
        const authorities = await Wallet.findAll({
            where: {
                election_id,
                role: { [db.Sequelize.Op.in]: ['authority', 'admin'] }
            },
            attributes: ['authority_id', 'wallet_address', 'role', 'pk', 'commitment']
        });

        const detailed = authorities.map(a => ({
            authority_id: a.authority_id,
            wallet_address: a.wallet_address,
            role: a.role,
            has_round1: !!a.pk,
            has_round2: !!a.commitment,
            status: (!a.pk) ? 'Pending Round 1' : (!a.commitment) ? 'Pending Round 2' : 'Completed'
        }));

        res.json({
            authorities: detailed,
            election_status: crypto ? crypto.status : 'unknown',
            election_pk: crypto ? crypto.election_pk : null
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.computeElectionKeys = async (req, res) => {
    try {
        const { election_id } = req.body;
        const crypto = await ElectionCrypto.findByPk(election_id);
        if (!crypto) return res.status(404).json({ message: 'Election not found' });

        if (crypto.status === 'completed' && crypto.election_pk) {
            console.log(`[DKG] Already Finalized. Returning existing PK.`);
            return res.json({ message: 'DKG Already Finalized.', election_pk: crypto.election_pk });
        }

        // Fetch all authorities
        const authorities = await Wallet.findAll({
            where: {
                election_id,
                role: { [Op.in]: ['authority', 'admin'] }
            }
        });

        const allCommitted = authorities.every(a => a.commitment != null);
        if (!allCommitted) {
            return res.status(400).json({
                message: 'Cannot finalize: Not all authorities have submitted Round 2 commitments.'
            });
        }

        console.log(`[DKG] Manual Finalization: Computing Election PK...`);

        const ristretto255 = await getRistretto();
        let sumPoint = ristretto255.Point.ZERO;
        let success = true;

        for (const auth of authorities) {
            try {
                const parsed = JSON.parse(auth.commitment);
                const C0_Hex = parsed[0];
                if (!C0_Hex) throw new Error("Missing C0");
                const point = ristretto255.Point.fromHex(C0_Hex);
                sumPoint = sumPoint.add(point);
            } catch (e) {
                console.error(`[DKG] Failed to aggregate from AuthID ${auth.authority_id}:`, e);
                success = false;
                break;
            }
        }

        if (success) {
            const electionPK = sumPoint.toHex();
            crypto.election_pk = electionPK;
            crypto.status = 'completed';
            await crypto.save();
            console.log(`[DKG] Election PK Computed: ${electionPK}`);
            res.json({ message: 'DKG Finalized. Election Public Key Computed.', election_pk: electionPK });
        } else {
            return res.status(500).json({ message: 'Aggregation failed due to corrupted commitment data.' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};
