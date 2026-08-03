import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { getCandidateAssetUrl } from '../lib/candidateAssets';

export default function ResumeViewer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const path = searchParams.get('path');
  const fileName = searchParams.get('name') || 'resume.pdf';
  const returnTo = searchParams.get('returnTo');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (returnTo?.startsWith('/')) {
      navigate(returnTo);
      return;
    }

    navigate('/');
  };

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;

    async function loadResume() {
      if (!path) {
        setError('This resume link is incomplete.');
        return;
      }

      try {
        const signedUrl = await getCandidateAssetUrl(path);
        if (!signedUrl) throw new Error('Resume not found.');

        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error('You are not authorized to view this resume.');

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (alive) setFileUrl(objectUrl);
      } catch (loadError) {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Could not load this resume.');
      }
    }

    void loadResume();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return (
    <div className="min-h-screen bg-[#F1EFE8] px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[#D3D1C7] bg-white shadow-card-hover">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D3D1C7] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="shrink-0 text-[#1D9E75]" size={20} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[#1A1A1A]">{fileName}</div>
              <div className="text-xs text-[#8A867E]">RoleWave resume viewer</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleBack} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D3D1C7] px-3 py-2 text-xs font-semibold text-[#5F5E5A]">
              <ArrowLeft size={14} /> Back
            </button>
            {fileUrl && (
              <a href={fileUrl} download={fileName} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white">
                <Download size={14} /> Download
              </a>
            )}
          </div>
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center bg-[#F7F6F2] p-3 sm:p-5">
          {error ? (
            <div className="max-w-md rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-5 py-4 text-center text-sm text-[#7A5000]">
              {error}
            </div>
          ) : fileUrl ? (
            <iframe title={fileName} src={fileUrl} className="h-[calc(100vh-9rem)] w-full rounded-xl border border-[#D3D1C7] bg-white" />
          ) : (
            <div className="text-sm text-[#5F5E5A]">Loading {fileName}…</div>
          )}
        </main>
      </div>
    </div>
  );
}
