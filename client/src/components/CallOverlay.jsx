import { useEffect, useRef } from 'react';

export default function CallOverlay({ webrtc }) {
  const {
    callState,
    callType,
    callPeer,
    localStream,
    remoteStream,
    answerCall,
    rejectCall,
    endCall,
    peerRef,
  } = webrtc;

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleAccept = () => {
    const pending = peerRef.current;
    if (pending?._pendingOffer) {
      answerCall(pending._from, pending._pendingOffer, pending._type);
    }
  };

  const handleReject = () => {
    const pending = peerRef.current;
    if (pending?._from) {
      rejectCall(pending._from);
    }
  };

  // Incoming call
  if (callState === 'incoming') {
    const pending = peerRef.current;
    return (
      <div className="call-overlay">
        <div className="call-card">
          <h3 className="pulsing">
            📞 Incoming {pending?._type === 'video' ? 'Video' : 'Voice'} Call
          </h3>
          <p className="call-type">from {pending?._fromName || 'Unknown'}</p>
          <div className="call-actions">
            <button className="btn btn-success" onClick={handleAccept} style={{ width: 'auto' }}>
              ✓ Accept
            </button>
            <button className="btn btn-danger" onClick={handleReject} style={{ width: 'auto' }}>
              ✕ Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calling (ringing)
  if (callState === 'calling') {
    return (
      <div className="call-overlay">
        <div className="call-card">
          <h3 className="pulsing">
            📞 Calling…
          </h3>
          <p className="call-type">{callType === 'video' ? 'Video' : 'Voice'} call</p>
          <div className="call-actions">
            <button className="btn btn-danger" onClick={endCall} style={{ width: 'auto' }}>
              ✕ Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected call
  if (callState === 'connected') {
    return (
      <div className="call-overlay">
        <div className="call-card">
          {callType === 'video' ? (
            <div className="call-video-container">
              <video ref={remoteVideoRef} autoPlay playsInline />
              <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
            </div>
          ) : (
            <>
              <h3>🔊 Voice Call Connected</h3>
              <p className="call-type" style={{ marginBottom: 24 }}>Call in progress…</p>
              {/* Hidden audio elements */}
              <audio ref={remoteVideoRef} autoPlay />
              <audio ref={localVideoRef} autoPlay muted />
            </>
          )}
          <div className="call-actions">
            <button className="btn btn-danger" onClick={endCall} style={{ width: 'auto' }}>
              ✕ End Call
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
