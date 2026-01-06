import { useState, useEffect } from 'react';
import { ristretto255 } from '@noble/curves/ed25519.js';
import { openDB } from 'idb';
import useAuthStore from '../../../store/useAuthStore';

// Helper for hex conversion
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const TIMER_DURATION = 60; // 1 minute countdown for visual effect

export default function Round2({ electionId, authorityId, dkgState, refresh }) {
    const { walletAddress } = useAuthStore();
    const [status, setStatus] = useState('pending'); // pending, computing, submitted, completed_wait
    const [peers, setPeers] = useState([]);
    const [mySecret, setMySecret] = useState(null);
    const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
    const [finalStatus, setFinalStatus] = useState(null); // 'done' if user finalized

    // Load Peers and My Secret
    useEffect(() => {
        const load = async () => {
            if (!walletAddress) return;

            // 1. Fetch Round 2 Data (My ID + Peers)
            try {
                const res = await fetch('http://localhost:4000/api/dkg/round2/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ election_id: electionId, wallet_address: walletAddress })
                });

                if (res.ok) {
                    const data = await res.json();
                    setPeers(data.peers);
                    // Use returned authority ID for local logic if needed, 
                    // though prop authorityId is also passed. 
                    // User wanted backend to return it.
                    console.log("Round 2 Init: My ID =", data.authority_id);
                } else {
                    const err = await res.json();
                    console.error("Round 2 Init Failed:", err.message);
                    // If not active, maybe alert?
                    // alert(err.message); 
                }
            } catch (e) {
                console.error("Failed to init Round 2", e);
            }

            // 2. Fetch My Secret from IDB
            try {
                const db = await openDB('ZkVotingDB', 1);
                // KEY CHANGE: Look up using composite key
                const secretKey = `${electionId}_${walletAddress}`;
                const secretRecord = await db.get('secrets', secretKey);
                console.log("Loaded secret record from IDB:", secretRecord);

                if (secretRecord && secretRecord.secret_scalar) {
                    setMySecret(secretRecord.secret_scalar);
                } else {
                    // Fallback/Legacy check
                    // If fresh setup, this shouldn't rely on legacy
                    // But for robustness we can warn or check simple key
                    console.warn(`Secret not found for key ${secretKey}`);
                    // Try simple electionID key just in case (e.g. legacy/single tab flow)
                    const legacy = await db.get('secrets', electionId);
                    if (legacy && legacy.secret_scalar) setMySecret(legacy.secret_scalar);
                }
            } catch (e) {
                console.error("Failed to load secret", e);
            }
        };
        load();
    }, [electionId, walletAddress]);

    // Timer
    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    // Compute & Submit
    const handleComputeAndSubmit = async () => {
        if (!mySecret) { alert("Secret not found. Did you finish Round 1?"); return; }
        if (!peers.length) { alert("No peers found."); return; }

        setStatus('computing');

        try {
            const degree = dkgState.polynomial_degree || 2; // Default if missing, but should be there
            const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed'); // Ed25519 Order

            // 1. Generate Polynomial
            // f(x) = a0 + a1*x + ... + ad*x^d
            const coeffs = [BigInt('0x' + mySecret)]; // a0
            for (let i = 1; i <= degree; i++) {
                const rnd = window.crypto.getRandomValues(new Uint8Array(32));
                let val = BigInt('0x' + bytesToHex(rnd)) % L;
                coeffs.push(val);
            }

            // 2. Compute Commitments (C_k = a_k * G)
            // Need to commit to ALL coefficients for VSS
            const commitments = coeffs.map(coeff => {
                const point = ristretto255.Point.BASE.multiply(coeff);
                return point.toHex();
            });
            const myCommitmentC0 = commitments[0]; // For local reference if needed

            // RESTORED: Needed for Encryption (Share derivation)
            const mySecretBI = BigInt('0x' + mySecret);

            // 3. Compute Shares & Encrypt
            const encryptedShares = [];

            // We must include OURSELVES in the distribution for the math to work.
            // Check if peers includes us (it usually excludes self).
            // We construct a target list including self.
            const myPkPoint = ristretto255.Point.BASE.multiply(mySecretBI);
            const myPkHex = myPkPoint.toHex();
            const mySelfObj = { authority_id: authorityId, pk: myPkHex };

            const allTargets = [...peers];
            if (!allTargets.find(p => p.authority_id === authorityId)) {
                allTargets.push(mySelfObj);
            }

            for (const target of allTargets) {
                // Evaluate f(target.authority_id)
                const x = BigInt(target.authority_id);
                let y = BigInt(0);

                // Horner's Method: a_d * x^d + ... + a_0
                for (let k = coeffs.length - 1; k >= 0; k--) {
                    y = (y * x + coeffs[k]) % L;
                }
                const shareScalar = y;

                // Encrypt with Shared Key (Scalar Masking)
                // Shared Point = Target PK * My Secret
                const targetPoint = ristretto255.Point.fromHex(target.pk);
                const sharedPoint = targetPoint.multiply(mySecretBI);

                // Derive Mask: Hash(SharedPoint) -> scalar
                // Use .toHex() as .toRawBytes() is undefined in this version
                const sharedHex = sharedPoint.toHex();
                // Convert Hex to Uint8Array for Hashing
                const sharedBytes = new Uint8Array(sharedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

                const hashBuffer = await window.crypto.subtle.digest('SHA-256', sharedBytes);
                const maskHex = bytesToHex(new Uint8Array(hashBuffer));
                const mask = BigInt('0x' + maskHex) % L;

                // Encrypt: (Share + Mask) % L
                const encryptedVal = (shareScalar + mask) % L;
                const encryptedHex = encryptedVal.toString(16).padStart(64, '0');

                encryptedShares.push({
                    to_authority_id: target.authority_id,
                    encrypted_share: encryptedHex
                });
            }

            // 4. Submit
            // const walletAddress = localStorage.getItem('wallet'); // Using store now
            const payload = {
                election_id: electionId,
                wallet_address: walletAddress,
                commitments: commitments, // VSS Requires full vector
                shares: encryptedShares
            };

            const res = await fetch('http://localhost:4000/api/dkg/round2/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setStatus('submitted');
                refresh();
            } else {
                const err = await res.json();
                alert('Details: ' + err.message);
                setStatus('pending');
            }

        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
            setStatus('pending');
        }
    };

    // Calculate My Secret (Finalize)
    const handleCalculateSecret = async () => {
        try {
            // Fetch shares sent TO me
            if (!authorityId) {
                alert("Authority ID missing. Please reload.");
                return;
            }

            const res = await fetch(`http://localhost:4000/api/dkg/shares/${electionId}/${authorityId}`);
            if (!res.ok) throw new Error("Failed to fetch shares");

            const { shares } = await res.json();
            const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

            let finalShare = BigInt(0);

            // We need to look up senders. Peers list only has others.
            // We must add ourselves to look up our own self-share.
            const myPkPoint = ristretto255.Point.BASE.multiply(BigInt('0x' + mySecret));
            const myPkHex = myPkPoint.toHex();
            const mySelfObj = { authority_id: authorityId, pk: myPkHex };

            const allLookups = [...peers, mySelfObj];

            for (const item of shares) {
                // Find Sender
                const sender = allLookups.find(p => p.authority_id === item.from_authority_id);
                if (!sender) {
                    console.warn(`Sender ${item.from_authority_id} not found in known authorities`);
                    continue;
                }

                // Decrypt
                // Shared Key = Sender PK * My Secret
                const senderPoint = ristretto255.Point.fromHex(sender.pk);
                const mySecretBI = BigInt('0x' + mySecret);
                const sharedPoint = senderPoint.multiply(mySecretBI);

                // Regenerate Mask
                const sharedHex = sharedPoint.toHex();
                const sharedBytes = new Uint8Array(sharedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

                const hashBuffer = await window.crypto.subtle.digest('SHA-256', sharedBytes);
                const maskHex = bytesToHex(new Uint8Array(hashBuffer));
                const mask = BigInt('0x' + maskHex) % L;

                // Decrypt: (Encrypted - Mask) % L
                // Handle negative modulo correctly
                const encryptedVal = BigInt('0x' + item.encrypted_share);
                let decryptedVal = (encryptedVal - mask) % L;
                if (decryptedVal < 0n) decryptedVal += L;

                finalShare = (finalShare + decryptedVal) % L;
            }

            // Store Final Share
            const db = await openDB('ZkVotingDB', 1);
            // KEY CHANGE: Unique key for final secret
            const finalKey = `${electionId}_FINAL_${walletAddress}`;

            await db.put('secrets', {
                election_id: finalKey,
                secret_scalar: finalShare.toString(16),
                created_at: new Date().toISOString()
            });

            setFinalStatus('done');

        } catch (e) {
            console.error(e);
            alert("Calculation failed: " + e.message);
        }
    };

    return (
        <div className="text-center">
            <h3 className="text-lg font-bold uppercase tracking-wider text-purple-500 mb-6">Round 2: Share Distribution</h3>

            <div className="mb-4 text-sm text-gray-400">
                <p>Status: <span className="text-white font-mono">{dkgState?.status}</span></p>
                <p>Degree: <span className="text-white font-mono">{dkgState?.polynomial_degree}</span></p>
                <p>Peers: <span className="text-white font-mono">{peers.length}</span></p>
            </div>

            {status === 'pending' && dkgState?.status === 'round2' && (
                <button
                    onClick={handleComputeAndSubmit}
                    className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20"
                >
                    Compute & Distribute Shares
                </button>
            )}

            {status === 'computing' && <p className="text-purple-400 animate-pulse">Computing Polynomials...</p>}

            {(status === 'submitted' || dkgState?.status === 'completed') && (
                <div className="bg-emerald-500/10 p-6 rounded-xl border border-emerald-500/20 inline-block mb-6">
                    <p className="text-emerald-400 font-bold">Shares Submitted!</p>
                </div>
            )}

            {dkgState?.status === 'completed' && finalStatus !== 'done' && (
                <div className="mt-4">
                    <p className="text-blue-300 mb-4">DKG Completed. Time to calculate your final secret.</p>
                    <button
                        onClick={handleCalculateSecret}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20"
                    >
                        Calculate My Secret
                    </button>
                </div>
            )}

            {finalStatus === 'done' && (
                <div className="mt-6 bg-blue-500/10 p-6 rounded-xl border border-blue-500/20 inline-block">
                    <p className="text-blue-400 font-bold text-xl">Secret Calculated & Stored</p>
                    <p className="text-gray-400 text-sm mt-2">You are ready for the election.</p>
                </div>
            )}
        </div>
    );
}
