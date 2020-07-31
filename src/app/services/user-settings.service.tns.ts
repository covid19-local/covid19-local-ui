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
import { UserSettings } from '../models/user-settings';

const USER_SETTINGS_KEY = 'userSettings';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
    public get userSettings(): UserSettings {
        const userSettingsValue = getString(USER_SETTINGS_KEY, '');
        if (userSettingsValue === '') {
            const userSettings: UserSettings = {
                enableNotifications: true
            };
            this.userSettings = userSettings;
            return userSettings;
        }
        return JSON.parse(userSettingsValue);
    }

    public set userSettings(value: UserSettings) {
        setString(USER_SETTINGS_KEY, JSON.stringify(value));
    }

  constructor() { }
}
