// ================================
// EFFECT ANALYZER - Diagnóstico de Runtime
// ================================
// Analisa logs em tempo real e detecta padrões de concorrência

window.EffectAnalyzer = class EffectAnalyzer {
  constructor() {
    this.logs = [];
    this.patterns = {
      duplicateSESSION_RESTORED: 0,
      refreshDuringRestore: 0,
      sessionRestoredAfterLogin: 0,
      raceConditionSuspected: 0
    };
    this._startTime = Date.now();
    this._originalConsoleLog = console.log;
    this._interceptLogs();
  }

  _interceptLogs() {
    const self = this;
    console.log = function(...args) {
      // Chamar log original
      self._originalConsoleLog.apply(console, args);
      
      // Analisar entrada
      args.forEach(arg => {
        if (typeof arg === 'object' && arg !== null) {
          self._analyzeEntry(arg);
        }
      });
    };
  }

  _analyzeEntry(entry) {
    // Adicionar ao log
    this.logs.push({
      ...entry,
      relativeTime: Date.now() - this._startTime
    });

    // Detectar padrões
    this._detectPatterns(entry);
  }

  _detectPatterns(entry) {
    const recentLogs = this.logs.slice(-10); // Últimos 10 logs

    // Padrão 1: Múltiplos SESSION_RESTORED seguidos
    if (entry.event === 'SESSION_RESTORED' || (entry.type && entry.type.includes('SESSION_RESTORED'))) {
      const recentSESSION_RESTORED = recentLogs.filter(l => 
        l.event === 'SESSION_RESTORED' || (l.type && l.type.includes('SESSION_RESTORED'))
      );
      if (recentSESSION_RESTORED.length > 1) {
        this.patterns.duplicateSESSION_RESTORED++;
        console.warn('[ANALYZER] Duplicate SESSION_RESTORED detected!', {
          count: recentSESSION_RESTORED.length,
          timestamps: recentSESSION_RESTORED.map(l => l.timestamp || l.relativeTime)
        });
      }
    }

    // Padrão 2: REFRESH durante RESTORE
    if (entry.effect === 'REFRESH_SESSION') {
      const hasRecentRestore = recentLogs.some(l => 
        l.effect === 'RESTORE_SESSION' && 
        (Date.now() - (l.timestamp || 0)) < 5000
      );
      if (hasRecentRestore) {
        this.patterns.refreshDuringRestore++;
        console.warn('[ANALYZER] REFRESH during RESTORE detected!');
      }
    }

    // Padrão 3: SESSION_RESTORED após LOGIN
    if (entry.event === 'SESSION_RESTORED' || (entry.type === 'SESSION_RESTORED')) {
      const hasRecentLogin = recentLogs.some(l => 
        l.effect === 'LOGIN' && 
        (Date.now() - (l.timestamp || 0)) < 10000
      );
      if (hasRecentLogin) {
        this.patterns.sessionRestoredAfterLogin++;
        console.warn('[ANALYZER] SESSION_RESTORED after LOGIN detected!');
      }
    }

    // Padrão 4: Race condition suspeita (effects sobrepostos)
    if (entry.effect) {
      const runningNow = this.logs.filter(l => 
        l.timestamp && 
        (Date.now() - l.timestamp) < 100 && 
        l.effect && 
        l.effect !== entry.effect
      );
      if (runningNow.length > 0) {
        this.patterns.raceConditionSuspected++;
        console.warn('[ANALYZER] Potential race condition!', {
          currentEffect: entry.effect,
          overlappingEffects: runningNow.map(l => l.effect)
        });
      }
    }
  }

  // Gerar relatório completo
  generateReport() {
    const effects = this._countEffects();
    const sequence = this._getSequence();
    const duplicates = this._findDuplicates();

    return {
      summary: {
        totalLogs: this.logs.length,
        uptime: Date.now() - this._startTime,
        patterns: { ...this.patterns }
      },
      effects,
      sequence,
      duplicates,
      rawLogs: [...this.logs]
    };
  }

  _countEffects() {
    const counts = {};
    this.logs.forEach(log => {
      if (log.effect) {
        counts[log.effect] = (counts[log.effect] || 0) + 1;
      }
    });
    return counts;
  }

  _getSequence() {
    return this.logs
      .filter(l => l.effect || l.event)
      .map(l => ({
        time: l.relativeTime || l.timestamp,
        type: l.effect || l.event,
        state: l.state || l.currentState
      }));
  }

  _findDuplicates() {
    const effectGroups = {};
    this.logs.forEach(log => {
      if (log.effect) {
        if (!effectGroups[log.effect]) {
          effectGroups[log.effect] = [];
        }
        effectGroups[log.effect].push(log);
      }
    });

    const duplicates = {};
    Object.entries(effectGroups).forEach(([effect, logs]) => {
      if (logs.length > 1) {
        // Verificar se são realmente duplicados (mesmo contexto em pouco tempo)
        const timeWindow = logs[logs.length - 1].timestamp - logs[0].timestamp;
        if (timeWindow < 5000) { // Menos de 5 segundos
          duplicates[effect] = {
            count: logs.length,
            timeWindow,
            timestamps: logs.map(l => l.timestamp)
          };
        }
      }
    });

    return duplicates;
  }

  // Veredito automático
  getVerdict() {
    const hasDuplicates = Object.keys(this._findDuplicates()).length > 0;
    const hasRaceConditions = this.patterns.raceConditionSuspected > 0;
    const hasRefreshDuringRestore = this.patterns.refreshDuringRestore > 0;

    if (hasRaceConditions || hasRefreshDuringRestore) {
      return {
        verdict: '(C) Não determinístico (race condition)',
        confidence: 'HIGH',
        reasons: [
          hasRaceConditions && 'Race conditions detectadas',
          hasRefreshDuringRestore && 'REFRESH durante RESTORE detectado'
        ].filter(Boolean)
      };
    }

    if (hasDuplicates) {
      return {
        verdict: '(B) Determinístico com redundância',
        confidence: 'MEDIUM',
        reasons: ['Effects duplicados detectados, mas sem race condition']
      };
    }

    return {
      verdict: '(A) Determinístico',
      confidence: 'HIGH',
      reasons: ['Nenhum padrão de concorrência detectado']
    };
  }

  // Exportar para console
  printReport() {
    const report = this.generateReport();
    const verdict = this.getVerdict();

    console.group('═══════════════════════════════════════');
    console.log('     EFFECT ANALYZER REPORT');
    console.groupEnd();

    console.log('═══════════════════════════════════════');
    console.log('RESUMO:');
    console.log(`  Total de logs: ${report.summary.totalLogs}`);
    console.log(`  Uptime: ${(report.summary.uptime / 1000).toFixed(2)}s`);
    console.log(`  Padrões detectados:`, report.summary.patterns);

    console.log('\nEFFECTS EXECUTADOS:');
    Object.entries(report.effects).forEach(([effect, count]) => {
      const hasDup = report.duplicates[effect];
      console.log(`  ${effect}: ${count}x ${hasDup ? '⚠️ DUPLICADO' : '✅'}`);
    });

    if (Object.keys(report.duplicates).length > 0) {
      console.log('\nDUPLICAÇÕES:');
      Object.entries(report.duplicates).forEach(([effect, data]) => {
        console.log(`  ${effect}: ${data.count}x em ${data.timeWindow}ms`);
      });
    }

    console.log('\nSEQUÊNCIA (últimos 10):');
    report.sequence.slice(-10).forEach((s, i) => {
      console.log(`  T+${s.time}ms: ${s.type} [${s.state || 'no state'}]`);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('VEREDICTO:', verdict.verdict);
    console.log('Confiança:', verdict.confidence);
    console.log('Razões:', verdict.reasons.join(', ') || 'Nenhuma anomalia');
    console.log('═══════════════════════════════════════');

    return report;
  }

  // Reset
  reset() {
    this.logs = [];
    this.patterns = {
      duplicateSESSION_RESTORED: 0,
      refreshDuringRestore: 0,
      sessionRestoredAfterLogin: 0,
      raceConditionSuspected: 0
    };
    this._startTime = Date.now();
    console.log('[ANALYZER] Reset complete');
  }
}

// Auto-inicializar se necessário
if (typeof window !== 'undefined') {
  window.__EFFECT_ANALYZER__ = new window.EffectAnalyzer();
  console.log('[EffectAnalyzer] Inicializado. Use window.__EFFECT_ANALYZER__.printReport() para relatório.');
}
