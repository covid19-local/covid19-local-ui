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
import { DatePipe, DecimalPipe } from '@angular/common';
import { NotificationService } from '../services/notification.service';

registerElement('MapView', () => MapView);

const templates = `<template key="defaultTemplate">
                        <StackLayout orientation="vertical">
                            <Label text="{{userData.region}}"
                                style="font-size: 14; font-weight: bold;">
                            </Label>
                            <Label text="{{userData.confirmedCases}}" className="snippet"
                                style="font-size: 12;">
                            </Label>
                            <Label text="{{userData.date}}" className="snippet"
                                style="font-size: 12;">
                            </Label>
                        </StackLayout>
                    </template>`;

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
  @ViewChild('MapView', {static: false}) mapView: MapView & {infoWindowTemplates: string };

  lastCamera: String;

  constructor(private mapService: MapService, private covidService: CovidService,
    private datePipe: DatePipe, private decimalPipe: DecimalPipe,
    private notificationService: NotificationService) { }

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
      const regionName = this.country.short_name;
      const province = this.state.long_name;
      this.covidService.getReports(this.date, regionName, province).subscribe(result => {
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
                        last_update: datum.last_update,
                        lat: datum.region.lat,
                        long: datum.region.long
                     };
                }
            }
            this.latitude = +this.report.lat;
            this.longitude = +this.report.long;
            this.isLocationLoaded = true;
            this.subscribeToNotifications();
            this.setPrimaryMarker();
            result.data[0].region.cities.filter(report => report !== this.report).forEach(report => {
                if (report.name.toUpperCase() !== 'UNASSIGNED') {
                    this.setMarker(+report.lat, +report.long, report.name, report.confirmed, this.convertToDate(report.date), false);
                } else {
                    this.setMarker(
                        this.stateResult.geometry.location.lat,
                        this.stateResult.geometry.location.lng,
                        report.name, report.confirmed,
                        this.convertToDate(report.date),
                         false);
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

  setMarker(latitude: number, longitude: number, region: string, confirmedCases: number, date: Date, showInfoWindow: boolean) {
      if (this.mapView && !isNullOrUndefined(latitude) && !isNullOrUndefined(longitude)) {
        console.log(`Setting a marker for ${region}...`);
        const marker = new Marker();
        marker.position = Position.positionFromLatLng(latitude, longitude);
        marker.userData = {
            region: region,
            confirmedCases: `${this.decimalPipe.transform(confirmedCases)} confirmed cases`,
            date: `Last updated ${this.datePipe.transform(date, 'shortDate')}`
        };
        marker.infoWindowTemplate = 'defaultTemplate';
        this.mapView.addMarker(marker);
        if (showInfoWindow) {
            marker.showInfoWindow();
        }
      }
  }

  setPrimaryMarker() {
      this.setMarker(this.latitude, this.longitude, this.report.name, this.report.confirmed, this.convertToDate(this.report.date), true);
  }
  subscribeToNotifications() {
      const stateTopicArgs = [this.country.short_name, this.state.long_name];
      const cityTopicArgs = stateTopicArgs.concat([this.report.name]);
      const stateTopic = this.generateTopic(stateTopicArgs);
      const cityTopic =  this.generateTopic(cityTopicArgs);
      this.notificationService.subscribeToTopics([stateTopic, cityTopic], true);
  }

  onMapReady(event) {
      console.log('Map Ready');

      this.mapView = event.object;
      this.mapView.infoWindowTemplates = templates;
      this.enableLocation();
  }

  convertToDate(input: string): Date {
      const offsetHours = new Date().getTimezoneOffset() / 60;
      let offsetIndicator = '+';
      if (offsetHours > 0) {
        offsetIndicator = '-';
      }
      let formattedOffset = `Z${offsetIndicator}${offsetHours}:00`;
      if (offsetHours === 0) {
        formattedOffset = 'Z';
      }
      input = `${input}${formattedOffset}`;
      return new Date(input);
  }

  generateTopic(topicArgs: string[]): string {
    let topic = '';
    for (const arg of topicArgs) {
        topic += `${encodeURI(arg).replace('\'', '').replace('(', '').replace(')', '')}_`;
    }
    if (topic.length > 0) {
        topic = topic.substring(0, topic.lastIndexOf('_'));
    }
    return topic;
  }
}
