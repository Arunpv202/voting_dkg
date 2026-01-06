import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Loader2, Key } from "lucide-react";
import useAuthStore from "../../store/useAuthStore";

export default function EnterDKG() {
    const navigate = useNavigate();
    const [inputElectionId, setInputElectionId] = useState("");
    const [loading, setLoading] = useState(false);

    const { setElectionId } = useAuthStore();

    const handleEnter = async () => {
        if (!inputElectionId) return;
        setLoading(true);

        try {
            // Validate Election ID against backend
            const res = await fetch(`http://localhost:4000/api/elections/${inputElectionId}`);
            if (res.ok) {
                // If valid, store properly in Auth Store
                setElectionId(inputElectionId);
                navigate(`/authority/dkg/${inputElectionId}`);
            } else {
                alert("Invalid Election ID. Please check and try again.");
            }
        } catch (error) {
            console.error(error);
            alert("Connection error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                <button
                    onClick={() => navigate("/user/dashboard")}
                    className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Back to Dashboard</span>
                </button>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative">

                    <div className="text-center mb-10">
                        <div className="inline-flex p-4 bg-red-500/10 rounded-2xl text-red-500 mb-6 border border-red-500/20">
                            <Shield size={32} />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mb-3">DKG Access Portal</h2>
                        <p className="text-gray-400 text-sm leading-relaxed px-4">
                            Enter the specific Election ID to participate in the Distributed Key Generation (DKG) process.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="group">
                            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
                                Election Identifier
                            </label>
                            <input
                                type="text"
                                value={inputElectionId}
                                onChange={(e) => setInputElectionId(e.target.value)}
                                placeholder="Enter Election ID"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-6 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-gray-700 font-medium font-mono text-center tracking-widest text-lg"
                            />
                        </div>

                        <button
                            onClick={handleEnter}
                            disabled={loading || !inputElectionId}
                            className="w-full mt-4 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <span>Start DKG Process</span>}
                        </button>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}
