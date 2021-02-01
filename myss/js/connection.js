'use strict';

var Connection = function (peerA, peerB, call) {
    console.log("new Connection, caller: ", peerA, " callee: ", peerB);
    
    this.remoteVideo = document.querySelector('#remotevideo');

    this.call_ = call;
    this.roomRef = this.call_.appController_.roomRef;
    this.caller = peerA;
    this.callee = peerB;
    this.localStream = call.localStream;
    this.remoteStream = new MediaStream();

    this.configuration = {
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                    "stun:stun.ekiga.net",
                    "stun:stun.ideasip.com",
                    "stun:stun.rixtelecom.se",
                    "stun:stun.schlund.de",
                    "stun:stun.stunprotocol.org:3478",
                    "stun:stun.voiparound.com",
                    "stun:stun.voipbuster.com",
                    "stun:stun.voipstunt.com",
                    "stun:stun.voxgratia.org"
                ],
            },
        ],
        iceCandidatePoolSize: 10,
    };

    this.videoSenders = [];
    this.audioSenders = [];
    
}

Connection.prototype.initDB = function (pcName) {
    this.pcCollection = this.roomRef.collection(pcName);
    this.pcCollectionRef = this.pcCollection.doc(pcName);
    this.pcCollectionRef.set({ caller: this.caller, callee: this.callee });

    this.callerCandidatesCollection = this.pcCollectionRef.collection('callerCandidates');
    this.calleeCandidatesCollection = this.pcCollectionRef.collection('calleeCandidates');
}

Connection.prototype.addCandidateDB = function (isCaller, candidate) {
    if (isCaller) {
        this.callerCandidatesCollection.add(candidate);
    } else {
        this.calleeCandidatesCollection.add(candidate);
    }
}

Connection.prototype.initConnection = function(pcName) {
    this.pcName = pcName;
    this.initDB(pcName);
    
    this.peerConnection = new RTCPeerConnection(this.configuration);
    this.registerPeerConnectionListeners();
    
    this.localStream.getVideoTracks().forEach(track =>
        this.videoSenders.push(this.peerConnection.addTrack(track, this.localStream)));
    this.localStream.getAudioTracks().forEach(track =>
        this.audioSenders.push(this.peerConnection.addTrack(track, this.localStream)));

    /* it is triggered at its own setLocalDescription */
    this.peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
            console.log('Got final candidate!');
            return;
        }
        console.log('Got candidate: ', event.candidate);
        this.addCandidateDB(isCaller, event.candidate.toJSON());
    });

    /* this is triggered at its setRemoteDescription */
    this.peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        this.remoteVideo.srcObject = this.remoteStream;
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
            this.remoteStream.addTrack(track);
        });
    });
}

Connection.prototype.startOffer = async function() {
    /* create Offer */
    const roomWithOffer = await setLocalDescription(true);
    await this.pcCollectionRef.update(roomWithOffer);

    this.roomId = this.roomRef.id;

    /* it is triggered at peer create answer */
    this.pcCollectionRef.onSnapshot(async snapshot => {
        const data = snapshot.data();
        await this.setRemoteDescription(true, data);
    });

    /* it is trigger at peer(callee) added in DB */
    this.calleeCandidatesCollection.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type == 'added') {
                let data = change.doc.data();
                await this.addIceCandidate(data);
            }
        });
    })
}

Connection.prototype.startAnswer = async function() {
    const pcCollectionSnapshot = await this.pcCollectionRef.get();
    const data = pcCollectionSnapshot.data();
    console.log('Got offer:', data.offer);
    await this.setRemoteDescription(false, data);

    const roomWithAnswer = await this.setLocalDescription(false);
    await this.pcCollectionRef.update(roomWithAnswer);
    
    /* it is trigger at peer(callee) added in DB */
    this.callerCandidatesCollection.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                let data = change.doc.data();
                console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                await this.addIceCandidate(data);
            }
        });
    });
}

Connection.prototype.startConnection = async function (me) {
    const pcCollectionSnapshot = await this.pcCollectionRef.get();
    //const caller = pcCollectionSnapshot.data().caller;
    //const callee = pcCollectionSnapshot.data().callee;
    
    if (me == this.caller) {
        await this.startOffer();
    } else {
        await this.startAnswer();
    }
}


Connection.prototype.registerPeerConnectionListeners = function() {
    this.peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(
          `[${this.pcName}] ICE gathering state changed: ${this.peerConnection.iceGatheringState}`);
    });
  
    this.peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`[${this.pcName}] Connection state change: ${this.peerConnection.connectionState}`);
        if (this.peerConnection.connectionState == "disconnected") {
            //noticeInfo.innerHTML = 'Peer disconnected!! '
        }
    });
  
    this.peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`[${this.pcName}] Signaling state change: ${this.peerConnection.signalingState}`);
    });
  
    this.peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(
          `[${this.pcName}] ICE connection state change: ${this.peerConnection.iceConnectionState}`);
    });
}

Connection.prototype.setLocalDescription = async function (isCaller) {
    if (isCaller) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        console.log('Created offer: ', offer);

        return {
            'offer': {
                type: offer.type,
                sdp: offer.sdp,
            },
        };
    } else {
        const answer = await this.peerConnection.createAnswer();
        console.log('Created answer:', answer);
        await this.peerConnection.setLocalDescription(answer);

        return {
            answer: {
                type: answer.type,
                sdp: answer.sdp,
            },
        };
    }
}

Connection.prototype.setRemoteDescription = async function (isCaller, data) {
    if (isCaller) {
        if (!this.peerConnection.currentRemoteDescription && data && data.answer) {
            console.log('Got remote description: ', data.answer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    } else {
        if (!this.peerConnection.currentRemoteDescription && data && data.offer) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        }
    }
}

Connection.prototype.addIceCandidate = async function (data) {
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
}

Connection.prototype.hangup = function () {
    if (this.remoteStream && this.remoteStream.getTracks()) {
        console.log("Stop remote tracks. Size: " + this.remoteStream.getTracks().length);
        this.remoteStream.getTracks().forEach(track => track.stop());
        this.remoteStream = new MediaStream();
    }
    if (this.peerConnection) {
        this.peerConnection.close();
    }
    this.remoteVideo.srcObject = null;
}