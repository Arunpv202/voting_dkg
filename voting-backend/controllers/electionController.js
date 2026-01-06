const db = require('../models');
const Election = db.Election;
const RegistrationToken = db.RegistrationToken;
const Candidate = db.Candidate;
const Wallet = db.Wallet;
const ElectionCrypto = db.ElectionCrypto;
const MerkleTreeService = require('../utils/merkleTree');
const dkgController = require('./dkgController');

// Helper for Auto Merkle Root Generation
const generateMerkleRoot = async (election_id) => {
    console.log(`Starting Merkle Root generation for ${election_id}`);
    try {
        const election = await Election.findByPk(election_id);
        if (!election) return;

        // Fetch used tokens with commitments
        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        const commitments = tokens.map(t => t.commitment).filter(c => c);
        let root = null;

        if (commitments.length > 0) {
            const merkleService = new MerkleTreeService(commitments);
            root = merkleService.getRoot();
        } else {
            root = '0x0000000000000000000000000000000000000000000000000000000000000000';
        }

        election.merkle_root = root;
        election.status = 'setup_completed';
        await election.save();

        // Calculate and store Election Crypto details
        // DKG Params Logic
        const authorityCount = await Wallet.count({ where: { election_id, role: 'authority' } });

        // User requested: "always make dgree to 3 and threshold to 3"
        // WARNING: This assumes at least 3 authorities or insecure setup for testing.
        const threshold = 3;
        const polynomial_degree = 3;

        await ElectionCrypto.upsert({
            election_id,
            threshold,
            authority_numbers: authorityCount, // Keep actual count for reference
            polynomial_degree,
            status: 'setup'
        });

        // Trigger Round 1 (Status update + Timer)
        await dkgController.triggerRound1(election_id);

        console.log(`Merkle Root generated for ${election_id}: ${root}`);
        console.log(`Election Crypto params set: Auth=${authorityCount}, Thresh=${threshold}, Deg=${polynomial_degree}`);

    } catch (error) {
        console.error(`Error generating Merkle Root for ${election_id}:`, error);
    }
};

exports.createElection = async (req, res) => {
    try {
        const { election_id, election_name, creator_name, wallet_address } = req.body;
        const election = await Election.create({
            election_id,
            election_name,
            creator_name,
            status: 'created'
        });

        // Store Admin Wallet
        if (wallet_address) {
            await Wallet.create({
                wallet_address,
                election_id,
                role: 'admin',
                authority_id: 1
            });
            console.log(`Debug: Authority role created for Admin: ${wallet_address} ID: 1`);
        }
        res.status(201).json(election);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.setupElection = async (req, res) => {
    try {
        const { election_id, candidates, start_time, end_time, result_time, authorities } = req.body;

        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        // Update election details
        election.start_time = start_time;
        election.end_time = end_time;
        election.result_time = result_time;

        await election.save();

        // Store Authority Wallets
        if (authorities && authorities.length > 0) {
            // Start ID from 2 because Admin is ID 1
            let authCounter = 2;

            for (const auth of authorities) {
                if (auth.wallet_address) {
                    // Check if wallet exists
                    const existingWallet = await Wallet.findOne({
                        where: {
                            wallet_address: auth.wallet_address,
                            election_id
                        }
                    });

                    if (existingWallet) {
                        // If Admin (ID 1), skip and warn
                        if (existingWallet.role === 'admin') {
                            console.warn(`[Constraint Violation] Wallet ${auth.wallet_address} is Admin. Cannot be Authority.`);
                            continue;
                        }

                        // Check if already Authority (prevent duplicates)
                        const existingAuthRole = await Wallet.findOne({
                            where: {
                                wallet_address: auth.wallet_address,
                                election_id,
                                role: 'authority'
                            }
                        });
                        if (existingAuthRole) {
                            console.log(`Debug: Wallet ${auth.wallet_address} already has authority role. Skipping.`);
                            continue;
                        }
                    }

                    // Create Authority Role
                    console.log(`Debug: Creating Authority ${authCounter} for ${auth.wallet_address}`);
                    await Wallet.create({
                        wallet_address: auth.wallet_address,
                        election_id,
                        role: 'authority',
                        authority_id: authCounter++
                    });
                }
            }
        }

        // Add candidates
        if (candidates && candidates.length > 0) {
            const candidateData = candidates.map(c => ({
                election_id,
                candidate_name: c.candidate_name,
                symbol_name: c.symbol_name
            }));
            await Candidate.bulkCreate(candidateData);
        }

        res.json({ message: 'Election setup updated', election });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.completeSetup = async (req, res) => {
    try {
        const { election_id } = req.body;
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        election.status = 'registration';
        await election.save();

        // Start 2-minute timer for Merkle Root generation
        const ONE_MINUTE = 1 * 60 * 1000;
        setTimeout(() => generateMerkleRoot(election_id), ONE_MINUTE);

        res.json({ message: 'Registration started. Merkle Root will be generated in 1 minute.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.startRegistration = async (req, res) => {
    try {
        const { election_id } = req.body;
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        election.status = 'registration';
        await election.save();
        res.json({ message: 'Registration started', election });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.closeRegistration = async (req, res) => {
    try {
        const { election_id } = req.body;
        await generateMerkleRoot(election_id);
        res.json({ message: 'Registration closed manually' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMerkleRoot = async (req, res) => {
    try {
        const { election_id } = req.params;
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        res.json({ merkle_root: election.merkle_root });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMerkleWitness = async (req, res) => {
    try {
        const { election_id, commitment } = req.body;

        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        const commitments = tokens.map(t => t.commitment).filter(c => c);
        const merkleService = new MerkleTreeService(commitments);

        const proof = merkleService.getProof(commitment);

        res.json({ proof });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getElection = async (req, res) => {
    try {
        const { election_id } = req.params;
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });
        res.json(election);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
