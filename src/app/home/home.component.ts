import { Component, OnInit, ViewChild } from '@angular/core';
import { registerElement } from 'nativescript-angular/element-registry';
import { MapView, Marker, Position } from 'nativescript-google-maps-sdk';
import * as geolocation from 'nativescript-geolocation';
import { Accuracy } from 'tns-core-modules/ui/enums';
import { MapService } from '../services/map.service';
import { Result, GeocodeResponse } from '../models/geocode';
import { CovidService } from '../services/covid.service';
import { City, Datum } from '../models/covid';
import { Location } from '../models/location';
import { isNullOrUndefined } from 'util';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NotificationService } from '../services/notification.service';
import { LocationService } from '../services/location.service';
import { HomeLocation } from '../models/home-location';
import { confirm } from 'tns-core-modules/ui/dialogs';
import { Report } from '../models/report';

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
    zoom = 9;
    bearing = 0;
    tilt = 0;
    padding = [40, 40, 40, 40];
    date = new Date();
    states: string[] = [];
    public get location(): HomeLocation {
        return this.locationService.location;
    }
    public set location(value: HomeLocation) {
        this.locationService.location = value;
    }
    public report: Report;
    isLocationLoaded = false;
    @ViewChild('MapView', { static: false }) mapView: MapView & { infoWindowTemplates: string };

    lastCamera: String;

    constructor(private mapService: MapService, private covidService: CovidService,
        private datePipe: DatePipe, private decimalPipe: DecimalPipe,
        private notificationService: NotificationService,
        private locationService: LocationService) { }

    ngOnInit() {
    }

    async enableLocation() {
        if (await geolocation.isEnabled()) {
            try {
                await geolocation.enableLocationRequest(true, true);
                console.log('User Enabled Location Service');
            } catch (ex) {
                console.log('Unable to Enable Location', ex);
            }
        }
    }

    getCurrentLocation(): Promise<geolocation.Location> {
        return geolocation.getCurrentLocation({
            desiredAccuracy: Accuracy.any,
            maximumAge: 5000,
            timeout: 10000
        });
    }

    reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResponse> {
        return this.mapService.reverseGeocode(latitude, longitude).toPromise();
    }

    getHomeLocation(geocodeResults: Result[]): HomeLocation {
        const countryResult = geocodeResults.find(result => result.types.includes('country'));
        const stateResult = geocodeResults.find(result => result.types.includes('administrative_area_level_1'));
        const countyResult = geocodeResults.find(result => result.types.includes('administrative_area_level_2'));
        const cityResult = geocodeResults.find(result => result.types.includes('locality'));
        let countryLocation: Location = null;
        let stateLocation: Location = null;
        let countyLocation: Location = null;
        let cityLocation: Location = null;

        if (!isNullOrUndefined(countryResult)) {
            const country = countryResult.address_components
                .find(component => component.types.includes('country'));
            countryLocation = {
                name: country.short_name,
                lat: countryResult.geometry.location.lat,
                long: countryResult.geometry.location.lng
            };
        }
        if (!isNullOrUndefined(stateResult)) {
            const state = stateResult.address_components
                .find(component => component.types.includes('administrative_area_level_1'));
            stateLocation = {
                name: state.long_name,
                lat: stateResult.geometry.location.lat,
                long: stateResult.geometry.location.lng
            };
        }
        if (!isNullOrUndefined(countyResult)) {
            const county = countyResult.address_components
                .find(component => component.types.includes('administrative_area_level_2'));
            countyLocation = {
                name: county.long_name,
                lat: countyResult.geometry.location.lat,
                long: countyResult.geometry.location.lng
            };
        }
        if (!isNullOrUndefined(cityResult)) {
            const city = cityResult.address_components
                .find(component => component.types.includes('locality'));
            cityLocation = {
                name: city.long_name,
                lat: cityResult.geometry.location.lat,
                long: cityResult.geometry.location.lng
            };
        }
        return {
            name: '',
            lat: 0,
            long: 0,
            city: cityLocation,
            county: countyLocation,
            province: stateLocation,
            region: countryLocation
        };
    }

    async getReports(regionName: string, province: string): Promise<Datum> {
        const result = await this.covidService.getReports(this.date, regionName, province).toPromise();
        if (result.data.length > 0) {
            return result.data[0];
        } else {
            const yesterday = new Date();
            yesterday.setDate(this.date.getDate() - 1);
            if (this.date > yesterday) {
                this.date = yesterday;
                return this.getReports(regionName, province);
            } else {
                return null;
            }
        }
    }

    getReportForHomeLocation(datum: Datum, homeLocation: HomeLocation): City {
        let theReport: City;
        theReport = datum.region.cities.
            find(cityReport =>
               homeLocation.county !== null && this.matchesName(cityReport, homeLocation.county.name));
        if (isNullOrUndefined(theReport)) {
            theReport = datum.region.cities.
                find(cityReport =>
                    homeLocation.city !== null && this.matchesName(cityReport, homeLocation.city.name));
            if (isNullOrUndefined(theReport)) {
                theReport = {
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
        return theReport;
    }

    matchesName(cityReport: City, name: string): boolean {
        return !isNullOrUndefined(name) &&
            (cityReport.name.toUpperCase().trim() === name.toUpperCase().trim() ||
                cityReport.name.toUpperCase().trim() === name.toUpperCase().replace('COUNTY', '').trim() ||
                cityReport.name.toUpperCase().trim().includes(name.toUpperCase().replace('COUNTY', '').trim()) ||
                cityReport.name.toUpperCase().trim() === name.toUpperCase().replace('PARISH', '').trim() ||
                cityReport.name.toUpperCase().trim().includes(name.toUpperCase().replace('PARISH', '').trim()));
    }

    hasState(stateLongName: string): boolean {
        return this.states.includes(stateLongName);
    }

    addState(stateLongName: string) {
        if (!this.hasState(stateLongName)) {
            this.states.push(stateLongName);
        }
    }

    async setMarkersForLocation(latitude: number, longitude: number) {
        const geocodeResponse = await this.reverseGeocode(latitude, longitude);
        if (geocodeResponse.status === 'OK') {
            const homeLocation = this.getHomeLocation(geocodeResponse.results);
            if (!isNullOrUndefined(homeLocation.province)) {
                const province = homeLocation.province.name;
                if (!this.hasState(province)) {
                    this.addState(province);
                    const reports = await this.getReports(homeLocation.region.name, homeLocation.province.name);
                    this.setMarkersForReports(homeLocation, reports.region.cities);
                }
            }
        } else {
            console.log('Status is not OK');
        }
    }

    setMarkersForReports(homeLocation: HomeLocation, reports: City[]) {
        reports.forEach(report => {
            if (report.name.toUpperCase() !== 'UNASSIGNED') {
                this.setMarker(+report.lat, +report.long, report.name, report.confirmed, this.convertToDate(report.date), false);
            } else {
                this.setMarker(
                    homeLocation.province.lat,
                    homeLocation.province.lat,
                    report.name, report.confirmed,
                    this.convertToDate(report.date),
                    false);
            }
        });
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

    subscribeToNotificationsForHomeLocation(homeLocation: HomeLocation) {
        const stateTopicArgs = [homeLocation.region.name, homeLocation.province.name];
        const cityTopicArgs = stateTopicArgs.concat([homeLocation.name]);
        const stateTopic = this.generateTopic(stateTopicArgs);
        const cityTopic = this.generateTopic(cityTopicArgs);
        this.notificationService.subscribeToTopics([stateTopic, cityTopic], true);
    }

    async onMapReady(event) {
        console.log('Map Ready');

        this.mapView = event.object;
        this.mapView.infoWindowTemplates = templates;

        await this.enableLocation();
        const currentLocation = await this.getCurrentLocation();
        const geocodeResponse = await this.reverseGeocode(currentLocation.latitude, currentLocation.longitude);
        if (geocodeResponse.status === 'OK') {
            let homeLocation = this.getHomeLocation(geocodeResponse.results);
            let reports = await this.getReports(homeLocation.region.name, homeLocation.province.name);
            let homeReport = this.getReportForHomeLocation(reports, homeLocation);
            homeLocation.name = homeReport.name;
            homeLocation.lat = +homeReport.lat;
            homeLocation.long = +homeReport.long;

            if (isNullOrUndefined(this.location)) {
                this.location = homeLocation;
            } else {
                if (this.location.name !== homeLocation.name) {
                    const confirmMessage = 'Your location has changed. Would you like to use your new location?';
                    const options = {
                        title: 'Use new location?',
                        message: confirmMessage,
                        okButtonText: 'Yes',
                        cancelButtonText: 'No'
                    };
                    if (await confirm(options) === true) {
                        this.location = homeLocation;
                    } else {
                        homeLocation = this.location;
                        reports = await this.getReports(homeLocation.region.name, homeLocation.province.name);
                        homeReport = this.getReportForHomeLocation(reports, homeLocation);
                    }
                }
            }
            this.isLocationLoaded = true;

            this.report = {
                date: this.convertToDate(homeReport.date),
                confirmed: homeReport.confirmed,
                confirmed_diff: homeReport.confirmed_diff,
                deaths: homeReport.deaths,
                deaths_diff: homeReport.deaths_diff
            };

            this.addState(homeLocation.province.name);
            this.subscribeToNotificationsForHomeLocation(homeLocation);
            this.setMarker(homeLocation.lat, homeLocation.long, homeLocation.name,
                homeReport.confirmed, this.convertToDate(homeReport.date), true);
            this.setMarkersForReports(homeLocation, reports.region.cities.filter(report => report.name !== homeLocation.name));
        } else {
            console.log('Status is not OK');
        }
    }

    async onCameraChanged(event) {
        this.mapView = event.object;
        if (!isNullOrUndefined(this.mapView)) {
            const visibleRegion = this.mapView.gMap.getProjection().getVisibleRegion();
            await this.setMarkersForLocation(visibleRegion.farLeft.latitude, visibleRegion.farLeft.longitude);
            await this.setMarkersForLocation(visibleRegion.farRight.latitude, visibleRegion.farRight.longitude);
            await this.setMarkersForLocation(visibleRegion.nearLeft.latitude, visibleRegion.nearLeft.longitude);
            await this.setMarkersForLocation(visibleRegion.nearRight.latitude, visibleRegion.nearRight.longitude);
        }
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
