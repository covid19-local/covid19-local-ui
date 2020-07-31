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
import { HomeLocation } from '../models/home-location';

const LOCATION_KEY = 'location';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

    public get location(): HomeLocation {
        const locationValue = getString(LOCATION_KEY, '');
        if (locationValue === '') {
            return null;
        }
        return JSON.parse(locationValue);
    }

    public set location(value: HomeLocation) {
        setString(LOCATION_KEY, JSON.stringify(value));
    }

  constructor() { }
}
