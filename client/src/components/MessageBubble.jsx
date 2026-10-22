function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isMine, onImageClick }) {
  const { type, content, senderName, timestamp, fileName } = message;

  if (type === 'system') {
    return (
      <div className="message system-msg">
        <div className="message-bubble">{content}</div>
      </div>
    );
  }

  const alignment = isMine ? 'mine' : 'theirs';

  return (
    <div className={`message ${alignment}`}>
      {!isMine && <span className="message-sender">{senderName}</span>}

      <div className="message-bubble">
        {type === 'image' ? (
          <img
            className="message-image"
            src={content}
            alt={fileName || 'Shared image'}
            onClick={() => onImageClick(content)}
            loading="lazy"
          />
        ) : (
          <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
        )}
      </div>

      <span className="message-time">{formatTime(timestamp)}</span>
    </div>
  );
}
