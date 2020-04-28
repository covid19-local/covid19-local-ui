import { Component, OnInit } from '@angular/core';
const firebase = require('nativescript-plugin-firebase');

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  ngOnInit() {
    firebase.init({

      showNotifications: true,
      showNotificationsWhenInForeground: true,

      onPushTokenReceivedCallback: (token) => {
        console.log('[Firebase] onPushTokenReceivedCallback:', { token });
      },

      onMessageReceivedCallback: (message) => {
        console.log('[Firebase] onMessageReceivedCallback:', { message });
      }

    }).then(
      () => {
        console.log('firebase.init done'); },
      error => {
        console.log(`firebase.init error: ${error}`);
      }
    );
  }
}
