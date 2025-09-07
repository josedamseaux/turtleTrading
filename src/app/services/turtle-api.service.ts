import { Injectable } from '@angular/core';
import { HttpClient, HttpParams,HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  available_tickers: number;
}

export interface TickersListResponse {
  tickers: string[];
  count: number;
  description: string;
}

export interface ScanResult {
  data: { [symbol: string]: any };
  processed: number;
  errors: number;
  total_requested: number;
}

@Injectable({
  providedIn: 'root'
})
export class TurtleApiService {
  private readonly API_BASE = 'http://127.0.0.1:5000';

  constructor(private http: HttpClient) {
      console.log('TurtleApiService created - http available?', !!this.http);

  }

  async getHealth(): Promise<HealthResponse> {
    const url = `${this.API_BASE}/health`;
    return firstValueFrom(this.http.get<HealthResponse>(url));
  }

  async getTickersList(): Promise<string[]> {
    const url = `${this.API_BASE}/tickers_list`;
    const response = await firstValueFrom(this.http.get<TickersListResponse>(url));
    console.log(response)
    return response.tickers || [];
  }

  async scanTickers(symbols: string[], daysBack: number, entryLookback: number, exitLookback: number): Promise<ScanResult> {
    const url = `${this.API_BASE}/scan`;
    let params = new HttpParams()
      .set('symbols', symbols.join(','))
      .set('daysBack', daysBack.toString())
      .set('entry', entryLookback.toString())
      .set('exit', exitLookback.toString());
    return firstValueFrom(this.http.get<ScanResult>(url, { params }));
  }
}
