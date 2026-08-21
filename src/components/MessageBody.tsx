const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+|(?<![@\w])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi;

function splitTrailingPunctuation(value: string) {
  const trailingMatch = value.match(/[.,!?;:)}\]]+$/);
  if (!trailingMatch) return { url: value, trailing: '' };
  const trailing = trailingMatch[0];
  return { url: value.slice(0, -trailing.length), trailing };
}

export default function MessageBody({ body, linkClassName }: { body: string; linkClassName: string }) {
  const parts = body.split(urlPattern);

  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        const isUrl = /^(https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/|$))/i.test(part);
        if (!isUrl) return <span key={`${part}-${index}`}>{part}</span>;

        const { url, trailing } = splitTrailingPunctuation(part);
        return (
          <span key={`${part}-${index}`}>
            <a
              href={url.startsWith('http') ? url : `https://${url}`}
              target="_blank"
              rel="noreferrer noopener"
              className={`underline underline-offset-2 ${linkClassName}`}
            >
              {url}
            </a>
            {trailing}
          </span>
        );
      })}
    </div>
  );
}
