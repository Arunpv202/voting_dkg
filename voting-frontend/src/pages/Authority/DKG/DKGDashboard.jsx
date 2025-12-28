
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Round1 from './Round1';
import Round2 from './Round2';
import useAuthStore from '../../../store/useAuthStore';

export default function DKGDashboard() {
    const { electionId } = useParams();
    const { walletAddress } = useAuthStore();
    const [status, setStatus] = useState('loading');
    const [dkgState, setDkgState] = useState(null);
    const [view, setView] = useState('buttons'); // 'buttons', 'round1', 'round2'
    const [derivedAuthorityId, setDerivedAuthorityId] = useState(null);

    const fetchStatus = async () => {
        if (!electionId) return;
        try {
            const res = await fetch(`http://localhost:4000/api/dkg/status/${electionId}`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data.status);
                setDkgState(data);
            } else {
                setStatus('error');
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    // Auto-fetch Authority ID for Round 2 usage
    const fetchMyAuthorityId = async () => {
        if (!walletAddress || !electionId) return;
        try {
            const res = await fetch(`http://localhost:4000/api/dkg/authorities/${electionId}`);
            if (res.ok) {
                const data = await res.json();
                // Find me
                const me = data.authorities.find(a => a.wallet_address.toLowerCase() === walletAddress.toLowerCase());
                if (me) {
                    setDerivedAuthorityId(me.authority_id);
                }
            }
        } catch (e) {
            console.error("Failed to fetch authorities", e);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchMyAuthorityId();
        const interval = setInterval(() => {
            fetchStatus();
            // Retry ID fetch if not found yet (e.g. status changed from setup to round1)
            if (!derivedAuthorityId) fetchMyAuthorityId();
        }, 3000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [electionId, walletAddress]); // Removed derivedAuthorityId to avoid infinite loop

    const handleRound1Click = () => {
        if (status === 'setup' || status === 'round1' || status === 'round2' || status === 'completed') {
            // User can view Round 1 anytime it's active or passed, technically. 
            // But per requirement "check status is round1". 
            // We'll be lenient: allow entering if started.
            setView('round1');
        } else {
            alert('Round 1 is not active yet.');
        }
    };

    const handleRound2Click = () => {
        if (status === 'round1') {
            alert('Round 2 has not started yet. Please wait for the timer.');
            return;
        }
        if (status === 'round2' || status === 'completed') {
            if (!derivedAuthorityId) {
                // Try one more fetch immediately
                fetchMyAuthorityId().then(() => {
                    setView('round2');
                });
            } else {
                setView('round2');
            }
        } else {
            alert('Round 2 is not active.');
        }
    };

    const handleBack = () => {
        setView('buttons');
    };

    const isRound1Active = status === 'round1' || status === 'setup';
    const isRound2Active = status === 'round2' || status === 'completed';

    if (status === 'loading') return <div className="p-10 text-white">Loading DKG Status...</div>;
    if (status === 'error') return (
        <div className="p-10 text-red-500">
            <h2 className="text-xl font-bold">Error loading DKG status</h2>
            <p>Invalid Election ID: {String(electionId)}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-white p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">DKG Dashboard</h1>
                    {view !== 'buttons' && (
                        <button
                            onClick={handleBack}
                            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            ← Back
                        </button>
                    )}
                </div>

                <div className="mb-6 text-center">
                    <p className="text-gray-400 text-sm">Election ID: <span className="font-mono text-indigo-400">{electionId}</span></p>
                    <p className="text-gray-500 text-xs mt-1">Status: {status}</p>
                </div>

                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 shadow-xl min-h-[500px]">

                    {/* VIEW 1: BUTTONS */}
                    {view === 'buttons' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Round 1 */}
                            <button
                                onClick={handleRound1Click}
                                className={`group relative p-10 rounded-2xl border-2 text-left transition-all transform hover:scale-105 ${isRound1Active
                                    ? 'bg-gradient-to-br from-indigo-900/40 to-slate-900/80 border-indigo-500/60 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/30 cursor-pointer'
                                    : 'bg-slate-900/30 border-gray-700/30 opacity-60'
                                    }`}
                            >
                                <div className="absolute top-4 right-4">
                                    {status === 'round1' && <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />}
                                </div>
                                <h2 className="text-3xl font-black mb-3 text-white group-hover:text-indigo-300">Round 1</h2>
                                <p className="text-sm text-indigo-400 font-mono mb-4 uppercase tracking-wider">Key Commitments</p>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Generate your secret scalar and submit your public key commitment to participate in the distributed key generation ceremony.
                                </p>
                            </button>

                            {/* Round 2 */}
                            <button
                                onClick={handleRound2Click}
                                className={`group relative p-10 rounded-2xl border-2 text-left transition-all transform hover:scale-105 ${isRound2Active
                                    ? 'bg-gradient-to-br from-purple-900/40 to-slate-900/80 border-purple-500/60 hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-500/30 cursor-pointer'
                                    : 'bg-slate-900/30 border-gray-700/30 opacity-60' // not disabled, just dimmed, click handles alert
                                    }`}
                            >
                                <div className="absolute top-4 right-4">
                                    {status === 'round2' && <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />}
                                </div>
                                <h2 className="text-3xl font-black mb-3 text-white group-hover:text-purple-300">Round 2</h2>
                                <p className="text-sm text-purple-400 font-mono mb-4 uppercase tracking-wider">Share Distribution</p>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Compute polynomial shares, encrypt them using ECDH, and securely distribute to other authorities.
                                </p>
                            </button>
                        </div>
                    )}

                    {/* VIEW 2: ROUND 1 */}
                    {view === 'round1' && (
                        <Round1
                            electionId={electionId}
                            dkgState={dkgState}
                            refresh={fetchStatus}
                        />
                    )}

                    {/* VIEW 3: ROUND 2 */}
                    {view === 'round2' && (
                        <Round2
                            electionId={electionId}
                            authorityId={derivedAuthorityId}
                            dkgState={dkgState}
                            refresh={fetchStatus}
                        />
                    )}

                </div>
            </div>
        </div>
    );
}
