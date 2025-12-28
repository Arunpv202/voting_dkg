import { useState, useEffect } from 'react';
import { ristretto255, ed25519 } from '@noble/curves/ed25519.js';
import { openDB } from 'idb';
import useAuthStore from '../../../store/useAuthStore';
import { initDB } from '../../../utils/zkStorage';




// Helper for hex conversion
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Round1({ electionId, dkgState, refresh }) {
    const [status, setStatus] = useState('pending'); // pending, generating, submitted
    const [pk, setPk] = useState('');
    const { walletAddress } = useAuthStore();

    const handleGenerateAndSubmit = async () => {
        setStatus('generating');
        try {
            // 1. Generate Secret Scalar
            // Ristretto255/Ed25519 seed is just 32 random bytes
            const secret = window.crypto.getRandomValues(new Uint8Array(32));

            // Compute Ristretto Public Key: PK = Secret * BasePoint
            // We interpret the random bytes as a scalar
            const secretHex = bytesToHex(secret);

            // Ed25519 Curve Order (L)
            const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

            let secretScalar = BigInt('0x' + secretHex) % CURVE_ORDER;
            if (secretScalar === 0n) secretScalar = 1n; // Ensure strictly positive

            // NOTE: We keep secretHex as the original random bytes for storage if we want exact reconstruction,
            // BUT for the math to work, we must use the reduced scalar. 
            // Better to store the reduced scalar hex to avoid confusion.
            const validSecretHex = secretScalar.toString(16).padStart(64, '0');

            const pubKeyPoint = ristretto255.Point.BASE.multiply(secretScalar);
            const pkHex = pubKeyPoint.toHex();

            // 2. Store Secret Locally
            // Using IndexedDB wrapper defined in zkStorage.js or inline here for simplicity
            // For this phase, let's just store simple IDB
            // 2. Store Secret Locally
            // Use shared initDB to ensure 'secrets' store exists
            const db = await initDB();
            await db.put('secrets', {
                election_id: electionId,
                secret_scalar: validSecretHex, // Store the reduced scalar
                public_key: pkHex,
                created_at: new Date().toISOString()
            });

            // 3. Submit PK to Backend
            const res = await fetch('http://localhost:4000/api/dkg/round1/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    election_id: electionId,
                    wallet_address: walletAddress,
                    pk: pkHex
                })
            });

            if (res.ok) {
                const data = await res.json();
                console.log('Authority ID returned:', data.authority_id);
                // Optionally store it for next steps

                setPk(pkHex);
                setStatus('submitted');
                refresh();
            } else {
                const errorData = await res.json();
                alert(`Submission failed: ${errorData.message}`);
                setStatus('pending');
            }
        } catch (err) {
            console.error(err);
            alert('Error in Round 1: ' + err.message);
            setStatus('pending');
        }
    };

    return (
        <div className="text-center">
            <h3 className="text-lg font-bold uppercase tracking-wider text-indigo-500 mb-6">Round 1: Public Key Commitment</h3>



            {status === 'pending' && (
                <button
                    onClick={handleGenerateAndSubmit}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                    Generate & Submit Public Key
                </button>
            )}

            {status === 'generating' && <p className="text-indigo-400 animate-pulse">Generating Cryptographic Material...</p>}

            {status === 'submitted' && (
                <div className="bg-emerald-500/10 p-6 rounded-xl border border-emerald-500/20 inline-block">
                    <p className="text-emerald-400 font-bold mb-2">Public Key Submitted Successfully!</p>
                    <p className="text-xs font-mono text-gray-500 break-all max-w-sm">{pk}</p>
                    <p className="text-sm text-gray-400 mt-4">Waiting for other authorities to finish...</p>
                </div>
            )}
        </div>
    );
}
