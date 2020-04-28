import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Covid } from '../models/covid';
import { DatePipe } from '@angular/common';

const COVID_BASE_API = 'https://covid-api.com/api';
const REPORTS_BASE_API = `${COVID_BASE_API}/reports`;

@Injectable({
  providedIn: 'root'
})
export class CovidService {

  constructor(private http: HttpClient, private datePipe: DatePipe) { }

  getReports(date: Date, regionName: string, regionProvince: string): Observable<Covid> {
    const formattedDate = this.datePipe.transform(date, 'yyyy-MM-dd');
    regionName = encodeURI(regionName);
    regionProvince = encodeURI(regionProvince);
    return this.http.get<Covid>(
      `${REPORTS_BASE_API}?date=${formattedDate}&region_name=${regionName}&region_province=${regionProvince}`);
  }
}
