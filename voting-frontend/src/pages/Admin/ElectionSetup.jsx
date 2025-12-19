import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Settings, 
  User, 
  Image as ImageIcon, 
  Flag, 
  AlignLeft, 
  Calendar, 
  CheckCircle,
  Plus
} from "lucide-react";

export default function ElectionSetup() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Navigation */}
        <button 
          onClick={() => navigate("/admin/register-users")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium tracking-wide">Back to User Registration</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-3xl shadow-2xl">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
              <Settings size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight">Election Setup</h2>
              <p className="text-gray-400 text-sm">Configure candidates and voting schedule.</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* SECTION 1: CANDIDATE INFO */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 ml-1">Candidate Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input type="text" placeholder="Candidate Name" className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all font-medium" />
                  </div>
                </div>
                <div className="group">
                  <div className="relative">
                    <Flag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input type="text" placeholder="Symbol Name" className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all font-medium" />
                  </div>
                </div>
              </div>

              {/* Uploads Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative border border-dashed border-white/10 rounded-xl p-4 bg-black/20 hover:border-indigo-500/50 transition-all text-center group cursor-pointer">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg text-gray-500 group-hover:text-indigo-400"><ImageIcon size={20} /></div>
                    <span className="text-xs font-medium text-gray-400">Upload Photo</span>
                  </div>
                </div>
                <div className="relative border border-dashed border-white/10 rounded-xl p-4 bg-black/20 hover:border-indigo-500/50 transition-all text-center group cursor-pointer">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg text-gray-500 group-hover:text-indigo-400"><Flag size={20} /></div>
                    <span className="text-xs font-medium text-gray-400">Upload Symbol</span>
                  </div>
                </div>
              </div>

              <div className="relative group">
                <AlignLeft className="absolute left-4 top-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <textarea placeholder="Election Description" className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 h-24 outline-none focus:border-indigo-500/50 transition-all resize-none" />
              </div>

              <button className="w-full py-3 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                <Plus size={18} /> Add Candidate to List
              </button>
            </section>

            {/* SECTION 2: TIMELINE */}
            <section className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 ml-1">Election Timeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DateInput label="Start Date" />
                <DateInput label="End Date" />
                <DateInput label="Results Date" />
              </div>
            </section>
          </div>

          {/* COMPLETE BUTTON */}
          <button
            onClick={() => navigate("/admin/view-elections")}
            className="w-full mt-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle size={20} />
            <span>Complete Election Setup</span>
          </button>
        </div>

        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          Step 3 of 3: Final Deployment
        </p>
      </motion.div>
    </div>
  );
}

// Helper Component for Date Inputs
function DateInput({ label }) {
  return (
    <div className="group">
      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={14} />
        <input type="date" className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500/50 transition-all [color-scheme:dark]" />
      </div>
    </div>
  );
}