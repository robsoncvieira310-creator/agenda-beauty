// ================================
// BOOT TRACE EXPORTER v3
// Causal Graph Engine - Detector de dual finalizer com prova causal
// ================================

/**
 * Exporta e analisa o grafo causal completo
 * @returns {Object} Snapshot imutável com análise causal
 */
window.exportBootTrace = function() {
  // === CAUSAL GRAPH v3 ===
  const graph = window.__BOOT_CAUSAL_GRAPH__;

  if (!graph || graph.length === 0) {
    console.log('[BOOT_TRACE_EXPORTER v3] No causal graph available');
    return null;
  }

  // Ordenar por timestamp
  const sorted = [...graph].sort((a, b) => a.t - b.t);

  // === ANÁLISE DE FINALIZER COM CAUSAL GRAPH ===
  const resolveEvents = sorted.filter(e =>
    e.event.includes("RESOLVE") ||
    e.event.includes("FINALIZER")
  );

  const kernelResolve = resolveEvents.find(e =>
    e.event === "BOOT_READY_RESOLVE_CALLED_FROM_KERNEL"
  );

  const autoResolve = resolveEvents.find(e =>
    e.event === "AUTO_HEAL_RESOLVE_DONE"
  );

  const blockedFinalizer = sorted.find(e =>
    e.event === "AUTO_HEAL_BLOCKED_ALREADY_FINALIZED"
  );

  console.log("%c=== CAUSAL BOOT GRAPH v3 ===", "font-size: 14px; font-weight: bold; color: #4ECDC4;");
  console.log("Total causal nodes:", sorted.length);
  console.log("Boot ID:", sorted[0]?.bootId);

  // Print causal tree
  console.log("%c=== CAUSAL TREE ===", "font-size: 12px; font-weight: bold; color: #95E1D3;");
  sorted.forEach((node, i) => {
    const indent = node.parentId ? "  → " : "● ";
    const color = node.event.startsWith("KERNEL_") ? "#FF6B6B" :
                  node.event.startsWith("BOOT_") ? "#4ECDC4" :
                  node.event.startsWith("AUTO_") ? "#FFE66D" : "#A8A8A8";
    console.log(
      `%c${indent}[${node.id}] ${node.event.padEnd(45)} %c${node.t.toFixed(3)}ms`,
      `color: ${color};`,
      "color: #888;"
    );
  });

  console.log("%c=== FINALIZER ANALYSIS ===", "font-size: 12px; font-weight: bold; color: #F38181;");

  if (kernelResolve && autoResolve) {
    console.log("⚠ DUAL FINALIZER DETECTED (causal analysis)");

    // Análise causal (não só temporal!)
    const kernelChain = window.buildCausalChain(kernelResolve.id);
    const autoChain = window.buildCausalChain(autoResolve.id);

    console.log("Kernel resolve chain length:", kernelChain.length);
    console.log("Auto-heal resolve chain length:", autoChain.length);

    // Verificar se auto-heal foi bloqueado
    if (blockedFinalizer) {
      console.log("%c✓ BLOCKED FINALIZER DETECTED - Prevention worked!", "color: green; font-weight: bold;");
    }

    if (autoResolve.t < kernelResolve.t) {
      console.log("%c⚠ RECOVERY WON (temporal violation candidate)", "color: orange;");
    } else {
      console.log("%c✔ KERNEL WON (temporal order correct)", "color: green;");
    }

    // Prova causal: quem originou a resolução?
    const kernelOrigin = kernelChain[0]?.event;
    const autoOrigin = autoChain[0]?.event;

    console.log("Kernel resolution origin:", kernelOrigin);
    console.log("Auto-heal resolution origin:", autoOrigin);

  } else if (kernelResolve) {
    console.log("%c✓ SINGLE FINALIZER (kernel only) - CLEAN BOOT", "color: green;");
  } else if (autoResolve) {
    console.log("%c⚠ RECOVERY ONLY FINALIZER - Kernel failed to resolve", "color: orange;");
  } else {
    console.log("%c✗ NO FINALIZER FOUND - Boot incomplete?", "color: red;");
  }

  // === RECONSTRUÇÃO DE CADEIA CAUSAL ===
  console.log("%c=== SAMPLE CAUSAL CHAIN ===", "font-size: 12px; font-weight: bold; color: #A8A8A8;");
  if (sorted.length > 0) {
    const lastNode = sorted[sorted.length - 1];
    const chain = window.buildCausalChain(lastNode.id);
    console.log(`Chain from root to [${lastNode.event}]:`);
    chain.forEach((node, i) => {
      const prefix = i === 0 ? "ROOT" : "→";
      console.log(`  ${prefix} [${node.id}] ${node.event}`);
    });
  }

  return sorted;
};

// Compatibilidade v2 - mantém função original
window.exportBootTraceLegacy = function() {
  const buffer = window.__BOOT_TRACE_BUFFER__;
  
  if (!buffer || buffer.length === 0) {
    console.log('[BOOT_TRACE_EXPORTER v2] No trace buffer available');
    return null;
  }

  // Criar snapshot imutável
  const snapshot = JSON.parse(JSON.stringify(buffer));

  // Agrupar por categoria
  const grouped = {
    kernel: snapshot.filter(e => e.event.startsWith("KERNEL_")),
    boot: snapshot.filter(e => e.event.startsWith("BOOT_")),
    recovery: snapshot.filter(e => 
      e.event.startsWith("AUTO_") || 
      e.event.includes("DEGRADED") ||
      e.event.startsWith("RECOVERY")
    ),
    phase: snapshot.filter(e => e.event.includes("PHASE") || e.event.includes("PHASE_TRANSITION"))
  };

  // Ordenar por timestamp
  const ordered = [...snapshot].sort((a, b) => a.t - b.t);

  // === ANÁLISE DE RACE CONDITION ===
  
  // Eventos críticos para determinar ordem
  const kernelResolve = ordered.find(e => e.event === "BOOT_READY_RESOLVE_CALLED_FROM_KERNEL");
  const autoResolve = ordered.find(e => e.event === "AUTO_HEAL_RESOLVE_DONE");
  const autoResolveAttempt = ordered.find(e => e.event === "AUTO_HEAL_RESOLVE_ATTEMPT");
  const kernelStateReady = ordered.find(e => e.event === "KERNEL_STATE_READY");
  const setDegraded = ordered.find(e => e.event === "SET_DEGRADED_TRIGGERED");

  // Verificar dual finalizer
  const hasDualFinalizer = kernelResolve && (autoResolve || autoResolveAttempt);

  // Determinar quem resolveu primeiro
  let winner = null;
  let raceAnalysis = null;

  if (hasDualFinalizer) {
    const kernelTime = kernelResolve?.t;
    const autoTime = autoResolve?.t || autoResolveAttempt?.t;

    if (autoTime && kernelTime) {
      const autoWon = autoTime < kernelTime;
      winner = autoWon ? "RECOVERY" : "KERNEL";
      
      raceAnalysis = {
        winner,
        kernelTime,
        autoTime,
        delta: Math.abs(autoTime - kernelTime).toFixed(3),
        margin: autoWon ? "RECOVERY_WON" : "KERNEL_WON",
        severity: Math.abs(autoTime - kernelTime) < 10 ? "CRITICAL" : "WARNING"
      };
    }
  }

  // === DETECTAR AUTO-HEAL EM BOOT NORMAL ===
  const autoHealInNormalBoot = ordered.some(e => 
    e.event.startsWith("AUTO_") && 
    !setDegraded
  );

  // === VERIFICAR CALLBACKS ANTES/DEPOIS DE RELEASE ===
  const releaseTrue = ordered.find(e => e.event === "BOOT_RELEASE_TRUE_CALL");
  const callbackStart = ordered.find(e => e.event === "KERNEL_CALLBACK_QUEUE_FLUSH_START");
  const callbacksDone = ordered.find(e => e.event === "KERNEL_CALLBACKS_EXECUTE_DONE");

  const callbackTiming = {
    releaseCallTime: releaseTrue?.t,
    queueFlushStart: callbackStart?.t,
    callbacksDone: callbacksDone?.t,
    order: releaseTrue && callbackStart 
      ? (releaseTrue.t < callbackStart.t ? "CORRECT" : "INVERTED")
      : "UNKNOWN"
  };

  // === VERIFICAR KERNEL SEM RESOLUÇÃO ===
  const kernelReadyWithoutResolve = kernelStateReady && !kernelResolve;

  // === RESUMO ===
  const analysis = {
    bootId: snapshot[0]?.bootId || 'unknown',
    totalEvents: snapshot.length,
    timeRange: ordered.length > 0 
      ? (ordered[ordered.length - 1].t - ordered[0].t).toFixed(3) 
      : 0,
    phases: [...new Set(ordered.map(e => e.phase))],
    
    // Race condition
    dualFinalizer: hasDualFinalizer,
    raceWinner: winner,
    raceAnalysis,
    
    // Problemas detectados
    autoHealInterference: autoHealInNormalBoot,
    kernelReadyWithoutResolution: !!kernelReadyWithoutResolve,
    callbackOrder: callbackTiming.order,
    
    // Eventos críticos presentes
    events: {
      kernelStateReady: !!kernelStateReady,
      kernelResolve: !!kernelResolve,
      autoResolve: !!(autoResolve || autoResolveAttempt),
      setDegraded: !!setDegraded,
      releaseTrue: !!releaseTrue,
      callbackStart: !!callbackStart
    }
  };

  // === OUTPUT ===
  console.log("%c=== BOOT TRACE SNAPSHOT v2 ===", "font-size: 14px; font-weight: bold; color: #4ECDC4;");
  console.log("Boot ID:", analysis.bootId);
  console.log("Total Events:", analysis.totalEvents);
  console.log("Phases:", analysis.phases.join(", "));
  
  console.log("%c=== ORDERED EVENTS ===", "font-size: 12px; font-weight: bold; color: #95E1D3;");
  ordered.forEach((e, i) => {
    const color = e.event.startsWith("KERNEL_") ? "#FF6B6B" :
                  e.event.startsWith("BOOT_") ? "#4ECDC4" :
                  e.event.startsWith("AUTO_") ? "#FFE66D" : "#A8A8A8";
    console.log(
      `%c[${i}]%c ${e.event.padEnd(40)} %c${e.t.toFixed(3)}ms %c(${e.phase})`,
      `color: ${color}; font-weight: bold;`,
      "color: inherit;",
      "color: #888;",
      `color: ${color};`
    );
  });

  console.log("%c=== RACE ANALYSIS ===", "font-size: 12px; font-weight: bold; color: #F38181;");
  if (hasDualFinalizer) {
    console.log("⚠ DUAL FINALIZER DETECTED");
    console.log(`Winner: ${winner}`);
    console.log(`Time delta: ${raceAnalysis.delta}ms`);
    console.log(`Severity: ${raceAnalysis.severity}`);
    
    if (winner === "RECOVERY") {
      console.log("%c🚨 RECOVERY WON THE RACE - POTENTIAL BUG", "color: red; font-weight: bold;");
    } else {
      console.log("%c✓ KERNEL WON THE RACE - CORRECT ORDER", "color: green; font-weight: bold;");
    }
  } else {
    console.log("%c✓ No dual finalizer - clean boot", "color: green;");
  }

  console.log("%c=== DIAGNÓSTICO ===", "font-size: 12px; font-weight: bold; color: #A8A8A8;");
  console.log("Auto-heal interference:", autoHealInNormalBoot ? "⚠ SIM" : "✓ NÃO");
  console.log("Callback order:", callbackTiming.order);
  console.log("Kernel resolved:", kernelResolve ? "✓ SIM" : "✗ NÃO");

  return {
    snapshot,
    grouped,
    ordered,
    analysis,
    raceAnalysis,
    callbackTiming
  };
};

/**
 * Validação rápida - verifica se todos eventos têm bootId
 */
window.validateBootTrace = function() {
  const buffer = window.__BOOT_TRACE_BUFFER__;
  
  if (!buffer) {
    console.error("[BOOT_TRACE_VALIDATOR] No buffer found");
    return false;
  }

  const withoutBootId = buffer.filter(e => !e.bootId);
  const withoutPhase = buffer.filter(e => !e.phase);

  console.log("%c=== BOOT TRACE VALIDATION ===", "font-weight: bold;");
  console.log("Total entries:", buffer.length);
  console.log("Missing bootId:", withoutBootId.length);
  console.log("Missing phase:", withoutPhase.length);
  
  if (withoutBootId.length === 0 && withoutPhase.length === 0) {
    console.log("%c✓ ALL VALID", "color: green; font-weight: bold;");
    return true;
  } else {
    console.log("%c✗ VALIDATION FAILED", "color: red; font-weight: bold;");
    return false;
  }
};

// Auto-export após 5 segundos (quando boot provavelmente completou)
setTimeout(() => {
  if (window.__BOOT_TRACE_BUFFER__ && window.__BOOT_TRACE_BUFFER__.length > 0) {
    console.log('[BOOT_TRACE_EXPORTER v2] Auto-exporting...');
    window.exportBootTrace();
    window.validateBootTrace();
  }
}, 5000);

console.log('[BOOT_TRACE_EXPORTER v2] Ready.');
console.log('Call: window.exportBootTrace() - for full analysis');
console.log('Call: window.validateBootTrace() - for quick validation');
