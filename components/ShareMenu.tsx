import React from 'react';

interface ShareMenuProps {
  title: string;
  text: string;
  url?: string;
  fileData?: string; // base64
  fileType?: string; // mimeType
  fileName?: string;
  onClose: () => void;
}

const ShareMenu: React.FC<ShareMenuProps> = ({ title, text, url, fileData, fileType, fileName, onClose }) => {
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        const shareData: ShareData = { title, text, url };
        
        if (fileData && fileType && fileName) {
          const blob = await (await fetch(`data:${fileType};base64,${fileData}`)).blob();
          const file = new File([blob], fileName, { type: fileType });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        }
        
        await navigator.share(shareData);
        onClose();
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      alert("Sharing is not supported on this browser. Use the links below.");
    }
  };

  const shareToSocial = (platform: 'twitter' | 'linkedin' | 'facebook' | 'whatsapp') => {
    const encodedText = encodeURIComponent(`${title}\n\n${text}`);
    const encodedUrl = encodeURIComponent(url || window.location.href);
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
        break;
    }
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = () => {
    const content = `${title}\n\n${text}\n\n${url || ''}`;
    navigator.clipboard.writeText(content).then(() => {
      alert("Content copied to clipboard!");
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-sm glass rounded-[2.5rem] border border-white/10 bg-[#0c0c0e] shadow-2xl p-8 space-y-8 animate-in zoom-in-95 duration-300">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif italic text-white">Share your <span className="text-indigo-400">Creation</span></h3>
          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Broadcast your vision to the world</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleNativeShare}
            className="col-span-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center space-x-3 shadow-lg shadow-indigo-600/20"
          >
            <i className="fa-solid fa-share-nodes"></i>
            <span>System Share</span>
          </button>
          
          <button 
            onClick={() => shareToSocial('twitter')}
            className="py-4 bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center space-x-2"
          >
            <i className="fa-brands fa-x-twitter"></i>
            <span>Twitter</span>
          </button>

          <button 
            onClick={() => shareToSocial('whatsapp')}
            className="py-4 bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center space-x-2"
          >
            <i className="fa-brands fa-whatsapp"></i>
            <span>WhatsApp</span>
          </button>

          <button 
            onClick={copyToClipboard}
            className="col-span-2 py-4 bg-white/5 border border-dashed border-zinc-800 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center space-x-3"
          >
            <i className="fa-solid fa-link"></i>
            <span>Copy Link & Text</span>
          </button>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ShareMenu;