import { useEffect, useRef } from 'react';
import './HtmlPreview.css';

interface HtmlPreviewProps {
  htmlContent: string | null;
  documentId?: string;
}

export default function HtmlPreview({ htmlContent, documentId }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [htmlContent]);

  if (!htmlContent) {
    return (
      <div className="html-preview">
        <div className="preview-header">
          <h3>HTML Preview</h3>
        </div>
        <div className="preview-empty">
          <p>No HTML document to preview</p>
          <p className="preview-hint">
            Ask the assistant to create or edit an HTML document to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="html-preview">
      <div className="preview-header">
        <h3>HTML Preview</h3>
        {documentId && (
          <span className="document-id">ID: {documentId}</span>
        )}
      </div>
      <div className="preview-content">
        <iframe
          ref={iframeRef}
          title="HTML Preview"
          sandbox="allow-same-origin allow-scripts"
          className="preview-iframe"
        />
      </div>
    </div>
  );
}

