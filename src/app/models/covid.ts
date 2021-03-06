// Generated by https://quicktype.io
//
// To change quicktype's target language, run command:
//
//   "Set quicktype target language"

export interface Covid {
    data: Datum[];
}

export interface Datum {
    date:           string;
    confirmed:      number;
    deaths:         number;
    recovered:      number;
    confirmed_diff: number;
    deaths_diff:    number;
    recovered_diff: number;
    last_update:    string;
    active:         number;
    active_diff:    number;
    fatality_rate:  number;
    region:         Region;
}

export interface Region {
    iso:      string;
    name:     string;
    province: string;
    lat:      string;
    long:     string;
    cities:   City[];
}

export interface City {
    name:           string;
    date:           string;
    fips:           number;
    lat:            null | string;
    long:           null | string;
    confirmed:      number;
    deaths:         number;
    confirmed_diff: number;
    deaths_diff:    number;
    last_update:    string;
}
