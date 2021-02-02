'use strict';


var Connection = function (me, peer, call) {   
    this.call_ = call;
    this.roomRef = this.call_.appController_.roomRef;

    var compare = me.localeCompare(peer);
    if (compare == 0) {
        console.log('peers have same name....');
        return;
    }
    this.caller = (compare == 1) ? me : peer;
    this.callee = (compare == 1) ? peer : me;
    this.pcName = `pc_${this.caller}-${this.callee}`;
    this.isCaller = (me == this.caller) ? true : false;

    console.log(`New connection name is ${this.pcName} (caller: ${this.caller}, callee: ${this.callee})`);

    this.localStream = call.localStream;
    this.remoteStream = new MediaStream();
    this.addRemoteStream(this.call_.connectionCnt, peer);

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

Connection.prototype.initDB = async function (pcName) {
    this.pcCollection = this.roomRef.collection(pcName);
    this.pcCollectionRef = this.pcCollection.doc(pcName);
    await this.pcCollectionRef.set({ caller: this.caller, callee: this.callee });

    this.callerCandidatesCollection = this.pcCollectionRef.collection('callerCandidates');
    this.calleeCandidatesCollection = this.pcCollectionRef.collection('calleeCandidates');
}

Connection.prototype.deleteDB = async function () {
    var res = await this.callerCandidatesCollection.get();
    res.forEach(element => {
        element.ref.delete();
    });
    var res1 = await this.calleeCandidatesCollection.get();
    res1.forEach(element => {
        element.ref.delete();
    });
    var res2 = await this.pcCollection.get();
    res2.forEach(element => {
        element.ref.delete();
    });
}

Connection.prototype.addCandidateDB = function (isCaller, candidate) {
    if (isCaller) {
        this.callerCandidatesCollection.add(candidate);
    } else {
        this.calleeCandidatesCollection.add(candidate);
    }
}

Connection.prototype.initConnection = async function() {
    await this.initDB(this.pcName);
    
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
        this.addCandidateDB(this.isCaller, event.candidate.toJSON());
    });

    /* this is triggered at its setRemoteDescription */
    this.peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
            this.remoteStream.addTrack(track);
        });
    });
}

Connection.prototype.addRemoteStream = function(index, peer) {
    const videosDiv = document.querySelector('#videos-div');
    var video = document.createElement('video');
    var div = document.createElement('div');
    var text = document.createTextNode(peer);

    div.appendChild(text);

    video.id = `remotevideo${index}`;
    video.autoplay = true;
    video.playsInline = true;


    videosDiv.append(div);
    videosDiv.append(video);

    this.remoteVideoNameDiv = div;
    this.remoteVideo = video;
    this.remoteVideo.srcObject = this.remoteStream;
}

Connection.prototype.startOffer = async function() {
    /* create Offer */
    const roomWithOffer = await this.setLocalDescription(true);
    await this.pcCollectionRef.update(roomWithOffer);

    /* it is trigger at peer(callee) added in DB */
    this.calleeCandidatesCollection.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type == 'added') {
                let data = change.doc.data();
                console.log(`caller addIceCandidate(calleeCandidates) ${JSON.stringify(data)}`);
                await this.addIceCandidate(data);
            }
        });
    })
}

Connection.prototype.startAnswer = async function() {
    /* create Answer */
    const roomWithAnswer = await this.setLocalDescription(false);
    await this.pcCollectionRef.update(roomWithAnswer);
    
    /* it is trigger at peer(caller) added in DB */
    this.callerCandidatesCollection.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                let data = change.doc.data();
                console.log(`callee addIceCandidate(callerCandidates) ${JSON.stringify(data)}`);
                //console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                await this.addIceCandidate(data);
            }
        });
    });
}

Connection.prototype.startConnection = async function (me) {
    const pcCollectionSnapshot = await this.pcCollectionRef.get();
    const caller = pcCollectionSnapshot.data().caller;
    const callee = pcCollectionSnapshot.data().callee;
    console.log("startConnection " + this.pcName + " caller: " + caller + " callee: " + callee);

    /* it is trigger at createAnswer / createOffer... */
    this.pcCollectionRef.onSnapshot(async snapshot => {
        const data = snapshot.data();
        await this.setRemoteDescription(this.isCaller, data);
    });

    if (me == this.caller) {
        await this.startOffer();
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
            console.log('Got answer:', data.answer);
            console.log('Got remote description: ', data.answer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    } else {
        if (!this.peerConnection.currentRemoteDescription && data && data.offer) {
            console.log('Got offer:', data.offer);
            console.log('Got remote description: ', data.offer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            await this.startAnswer();
        }
    }
}

Connection.prototype.addIceCandidate = async function (data) {
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
}

Connection.prototype.hangup = async function () {
    if (this.remoteStream && this.remoteStream.getTracks()) {
        console.log("Stop remote tracks. Size: " + this.remoteStream.getTracks().length);
        this.remoteStream.getTracks().forEach(track => track.stop());
        this.remoteStream = new MediaStream();
    }
    if (this.peerConnection) {
        this.peerConnection.close();
    }
    this.remoteVideo.srcObject = null;

    videosDiv.remove(this.remoteVideoNameDiv);
    videosDiv.remove(this.remoteVideo);

    await this.deleteDB();
}