import { Injectable } from '@angular/core';
import { Settings } from '../models/settings';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  constructor() { }

  getSettings(): Settings {
    return {
        geocodingApiKey: '',
        googleMapsApiBaseUrl: 'https://maps.googleapis.com/maps/api'
    };
}
}
