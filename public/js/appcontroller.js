'use strict';


var AppController = function(){
    console.log("new AppController!!");
    this.loginDiv = document.getElementById('login-div');

    this.showLoginPage();
}

AppController.prototype.showLoginPage = function() {
    this.loginObj = new Login();
    this.show_(this.loginDiv);
    this.loginObj.onLoginCompleted = function() {
        this.hide_(this.loginDiv);

    }.bind(this);
}


AppController.prototype.deactivate_ = function(element) {
    element.classList.remove('active');
}

AppController.prototype.activate_ = function(element) {
    element.classList.add('active');
}

AppController.prototype.hide_ = function(element) {
    element.classList.add('hidden');
}

AppController.prototype.show_ = function(element) {
    console.log("remove the hidden word");
    element.classList.remove('hidden');
}