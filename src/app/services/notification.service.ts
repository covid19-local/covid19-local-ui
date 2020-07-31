import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor() { }

  initialize() {}
  subscribeToTopic(topic: string) {}
  subscribeToTopics(topics: string[], removeOtherTopics: boolean) {}
  disableNotifications() {}
}
