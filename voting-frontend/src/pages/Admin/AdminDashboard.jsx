import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PlusCircle, LayoutDashboard, LogOut, BarChart3, ShieldCheck, Activity, Database, Hash } from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const walletAddress = localStorage.getItem("wallet") || "0x742d...44e";

  // Mock data for the "Ganache-style" activity monitor
  const recentTransactions = [
    { txHash: "0x8f2a...3d91", method: "CreateElection", block: "14201", status: "Confirmed" },
    { txHash: "0x4e1c...a2b5", method: "AuthorizeVoter", block: "14198", status: "Confirmed" },
    { txHash: "0x9d3b...f122", method: "CastVote", block: "14195", status: "Confirmed" },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col md:flex-row font-sans">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900/50 border-r border-white/5 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="font-bold tracking-tight text-xl">Admin Panel</span>
          </div>
          
          <nav className="space-y-2">
            <NavItem icon={<LayoutDashboard size={18} />} label="Command Center" active />
            <NavItem icon={<Activity size={18} />} label="Chain Explorer" />
          </nav>
        </div>

        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-gray-500 hover:text-red-400 transition-colors px-2 py-4"
        >
          <LogOut size={18} />
          <span className="font-medium">Disconnect</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">Governance Hub</h1>
            <p className="text-gray-400">System level controls and blockchain ledger monitoring.</p>
          </div>
          
          <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-2xl flex items-center gap-3">
            <Database size={16} className="text-indigo-400" />
            <span className="text-xs font-mono text-indigo-300">{walletAddress}</span>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <DashboardCard
            title="Create Election"
            desc="Deploy a new voting contract to the blockchain and set candidate parameters."
            icon={<PlusCircle size={32} />}
            color="indigo"
            onClick={() => navigate("/admin/create-election")}
          />

          <DashboardCard
            title="View Elections"
            desc="Review active ballots, monitor voter turnout, and finalize results on-chain."
            icon={<BarChart3 size={32} />}
            color="emerald"
            onClick={() => navigate("/admin/view-elections")}
          />
        </div>

        {/* Blockchain Activity Monitor (Ganache-style) */}
        <div className="rounded-3xl bg-slate-900 border border-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <Activity className="text-indigo-400" size={20} />
              <h3 className="font-bold text-lg">Blockchain Activity Monitor</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Network: Ganache / Local</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-widest bg-white/[0.01]">
                  <th className="px-6 py-4 font-medium">Transaction Hash</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium">Block</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentTransactions.map((tx, index) => (
                  <tr key={index} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-mono text-sm text-indigo-300">
                      <div className="flex items-center gap-2">
                        <Hash size={14} className="text-gray-600" />
                        {tx.txHash}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-md bg-slate-800 text-xs font-medium text-gray-300 border border-white/5">
                        {tx.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{tx.block}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        {tx.status}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-center border-t border-white/5 bg-white/[0.01]">
             <button className="text-xs text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-tighter">
                View All Transactions
             </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// Sub-components
function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
      active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
    }`}>
      {icon}
      <span className="font-semibold text-sm">{label}</span>
    </div>
  );
}

function DashboardCard({ title, desc, icon, onClick, color }) {
  const colorMap = {
    indigo: "hover:border-indigo-500/50 text-indigo-400",
    emerald: "hover:border-emerald-500/50 text-emerald-400",
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group cursor-pointer p-8 rounded-3xl bg-slate-900 border border-white/5 transition-all duration-300 shadow-xl ${colorMap[color]}`}
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h2 className="text-2xl font-bold mb-3 text-white">{title}</h2>
      <p className="text-gray-400 leading-relaxed mb-6">{desc}</p>
      <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest group-hover:gap-4 transition-all">
        Launch <span className="text-xl">→</span>
      </div>
    </motion.div>
  );
}