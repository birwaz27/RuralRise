import { useEffect, useState } from 'react';
import { apiBlob } from '../api';

export default function CertificatePreview({ url, title }: { url: string; title: string }) {
  const [src, setSrc] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let objectUrl = '';
    let active = true;
    apiBlob(url).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) { setSrc(objectUrl); setType(blob.type); }
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load this certificate.');
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  if (error) return <div className="certificate-preview-error">{error}</div>;
  if (!src) return <div className="certificate-preview-loading">Loading certificate…</div>;
  return type === 'application/pdf'
    ? <iframe className="certificate-preview" src={src} title={title} />
    : <img className="certificate-preview certificate-preview-image" src={src} alt={title} />;
}
