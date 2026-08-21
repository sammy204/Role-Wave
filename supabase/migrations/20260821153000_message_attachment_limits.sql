-- Support M4A uploads and cap message attachments at 10 MB.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a',
      'video/mp4', 'video/webm',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip'
    ]
where id = 'message-attachments';

alter table public.message_attachments drop constraint if exists message_attachments_size_bytes_check;
alter table public.message_attachments add constraint message_attachments_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 10485760);

notify pgrst, 'reload schema';
