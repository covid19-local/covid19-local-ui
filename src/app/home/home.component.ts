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
import { UserSettings } from '../models/user-settings';
import { UserSettingsService } from '../services/user-settings.service';

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
/**
 * The home component that displays map and local COVID-19 information
 */
export class HomeComponent implements OnInit {
    /**
     * The zoom level of the map
     */
    zoom = 9;
    /**
     * The bearing of the map
     */
    bearing = 0;
    /**
     * The tilt of the map
     */
    tilt = 0;
    /**
     * The padding of the map
     */
    padding = [40, 40, 40, 40];
    /**
     * The current date for loading reports
     */
    date = new Date();
    /**
     * The states that have been loaded
     */
    states: string[] = [];

    /**
     * The home location to load local COVID-19 reports
     */
    public get location(): HomeLocation {
        return this.locationService.location;
    }
    public set location(value: HomeLocation) {
        this.locationService.location = value;
    }

    /**
     * The local COVID-19 report
     */
    public report: Report;
    /**
     * Specifies if the location has been loaded
     */
    isLocationLoaded = false;

    /**
     * Specifies if notifications are enabled
     */
    public get enableNotifications(): boolean {
        return this.userSettings.enableNotifications;
    }
    public set enableNotifications(value: boolean) {
        // Sets enable notifications on the user settings
        const userSettings = this.userSettings;
        userSettings.enableNotifications = value;
        this.userSettings = userSettings;
        // Enables or disables notifications
        if (!value) {
            this.notificationService.disableNotifications();
        } else {
            if (!isNullOrUndefined(this.location)) {
                this.subscribeToNotificationsForHomeLocation(this.location);
            }
        }
    }

    /**
     * The user's settings
     */
    public get userSettings(): UserSettings {
        return this.userSettingsService.userSettings;
    }
    public set userSettings(value: UserSettings) {
        this.userSettingsService.userSettings = value;
    }

    /**
     * The map view
     */
    @ViewChild('MapView', { static: false }) mapView: MapView & { infoWindowTemplates: string };

    /**
     * The component constructor
     * @param mapService The map service instance
     * @param covidService The COVID-19 service instance
     * @param datePipe The date pipe for date formatting
     * @param decimalPipe The decimal pipe for number formatting
     * @param notificationService The notification service instance
     * @param locationService The location service instance
     * @param userSettingsService The user settings service instance
     */
    constructor(private mapService: MapService, private covidService: CovidService,
        private datePipe: DatePipe, private decimalPipe: DecimalPipe,
        private notificationService: NotificationService,
        private locationService: LocationService,
        private userSettingsService: UserSettingsService) { }

    ngOnInit() {
    }

    /**
     * Event handler for map ready.
     * The location and COVID-19 reports are loaded when the map is ready
     * @param event The map ready event
     */
    async onMapReady(event) {
        console.log('Map Ready');

        // Set the map view instance and load the templates
        this.mapView = event.object;
        this.mapView.infoWindowTemplates = templates;

        // Enable geolocation service
        await this.enableLocation();
        // Get the current location
        const currentLocation = await this.getCurrentLocation();
        // Determine the address from the current location
        const geocodeResponse = await this.reverseGeocode(currentLocation.latitude, currentLocation.longitude);
        // If the geocode response is OK, load the COVID-19 reports
        if (geocodeResponse.status === 'OK') {
            // Get the home location from the geocode response
            let homeLocation = this.getHomeLocation(geocodeResponse.results);
            // Get the COVID-19 reports for the home location state
            let reports = await this.getReports(homeLocation.region.name, homeLocation.province.name);
            // Gets the COVID-19 report for the home location
            let homeReport = this.getReportForHomeLocation(reports, homeLocation);
            // Set the home location name and coordinates from the COVID-19 report
            homeLocation.name = homeReport.name;
            homeLocation.lat = +homeReport.lat;
            homeLocation.long = +homeReport.long;

            // If the home location has not been saved, save the home location
            if (isNullOrUndefined(this.location)) {
                this.location = homeLocation;
            } else {
                // If the saved location does not match the home location, check if it should be changed
                if (this.location.name !== homeLocation.name) {
                    const confirmMessage = 'Your location has changed. Would you like to use your new location?';
                    const options = {
                        title: 'Use new location?',
                        message: confirmMessage,
                        okButtonText: 'Yes',
                        cancelButtonText: 'No'
                    };
                    // If the user responds yes to change, set the location to the new location
                    if (await confirm(options) === true) {
                        this.location = homeLocation;
                    } else {
                        // If the user responds no, load reports for teh exisitng location
                        homeLocation = this.location;
                        reports = await this.getReports(homeLocation.region.name, homeLocation.province.name);
                        homeReport = this.getReportForHomeLocation(reports, homeLocation);
                    }
                }
            }
            // Set location loaded to true
            this.isLocationLoaded = true;

            // Set the local COVID-19 report
            this.report = {
                date: this.convertToDate(homeReport.date),
                confirmed: homeReport.confirmed,
                confirmed_diff: homeReport.confirmed_diff,
                deaths: homeReport.deaths,
                deaths_diff: homeReport.deaths_diff
            };

            // Add the location state
            this.addState(homeLocation.province.name);

            // Subscribe to notifications or unsubscribe based on user settings
            if (this.enableNotifications) {
                this.subscribeToNotificationsForHomeLocation(homeLocation);
            } else {
                this.notificationService.disableNotifications();
            }
            // Set marker with COVID-19 report information for home location
            this.setMarker(homeLocation.lat, homeLocation.long, homeLocation.name,
                homeReport.confirmed, this.convertToDate(homeReport.date), true);
            // Set markers with COVID-19 report information for other locations
            this.setMarkersForReports(homeLocation, reports.region.cities.filter(report => report.name !== homeLocation.name));
        } else {
            console.log('Status is not OK');
        }
    }

    /**
     * Event handler for camera changed
     * Load COVID-19 reports for all states in camera
     * @param event The camera changed event
     */
    async onCameraChanged(event) {
        this.mapView = event.object;
        // If the map view is defined get hte visible region and set markers for COVID-19 reports
        if (!isNullOrUndefined(this.mapView)) {
            const visibleRegion = this.mapView.gMap.getProjection().getVisibleRegion();
            await this.setMarkersForLocation(visibleRegion.farLeft.latitude, visibleRegion.farLeft.longitude);
            await this.setMarkersForLocation(visibleRegion.farRight.latitude, visibleRegion.farRight.longitude);
            await this.setMarkersForLocation(visibleRegion.nearLeft.latitude, visibleRegion.nearLeft.longitude);
            await this.setMarkersForLocation(visibleRegion.nearRight.latitude, visibleRegion.nearRight.longitude);
        }
    }

    /**
     * Event handler for check changed
     * @param event Check changed event
     */
    public onCheckedChange(event: any) {
        // Set enable notifications to event value
        this.enableNotifications = event.value;
    }

    /**
     * Enables geolocation service
     */
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

    /**
     * Get the current location using the geolocation service
     */
    getCurrentLocation(): Promise<geolocation.Location> {
        return geolocation.getCurrentLocation({
            desiredAccuracy: Accuracy.any,
            maximumAge: 5000,
            timeout: 10000
        });
    }

    /**
     * Reverse geocode coordinates to an address
     * @param latitude The latitude of the current location
     * @param longitude The longitude of the current location
     */
    reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResponse> {
        return this.mapService.reverseGeocode(latitude, longitude).toPromise();
    }

    /**
     * Get the home location based on the geocode response
     * @param geocodeResults The geocode results
     */
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

    /**
     * Get COVID-19 reports for the region (country) and province (state)
     * @param regionName The region name (country)
     * @param province The province name (state)
     */
    async getReports(regionName: string, province: string): Promise<Datum> {
        // use the covid service to get the COVID-19 reports
        const result = await this.covidService.getReports(this.date, regionName, province).toPromise();
        if (result.data.length > 0) {
            return result.data[0];
        } else {
            // If no data is found, load reports for the previous day
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

    /**
     * Get COVID-19 report for the home location
     * @param datum The report datum
     * @param homeLocation The home location
     */
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

    /**
     * Determines if the city report matches the name
     * @param cityReport The city report
     * @param name The name
     */
    matchesName(cityReport: City, name: string): boolean {
        return !isNullOrUndefined(name) &&
            (cityReport.name.toUpperCase().trim() === name.toUpperCase().trim() ||
                cityReport.name.toUpperCase().trim() === name.toUpperCase().replace('COUNTY', '').trim() ||
                cityReport.name.toUpperCase().trim().includes(name.toUpperCase().replace('COUNTY', '').trim()) ||
                cityReport.name.toUpperCase().trim() === name.toUpperCase().replace('PARISH', '').trim() ||
                cityReport.name.toUpperCase().trim().includes(name.toUpperCase().replace('PARISH', '').trim()));
    }

    /**
     * Determines if the state has been loaded
     * @param stateLongName The state long name
     */
    hasState(stateLongName: string): boolean {
        return this.states.includes(stateLongName);
    }

    /**
     * Add a state that has been loaded
     * @param stateLongName The state long name
     */
    addState(stateLongName: string) {
        if (!this.hasState(stateLongName)) {
            this.states.push(stateLongName);
        }
    }

    /**
     * Set map markers with COVID-19 reports for the location
     * @param latitude the latitude of the location
     * @param longitude The longitude of the location
     */
    async setMarkersForLocation(latitude: number, longitude: number) {
        const geocodeResponse = await this.reverseGeocode(latitude, longitude);
        if (geocodeResponse.status === 'OK') {
            const homeLocation = this.getHomeLocation(geocodeResponse.results);
            if (!isNullOrUndefined(homeLocation.province)) {
                const province = homeLocation.province.name;
                // Load reports and markers if the state has not been added
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

    /**
     * Set markers for COVID-19 reports
     * @param homeLocation The home location
     * @param reports The COVID-19 reports for cities
     */
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

    /**
     * Set a marker for a COVID-19 report
     * @param latitude The latitude of the marker
     * @param longitude The longitude of the marker
     * @param region The region
     * @param confirmedCases The confirmed COVID-19 cases
     * @param date The date of the COVID-19 report
     * @param showInfoWindow Determines if the info window should be shown
     */
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

    /**
     * Subscribe to notifications for home location
     * @param homeLocation The home location
     */
    subscribeToNotificationsForHomeLocation(homeLocation: HomeLocation) {
        const stateTopicArgs = [homeLocation.region.name, homeLocation.province.name];
        const cityTopicArgs = stateTopicArgs.concat([homeLocation.name]);
        const stateTopic = this.generateTopic(stateTopicArgs);
        const cityTopic = this.generateTopic(cityTopicArgs);
        this.notificationService.subscribeToTopics([stateTopic, cityTopic], true);
    }

    /**
     * Convert a string to a date
     * @param input The string input
     */
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

    /**
     * Generate a topic name for notifications
     * @param topicArgs The topic arguments
     */
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
