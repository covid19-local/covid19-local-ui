import { Component, OnInit, ViewChild } from '@angular/core';
import {registerElement} from 'nativescript-angular/element-registry';
import { MapView, Marker, Position } from 'nativescript-google-maps-sdk';
import * as geolocation from 'nativescript-geolocation';
import { Accuracy } from 'tns-core-modules/ui/enums';
import { MapService } from '../services/map.service';
import { AddressComponent, Result } from '../models/geocode';
import { CovidService } from '../services/covid.service';
import { City } from '../models/covid';
import { isNullOrUndefined } from 'util';

registerElement('MapView', () => MapView);

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  title = 'covid19-ui';

  latitude = 0;
  longitude = 0;
  zoom = 9;
  bearing = 0;
  tilt = 0;
  padding = [40, 40, 40, 40];
  isLocationLoaded = false;
  countryResult: Result;
  country: AddressComponent;
  stateResult: Result;
  state: AddressComponent;
  countyResult: Result;
  county: AddressComponent;
  cityResult: Result;
  city: AddressComponent;
  report: City;
  date = new Date();
  @ViewChild('MapView', {static: false}) mapView: MapView;

  lastCamera: String;

  constructor(private mapService: MapService, private covidService: CovidService) { }

  ngOnInit() {
  }

  enableLocation() {
    geolocation.isEnabled().then( (isEnabled) => {
        if (!isEnabled) {
            geolocation.enableLocationRequest(true, true).then(() => {
                console.log('User Enabled Location Service');
                this.getCurrentLocation();
            }, (e) => {
                console.log(`Error: ${e.message || e}`);
            }).catch(ex => {
                console.log('Unable to Enable Location', ex);
            });
        } else {
            this.getCurrentLocation();
        }
    }, (e) => {
        console.log('Error: ' + (e.message || e));
    });
  }

  getCurrentLocation() {
    geolocation.getCurrentLocation({
        desiredAccuracy: Accuracy.any,
        maximumAge: 5000,
        timeout: 10000
    }).then((loc) => {
        if (loc) {
            this.latitude = loc.latitude;
            this.longitude = loc.longitude;
            this.getCurrentAddress();
        }
    }, (e) => {
        console.log('Error: ' + (e.message || e));
    });
  }

  getCurrentAddress() {
    this.mapService.reverseGeocode(this.latitude, this.longitude)
    .subscribe(response => {
        if (response.status === 'OK') {
            this.countryResult = response.results.find(result => result.types.includes('country'));
            this.stateResult = response.results.find(result => result.types.includes('administrative_area_level_1'));
            this.countyResult = response.results.find(result => result.types.includes('administrative_area_level_2'));
            this.cityResult = response.results.find(result => result.types.includes('locality'));
            if (!isNullOrUndefined(this.countryResult)) {
                this.country = this.countryResult.address_components
                .find(component => component.types.includes('country'));
            }
            if (!isNullOrUndefined(this.stateResult)) {
                this.state = this.stateResult.address_components
                .find(component => component.types.includes('administrative_area_level_1'));
            }
            if (!isNullOrUndefined(this.countyResult)) {
                this.county = this.countyResult.address_components
                .find(component => component.types.includes('administrative_area_level_2'));
            }
            if (!isNullOrUndefined(this.cityResult)) {
                this.city = this.cityResult.address_components
                .find(component => component.types.includes('locality'));
            }
            this.getCovidReports();
        } else {
            console.log('Status is not OK');
        }
    }, (error) => {
        console.log(error);
    });
  }

  getCovidReports() {
      // TODO: Determine iso from API instead of hard coding
      const iso = 'USA';
      const regionName = this.country.short_name;
      const province = this.state.long_name;
      this.covidService.getReports(this.date, iso, regionName, province).subscribe(result => {
          if (result.data.length > 0) {
            const datum = result.data[0];
            this.report = datum.region.cities.
            find(cityReport =>
                this.matchesAddress(cityReport, this.county));
            if (isNullOrUndefined(this.report)) {
                this.report = result.data[0].region.cities.
                find(cityReport =>
                    this.matchesAddress(cityReport, this.city));
                if (isNullOrUndefined(this.report)) {
                    this.report = {
                        name: datum.region.province,
                        date: datum.date,
                        fips: 0,
                        confirmed: datum.confirmed,
                        deaths: datum.deaths,
                        confirmed_diff: datum.confirmed_diff,
                        deaths_diff: datum.deaths_diff,
                        last_update: datum.last_update
                     };
                    console.log('Setting location to state...');
                    this.latitude = this.stateResult.geometry.location.lat;
                    this.longitude = this.stateResult.geometry.location.lng;
                } else {
                    console.log('Setting location to city...');
                    this.latitude = this.cityResult.geometry.location.lat;
                    this.longitude = this.cityResult.geometry.location.lng;
                }
            } else {
                console.log('Setting location to county...');
                this.latitude = this.countyResult.geometry.location.lat;
                this.longitude = this.countyResult.geometry.location.lng;
            }
            this.isLocationLoaded = true;
            this.setPrimaryMarker();
            result.data[0].region.cities.filter(report => report !== this.report).forEach(report => {
                if (report.name.toUpperCase() !== 'UNASSIGNED') {
                    const address = `${report.name}, ${this.state.short_name}`;
                    this.mapService.geocode(address).subscribe(response => {
                        const countyResult = response.results.find(geocodeResult =>
                            geocodeResult.types.includes('administrative_area_level_2'));
                        const cityResult = response.results.find(geocodeResult =>
                            geocodeResult.types.includes('locality'));

                        let latitude: number;
                        let longitude: number;
                        if (!isNullOrUndefined(countyResult)) {
                            latitude = countyResult.geometry.location.lat;
                            longitude = countyResult.geometry.location.lng;
                        }
                        if (!isNullOrUndefined(cityResult)) {
                            if (isNullOrUndefined(latitude) || isNullOrUndefined(longitude)) {
                                latitude = cityResult.geometry.location.lat;
                                longitude = cityResult.geometry.location.lng;
                            }
                        }
                        this.setMarker(latitude, longitude, report.name, report.confirmed, false);
                    });
                } else {
                    this.setMarker(
                        this.stateResult.geometry.location.lat,
                        this.stateResult.geometry.location.lng,
                        report.name, report.confirmed, false);
                }
            });
          } else {
              const yesterday = new Date();
              yesterday.setDate(this.date.getDate() - 1);
              if (this.date > yesterday) {
                this.date = yesterday;
                this.getCovidReports();
              }
          }
      }, (error) => {
        console.log(error);
      });
  }

  matchesAddress(cityReport: City, address: AddressComponent): boolean {
      return !isNullOrUndefined(address) &&
      (cityReport.name.toUpperCase().trim() === address.long_name.toUpperCase().trim() ||
      cityReport.name.toUpperCase().trim() === address.long_name.toUpperCase().replace('COUNTY', '').trim() ||
      cityReport.name.toUpperCase().trim().includes(address.long_name.toUpperCase().replace('COUNTY', '').trim()) ||
      cityReport.name.toUpperCase().trim() === address.long_name.toUpperCase().replace('PARISH', '').trim() ||
      cityReport.name.toUpperCase().trim().includes(address.long_name.toUpperCase().replace('PARISH', '').trim()));
  }

  setMarker(latitude: number, longitude: number, region: string, confirmedCases: number, showInfoWindow: boolean) {
      if (this.mapView && !isNullOrUndefined(latitude) && !isNullOrUndefined(longitude)) {
        console.log('Setting a marker...');
        const marker = new Marker();
        marker.position = Position.positionFromLatLng(latitude, longitude);
        marker.title = region;
        marker.snippet = `Confirmed Cases: ${confirmedCases}`;
        marker.userData = {index: 1};
        this.mapView.addMarker(marker);
        if (showInfoWindow) {
            marker.showInfoWindow();
        }
      }
  }

  setPrimaryMarker() {
      this.setMarker(this.latitude, this.longitude, this.report.name, this.report.confirmed, true);
  }

  onMapReady(event) {
      console.log('Map Ready');

      this.mapView = event.object;
      this.enableLocation();
  }
}
