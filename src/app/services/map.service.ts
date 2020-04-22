import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GeocodeResponse } from '../models/geocode';
import { Observable } from 'rxjs';
import { SettingsService } from './settings.service';
import { Settings } from '../models/settings';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private _settings: Settings;
  get settings(): Settings {
    if (!this._settings) {
      this._settings = this.settingsService.getSettings();
    }
    return this._settings;
  }

  get geoCodingApiBaseUrl(): string {
    return `${this.settings.googleMapsApiBaseUrl}/geocode/json`;
  }

  constructor(private http: HttpClient, private settingsService: SettingsService) { }

  geocode(address: string): Observable<GeocodeResponse> {
    address = encodeURI(address);
    return this.http.get<GeocodeResponse>(
      `${this.geoCodingApiBaseUrl}?address=${address}&key=${this.settings.geocodingApiKey}`);
  }

  reverseGeocode(latitude: number, longitude: number): Observable<GeocodeResponse> {
    return this.http.get<GeocodeResponse>(
      `${this.geoCodingApiBaseUrl}?latlng=${latitude},${longitude}&key=${this.settings.geocodingApiKey}`);
  }
}
