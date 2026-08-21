import { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUserFacingError } from '../lib/userFacingError';

export default function MessageAttachmentViewer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const path = searchParams.get('path');
  const fileName = searchParams.get('name') || 'attachment';
  const mimeType = searchParams.get('type') || 'application/octet-stream';
  const returnTo = searchParams.get('returnTo');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;

    async function loadAttachment() {
      if (!path) {
        setError('This attachment link is incomplete.');
        return;
      }
      try {
        const { data: signed, error: signedError } = await supabase.storage
          .from('message-attachments')
          .createSignedUrl(path, 60 * 60);
        if (signedError || !signed?.signedUrl) throw signedError || new Error('Attachment not found.');
        const response = await fetch(signed.signedUrl);
        if (!response.ok) throw new Error('You are not authorized to view this attachment.');
        objectUrl = URL.createObjectURL(await response.blob());
        if (alive) setFileUrl(objectUrl);
      } catch (loadError) {
        if (alive) setError(getUserFacingError(loadError, 'We couldn’t load this attachment. Please try again.'));
      }
    }

    void loadAttachment();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else if (returnTo?.startsWith('/')) navigate(returnTo);
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F1EFE8] px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[#D3D1C7] bg-white shadow-card-hover">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D3D1C7] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="shrink-0 text-[#1D9E75]" size={20} />
            <div className="min-w-0"><div className="truncate text-sm font-semibold text-[#1A1A1A]">{fileName}</div><div className="text-xs text-[#8A867E]">RoleWave attachment viewer</div></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleBack} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D3D1C7] px-3 py-2 text-xs font-semibold text-[#5F5E5A]"><ArrowLeft size={14} /> Back</button>
            {fileUrl && <a href={fileUrl} download={fileName} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white"><Download size={14} /> Download</a>}
          </div>
        </header>
        <main className="flex min-h-0 flex-1 items-center justify-center bg-[#F7F6F2] p-3 sm:p-5">
          {error ? <div className="max-w-md rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-5 py-4 text-center text-sm text-[#7A5000]">{error}</div> : fileUrl ? (
            mimeType.startsWith('image/') ? <img src={fileUrl} alt={fileName} className="max-h-[calc(100vh-9rem)] max-w-full rounded-xl object-contain" />
              : mimeType.startsWith('audio/') ? <audio controls autoPlay src={fileUrl} className="w-full max-w-xl" />
                : mimeType.startsWith('video/') ? <video controls autoPlay src={fileUrl} className="max-h-[calc(100vh-9rem)] max-w-full rounded-xl" />
                  : <iframe title={fileName} src={fileUrl} className="h-[calc(100vh-9rem)] w-full rounded-xl border border-[#D3D1C7] bg-white" />
          ) : <div className="text-sm text-[#5F5E5A]">Loading {fileName}…</div>}
        </main>
      </div>
    </div>
  );
}
