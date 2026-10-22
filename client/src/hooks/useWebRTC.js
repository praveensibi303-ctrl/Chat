import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function useWebRTC(socket) {
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const [callState, setCallState] = useState('idle');
  // idle | calling | incoming | connected
  const [callType, setCallType] = useState(null); // 'voice' | 'video'
  const [callPeer, setCallPeer] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallType(null);
    setCallPeer(null);
  }, []);

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate && callPeer) {
        socket.emit('call:ice-candidate', {
          to: callPeer,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanup();
      }
    };

    peerRef.current = pc;
    return pc;
  }, [callPeer, socket, cleanup]);

  const startCall = useCallback(
    async (targetId, type) => {
      try {
        setCallPeer(targetId);
        setCallType(type);
        setCallState('calling');

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video',
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerRef.current = pc;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('call:ice-candidate', { to: targetId, candidate: e.candidate });
          }
        };

        pc.ontrack = (e) => {
          remoteStreamRef.current = e.streams[0];
          setRemoteStream(e.streams[0]);
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            cleanup();
          }
        };

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call:initiate', { to: targetId, offer, callType: type });
      } catch (err) {
        console.error('Failed to start call:', err);
        cleanup();
      }
    },
    [socket, cleanup]
  );

  const answerCall = useCallback(
    async (from, offer, type) => {
      try {
        setCallState('connected');

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video',
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerRef.current = pc;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('call:ice-candidate', { to: from, candidate: e.candidate });
          }
        };

        pc.ontrack = (e) => {
          remoteStreamRef.current = e.streams[0];
          setRemoteStream(e.streams[0]);
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            cleanup();
          }
        };

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('call:answer', { to: from, answer });
      } catch (err) {
        console.error('Failed to answer call:', err);
        cleanup();
      }
    },
    [socket, cleanup]
  );

  const rejectCall = useCallback(
    (from) => {
      socket.emit('call:reject', { to: from });
      cleanup();
    },
    [socket, cleanup]
  );

  const endCall = useCallback(() => {
    if (callPeer) {
      socket.emit('call:end', { to: callPeer });
    }
    cleanup();
  }, [callPeer, socket, cleanup]);

  // Listen for signaling events
  useEffect(() => {
    const handleIncoming = ({ from, fromName, offer, callType: ct }) => {
      setCallPeer(from);
      setCallType(ct);
      setCallState('incoming');
      // Store offer for when user accepts
      peerRef.current = { _pendingOffer: offer, _from: from, _type: ct, _fromName: fromName };
    };

    const handleAnswered = async ({ from, answer }) => {
      if (peerRef.current && peerRef.current.setRemoteDescription) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState('connected');
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (peerRef.current && peerRef.current.addIceCandidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('ICE candidate error:', e);
        }
      }
    };

    const handleEnded = () => cleanup();
    const handleRejected = () => cleanup();

    const unsubs = [
      socket.on('call:incoming', handleIncoming),
      socket.on('call:answered', handleAnswered),
      socket.on('call:ice-candidate', handleIceCandidate),
      socket.on('call:ended', handleEnded),
      socket.on('call:rejected', handleRejected),
    ];

    return () => unsubs.forEach((u) => typeof u === 'function' && u());
  }, [socket, cleanup]);

  return {
    callState,
    callType,
    callPeer,
    localStream,
    remoteStream,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    peerRef,
  };
}
