// src/app/turtle-scanner/turtle-scanner.component.ts
import { Component, inject, Injectable, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurtleApiService } from '../../services/turtle-api.service';
import { HttpClient } from '@angular/common/http';
import { BadgeType, BadgeInfo, FilterState } from '../../../types/badges';

interface TickerData {
  symbol: string;
  hasError: boolean;
  error?: string;
  isActive?: boolean;
  badgeText?: string;
  badgeClass?: string;
  lastState?: any;
  latestBuy?: any;
  latestSell?: any;
  performance?: number;
  history?: any[];
  signals?: any[];
  badgeType?: any;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  // This service can now make HTTP requests via `this.http`.
}

@Component({
  selector: 'app-turtle-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './turtle-scanner.component.html',
  styleUrls: ['./turtle-scanner.component.css']
})
export class TurtleScannerComponent implements OnInit {
  // Form data
  symbols = '';
  daysBack = 10;
  entryLookback = 20;
  exitLookback = 10;

  // State
  loading = false;
  scanProgress = { current: 0, total: 0 };
  lastPayload: any = null;
  onScanAllButtonPressed = false;
  onScanButtonPressed = false;
  serverHealthButtonPressed = false;
  originalCount = 0;


  // Results
  scanStats = {
    totalSymbols: 0,
    activePositions: 0,
    recentSignals: 0,
    errors: 0
  };

  tickerResults: TickerData[] = [];
  errorMessage = '';
  successMessage = '';
  serverHealthMessage = '';

  // ✨ NUEVAS PROPIEDADES PARA FILTROS
  filters: FilterState = {
    selectedBadges: [],
    searchTerm: ''
  };

  badgeOptions = [
    // { value: BadgeType.RECENT_BUY, label: 'Recent Buy', color: 'bg-orange-500 text-white' },
    { value: BadgeType.BUY_SIGNAL, label: 'Buy Signal', color: 'bg-green-500 text-white' },
    { value: BadgeType.SELL_SIGNAL, label: 'Sell Signal', color: 'bg-red-500 text-white' },
    { value: BadgeType.NO_SIGNAL, label: 'No recent Signal', color: 'bg-gray-500 text-white' },
    // { value: BadgeType.ERROR, label: 'Error', color: 'bg-red-900 text-white' }
  ];

  // Variable para almacenar datos sin filtrar
  private allTickerResults: TickerData[] = [];

  constructor(private apiService: TurtleApiService) { }

  async ngOnInit() {
    await this.checkServerHealth();
  }

  async checkServerHealth() {
    try {
      const health = await this.apiService.getHealth();
      this.showSuccess(`✅ Servidor conectado correctamente<br/>
        Versión: ${health.version || 'N/A'} | ${health.available_tickers || 0} tickers disponibles`);
    } catch (e) {
      console.warn('Server health check failed:', e);
    }
  }

  async onScan() {
    this.onScanButtonPressed = true;
    if (!this.symbols.trim()) {
      this.showError('No ticker(s) has been entered');
      return;
    }

    const symbolList = this.symbols.split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    await this.runScan(symbolList);
  }

  async onScanAll() {
    this.loading = true;
    this.onScanAllButtonPressed = true;
    this.serverHealthButtonPressed = false;
    try {
      const tickerList = await this.apiService.getTickersList();
      if (!tickerList || tickerList.length === 0) {
        throw new Error('Lista de tickers vacía');
      }
      await this.runScan(tickerList);
    } catch (e: any) {
      console.warn('Error getting tickets from server', e.message);
      this.showError(`⚠️ Error: ${e.message}. Using backup list...`);
      const fallbackTickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "ADSK"];
      await this.runScan(fallbackTickers);
    } finally {
      this.loading = false;
    }
  }

  async onHealthCheck() {
    this.loading = true;
    try {
      const health = await this.apiService.getHealth();
      this.serverHealthButtonPressed = true;
      this.showServerHealthMessage(`✅ Servidor funcionando correctamente<br/>
        Versión: ${health.version || 'N/A'} | Tickers: ${health.available_tickers || 'N/A'}`);
    } catch (e: any) {
      this.showError(`❌ Error conectando con servidor: ${e.message}`);
    } finally {
      this.loading = false;
    }
  }

  onDownloadCSV() {
    if (!this.lastPayload) {
      this.showError('No hay datos para descargar. Ejecuta un scan primero.');
      return;
    }
    this.downloadCSV();
  }

  private async runScan(symbols: string[]) {
    this.loading = true;
    this.scanProgress = { current: 0, total: symbols.length };

    try {
      const chunkSize = 20;
      const chunks: string[][] = [];
      for (let i = 0; i < symbols.length; i += chunkSize) {
        chunks.push(symbols.slice(i, i + chunkSize));
      }

      let aggregatedData: { [key: string]: any } = {};
      let totalProcessed = 0;
      let totalErrors = 0;

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        this.scanProgress.current = chunkIndex * chunkSize;

        try {
          const result = await this.apiService.scanTickers(
            chunk,
            this.daysBack,
            this.entryLookback,
            this.exitLookback
          );

          Object.assign(aggregatedData, result.data);
          totalProcessed += result.processed || 0;
          totalErrors += result.errors || 0;

        } catch (chunkError) {
          console.error('Error en chunk:', chunkError);
          totalErrors += chunk.length;
        }

        await this.delay(100);
      }
      this.originalCount = symbols.length
      this.scanProgress.current = symbols.length;
      this.lastPayload = { data: aggregatedData };

      setTimeout(() => {
        this.renderResults({ data: aggregatedData });
      }, 400);

    } catch (err: any) {
      console.error(err);
      this.showError('Error conectando con el backend: ' + (err.message || err));
    } finally {
      this.loading = false;
    }
  }

  private renderResults(payload: any) {
    const data = payload.data || {};
    const symbols = Object.keys(data);

    if (symbols.length === 0) {
      this.showError('La API no devolvió datos.');
      return;
    }

    // Calculate stats
    let activePositions = 0;
    let recentSignals = 0;
    let errorCount = 0;

    for (const symbol of symbols) {
      const entry = data[symbol];
      if (entry?.error) {
        errorCount++;
        continue;
      }
      if (entry?.last_state?.position === 1) {
        activePositions++;
      }
      if (entry?.recent_buys?.length > 0) {
        recentSignals++;
      }
    }

    this.scanStats = {
      totalSymbols: symbols.length,
      activePositions,
      recentSignals,
      errors: errorCount
    };

    // Sort and transform data
    const sortedSymbols = this.sortSymbols(symbols, data);
    this.allTickerResults = this.transformTickerData(sortedSymbols, data);

    // ✨ APLICAR FILTROS INICIALMENTE
    this.applyFilters();
    this.clearMessages();
  }

  private getBadgeInfo(entry: any): BadgeInfo {
    const today = new Date();

    if (!entry || entry.error) {
      return { priority: 4, badge: BadgeType.ERROR };
    }

    const lastState = entry.last_state || {};
    const recentBuys = entry.recent_buys || [];
    const recentSells = entry.recent_sells || (entry.signals || []).filter((s: any) =>
      (s.type || s.signal_type || '').toUpperCase() === 'SELL'
    );

    // Ordenar por fecha para obtener el más reciente
    const sortedBuys = [...recentBuys].sort((x: any, y: any) =>
      new Date(y.date).getTime() - new Date(x.date).getTime()
    );
    const sortedSells = [...recentSells].sort((x: any, y: any) =>
      new Date(y.date).getTime() - new Date(x.date).getTime()
    );

    const latestBuy = sortedBuys[0];
    const latestSell = sortedSells[0];
    const isActive = lastState.position === 1;

    console.log(`Symbol: ${entry.symbol || 'unknown'}`);
    console.log(`  isActive: ${isActive}`);
    console.log(`  latestBuy: ${latestBuy?.date}`);
    console.log(`  latestSell: ${latestSell?.date}`);

    // Obtener la fecha más reciente entre buy y sell
    let mostRecentAction = null;
    let mostRecentDate = null;

    if (latestBuy?.date && latestSell?.date) {
      const buyDate = new Date(latestBuy.date);
      const sellDate = new Date(latestSell.date);
      if (buyDate.getTime() > sellDate.getTime()) {
        mostRecentAction = 'buy';
        mostRecentDate = buyDate;
      } else {
        mostRecentAction = 'sell';
        mostRecentDate = sellDate;
      }
    } else if (latestBuy?.date) {
      mostRecentAction = 'buy';
      mostRecentDate = new Date(latestBuy.date);
    } else if (latestSell?.date) {
      mostRecentAction = 'sell';
      mostRecentDate = new Date(latestSell.date);
    }

    if (mostRecentDate && !isNaN(mostRecentDate.getTime())) {
      const daysAgo = Math.floor((today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  Most recent: ${mostRecentAction}, ${daysAgo} days ago`);

      if (daysAgo >= 0 && daysAgo <= 11) {
        if (mostRecentAction === 'buy') {
          if (isActive) {
            return { priority: 1, badge: BadgeType.BUY_SIGNAL, daysAgo };
          } else {
            // ¡RECENT BUY es cuando compró pero ya no está activo!
            return { priority: 0, badge: BadgeType.RECENT_BUY, daysAgo };
          }
        } else if (mostRecentAction === 'sell') {
          if (!isActive) {
            return { priority: 2, badge: BadgeType.SELL_SIGNAL, daysAgo };
          }
        }
      }
    }

    return { priority: 3, badge: BadgeType.NO_SIGNAL };
  }

  private sortSymbols(symbols: string[], data: any): string[] {
    return symbols.sort((a, b) => {
      const entryA = data[a];
      const entryB = data[b];

      // Errores van al final
      if (entryA?.error && !entryB?.error) return 1;
      if (!entryA?.error && entryB?.error) return -1;
      if (entryA?.error && entryB?.error) return a.localeCompare(b);

      const badgeA = this.getBadgeInfo(entryA);
      const badgeB = this.getBadgeInfo(entryB);

      console.log(`Comparing ${a} (${badgeA.badge}, priority: ${badgeA.priority}) vs ${b} (${badgeB.badge}, priority: ${badgeB.priority})`);

      // Ordenar por prioridad
      if (badgeA.priority !== badgeB.priority) {
        return badgeA.priority - badgeB.priority;
      }

      // Si misma prioridad, ordenar por fecha más reciente primero
      if (badgeA.daysAgo !== undefined && badgeB.daysAgo !== undefined) {
        return badgeA.daysAgo - badgeB.daysAgo;
      }

      // Si misma prioridad -> alfabético
      return a.localeCompare(b);
    });
  }

  private transformTickerData(symbols: string[], data: any): any[] {
    const today = new Date();

    return symbols.map(symbol => {
      const entry = data[symbol];
      if (!entry || entry.error) {
        return {
          symbol,
          error: entry?.error || 'Sin datos',
          hasError: true
        };
      }

      const lastState = entry.last_state || {};
      const recentBuys = entry.recent_buys || [];
      const recentSells = entry.recent_sells || (entry.signals || []).filter((s: any) => (s.type || s.signal_type || '').toUpperCase() === 'SELL');
      const latestBuy = recentBuys.length ? recentBuys[0] : null;
      const latestSell = recentSells.length ? recentSells[0] : null;
      const isActive = lastState.position === 1;

      // ✨ USAR EL NUEVO getBadgeInfo PARA CONSISTENCIA
      const badgeInfo = this.getBadgeInfo(entry);
      let badgeText = badgeInfo.badge;
      let badgeClass = 'no';

      // Mapear badge types a clases CSS
      switch (badgeInfo.badge) {
        case BadgeType.BUY_SIGNAL:
          badgeClass = 'active';
          break;
        case BadgeType.RECENT_BUY:
          // badgeText = 'RECENT BUY'; // Mantener el texto original para compatibilidad
          badgeClass = 'recent';
          break;
        case BadgeType.SELL_SIGNAL:
          badgeClass = 'sell';
          break;
        case BadgeType.ERROR:
          badgeClass = 'error';
          break;
      }

      // Construir mapa de señales por fecha -> tipos
      const signalMap: { [date: string]: string[] } = {};
      (entry.signals || []).forEach((s: any) => {
        const d = s.date;
        if (!d) return;
        const t = (s.type || s.signal_type || s.kind || '').toUpperCase();
        signalMap[d] = signalMap[d] || [];
        signalMap[d].push(t || 'UNKNOWN');
      });

      const history = (entry.history || []).slice(0, 30).map((h: any) => {
        const types = signalMap[h.date] || [];
        return {
          ...h,
          hasBuySignal: types.includes('BUY'),
          hasSellSignal: types.includes('SELL'),
          signalTypes: types
        };
      });

      let performance = null;
      if (latestBuy && lastState.current_price && latestBuy.price) {
        performance = ((lastState.current_price - latestBuy.price) / latestBuy.price) * 100;
      }

      return {
        symbol,
        hasError: false,
        isActive,
        badgeText,
        badgeClass,
        badgeType: badgeInfo.badge, // ✨ NUEVO: para filtrado
        lastState,
        latestBuy,
        latestSell,
        sellSignal: !!(latestSell && !isActive),
        performance,
        history,
        signals: entry.signals || []
      };
    });
  }

  toggleBadgeFilter(badge: BadgeType): void {
    const index = this.filters.selectedBadges.indexOf(badge);
    if (index > -1) {
      this.filters.selectedBadges.splice(index, 1);
    } else {
      this.filters.selectedBadges.push(badge);
    }
    this.applyFilters();
  }

  isBadgeSelected(badge: BadgeType): boolean {
    return this.filters.selectedBadges.includes(badge);
  }

  clearFilters(): void {
    this.filters = {
      selectedBadges: [],
      searchTerm: ''
    };
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  private applyFilters(): void {
    this.tickerResults = this.allTickerResults.filter(ticker => {
      // Filtro por texto
      if (this.filters.searchTerm &&
        !ticker.symbol.toLowerCase().includes(this.filters.searchTerm.toLowerCase())) {
        return false;
      }

      // Filtro por badges
      if (this.filters.selectedBadges.length > 0) {
        if (ticker.hasError) {
          return this.filters.selectedBadges.includes(BadgeType.ERROR);
        } else {
          return this.filters.selectedBadges.includes(ticker.badgeType || BadgeType.NO_SIGNAL);
        }
      }

      return true;
    });
  }

  private downloadCSV() {
    // Implementation similar to before
    const data = this.lastPayload?.data || {};
    const rows: string[][] = [['symbol', 'status', 'current_price', 'atr']];

    for (const symbol of Object.keys(data)) {
      const obj = data[symbol];
      const lastState = obj?.last_state || {};
      rows.push([
        symbol,
        obj?.error ? 'ERROR' : (lastState.position === 1 ? 'BUY_SIGNAL' : 'NO_SIGNAL'),
        lastState.current_price || '',
        lastState.atr || ''
      ]);
    }

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turtle_signals_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.successMessage = '';
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
  }


  private showServerHealthMessage(message: string) {
    this.serverHealthMessage = message;
    this.errorMessage = '';
  }

  private clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  fmt(n: any): string {
    return (typeof n === 'number') ? n.toFixed(2) : 'N/A';
  }

  getProgressPercentage(): number {
    return this.scanProgress.total > 0 ?
      Math.round((this.scanProgress.current / this.scanProgress.total) * 100) : 0;
  }

  getFilterChipClass(badgeType: BadgeType): string {
  switch (badgeType) {
    case BadgeType.RECENT_BUY:
      return 'recent-buy';
    case BadgeType.BUY_SIGNAL:
      return 'buy-signal';
    case BadgeType.SELL_SIGNAL:
      return 'sell-signal';
    case BadgeType.NO_SIGNAL:
      return 'no-signal';
    case BadgeType.ERROR:
      return 'error';
    default:
      return '';
  }
}

}

