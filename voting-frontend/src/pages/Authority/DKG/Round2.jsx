import { useState, useEffect } from 'react';
import { ristretto255 } from '@noble/curves/ed25519.js';
import { openDB } from 'idb';
import CryptoJS from 'crypto-js';
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
            // Fetch Peers
            try {
                const res = await fetch(`http://localhost:4000/api/dkg/authorities/${electionId}`);
                if (res.ok) {
                    const data = await res.json();
                    setPeers(data.authorities);
                }
            } catch (e) {
                console.error("Failed to load peers", e);
            }

            // Fetch My Secret from IDB
            try {
                const db = await openDB('ZkVotingDB', 1);
                const secretRecord = await db.get('secrets', electionId);
                // Note: In Round 1 we stored with key 'election_id' or 'secrets' store? 
                // Round 1 Code: db.put('secrets', { election_id: electionId ... }) -> key defaults?
                // Round 1 didn't specify key, so it might be auto-increment or election_id if schema. 
                // Let's assume we can query by election_id or index.
                // Correction: IDB 'put' without key path requires key. Round 1 used `db.put('secrets', { ... })`. 
                // Let's assume the user setup IDB correctly or we fetch all and find. 
                // For robustness, let's look for match.

                // Hack: If key path is not set, we might iterate.
                let cursor = await db.transaction('secrets').store.openCursor();
                while (cursor) {
                    if (cursor.value.election_id === electionId && cursor.value.secret_scalar) {
                        setMySecret(cursor.value.secret_scalar);
                        break;
                    }
                    cursor = await cursor.continue();
                }
            } catch (e) {
                console.error("Failed to load secret", e);
            }
        };
        load();
    }, [electionId]);

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

            // 2. Compute Commitment (C0 = a0 * G)
            const mySecretBI = BigInt('0x' + mySecret);
            const commitmentPoint = ristretto255.Point.BASE.multiply(mySecretBI);
            const commitmentHex = commitmentPoint.toHex();

            // 3. Compute Shares & Encrypt
            const encryptedShares = [];

            for (const peer of peers) {
                // Evaluate f(peer.authority_id)
                const x = BigInt(peer.authority_id);
                let y = BigInt(0);

                // Horner's Method: a_d * x^d + ... + a_0
                for (let k = coeffs.length - 1; k >= 0; k--) {
                    y = (y * x + coeffs[k]) % L;
                }
                const shareHex = y.toString(16);

                // Encrypt with Shared Key (ECDH)
                // Peer PK (Point) * My Secret (Scalar)
                const peerPoint = ristretto255.Point.fromHex(peer.pk);
                const sharedPoint = peerPoint.multiply(mySecretBI);
                const sharedKeyHex = sharedPoint.toHex();

                const encrypted = CryptoJS.AES.encrypt(shareHex, sharedKeyHex).toString();

                encryptedShares.push({
                    to_authority_id: peer.authority_id,
                    encrypted_share: encrypted
                });
            }

            // 4. Submit
            // const walletAddress = localStorage.getItem('wallet'); // Using store now
            const payload = {
                election_id: electionId,
                wallet_address: walletAddress,
                commitment: commitmentHex,
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
            // Backend needs authority_id. We only have it if we fetched peers and found ourselves,
            // or if we trust the passed prop `authorityId`. 
            // The user said backend returns it in Round 1. 
            // In Dashboard, `confirmedAuthorityId` is passed as `authorityId` prop. Use that.
            if (!authorityId) {
                alert("Authority ID missing. Please reload.");
                return;
            }

            const res = await fetch(`http://localhost:4000/api/dkg/shares/${electionId}/${authorityId}`);
            if (!res.ok) throw new Error("Failed to fetch shares");

            const { shares } = await res.json();
            const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

            let finalShare = BigInt(0);

            for (const item of shares) {
                // Find Sender
                const sender = peers.find(p => p.authority_id === item.from_authority_id);
                if (!sender) {
                    console.warn(`Sender ${item.from_authority_id} not found in peers`);
                    continue;
                }

                // Decrypt
                // Shared Key = Sender PK * My Secret
                const senderPoint = ristretto255.Point.fromHex(sender.pk);
                const mySecretBI = BigInt('0x' + mySecret);
                const sharedPoint = senderPoint.multiply(mySecretBI);
                const sharedKeyHex = sharedPoint.toHex();

                const bytes = CryptoJS.AES.decrypt(item.encrypted_share, sharedKeyHex);
                const decryptedHex = bytes.toString(CryptoJS.enc.Utf8);

                if (!decryptedHex) throw new Error(`Failed to decrypt share from ${sender.authority_id}`);

                const shareVal = BigInt('0x' + decryptedHex);
                finalShare = (finalShare + shareVal) % L;
            }

            // Store Final Share
            const db = await openDB('ZkVotingDB', 1);
            await db.put('secrets', {
                election_id: electionId + "_FINAL",
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
