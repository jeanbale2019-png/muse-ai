
import React from 'react';

interface Notification {
  id: string;
  type: 'friend_request' | 'live_invite';
  from: string;
  fromName: string;
  avatar: string;
  roomId?: string;
  timestamp: any;
  status: 'unread' | 'read';
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onJoinLive: (roomId: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  isOpen, 
  onClose, 
  notifications, 
  onAcceptFriend, 
  onDeclineFriend, 
  onJoinLive 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-3xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out border-l border-white/20">
        <div className="px-6 py-8 flex justify-between items-center border-b border-black/5">
          <div className="flex items-center space-x-3">
             <h2 className="text-2xl font-black tracking-tighter text-black uppercase">Notifications</h2>
             {notifications.filter(n => n.status === 'unread').length > 0 && (
               <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                 {notifications.filter(n => n.status === 'unread').length}
               </span>
             )}
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
            <i className="fa-solid fa-xmark text-black/50"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
              <i className="fa-solid fa-bell-slash text-4xl mb-4 text-black"></i>
              <p className="text-[10px] font-black uppercase tracking-widest text-black">Aucune notification</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 rounded-[1.5rem] border transition-all hover:scale-[1.02] active:scale-95 ${
                  notif.status === 'unread' ? 'bg-white shadow-xl border-indigo-100' : 'bg-white/40 border-transparent'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="relative">
                    <img src={notif.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="avatar" />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white shadow-lg ${
                      notif.type === 'live_invite' ? 'bg-indigo-500' : 'bg-emerald-500'
                    }`}>
                      <i className={`fa-solid ${notif.type === 'live_invite' ? 'fa-video' : 'fa-user-plus'}`}></i>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-black leading-tight">
                        <span className="font-black">{notif.fromName}</span> 
                        {notif.type === 'live_invite' ? ' vous invite à rejoindre son Live.' : ' souhaite devenir votre ami.'}
                      </p>
                      <span className="text-[8px] font-black uppercase text-black/30 tracking-widest">A l'instant</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {notif.type === 'friend_request' ? (
                        <>
                          <button 
                            onClick={() => onAcceptFriend(notif.id)}
                            className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                          >
                            Accepter
                          </button>
                          <button 
                            onClick={() => onDeclineFriend(notif.id)}
                            className="flex-1 py-2 bg-black/5 text-black/40 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black/10 transition-all"
                          >
                            Décliner
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => notif.roomId && onJoinLive(notif.roomId)}
                          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                        >
                          Rejoindre le Live
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-6 border-t border-black/5 bg-white/30 backdrop-blur-md">
           <button className="w-full py-4 text-black/40 text-[10px] font-black uppercase tracking-[0.2em] hover:text-black transition-colors">
             Tout marquer comme lu
           </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
