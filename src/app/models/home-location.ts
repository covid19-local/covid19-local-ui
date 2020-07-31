import { Location } from './location';

export interface HomeLocation extends Location {
    city: Location;
    county: Location;
    province: Location;
    region: Location;
}
