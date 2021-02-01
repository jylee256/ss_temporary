'use strict';

var Login = function() {
    console.log("New login");

    this.createButton = document.querySelector('#createButton');
    this.joinButton = document.querySelector('#joinButton');

    this.createButtonListener = this.onCreateRoom.bind(this);
    this.createButton.addEventListener(
        'click', this.createButtonListener, false);

    this.joinButtonListener = this.onJoinRoom.bind(this);
    this.createButton.addEventListener(
        'click', this.createButtonListener, false);
}

Login.prototype.onCreateRoom = async function() {
    this.createButton.disabled = true;
    this.joinButton.disabled = true;

    const db = firebase.firestore();
    const roomRef = await db.collection('rooms').doc();
    const callerCandidatesCollection = roomRef.collection('callerCandidates');
}