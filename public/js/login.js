'use strict';

var Login = function() {
    console.log("new Login!");

    this.loginButton = document.getElementById('login-button');
    this.roomNumberInput = document.getElementById('roomNumber');
    this.roomNumberInputLabel = document.getElementById('roomNumber-label');

    this.roomNumberInput.value = 123456;

    this.onLoginCompleted = null;

    this.roomNumberInputListener = this.onRoomNumberInput.bind(this);
    this.roomNumberInput.addEventListener(
        'input', this.roomNumberInputListener, false);
    this.loginButtonListener = this.onLoginButton.bind(this);
    this.loginButton.addEventListener(
        'click', this.loginButtonListener, false);
}

Login.prototype.onLoginButton = function() {
    this.login(this.roomNumberInput.value);
}

Login.prototype.onRoomNumberInput = function() {
    var roomNumber = this.roomNumberInput.value;
    var valid = roomNumber.length >= 6;
    var re = /[^0-9]/g;
    valid = valid && !re.exec(roomNumber);
    if (valid) {
        console.log("room number valid!");
        this.roomNumberInputLabel.classList.add('hidden');
        this.loginButton.disabled = false;
    } else {
        console.log("room number invalid");
        this.roomNumberInputLabel.classList.remove('hidden');
        this.loginButton.disabled = true;
    }
}

Login.prototype.login = function(roomNumber) {
    /*$.ajax({
        url: '/postTest',
        async: true,
        type: 'POST',
        data: {
            test:"lll"
        },
        dataType: 'html',
        success: function(data) {
            alert("SUCCESSS!!!!!");
        },
        error: function(err) {
            alert("FAILED!!!" + err);
        }
    });*/

    if (this.onLoginCompleted) {
        this.onLoginCompleted();
    }
}