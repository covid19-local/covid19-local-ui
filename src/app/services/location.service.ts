import { Injectable } from '@angular/core';
import { HomeLocation } from '../models/home-location';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  public location: HomeLocation;

  constructor() { }
}
