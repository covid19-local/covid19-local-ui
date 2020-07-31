import { Injectable } from '@angular/core';
import {
    getBoolean,
    setBoolean,
    getNumber,
    setNumber,
    getString,
    setString,
    hasKey,
    remove,
    clear
} from 'tns-core-modules/application-settings';
const firebase = require('nativescript-plugin-firebase');
const SUBSCRIBED_TOPICS_KEY = 'subscribedTopics';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor() { }

  initialize() {
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

  get subscribedTopics(): string[] {
      const topicsValue = getString(SUBSCRIBED_TOPICS_KEY, '');
      if (topicsValue === '') {
          return [];
      }
      return topicsValue.split(',');
  }

  set subscribedTopics(value: string[]) {
      setString(SUBSCRIBED_TOPICS_KEY, value.join(','));
  }

  isSubscribedToTopic(topic: string) {
      return this.subscribedTopics.includes(topic);
  }

  subscribeToTopic(topic: string) {
      if (!this.isSubscribedToTopic(topic)) {
          firebase.subscribeToTopic(topic).then(() => {
              console.log(`Subscribed to topic ${topic}`);
              const subscribedTopics = this.subscribedTopics;
              subscribedTopics.push(topic);
              this.subscribedTopics = subscribedTopics;
            }).catch(error => {
                console.log(`Error subscribing to topic ${topic}: ${error}`);
            });
      } else {
        console.log(`Already subscribed to topic ${topic}`);
      }
  }

  removeTopic(topic: string) {
    let subscribedTopics = this.subscribedTopics;
    subscribedTopics = subscribedTopics.filter(theTopic => theTopic !== topic);
    this.subscribedTopics = subscribedTopics;
  }

  unsubscribeFromTopic(topic: string) {
    firebase.unsubscribeFromTopic(topic).then(() => {
        console.log(`Unsubscribed from topic ${topic}`);
        this.removeTopic(topic);
    }).catch(error => {
        console.log(`Error unsubscribing from topic ${topic}: ${error}`);
    });
  }

  subscribeToTopics(topics: string[], removeOtherTopics: boolean) {
      if (removeOtherTopics) {
          const extraTopics = this.subscribedTopics.filter(topic => !topics.includes(topic));
          for (const extraTopic of extraTopics) {
              if (extraTopic === '') {
                  this.removeTopic(extraTopic);
              } else {
                this.unsubscribeFromTopic(extraTopic);
              }
          }
      }
      for (const topic of topics) {
          this.subscribeToTopic(topic);
      }
  }

  disableNotifications() {
    for (const topic of this.subscribedTopics) {
      this.unsubscribeFromTopic(topic);
    }
  }
}
