import { Injectable } from '@angular/core';
import { Settings } from '../models/settings';
import * as app from 'tns-core-modules/application';
import * as utils from 'tns-core-modules/utils/utils';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  constructor() { }

  getSettings(): Settings {
      const geocodingApiKey: string = app.android.context.getResources().
        getString(utils.ad.resources.getStringId('nativescript_geocoding_api_key'));
      return {
          geocodingApiKey: geocodingApiKey,
          googleMapsApiBaseUrl: 'https://maps.googleapis.com/maps/api'
      };
  }
}
