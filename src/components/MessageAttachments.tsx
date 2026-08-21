import { useEffect, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchMessageAttachments } from '../lib/messages';
import type { MessageAttachment } from '../types';

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessageAttachments({
  messageId,
  attachments,
  isMine,
}: {
  messageId: string;
  attachments?: MessageAttachment[];
  isMine: boolean;
}) {
  const [items, setItems] = useState<MessageAttachment[]>(attachments || []);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const next = attachments ?? await fetchMessageAttachments(messageId);
        if (alive) setItems(next);
      } catch {
        // The message itself remains usable if attachment metadata is unavailable.
      }
    };
    void load();
    return () => { alive = false; };
  }, [attachments, messageId]);

  useEffect(() => {
    let alive = true;
    if (!items.length) return () => { alive = false; };
    void Promise.all(items.map(async (item) => {
      const { data } = await supabase.storage.from('message-attachments').createSignedUrl(item.storage_path, 60 * 60);
      return data?.signedUrl ? [item.id, data.signedUrl] as const : null;
    })).then((entries) => {
      if (!alive) return;
      setUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
    });
    return () => { alive = false; };
  }, [items]);

  if (!items.length) return null;

  const expandedImage = items.find((item) => item.id === expandedImageId);
  const expandedImageUrl = expandedImage ? urls[expandedImage.id] : null;

  return (
    <div className="mt-2 space-y-2">
      {items.map((item) => {
        const url = urls[item.id];
        const viewerHref = `/message-attachment/view?${new URLSearchParams({ path: item.storage_path, name: item.file_name, type: item.mime_type, returnTo: `${window.location.pathname}${window.location.search}` }).toString()}`;
        if (item.mime_type.startsWith('image/') && url) {
          return (
            <div key={item.id}>
              <button type="button" onClick={() => setExpandedImageId(item.id)} className="block max-w-full overflow-hidden rounded-xl text-left">
                <img src={url} alt={item.file_name} className="max-h-64 max-w-full cursor-zoom-in object-contain" />
              </button>
              <div className={`mt-1 truncate text-[11px] ${isMine ? 'text-white/75' : 'text-faint'}`}>{item.file_name}</div>
            </div>
          );
        }
        if (item.mime_type.startsWith('audio/') && url) {
          return <div key={item.id} className="space-y-1"><div className={`truncate text-xs font-medium ${isMine ? 'text-white' : 'text-ink'}`}>{item.file_name}</div><audio controls src={url} className="max-w-full" aria-label={item.file_name} /></div>;
        }
        if (item.mime_type.startsWith('video/') && url) {
          return <div key={item.id} className="space-y-1"><video controls src={url} className="max-h-64 max-w-full rounded-xl" aria-label={item.file_name} /><div className={`truncate text-[11px] ${isMine ? 'text-white/75' : 'text-faint'}`}>{item.file_name}</div></div>;
        }
        return (
          <a key={item.id} href={viewerHref} target="_blank" rel="noreferrer noopener" className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isMine ? 'border-white/30 text-white' : 'border-line text-ink'} ${url ? 'hover:underline' : 'pointer-events-none opacity-60'}`}>
            {item.mime_type === 'application/pdf' ? <FileText size={15} /> : <Paperclip size={15} />}
            <span className="min-w-0 flex-1 truncate">{item.file_name}</span>
            <span className="shrink-0 opacity-70">{formatSize(item.size_bytes)}</span>
          </a>
        );
      })}
      {expandedImage && expandedImageUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label={expandedImage.file_name} onClick={() => setExpandedImageId(null)}>
          <button type="button" onClick={() => setExpandedImageId(null)} className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" aria-label="Close image preview"><X size={20} /></button>
          <div className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
            <img src={expandedImageUrl} alt={expandedImage.file_name} className="max-h-[85vh] max-w-[92vw] object-contain" />
            <div className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">{expandedImage.file_name}</div>
          </div>
        </div>
      )}
    </div>
  );
}
