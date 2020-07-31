import { Injectable } from '@angular/core';
import { UserSettings } from '../models/user-settings';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  public userSettings: UserSettings;

  constructor() { }
}
