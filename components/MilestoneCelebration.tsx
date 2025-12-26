
import React from 'react';

interface MilestoneCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptChallenge: () => void;
}

const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({ isOpen, onClose, onAcceptChallenge }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="absolute inset-0 bg-[#09090b]/95 backdrop-blur-2xl" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl glass rounded-[3.5rem] border border-white/10 overflow-hidden shadow-[0_50px_200px_rgba(79,70,229,0.3)] animate-in zoom-in-95 duration-500">
        {/* Animated Background Pulse */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] aspect-square bg-indigo-600/10 blur-[120px] rounded-full animate-pulse"></div>
        
        <div className="relative p-10 md:p-14 space-y-10 text-center">
          {/* Trophy Icon with Halo */}
          <div className="relative w-24 h-24 mx-auto mb-12">
             <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse"></div>
             <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-indigo-300 rounded-[2rem] flex items-center justify-center shadow-2xl rotate-12 group-hover:rotate-0 transition-transform">
                <i className="fa-solid fa-trophy text-4xl text-white"></i>
             </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-serif italic text-white leading-tight">
              Félicitations pour ce nouveau <span className="text-indigo-400">record d'éloquence</span> !
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl font-light leading-relaxed max-w-lg mx-auto italic">
              "Ta progression montre que ton engagement dans le Master Studio porte ses fruits et que ta voix gagne en impact."
            </p>
          </div>

          {/* Progress Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4 hover:border-indigo-500/30 transition-all">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center space-x-2">
                 <i className="fa-solid fa-chart-line"></i>
                 <span>🏆 Record d'éloquence</span>
               </h3>
               <ul className="space-y-3 text-[11px] text-zinc-300 leading-relaxed list-disc pl-4 marker:text-indigo-500">
                  <li>Score inédit parmi les leaders de la Live Room.</li>
                  <li>Gemini valide désormais la clarté de ton argumentation.</li>
                  <li>Progrès sauvegardés via Firebase pour un suivi quotidien.</li>
               </ul>
            </div>

            <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4 hover:border-indigo-500/30 transition-all">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center space-x-2">
                 <i className="fa-solid fa-bolt-lightning"></i>
                 <span>📈 Tes Progrès</span>
               </h3>
               <ul className="space-y-3 text-[11px] text-zinc-300 leading-relaxed list-disc pl-4 marker:text-indigo-500">
                  <li>Meilleure gestion du débit et des silences au LAB.</li>
                  <li>Score de conviction significatif au Sommet des Leaders.</li>
                  <li>Régularité renforçant ta confiance publique.</li>
               </ul>
            </div>
          </div>

          <div className="space-y-8 pt-4">
             <p className="text-[11px] text-zinc-500 uppercase font-black tracking-[0.3em]">
               La parole est un art, et tu en deviens le maître.
             </p>
             
             <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <button 
                  onClick={onAcceptChallenge}
                  className="w-full sm:w-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  Accepter le défi de rhétorique
                </button>
                <button 
                  onClick={onClose}
                  className="w-full sm:w-auto px-10 py-5 bg-white/5 border border-white/10 text-zinc-400 hover:text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  Continuer l'exploration
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MilestoneCelebration;
