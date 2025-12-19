import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  UserPlus, 
  User, 
  Fingerprint, 
  Camera, 
  ArrowRight, 
  UploadCloud 
} from "lucide-react";

export default function RegisterUsers() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Aesthetic Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        {/* Navigation */}
        <button 
          onClick={() => navigate("/admin/create-election")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium tracking-wide">Back to Initialization</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-3xl shadow-2xl">
          {/* Header Section */}
          <div className="mb-10 text-center">
            <div className="inline-flex p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 mb-4">
              <UserPlus size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-2">Register User</h2>
            <p className="text-gray-400 text-sm">Enroll authorized voters into the election ledger.</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* USER NAME */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Voter Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-emerald-400 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Full name of voter"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-gray-700 font-medium"
                />
              </div>
            </div>

            {/* ELECTION ID */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election ID</label>
              <div className="relative">
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-emerald-400 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Reference existing Election ID"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-gray-700 font-medium"
                />
              </div>
            </div>

            {/* FACE UPLOAD FIELD */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Biometric Enrollment (Face)</label>
              <div className="relative border-2 border-dashed border-white/10 rounded-xl p-8 bg-black/20 hover:bg-black/40 hover:border-emerald-500/50 transition-all cursor-pointer text-center group">
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept="image/*"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-white/5 rounded-full text-gray-500 group-hover:text-emerald-400 transition-colors">
                    <Camera size={24} />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">Click to capture or upload image</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-tighter">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* ADD USER BUTTON */}
          <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl mt-8 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <UploadCloud size={20} />
            <span>Add User to Registry</span>
          </button>

          {/* NEXT: SETUP ELECTION */}
          <button
            onClick={() => navigate("/admin/election-setup")}
            className="w-full mt-4 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Next: Setup Election</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Informational Footer */}
        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          Step 2 of 3: Identity Management
        </p>
      </motion.div>
    </div>
  );
}