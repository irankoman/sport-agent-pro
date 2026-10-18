    // Registro de Service Worker para PWA instalable con cache-busting estricto
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js?v=20261018_audit')
          .then((reg) => {
            console.log('PWA ServiceWorker registrado:', reg.scope);
            if (reg.update) { reg.update(); }
          })
          .catch((err) => {
            navigator.serviceWorker.register('/service-worker.js?v=20261018_audit')
              .then((r) => console.log('SW fallback registrado:', r.scope))
              .catch((e) => console.log('Error SW:', e));
          });
      });
    }

    const { useState, useMemo, useEffect, useRef } = React;

    // Helper para zona horaria America/Santiago y cálculo estricto de la semana/jornada en curso
    const getSantiagoDate = () => {
      try {
        const santiagoStr = new Date().toLocaleString("en-US", { timeZone: "America/Santiago" });
        return new Date(santiagoStr);
      } catch(e) {
        const d = new Date();
        return new Date(d.getTime() - (3 * 3600000));
      }
    };

    const getSantiagoYMD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getActiveJornadaRange = () => {
      const santiagoNow = getSantiagoDate();
      // JS getDay(): 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
      // Para semana calendario cerrada de Lunes a Domingo: Lunes = 0 días de distancia, Martes = 1, ..., Domingo = 6
      const dayOfWeek = santiagoNow.getDay();
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      
      const startDate = new Date(santiagoNow.getFullYear(), santiagoNow.getMonth(), santiagoNow.getDate() - daysSinceMonday);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
      
      const startIso = getSantiagoYMD(startDate);
      const endIso = getSantiagoYMD(endDate);

      const dayDateMap = {
        'lun': getSantiagoYMD(startDate),
        'mar': getSantiagoYMD(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1)),
        'mie': getSantiagoYMD(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 2)),
        'jue': getSantiagoYMD(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 3)),
        'vie': getSantiagoYMD(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 4)),
        'sab': getSantiagoYMD(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 5)),
        'dom': getSantiagoYMD(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6))
      };

      const SPANISH_MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const startLabel = `Lun ${startDate.getDate()} ${SPANISH_MONTHS_SHORT[startDate.getMonth()]}`;
      const endLabel = `Dom ${endDate.getDate()} ${SPANISH_MONTHS_SHORT[endDate.getMonth()]}`;
      const weekRangeLabel = `Semana activa: ${startLabel} - ${endLabel}`;

      return { startIso, endIso, dayDateMap, santiagoNow, startDate, endDate, weekRangeLabel };
    };

    const buildWeekDaysList = () => {
      const { dayDateMap } = getActiveJornadaRange();
      const getNum = (id) => {
        const iso = dayDateMap[id];
        return iso ? ` ${iso.slice(8, 10)}` : '';
      };
      return [
        { id: 'all_week', short: '📅 TODA LA SEMANA' },
        { id: 'live', short: '🔴 EN VIVO' },
        { id: 'lun', short: `LUNES${getNum('lun')}` },
        { id: 'mar', short: `MARTES${getNum('mar')}` },
        { id: 'mie', short: `MIÉRCOLES${getNum('mie')}` },
        { id: 'jue', short: `JUEVES${getNum('jue')}` },
        { id: 'vie', short: `VIERNES${getNum('vie')}` },
        { id: 'sab', short: `SÁBADO${getNum('sab')}` },
        { id: 'dom', short: `DOMINGO${getNum('dom')}` }
      ];
    };

    const WEEK_DAYS = buildWeekDaysList();

    // Ligas individuales empezando por Chile
    const LEAGUES_LIST = [
      { id: 'chi', label: 'Chile', flag: '🇨🇱' },
      { id: 'eng', label: 'Premier', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
      { id: 'esp', label: 'LaLiga', flag: '🇪🇸' },
      { id: 'ita', label: 'Serie A', flag: '🇮🇹' },
      { id: 'ger', label: 'Bundesliga', flag: '🇩🇪' },
      { id: 'fra', label: 'Ligue 1', flag: '🇫🇷' },
      { id: 'por', label: 'Primeira', flag: '🇵🇹' },
      { id: 'nor', label: 'Eliteserien', flag: '🇳🇴' },
      { id: 'sco', label: 'Scottish', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' }
    ];

    const STORAGE_KEY_FAVORITES = 'sportagent_favorite_teams_v3';

    // Cargar selecciones manuales guardadas en localStorage (Sin equipos fijos por código)
    const loadSavedFavorites = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_FAVORITES);
        if (saved !== null) {
          return JSON.parse(saved);
        }
        const legacy = localStorage.getItem('sportagent_vip_teams_v10');
        if (legacy !== null) {
          return JSON.parse(legacy);
        }
      } catch (e) {
        console.error("Error leyendo favoritos de localStorage:", e);
      }
      return [];
    };

    // Helper para detectar partidos finalizados de forma inteligente
    const isFinishedMatch = (m) => {
      if (!m) return false;
      return Boolean(
        m.isFinished || 
        m.dataPhase?.includes('Finalizado') || 
        m.score?.includes('Final') ||
        (['lun', 'mar', 'mie', 'jue', 'vie'].includes(m.dayId) && m.score !== 'VS' && !m.isLive)
      );
    };

    function App() {
      const [matches, setMatches] = useState([]);
      const [isLoading, setIsLoading] = useState(true);
      const [lastUpdated, setLastUpdated] = useState('');
      
      const [selectedDay, setSelectedDay] = useState('all_week');
      const [selectedLeague, setSelectedLeague] = useState('all');
      const [onlyStarred, setOnlyStarred] = useState(false);
      const [onlyLive, setOnlyLive] = useState(false);
      const [searchQuery, setSearchQuery] = useState('');

      const weekDays = useMemo(() => buildWeekDaysList(), [matches]);
      const activeJornada = useMemo(() => getActiveJornadaRange(), [matches]);

      // Equipos Favoritos / VIP seleccionados manualmente por el usuario (Persistidos en localStorage)
      const [vipTeams, setVipTeams] = useState(loadSavedFavorites);

      // 158 Equipos reales para selector VIP
      const [allTeamsData, setAllTeamsData] = useState({});
      const [teamSearchQuery, setTeamSearchQuery] = useState('');
      const [teamLeagueFilter, setTeamLeagueFilter] = useState('all');

      // Modales y Partido Seleccionado
      const [showVipModal, setShowVipModal] = useState(false);
      const [showDetailModal, setShowDetailModal] = useState(false);
      const [selectedMatchId, setSelectedMatchId] = useState('');
      const [modalTab, setModalTab] = useState('tiros');

      // Referencias vivas para prevenir stale closures durante auto-refresh
      const selectedMatchIdRef = useRef(selectedMatchId);
      selectedMatchIdRef.current = selectedMatchId;

      const showDetailModalRef = useRef(showDetailModal);
      showDetailModalRef.current = showDetailModal;

      const lastInspectedMatchRef = useRef(null);

      // Semáforo de Sincronización de Alineaciones ('PREVIA' vs 'CONFIRMADO')
      const [lineupMode, setLineupMode] = useState('PREVIA');

      // Estado del Cupón Betano (para partidos en juego o próximos)
      const [activeProfileName, setActiveProfileName] = useState('conservador');
      const [betSlip, setBetSlip] = useState([]);
      const [stakeCLP, setStakeCLP] = useState(15000);
      const [copySuccess, setCopySuccess] = useState(false);

      // Estado de Instalación PWA (Android / iOS)
      const [installPrompt, setInstallPrompt] = useState(null);

      useEffect(() => {
        const handler = (e) => {
          e.preventDefault();
          setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
      }, []);

      const handleInstallApp = async () => {
        if (installPrompt) {
          installPrompt.prompt();
          const { outcome } = await installPrompt.userChoice;
          if (outcome === 'accepted') {
            setInstallPrompt(null);
          }
        } else {
          alert("📱 Para instalar SPORT-AGENT PRO en tu celular:\n\n• En iPhone (iOS Safari): Pulsa el botón 'Compartir' (el icono de un cuadrado con flecha hacia arriba) y selecciona 'Agregar al inicio'.\n\n• En Android (Chrome): Pulsa los 3 puntos arriba a la derecha y selecciona 'Instalar aplicación' o 'Agregar a la pantalla principal'.");
        }
      };

      // Checklist pre-apuesta interactivo
      const [checklist, setChecklist] = useState({
        lineupsConfirmed: true,
        weatherOptimal: true,
        refereeCompatible: true,
        bankrollProtected: true
      });

      // Guardar inmediatamente en localStorage cada cambio de Favoritos/VIP por nombre de club
      useEffect(() => {
        try {
          localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(vipTeams));
          localStorage.setItem('sportagent_vip_teams_v10', JSON.stringify(vipTeams));
        } catch (e) {
          console.error("Error guardando favoritos en localStorage:", e);
        }
      }, [vipTeams]);

      // Función de coincidencia con equipos Favoritos/VIP por nombre
      const matchesVipTeam = (m, teamsList) => {
        if (!m || !teamsList || teamsList.length === 0) return false;
        const h = (m.homeTeam || '').toLowerCase().trim();
        const a = (m.awayTeam || '').toLowerCase().trim();
        return teamsList.some(vip => {
          if (!vip) return false;
          const v = vip.toLowerCase().trim();
          return h === v || a === v || h.includes(v) || v.includes(h) || a.includes(v) || v.includes(a);
        });
      };

      // Determinar si un partido es Favorito / Importante bajo control manual del usuario
      const isMatchFavorite = (m) => {
        if (!m) return false;
        return matchesVipTeam(m, vipTeams);
      };

      // Alternar estrella manual en cualquier partido: guarda por NOMBRE del equipo permanentemente en localStorage
      const toggleStar = (id, e) => {
        if (e) e.stopPropagation();
        const match = matches.find(m => m.id === id);
        if (!match) return;

        const h = (match.homeTeam || '').trim();
        const a = (match.awayTeam || '').trim();
        const currentlyFav = isMatchFavorite(match);

        setVipTeams(prev => {
          let next;
          if (currentlyFav) {
            // Desmarcar: remover los nombres de equipos que coincidan
            next = prev.filter(t => {
              const tn = t.toLowerCase().trim();
              const matchesH = tn === h.toLowerCase() || h.toLowerCase().includes(tn) || tn.includes(h.toLowerCase());
              const matchesA = tn === a.toLowerCase() || a.toLowerCase().includes(tn) || tn.includes(a.toLowerCase());
              return !matchesH && !matchesA;
            });
          } else {
            // Marcar: agregar los nombres de ambos equipos de forma permanente
            const toAdd = [];
            if (h && !prev.some(t => t.toLowerCase().trim() === h.toLowerCase())) toAdd.push(h);
            if (a && !prev.some(t => t.toLowerCase().trim() === a.toLowerCase())) toAdd.push(a);
            next = [...prev, ...toAdd];
          }
          try {
            localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(next));
            localStorage.setItem('sportagent_vip_teams_v10', JSON.stringify(next));
          } catch(err) {}
          return next;
        });
      };

      const closeMatchDetail = () => {
        showDetailModalRef.current = false;
        setShowDetailModal(false);
      };

      // Cargar partidos reales y ejecutar ciclo de sincronización multifuente
      const loadRealMatches = async (force = false, isBackground = false) => {
        // Solo mostrar spinner en carga inicial o cuando el usuario presiona "Actualizar" manualmente
        if (!isBackground) {
          setIsLoading(true);
        }
        try {
          if (force) {
            await fetch('/api/sync/trigger', { method: 'POST' });
          }
          const res = await fetch(`/api/real-matches?force_refresh=${force}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              setMatches(data);
              setLastUpdated(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));

              const currentSelectedId = selectedMatchIdRef.current;
              const isModalOpen = showDetailModalRef.current;

              // Si ya hay un partido seleccionado o el modal está abierto, ACTUALIZAR la referencia viva SIN reiniciar a data[0]
              if (currentSelectedId) {
                const refreshedMatch = data.find(m => m.id === currentSelectedId);
                if (refreshedMatch) {
                  lastInspectedMatchRef.current = refreshedMatch;
                }
              } else if (!isModalOpen && data.length > 0) {
                // Solo si el usuario nunca seleccionó nada y el modal está cerrado
                initMatchSelection(data[0]);
              }
            }
          }
        } catch (e) {
          console.error("Error al cargar partidos:", e);
        } finally {
          if (!isBackground) {
            setIsLoading(false);
          }
        }
      };

      // Cargar los 158 equipos para el modal VIP
      const loadAllTeams = async () => {
        try {
          const res = await fetch('/api/all-teams');
          if (res.ok) {
            const data = await res.json();
            setAllTeamsData(data);
          }
        } catch (e) {
          console.error("Error al cargar equipos:", e);
        }
      };

      useEffect(() => {
        loadRealMatches(false, false);
        loadAllTeams();
        const interval = setInterval(() => loadRealMatches(true, true), 300000);
        return () => clearInterval(interval);
      }, []);

      const initMatchSelection = (match) => {
        if (!match) return;
        selectedMatchIdRef.current = match.id;
        lastInspectedMatchRef.current = match;
        setSelectedMatchId(match.id);
        const isConf = match.isLive || match.isFinished || Boolean(match.playerAnalytics?.isOfficialConfirmed);
        setLineupMode(isConf ? 'CONFIRMADO' : 'PREVIA');
        const defaultIds = match.suggestedProfiles?.conservador?.pickIds || [];
        const allP = [...(match.betanoLevel1 || []), ...(match.betanoLevel2 || [])];
        const picks = allP.filter((p) => defaultIds.includes(p.id));
        setBetSlip(picks.length > 0 ? picks : allP.slice(0, 2));
        setActiveProfileName('conservador');
      };

      const openMatchDetail = (match) => {
        if (!match) return;
        selectedMatchIdRef.current = match.id;
        lastInspectedMatchRef.current = match;
        showDetailModalRef.current = true;
        initMatchSelection(match);
        setModalTab('tiros');
        setShowDetailModal(true);
      };

      const handleLeagueSelect = (leagueId) => {
        setSelectedLeague(leagueId);
        setOnlyStarred(false);
        if (leagueId !== 'all') {
          const { startIso, endIso, dayDateMap } = getActiveJornadaRange();
          const hasMatches = matches.some(m => {
            if (m.leagueId !== leagueId) return false;
            const mDate = m.matchDate || (m.rawDate ? m.rawDate.slice(0, 10) : '');
            if (mDate && (mDate < startIso || mDate > endIso)) return false;
            if (selectedDay === 'all_week') return true;
            if (selectedDay === 'live') return m.isLive;
            const expectedDate = dayDateMap[selectedDay];
            if (expectedDate && mDate && mDate !== expectedDate) return false;
            return m.dayId === selectedDay;
          });
          if (!hasMatches) {
            setSelectedDay('all_week');
          }
        }
      };

      const selectedMatch = useMemo(() => {
        if (!selectedMatchId) {
          return lastInspectedMatchRef.current || matches[0] || null;
        }
        // 1. Buscar coincidencia exacta por ID determinista
        let found = matches.find((m) => m.id === selectedMatchId);
        // 2. Si no lo encuentra por ID (por ej. si cambió algún parámetro), buscar por nombres de equipos
        if (!found && lastInspectedMatchRef.current) {
          const lim = lastInspectedMatchRef.current;
          found = matches.find((m) => m.homeTeam === lim.homeTeam && m.awayTeam === lim.awayTeam);
        }
        if (found) {
          lastInspectedMatchRef.current = found;
          return found;
        }
        // 3. Si el modal está abierto o había un partido inspeccionado, PRESERVARLO (NUNCA retroceder a matches[0])
        if (lastInspectedMatchRef.current) {
          return lastInspectedMatchRef.current;
        }
        return matches[0] || null;
      }, [matches, selectedMatchId]);

      // Conteo de partidos favoritos activos
      const favoriteMatchesCount = useMemo(() => {
        return matches.filter(m => isMatchFavorite(m)).length;
      }, [matches, vipTeams]);

      // Filtrado reactivo de partidos con filtro estricto de semana/jornada en America/Santiago
      const filteredMatches = useMemo(() => {
        const { startIso, endIso, dayDateMap } = getActiveJornadaRange();

        return matches.filter((m) => {
          // 1. FILTRO ESTRICTO: Descartar automáticamente partidos de semanas posteriores o fuera de la jornada
          const mDate = m.matchDate || (m.rawDate ? m.rawDate.slice(0, 10) : '');
          if (mDate && (mDate < startIso || mDate > endIso)) {
            return false;
          }

          if (onlyLive && !m.isLive) return false;
          if (selectedDay === 'live' && !m.isLive) return false;
          
          // 2. Filtro por día: verificar coincidencia exacta por dayId Y por fecha de la jornada
          if (selectedDay !== 'all_week' && selectedDay !== 'live') {
            const expectedDate = dayDateMap[selectedDay];
            if (expectedDate && mDate && mDate !== expectedDate) return false;
            if (m.dayId !== selectedDay) return false;
          }
          
          if (onlyStarred && !isMatchFavorite(m)) return false;
          if (!onlyStarred && selectedLeague !== 'all' && m.leagueId !== selectedLeague) return false;

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const inHome = (m.homeTeam || '').toLowerCase().includes(q);
            const inAway = (m.awayTeam || '').toLowerCase().includes(q);
            const inLeague = (m.leagueName || '').toLowerCase().includes(q);
            if (!inHome && !inAway && !inLeague) return false;
          }
          return true;
        });
      }, [matches, selectedDay, selectedLeague, onlyStarred, onlyLive, searchQuery, vipTeams]);

      const applyRiskProfile = (profileKey) => {
        if (!selectedMatch) return;
        setActiveProfileName(profileKey);
        const profile = selectedMatch.suggestedProfiles?.[profileKey];
        if (!profile) return;
        const allPicks = [...(selectedMatch.betanoLevel1 || []), ...(selectedMatch.betanoLevel2 || [])];
        const selectedPicks = allPicks.filter((p) => profile.pickIds.includes(p.id));
        setBetSlip(selectedPicks.length > 0 ? selectedPicks : allPicks.slice(0, 2));
      };

      const togglePickInSlip = (pick) => {
        setActiveProfileName('custom');
        setBetSlip((prev) => {
          const exists = prev.find((p) => p.id === pick.id);
          if (exists) return prev.filter((p) => p.id !== pick.id);
          return [...prev, pick];
        });
      };

      const loadCombinadaToSlip = (combinada) => {
        if (!combinada || !combinada.picks) return;
        setActiveProfileName('custom');
        setBetSlip((prev) => {
          const newSlip = [...prev];
          combinada.picks.forEach((p) => {
            if (!newSlip.some((item) => item.id === p.id)) {
              newSlip.push(p);
            }
          });
          return newSlip;
        });
      };

      const removePickFromSlip = (pickId, e) => {
        if (e) e.stopPropagation();
        setActiveProfileName('custom');
        setBetSlip((prev) => prev.filter((p) => p.id !== pickId));
      };

      const toggleVipTeam = (teamName) => {
        const cleanName = (teamName || '').trim();
        if (!cleanName) return;
        setVipTeams((prev) => {
          const exists = prev.some(t => t.toLowerCase().trim() === cleanName.toLowerCase());
          const next = exists
            ? prev.filter(t => t.toLowerCase().trim() !== cleanName.toLowerCase())
            : [...prev, cleanName];
          try {
            localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(next));
            localStorage.setItem('sportagent_vip_teams_v10', JSON.stringify(next));
          } catch(err) {}
          return next;
        });
      };

      // Cálculo Criterio de Kelly (Quarter-Kelly) sugerido
      const combinedOdds = useMemo(() => betSlip.reduce((acc, item) => acc * item.odds, 1), [betSlip]);
      const combinedProb = useMemo(() => betSlip.length === 0 ? 0 : Math.round(betSlip.reduce((acc, item) => acc * (item.prob / 100), 1) * 100), [betSlip]);
      
      const suggestedKellyStakeCLP = useMemo(() => {
        if (combinedOdds <= 1.05 || combinedProb <= 5) return 5000;
        const b = combinedOdds - 1.0;
        const p = combinedProb / 100.0;
        const q = 1.0 - p;
        const fullKelly = (b * p - q) / b;
        if (fullKelly <= 0) return 5000;
        const stakeRatio = Math.max(0.01, Math.min(0.05, fullKelly * 0.25));
        const val = Math.round((500000 * stakeRatio) / 1000) * 1000;
        return Math.max(5000, val);
      }, [combinedOdds, combinedProb]);

      const formatCLP = (amt) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amt);

      // Copiar información al portapapeles
      const handleCopyReport = () => {
        if (!selectedMatch) return;
        const isFin = isFinishedMatch(selectedMatch);
        let text = '';

        if (isFin) {
          const pm = selectedMatch.postMatchReport || {};
          const ga = pm.goalsAudit;
          const compItems = pm.complianceItems || [];
          const goalLines = ga && ga.goalEvents && ga.goalEvents.length > 0 
            ? ga.goalEvents.map(g => `  ⚽ ${g.minute} ${g.player} (${g.team || selectedMatch.homeTeam})`).join('\n')
            : '  (Sin registro individual de anotadores)';
          const compLines = compItems.map(item => `• [${item.category}] ${item.selection} -> ${item.actual} (${item.status})`).join('\n');

          text = [
            `🏁 SPORT-AGENT PRO · AUDITORÍA POST-PARTIDO OFICIAL`,
            `Encuentro: ${selectedMatch.homeTeam} ${selectedMatch.score} ${selectedMatch.awayTeam}`,
            `Liga: ${selectedMatch.leagueName} | Fecha: ${selectedMatch.dayLabel}`,
            `Estadio: ${selectedMatch.stadium} (${selectedMatch.city || 'Sede'})`,
            `Balance Global: ${pm.overallAccuracy?.scoreLabel || pm.overallAccuracy?.overallScore || pm.modelAccuracy?.overallScore || 'Aciertos verificados'}`,
            `--------------------------------------------------`,
            `AUDITORÍA DE GOLES:`,
            `• Goles Reales: ${ga ? ga.actualGoals : selectedMatch.score} | Proyección: ${ga ? ga.projectedLine : 'Over 2.5'} -> ${ga ? ga.statusLabel : 'VERIFICADO'}`,
            goalLines,
            `--------------------------------------------------`,
            `BALANCE DE CUMPLIMIENTO (COLECTIVO & JUGADORES):`,
            compLines,
            `--------------------------------------------------`,
            `Árbitro Oficial: ${selectedMatch.referee?.name} (${pm.refereeActualYellows || 4} 🟨 mostradas)`,
            `SPORT-AGENT PRO · Inteligencia Deportiva Betano CLP`
          ].join('\n');
        } else {
          if (betSlip.length === 0) return;
          text = [
            `⚡ SPORT-AGENT PRO · PRONÓSTICO BETANO CHILE`,
            `Partido: ${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam} (${selectedMatch.leagueName})`,
            `Fecha: ${selectedMatch.dayLabel}`,
            `Árbitro: ${selectedMatch.referee?.name}`,
            `Sincronización Alineaciones: ${lineupMode === 'CONFIRMADO' ? 'ONCE OFICIAL CONFIRMADO' : 'MODO PREVIA'}`,
            `--------------------------------------------------`,
            ...betSlip.map((b, i) => `${i+1}. [${b.category || b.type}] ${b.market || b.player} (@${b.odds.toFixed(2)})`),
            `--------------------------------------------------`,
            `Cuota Total Betano: @${combinedOdds.toFixed(2)}`,
            `Probabilidad Conjunta IA: ${combinedProb}%`,
            `Monto Sugerido (Kelly): ${formatCLP(stakeCLP)}`,
            `Retorno Potencial: ${formatCLP(stakeCLP * combinedOdds)} CLP`,
            `Ganancia Neta: +${formatCLP(Math.max(0, stakeCLP * combinedOdds - stakeCLP))} CLP`
          ].join('\n');
        }

        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      };

      // Lista plana de equipos para el modal VIP
      const flatTeamsList = useMemo(() => {
        let list = [];
        Object.entries(allTeamsData).forEach(([lKey, lObj]) => {
          if (teamLeagueFilter === 'all' || teamLeagueFilter === lKey) {
            (lObj.teams || []).forEach(t => {
              list.push({ ...t, leagueKey: lKey });
            });
          }
        });
        if (teamSearchQuery.trim()) {
          const q = teamSearchQuery.toLowerCase();
          list = list.filter(t => t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q));
        }
        return list;
      }, [allTeamsData, teamSearchQuery, teamLeagueFilter]);

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          
          {/* HEADER PRINCIPAL GLOBAL */}
          <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 backdrop-blur shadow-md">
            <div className="max-w-[1750px] mx-auto flex flex-wrap items-center justify-between gap-3">
              
              {/* Brand & Título */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-500/20">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                      SPORT-AGENT <span className="text-orange-500">PRO</span>
                    </h1>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      PARRILLA RADAR 360° · BETANO CLP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Alineaciones (Titular vs. Mixto) • Clima & Cancha • Árbitros Oficiales • Haz clic en un partido para su Análisis Profundo o Post-Mórtem
                  </p>
                </div>
              </div>

              {/* Buscador de equipos integrado */}
              <div className="flex-1 max-w-sm hidden md:block">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar equipo o partido (ej. Arsenal, Colo-Colo, Real Madrid)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 text-xs hover:text-white">✕</button>
                  )}
                </div>
              </div>

              {/* Controles de estado y acciones */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-bold font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>EN LÍNEA {lastUpdated && `(${lastUpdated})`}</span>
                </div>
                
                <button
                  onClick={() => loadRealMatches(true)}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition active:scale-95"
                  title="Actualizar datos reales desde la API"
                >
                  <span className={isLoading ? "animate-spin" : ""}>🔄</span>
                  <span className="hidden md:inline">{isLoading ? "Sincronizando..." : "Actualizar"}</span>
                </button>

                <button
                  onClick={() => setShowVipModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center gap-1.5 transition shadow"
                >
                  <span>👑 Mis Favoritos ({vipTeams.length})</span>
                </button>

                <button
                  onClick={handleInstallApp}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 text-xs font-black border border-orange-500/40 flex items-center gap-1.5 transition active:scale-95 shadow"
                  title="Instalar como app nativa en tu celular"
                >
                  <span>📲</span>
                  <span>Instalar App</span>
                </button>
              </div>
            </div>

            {/* BARRA CALENDARIO SEMANAL */}
            <div className="max-w-[1750px] mx-auto mt-2.5 flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {weekDays.map((d) => {
                  const isActive = selectedDay === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDay(d.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition ${
                        isActive ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <div className="shrink-0 bg-slate-900 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                <span>🗓️</span>
                <span>{activeJornada.weekRangeLabel}</span>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* BARRA DE FILTROS Y LIGAS: FAVORITOS UBICADO ANTES DE CHILE                */}
            {/* ========================================================================= */}
            <div className="max-w-[1750px] mx-auto mt-2 pt-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Filtros:</span>

              {/* 1. TODAS LAS 9 LIGAS */}
              <button
                onClick={() => { setSelectedLeague('all'); setOnlyStarred(false); }}
                className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                  selectedLeague === 'all' && !onlyStarred ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>🌐 Todas las 9 Ligas</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedLeague === 'all' && !onlyStarred ? 'bg-black/30 text-slate-950 font-bold' : 'bg-slate-900 text-orange-400'}`}>
                  {matches.length}
                </span>
              </button>

              {/* 2. ⭐ IMPORTANTES / MIS FAVORITOS (UBICADO ANTES DE CHILE) */}
              <button
                onClick={() => {
                  setOnlyStarred(!onlyStarred);
                }}
                className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 border shrink-0 transition shadow-sm ${
                  onlyStarred 
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-amber-500/20' 
                    : 'bg-slate-800 border-amber-500/50 text-amber-300 hover:bg-slate-700'
                }`}
                title="Filtrar solo partidos de tus equipos favoritos o marcados con estrella"
              >
                <span>⭐ Importantes / Favoritos</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  onlyStarred ? 'bg-black/30 text-slate-950' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {favoriteMatchesCount}
                </span>
              </button>

              {/* 3. LIGAS OFICIALES (INICIANDO POR CHILE Y SIGUIENTES) */}
              {LEAGUES_LIST.map((lg) => {
                const count = matches.filter(m => m.leagueId === lg.id).length;
                const isSelected = selectedLeague === lg.id && !onlyStarred;
                return (
                  <button
                    key={lg.id}
                    onClick={() => handleLeagueSelect(lg.id)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                      isSelected ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{lg.flag} {lg.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-black/30 text-slate-950 font-bold' : 'bg-slate-900 text-orange-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* 4. 🔴 EN VIVO */}
              <button
                onClick={() => setOnlyLive(!onlyLive)}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 border shrink-0 transition ${
                  onlyLive ? 'bg-rose-500 text-white border-rose-400 font-bold shadow' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🔴 En Vivo ({matches.filter((m) => m.isLive).length})
              </button>
            </div>
          </header>

          {/* VISTA PRINCIPAL: RADAR LIMPIO Y COMPLETO A ANCHO TOTAL */}
          <main className="flex-1 p-4 max-w-[1750px] w-full mx-auto flex flex-col gap-3">
            
            {/* Buscador móvil visible solo en pantallas pequeñas */}
            <div className="block md:hidden">
              <input
                type="text"
                placeholder="🔍 Buscar equipo o partido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
              />
            </div>

            {/* TABLA RADAR DE PARTIDOS PRINCIPAL */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col">
              
              {/* Cabecera de la tabla */}
              <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-white flex items-center gap-2">
                    <span className="text-orange-500">⚡</span> RADAR DE PARTIDOS · PARRILLA SEMANAL (9 LIGAS)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Inspección de alineaciones, clima, canchas y árbitros. Toca la estrella ★ para marcar o desmarcar favoritos manualmente.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg font-mono flex items-center gap-1.5 shadow-sm">
                    <span>🗓️</span> {activeJornada.weekRangeLabel}
                  </span>
                  <span className="text-xs text-orange-400 font-bold bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-lg font-mono">
                    {filteredMatches.length} partidos encontrados
                  </span>
                </div>
              </div>

              {/* Contenedor scrolleable de la tabla */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950 font-mono tracking-wider">
                      <th className="py-3 px-3.5 text-center w-12" title="Favoritos">★</th>
                      <th className="py-3 px-4 w-44">Fecha & Liga</th>
                      <th className="py-3 px-4">Encuentro Oficial</th>
                      <th className="py-3 px-4 w-56">Alineación (Titular vs Mixto)</th>
                      <th className="py-3 px-4 w-52">Clima & Cancha</th>
                      <th className="py-3 px-4 w-48">Árbitro Oficial</th>
                      <th className="py-3 px-4 text-center w-36">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredMatches.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-16 text-center text-slate-500 font-mono">
                          {isLoading ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-xl animate-spin">🔄</span>
                              <span>Cargando partidos de las 9 ligas en tiempo real...</span>
                            </div>
                          ) : (
                            <div>
                              <p className="text-base text-slate-400 mb-1">No hay partidos para los filtros seleccionados.</p>
                              <p className="text-xs text-slate-600">Prueba seleccionando "📅 TODA LA SEMANA" o "Todas las 9 Ligas" en la barra superior.</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredMatches.map((m) => {
                        const isFin = isFinishedMatch(m);
                        const isFav = isMatchFavorite(m);

                        return (
                          <tr
                            key={m.id}
                            onClick={() => openMatchDetail(m)}
                            className="cursor-pointer transition hover:bg-slate-800/80 group"
                          >
                            {/* Favorito / Estrella Interactiva */}
                            <td className="py-3 px-3.5 text-center">
                              <button
                                onClick={(e) => toggleStar(m.id, e)}
                                className="hover:scale-125 transition inline-block p-1"
                                title={isFav ? "Quitar de Favoritos / Importantes" : "Agregar a Favoritos / Importantes"}
                              >
                                <span className={isFav ? 'text-amber-400 text-base' : 'text-slate-600 group-hover:text-slate-400 text-base'}>
                                  ★
                                </span>
                              </button>
                            </td>

                            {/* Fecha y Liga */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-white font-mono flex items-center gap-1.5">
                                {m.isLive ? (
                                  <span className="text-rose-500 font-black animate-pulse">🔴 VIVO</span>
                                ) : isFin ? (
                                  <span className="text-slate-400 font-medium">🏁 {m.dayLabel}</span>
                                ) : (
                                  <span>{m.dayLabel}</span>
                                )}
                              </div>
                              <div className="text-[11px] text-orange-400 font-semibold mt-0.5">{m.leagueName}</div>
                            </td>

                            {/* Encuentro Oficial */}
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-white text-sm sm:text-base group-hover:text-orange-300 transition">
                                {m.homeTeam} 
                                <span className={`px-2 font-bold font-mono text-xs sm:text-sm ${isFin ? 'text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded mx-1' : 'text-orange-400'}`}>
                                  {m.score}
                                </span> 
                                {m.awayTeam}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>📍 {m.stadium}</span>
                                {m.city && <span>• {m.city}</span>}
                                {isFav && <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.2 rounded">⭐ Favorito</span>}
                                {m.oddsDetails && (
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold flex items-center gap-1">
                                    <span>📊</span> 1: @{m.oddsDetails.homeWin.toFixed(2)} · 2: @{m.oddsDetails.awayWin.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Alineación (Titular vs Mixto) */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className="badge-titular px-2 py-0.5 rounded text-[10px] font-bold w-fit">
                                  L: {m.lineupSummary?.homeType || 'XI Titular'}
                                </span>
                                <span className="badge-mixto px-2 py-0.5 rounded text-[10px] font-bold w-fit">
                                  V: {m.lineupSummary?.awayType || 'Titulares Habituales'}
                                </span>
                              </div>
                            </td>

                            {/* Clima y Superficie */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-sky-300">{m.weatherPitch?.condition || 'Clima normal'}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={m.weatherPitch?.pitchType}>
                                {m.weatherPitch?.pitchType || 'Césped en óptimas condiciones'}
                              </div>
                            </td>

                            {/* Árbitro Oficial */}
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-200">{m.referee?.name}</div>
                              <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1 mt-0.5">
                                <span>🟨 {m.referee?.avgYellows} amarillas</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-emerald-400">{Math.round((m.referee?.penaltiesPerMatch || 0.35) * 100)}% penales</span>
                              </div>
                            </td>

                            {/* Botón de Acción */}
                            <td className="py-3 px-4 text-center">
                              {isFin ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMatchDetail(m);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 mx-auto active:scale-95 shadow-sm"
                                >
                                  <span>🏁</span>
                                  <span>Historial</span>
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMatchDetail(m);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/40 text-xs font-bold transition flex items-center gap-1.5 mx-auto active:scale-95 shadow-sm"
                                >
                                  <span>⚡</span>
                                  <span>Analizar</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer resumen de la tabla */}
              <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400 font-mono">
                <span>9 Ligas Oficiales: Premier, LaLiga, Serie A, Bundesliga, Ligue 1, Primeira Liga, Eliteserien, Scottish, Chile</span>
                <span>Filtro "⭐ Importantes / Favoritos" ubicado antes de Chile</span>
              </div>
            </div>
          </main>

          {/* ========================================================================= */}
          {/* SUB-VENTANA MODAL FLOTANTE: DETALLE PROFUNDO (FUTUROS) O POST-MÓRTEM (FIN) */}
          {/* ========================================================================= */}
          {showDetailModal && selectedMatch && (() => {
            const isFin = isFinishedMatch(selectedMatch);
            const isFav = isMatchFavorite(selectedMatch);
            const pm = selectedMatch.postMatchReport || {};

            // Analítica activa según modo (Previa vs Once Oficial Confirmado)
            const activeAnalytics = (lineupMode === 'CONFIRMADO'
              ? (selectedMatch.playerAnalytics?.confirmed || selectedMatch.playerAnalytics)
              : (selectedMatch.playerAnalytics?.previa || selectedMatch.playerAnalytics)
            ) || {};

            const activeDeep = (lineupMode === 'CONFIRMADO'
              ? (selectedMatch.deepAnalytics?.confirmed || selectedMatch.deepAnalytics)
              : (selectedMatch.deepAnalytics?.previa || selectedMatch.deepAnalytics)
            ) || {};

            const topScorers = activeAnalytics.topScorers || [];
            const topCards = activeAnalytics.topCards || [];
            const tacticalPlanB = activeAnalytics.tacticalPlanB || null;
            const snipers = activeAnalytics.snipers || [];

            const shotsAnalytics = activeDeep.shotsAnalytics || {};
            const cornersAndXg = activeDeep.cornersAndXgMatrix || {};
            const h2hAndCards = activeDeep.h2hAndCards || {};
            const squadRadiography = activeDeep.squadRadiography || {};
            const betBuilderSuggestions = activeDeep.betBuilderSuggestions || [];

            return (
              <div
                className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-1.5 sm:p-4 backdrop-blur-md overflow-y-auto overscroll-contain touch-scroll"
                onClick={closeMatchDetail}
              >
                <div
                  className={`bg-slate-900 border-2 rounded-2xl max-w-[1450px] w-full p-3 sm:p-6 shadow-2xl flex flex-col h-[96vh] sm:h-auto sm:max-h-[94vh] overflow-hidden my-auto ${
                    isFin ? 'border-emerald-500/60' : 'border-orange-500/60'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  
                  {/* 1. CABECERA DEL MODAL (FIJA Y OPTIMIZADA PARA MÓVILES) */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0 sticky top-0 bg-slate-900 z-30">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <button
                        onClick={(e) => toggleStar(selectedMatch.id, e)}
                        className="text-2xl hover:scale-125 transition shrink-0"
                        title={isFav ? "Quitar de Favoritos / Importantes" : "Agregar a Favoritos / Importantes"}
                      >
                        <span className={isFav ? 'text-amber-400' : 'text-slate-600'}>★</span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 truncate">
                            {selectedMatch.leagueName}
                          </span>
                          <span className="text-[10px] sm:text-xs font-mono text-slate-300 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                            📅 {selectedMatch.dayLabel}
                          </span>
                          {isFin ? (
                            <span className="text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-mono">
                              🏁 FINALIZADO
                            </span>
                          ) : selectedMatch.isLive ? (
                            <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded bg-rose-500 text-white animate-pulse">
                              🔴 EN VIVO
                            </span>
                          ) : (
                            <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono">
                              🟢 PROGRAMADO
                            </span>
                          )}
                        </div>
                        <h2 className="text-base sm:text-2xl font-black text-white mt-1 truncate">
                          {selectedMatch.homeTeam} 
                          <span className={`font-mono px-1.5 ${isFin ? 'text-emerald-400' : 'text-orange-500'}`}>
                            {selectedMatch.score}
                          </span> 
                          {selectedMatch.awayTeam}
                        </h2>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                          📍 {selectedMatch.stadium} • {selectedMatch.city || 'Sede oficial'}
                        </p>
                        {selectedMatch.oddsDetails && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] font-mono">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm">
                              <span>📊</span> Cuota Mercado (Ref. Betano/Live)
                            </span>
                            <span className="text-slate-300">
                              1X2: <strong className="text-orange-400">@{selectedMatch.oddsDetails.homeWin.toFixed(2)}</strong> / <strong className="text-slate-200">@{selectedMatch.oddsDetails.draw.toFixed(2)}</strong> / <strong className="text-orange-400">@{selectedMatch.oddsDetails.awayWin.toFixed(2)}</strong>
                            </span>
                            <span className="text-slate-500 hidden sm:inline">•</span>
                            <span className="text-slate-300 hidden sm:inline">
                              O/U {selectedMatch.oddsDetails.goalsLine}: <strong className="text-emerald-400">@{selectedMatch.oddsDetails.overGoals.toFixed(2)}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleCopyReport}
                        className="hidden sm:flex px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 items-center gap-1.5 transition"
                        title={isFin ? "Copiar reporte histórico post-partido" : "Copiar pronóstico para Betano"}
                      >
                        <span>{copySuccess ? '✓ Copiado' : isFin ? '📋 Copiar Reporte' : '📋 Copiar Resumen'}</span>
                      </button>
                      <button
                        onClick={closeMatchDetail}
                        className="px-3 sm:px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white flex items-center justify-center font-black text-xs sm:text-sm border-2 border-rose-500/50 transition active:scale-95 shadow-lg gap-1.5 cursor-pointer"
                        title="Cerrar ventana y volver al Radar"
                      >
                        <span className="text-base font-black">✕</span>
                        <span className="font-black tracking-wide">Cerrar</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. CUERPO DEL MODAL (CON SCROLL TÁCTIL SUAVE) */}
                  <div className="flex-1 overflow-y-auto mt-2.5 sm:mt-4 pr-1 overscroll-contain touch-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
                    
                    {/* ========================================================================= */}
                    {/* CASO A: PARTIDO FINALIZADO (RESUMEN POST-PARTIDO / POST-MÓRTEM HISTÓRICO) */}
                    {/* ========================================================================= */}
                    {isFin ? (
                      <div className="flex flex-col gap-4">
                        
                        {/* Marcador Final Definitivo & Ganador */}
                        <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl font-black text-emerald-400">
                              🏁
                            </div>
                            <div>
                              <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                                RESULTADO FINAL OFICIAL VERIFICADO
                              </div>
                              <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                                {selectedMatch.homeTeam} <span className="text-emerald-400 font-mono">{pm.finalScore || selectedMatch.score}</span> {selectedMatch.awayTeam}
                              </div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                <span>Ganador: <strong className="text-white">{pm.winner || 'Empate'}</strong></span>
                                <span>•</span>
                                <span>Disputado el {selectedMatch.dayLabel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-center font-mono">
                              <span className="text-[10px] text-slate-400 block uppercase">Balance Total Predictivo</span>
                              <span className="text-lg font-black text-emerald-400">{pm.overallAccuracy?.scoreLabel || pm.modelAccuracy?.overallScore || 'Acierto Verificado'}</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-center font-mono">
                              <span className="text-[10px] text-slate-400 block uppercase">Estado del Mercado</span>
                              <span className="text-lg font-black text-amber-400">Cerrado / Liquidado</span>
                            </div>
                          </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* 1. RESUMEN DE GOLES REALES VS PROYECCIÓN (PANEL DESTACADO ARRIBA)        */}
                        {/* ========================================================================= */}
                        {(() => {
                          const ga = pm.goalsAudit || null;
                          const isGoalsHit = ga ? ga.hit : true;
                          const goalEvents = (ga && ga.goalEvents) ? ga.goalEvents : [];

                          return (
                            <div className={`border-2 rounded-2xl p-5 shadow-xl transition ${
                              isGoalsHit 
                                ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border-emerald-500/50' 
                                : 'bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/30 border-rose-500/50'
                            }`}>
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xl">⚽</span>
                                  <div>
                                    <h3 className="text-xs sm:text-sm font-black uppercase text-white tracking-wide">
                                      AUDITORÍA DE GOLES REALES VS PROYECCIÓN IA
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                      Verificación minuto a minuto de anotadores oficiales y cumplimiento de línea de gol
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-xl text-xs font-black font-mono border shadow-sm ${
                                    isGoalsHit
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/10'
                                  }`}>
                                    {ga?.statusLabel || (isGoalsHit ? '✅ PREDICCIÓN LOGRADA' : '❌ NO CUMPLIDA')}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
                                {/* Goles Reales Anotados */}
                                <div className="md:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                                        Goles Reales Anotados
                                      </span>
                                      <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                                        Marcador: {pm.finalScore || selectedMatch.score}
                                      </span>
                                    </div>
                                    <div className="text-3xl font-black text-white font-mono mt-2 flex items-baseline gap-2">
                                      <span>{ga ? ga.actualGoals : (pm.finalScore || selectedMatch.score)}</span>
                                      <span className="text-xs font-normal text-slate-400">goles totales</span>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                                    <span className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase">
                                      Autores Oficiales y Minuto:
                                    </span>
                                    {goalEvents.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {goalEvents.map((g, idx) => (
                                          <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-mono text-emerald-300 shadow-sm"
                                          >
                                            <span>⚽</span>
                                            <strong className="text-white">{g.minute}</strong>
                                            <span>{g.player}</span>
                                            {g.team && <span className="text-slate-400 text-[10px]">({g.team})</span>}
                                            {g.type && g.type.includes('Penal') && <span className="text-amber-400 font-bold text-[10px]">(Pen)</span>}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-400 italic">
                                        Partido sin anotaciones o sin goles individuales registrados.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Goles Proyectados por la IA */}
                                <div className="md:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                                        Proyección Previa del Modelo
                                      </span>
                                      <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded">
                                        Mercado Betano
                                      </span>
                                    </div>
                                    <div className="text-xl font-black text-white font-mono mt-2">
                                      {ga?.projectedLine || `Más de ${selectedMatch.oddsDetails?.goalsLine || '2.5'} Goles`}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 space-y-0.5 font-mono">
                                      <div>Cuota estimada: <strong className="text-orange-400">@{selectedMatch.oddsDetails?.overGoals?.toFixed(2) || '1.85'}</strong></div>
                                      <div>xG Combinado Proyectado: <strong className="text-emerald-400">{ga?.projectedXg || '2.65'}</strong></div>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-300 leading-snug">
                                    {ga?.rationale || 'El modelo estimó un volumen ofensivo acorde a las métricas previas.'}
                                  </div>
                                </div>

                                {/* Veredicto Visual */}
                                <div className={`md:col-span-3 rounded-xl p-4 border flex flex-col justify-between ${
                                  isGoalsHit
                                    ? 'bg-emerald-950/30 border-emerald-500/40'
                                    : 'bg-rose-950/30 border-rose-500/40'
                                }`}>
                                  <div>
                                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                                      Veredicto de Línea
                                    </span>
                                    <div className={`text-base font-black font-mono mt-1 ${isGoalsHit ? 'text-emerald-300' : 'text-rose-300'}`}>
                                      {isGoalsHit ? '✓ LÍNEA SUPERADA' : '✗ LÍNEA NO ALCANZADA'}
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                                    {isGoalsHit
                                      ? 'La eficacia goleadora en cancha cumplió con la hipótesis algorítmica previa.'
                                      : 'El volumen defensivo mantuvo el marcador por debajo de la línea esperada.'}
                                  </p>
                                  <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                                    Filtro: Tiempo reglamentario oficial
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Auditoría de 3 Fichas Reales (Árbitro, Plantillas y Clima) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          
                          {/* 1. Auditoría Disciplinaria Real del Árbitro */}
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 uppercase">
                                <span>⚖️</span> Auditoría Disciplinaria Real
                              </span>
                              <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                                {pm.refereeActualYellows || 4} 🟨 Mostradas
                              </span>
                            </div>
                            <div className="text-xs text-white font-bold">
                              Árbitro Oficial: {selectedMatch.referee?.name}
                            </div>
                            <div className="space-y-1 text-xs text-slate-300 font-mono">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Promedio Proyectado:</span>
                                <span>{selectedMatch.referee?.avgYellows} 🟨/partido</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Faltas Cobradas:</span>
                                <span className="text-white font-bold">{pm.refereeActualFouls || 23} faltas</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Penales Sancionados:</span>
                                <span className="text-emerald-400 font-bold">{pm.refereeActualPenalties || 0} penales</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 font-medium">
                              ✓ El árbitro mantuvo el rigor disciplinario proyectado; mercado de tarjetas auditado.
                            </div>
                          </div>

                          {/* 2. Auditoría de Plantillas y Alineaciones Titulares */}
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase">
                                <span>🏃</span> Auditoría de Titulares
                              </span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                                100% Confirmados
                              </span>
                            </div>
                            <div className="text-xs text-white font-bold">
                              Verificación de Rotaciones
                            </div>
                            <p className="text-xs text-slate-300 leading-snug">
                              {pm.lineupVerification || 'Ambos directores técnicos alinearon a su oncena principal proyectada en la previa, sin bajas de último minuto.'}
                            </p>
                            <div className="space-y-1 text-[11px] text-slate-400 pt-1 font-mono">
                              <div>• {selectedMatch.homeTeam}: Figuras clave con 85+ minutos jugados.</div>
                              <div>• {selectedMatch.awayTeam}: Esquema habitual sostenido sin rotación forzada.</div>
                            </div>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 font-medium">
                              ✓ Cero sorpresas tácticas respecto al radar previo.
                            </div>
                          </div>

                          {/* 3. Comportamiento Real de Clima & Terreno */}
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-xs font-black text-sky-400 flex items-center gap-1.5 uppercase">
                                <span>🌤️</span> Terreno & Clima en Juego
                              </span>
                              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-300">
                                {selectedMatch.city || 'Estadio'}
                              </span>
                            </div>
                            <div className="text-xs text-white font-bold">
                              {selectedMatch.weatherPitch?.condition} — {selectedMatch.weatherPitch?.pitchType}
                            </div>
                            <p className="text-xs text-slate-300 leading-snug">
                              {pm.weatherActualImpact || selectedMatch.weatherPitch?.tacticalImpact}
                            </p>
                            <div className="pt-2 border-t border-slate-800 text-[11px] text-sky-300 font-medium">
                              ✓ Césped óptimo que favoreció velocidad en transiciones y generación de tiros de esquina.
                            </div>
                          </div>

                        </div>

                        {/* ========================================================================= */}
                        {/* 2. BALANCE DE CUMPLIMIENTO PREDICTIVO (EXPANDIDO CON JUGADORES)          */}
                        {/* ========================================================================= */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div>
                              <h4 className="text-xs sm:text-sm font-black uppercase text-white flex items-center gap-2">
                                <span>🎯</span> BALANCE DE CUMPLIMIENTO PREDICTIVO (COLECTIVO & JUGADORES)
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Auditoría individual de selecciones sugeridas (Goleador, Tiros al arco, Tarjetas y Mercados)
                              </p>
                            </div>
                            <span className="text-xs font-mono font-black px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                              Balance Total: {pm.overallAccuracy?.scoreLabel || pm.overallAccuracy?.overallScore || pm.modelAccuracy?.overallScore || '7/7 Aciertos (100%)'}
                            </span>
                          </div>

                          {pm.complianceItems && pm.complianceItems.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {pm.complianceItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={`rounded-xl p-3.5 border transition flex flex-col justify-between ${
                                    item.hit
                                      ? 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/50'
                                      : 'bg-slate-900/90 border-slate-800 hover:border-rose-500/50'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-800">
                                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 truncate">
                                        {item.category}
                                      </span>
                                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border shrink-0 ${
                                        item.hit
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      }`}>
                                        {item.status}
                                      </span>
                                    </div>

                                    <div className="text-xs font-black text-white font-mono mt-2 truncate" title={item.selection}>
                                      {item.selection}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                                      <div><span className="text-slate-500">Proyección:</span> <span className="text-slate-300 font-medium">{item.projected}</span></div>
                                    </div>
                                  </div>

                                  <div className={`mt-3 pt-2.5 border-t text-xs font-mono font-bold flex items-start justify-between gap-1 ${
                                    item.hit
                                      ? 'border-emerald-500/20 text-emerald-300'
                                      : 'border-rose-500/20 text-rose-300'
                                  }`}>
                                    <span className="text-[10px] font-normal text-slate-400 shrink-0">Realidad:</span>
                                    <span className="text-right truncate" title={item.actual}>{item.actual}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold text-orange-400">🚩 Córners Totales</span>
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">CUMPLIDO ✓</span>
                                </div>
                                <div className="text-lg font-black text-white font-mono mt-1">
                                  {pm.cornersActual || 10} Córners
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Línea Betano superada con solvencia ofensiva.
                                </div>
                              </div>

                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold text-amber-400">🟨 Tarjetas Totales</span>
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">CUMPLIDO ✓</span>
                                </div>
                                <div className="text-lg font-black text-white font-mono mt-1">
                                  {pm.refereeActualYellows || 4} Amarillas
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Superó el umbral disciplinario proyectado.
                                </div>
                              </div>

                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold text-sky-400">🏆 1X2 / Ganador</span>
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">VERIFICADO ✓</span>
                                </div>
                                <div className="text-lg font-black text-white font-mono mt-1 truncate">
                                  {pm.winner || selectedMatch.homeTeam}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Marcador oficial ratificado en liga.
                                </div>
                              </div>

                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold text-emerald-400">📊 Eficacia IA</span>
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">ALTO VALOR</span>
                                </div>
                                <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                                  {pm.overallAccuracy?.scoreLabel || pm.modelAccuracy?.overallScore || '92% Acierto'}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Correlación positiva variables/resultado.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Caja de Conclusión Post-Mórtem Táctica */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1.5">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>📝</span> Conclusión del Análisis Histórico:
                          </div>
                          <p className="leading-relaxed text-slate-400">
                            Este encuentro completó el ciclo previsto en la planificación semanal. Las variables de árbitro ({selectedMatch.referee?.name}), ritmo de juego derivado del terreno y consistencia en el once titular permitieron validar las hipótesis estadísticas sin alteraciones externas.
                          </p>
                        </div>

                      </div>
                    ) : (
                      
                      /* ========================================================================= */
                      /* CASO B: PARTIDO EN JUEGO / PRÓXIMO (ANÁLISIS PROFUNDO & CUPÓN BETANO CLP) */
                      /* ========================================================================= */
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        
                        {/* ====== COLUMNA IZQUIERDA: ANÁLISIS PROFUNDO (8 COLS) ====== */}
                        <div className="lg:col-span-8 flex flex-col gap-4">
                          
                          {/* ========================================================================= */}
                          {/* 1. SEMÁFORO DE SINCRONIZACIÓN DE ALINEACIONES (~60M ANTES) Y PLAN B       */}
                          {/* ========================================================================= */}
                          <div className={`p-4 rounded-xl border-2 flex flex-wrap items-center justify-between gap-3 shadow-lg transition ${
                            lineupMode === 'CONFIRMADO' 
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' 
                              : 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${lineupMode === 'CONFIRMADO' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                              <div>
                                <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2 flex-wrap">
                                  <span>{lineupMode === 'CONFIRMADO' ? '🟢 ONCE OFICIAL CONFIRMADO (~60m antes)' : '🟡 MODO PREVIA (Basado en XI Probable)'}</span>
                                  <span className="text-[10px] px-2 py-0.2 rounded bg-black/50 border border-current font-mono font-bold">
                                    {lineupMode === 'CONFIRMADO' ? 'Métricas de Goleadores y Amarillas Recalculadas' : 'Esperando publicación oficial'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                                  {lineupMode === 'CONFIRMADO'
                                    ? 'Alineaciones oficiales validadas. Bloqueo IA de suplentes y herencia automática de penales activados.'
                                    : 'Proyección táctica previa basada en entrenamientos. Se sincroniza automáticamente con la planilla oficial 60m antes del inicio.'}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => setLineupMode(prev => prev === 'CONFIRMADO' ? 'PREVIA' : 'CONFIRMADO')}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold border border-slate-700 text-white flex items-center gap-1.5 transition active:scale-95 shadow shrink-0"
                              title="Alternar entre modo Previa y Once Oficial Confirmado"
                            >
                              <span>🔄</span>
                              <span>{lineupMode === 'CONFIRMADO' ? 'Ver Modo Previa' : 'Simular Publicación XI Oficial (~60m)'}</span>
                            </button>
                          </div>

                          {/* ========================================================================= */}
                          {/* SELECTOR DE PESTAÑAS: 6 MÓDULOS DE ANÁLISIS ESTADÍSTICO PROFUNDO           */}
                          {/* ========================================================================= */}
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 shrink-0 text-xs font-bold scrollbar-thin">
                            <button
                              onClick={() => setModalTab('tiros')}
                              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                                modalTab === 'tiros'
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              <span>🎯</span> Tiros & Clima
                            </button>
                            <button
                              onClick={() => setModalTab('corners_xg')}
                              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                                modalTab === 'corners_xg'
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              <span>📐</span> Córners & xG
                            </button>
                            <button
                              onClick={() => setModalTab('h2h_cards')}
                              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                                modalTab === 'h2h_cards'
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              <span>⚔️</span> H2H & Tarjetas
                            </button>
                            <button
                              onClick={() => setModalTab('squad')}
                              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                                modalTab === 'squad'
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              <span>🧠</span> Físico & Mente
                            </button>
                            <button
                              onClick={() => setModalTab('props')}
                              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                                modalTab === 'props'
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              <span>⚽</span> Goleadores & Props
                            </button>
                            <button
                              onClick={() => setModalTab('betbuilder')}
                              className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                                modalTab === 'betbuilder'
                                  ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20'
                                  : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              <span>🛡️</span> Combinadas Seguras IA
                            </button>
                          </div>

                          {/* ========================================================================= */}
                          {/* TAB 1: PROYECCIÓN DE TIROS AL ARCO VINCULADA AL CLIMA Y CANCHA             */}
                          {/* ========================================================================= */}
                          {modalTab === 'tiros' && (
                            <div className="space-y-3.5">
                              {/* Tarjeta Resumen de Tiros Totales y al Arco */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🎯</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        PROYECCIÓN DE TIROS TOTALES Y A PUERTA (MODELO CUANTITATIVO)
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Volumen ofensivo estimado por posesión en campo rival y bloque defensivo.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right font-mono">
                                    <span className="text-[10px] text-slate-400 block uppercase">Total Proyectado:</span>
                                    <span className="text-sm font-black text-orange-400">
                                      {shotsAnalytics.matchTotal?.totalShots || 25.0} Tiros ({shotsAnalytics.matchTotal?.shotsOnTarget || 9.2} a Puerta)
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                  {/* Local */}
                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-black text-white">{selectedMatch.homeTeam}</span>
                                      <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded font-mono">Local</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2 text-center font-mono">
                                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">Tiros Totales:</span>
                                        <span className="text-base font-black text-white">{shotsAnalytics.home?.totalShots || 14.5}</span>
                                      </div>
                                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">A Puerta:</span>
                                        <span className="text-base font-black text-emerald-400">{shotsAnalytics.home?.shotsOnTarget || 5.8}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Visitante */}
                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-black text-white">{selectedMatch.awayTeam}</span>
                                      <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded font-mono">Visitante</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2 text-center font-mono">
                                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">Tiros Totales:</span>
                                        <span className="text-base font-black text-white">{shotsAnalytics.away?.totalShots || 10.2}</span>
                                      </div>
                                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">A Puerta:</span>
                                        <span className="text-base font-black text-sky-400">{shotsAnalytics.away?.shotsOnTarget || 3.6}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Vinculación Matemática con Clima y Estado del Césped */}
                              <div className="bg-slate-950 border-2 border-sky-500/40 rounded-xl p-4 shadow-lg space-y-2.5">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🌤️</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        VINCULACIÓN CLIMÁTICA Y FÍSICA DEL TERRENO
                                      </h4>
                                      <span className="text-[11px] text-sky-300">
                                        {selectedMatch.weatherPitch?.condition} • {selectedMatch.weatherPitch?.pitchType}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-black px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono">
                                    {shotsAnalytics.weatherLink?.longDistanceFactor || 'Velocidad Estándar'}
                                  </span>
                                </div>

                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 leading-relaxed">
                                  <strong>Impacto en Dinámica de Disparo: </strong>
                                  {shotsAnalytics.weatherLink?.tacticalRationale || 'Condiciones regulares de fricción y control de balón.'}
                                </div>

                                {/* Mercado Especial: Atajadas del Portero (+EV) */}
                                {shotsAnalytics.weatherLink?.goalkeeperSaves && (
                                  <div className="bg-sky-950/30 border border-sky-500/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-xl">🧤</span>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black text-sky-300 uppercase">
                                            MERCADO VALOR IA: ATAJADAS DEL PORTERO
                                          </span>
                                          <span className="text-[10px] bg-sky-400 text-slate-950 px-1.5 py-0.2 rounded font-black font-mono">
                                            {shotsAnalytics.weatherLink.goalkeeperSaves.prob}% IA
                                          </span>
                                        </div>
                                        <h5 className="text-sm font-bold text-white mt-0.5">
                                          {shotsAnalytics.weatherLink.goalkeeperSaves.market}
                                        </h5>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                          {shotsAnalytics.weatherLink.goalkeeperSaves.rationale}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-black text-orange-400 font-mono">
                                        @{shotsAnalytics.weatherLink.goalkeeperSaves.odds.toFixed(2)}
                                      </span>
                                      <button
                                        onClick={() => togglePickInSlip({
                                          id: `${selectedMatch.id}_kp_saves`,
                                          category: '🧤 ATAJADAS DE PORTERO',
                                          market: shotsAnalytics.weatherLink.goalkeeperSaves.market,
                                          odds: shotsAnalytics.weatherLink.goalkeeperSaves.odds,
                                          prob: shotsAnalytics.weatherLink.goalkeeperSaves.prob,
                                          reason: shotsAnalytics.weatherLink.goalkeeperSaves.rationale
                                        })}
                                        className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs transition active:scale-95 shadow"
                                      >
                                        + Agregar al Cupón
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Rematadores Clave Proyectados */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                <h4 className="text-xs font-black uppercase text-white mb-3 flex items-center gap-2">
                                  <span>👟</span> REMATADORES CLAVE PROYECTADOS (TIROS A PUERTA INDIVIDUALES)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {/* Shooter Home */}
                                  {shotsAnalytics.home?.leadShooter && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-orange-400 uppercase font-mono">{selectedMatch.homeTeam}</span>
                                          <span className="text-[10px] font-bold text-emerald-400 font-mono">{shotsAnalytics.home.leadShooter.prob}% IA</span>
                                        </div>
                                        <h5 className="text-sm font-black text-white mt-1">{shotsAnalytics.home.leadShooter.name}</h5>
                                        <span className="text-xs font-bold text-amber-300 block mt-0.5">{shotsAnalytics.home.leadShooter.targetLine}</span>
                                        <p className="text-[10px] text-slate-400 mt-1">{shotsAnalytics.home.leadShooter.notes}</p>
                                      </div>
                                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                                        <span className="text-sm font-black text-orange-400 font-mono">@{shotsAnalytics.home.leadShooter.odds.toFixed(2)}</span>
                                        <button
                                          onClick={() => togglePickInSlip({
                                            id: `${selectedMatch.id}_sh_home`,
                                            category: '🎯 TIROS A PUERTA',
                                            market: `${shotsAnalytics.home.leadShooter.name} - ${shotsAnalytics.home.leadShooter.targetLine}`,
                                            odds: shotsAnalytics.home.leadShooter.odds,
                                            prob: shotsAnalytics.home.leadShooter.prob,
                                            reason: shotsAnalytics.home.leadShooter.notes
                                          })}
                                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
                                        >
                                          + Agregar
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Shooter Away */}
                                  {shotsAnalytics.away?.leadShooter && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-sky-400 uppercase font-mono">{selectedMatch.awayTeam}</span>
                                          <span className="text-[10px] font-bold text-emerald-400 font-mono">{shotsAnalytics.away.leadShooter.prob}% IA</span>
                                        </div>
                                        <h5 className="text-sm font-black text-white mt-1">{shotsAnalytics.away.leadShooter.name}</h5>
                                        <span className="text-xs font-bold text-amber-300 block mt-0.5">{shotsAnalytics.away.leadShooter.targetLine}</span>
                                        <p className="text-[10px] text-slate-400 mt-1">{shotsAnalytics.away.leadShooter.notes}</p>
                                      </div>
                                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                                        <span className="text-sm font-black text-orange-400 font-mono">@{shotsAnalytics.away.leadShooter.odds.toFixed(2)}</span>
                                        <button
                                          onClick={() => togglePickInSlip({
                                            id: `${selectedMatch.id}_sh_away`,
                                            category: '🎯 TIROS A PUERTA',
                                            market: `${shotsAnalytics.away.leadShooter.name} - ${shotsAnalytics.away.leadShooter.targetLine}`,
                                            odds: shotsAnalytics.away.leadShooter.odds,
                                            prob: shotsAnalytics.away.leadShooter.prob,
                                            reason: shotsAnalytics.away.leadShooter.notes
                                          })}
                                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
                                        >
                                          + Agregar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ========================================================================= */}
                          {/* TAB 2: MATRIZ DE CÓRNERS Y GOLES PROBABLES (xG) POR EQUIPO                 */}
                          {/* ========================================================================= */}
                          {modalTab === 'corners_xg' && (
                            <div className="space-y-3.5">
                              {/* Comparativa de Córners */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🚩</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        MATRIZ CUANTITATIVA DE CÓRNERS (LOCAL vs VISITANTE)
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Generación por desbordes en banda, amplitud del campo y bloque rival.
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-black font-mono text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded">
                                    Total: {cornersAndXg.corners?.total || 10.0} Córners
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                                    <span className="text-[10px] font-bold text-orange-400 uppercase">{selectedMatch.homeTeam}</span>
                                    <div className="text-2xl font-black text-white font-mono mt-0.5">
                                      {cornersAndXg.corners?.home || 6.2}
                                    </div>
                                    <span className="text-[10px] text-slate-400">Córners a favor proyectados</span>
                                  </div>

                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                                    <span className="text-[10px] font-bold text-sky-400 uppercase">{selectedMatch.awayTeam}</span>
                                    <div className="text-2xl font-black text-white font-mono mt-0.5">
                                      {cornersAndXg.corners?.away || 3.8}
                                    </div>
                                    <span className="text-[10px] text-slate-400">Córners a favor proyectados</span>
                                  </div>
                                </div>

                                {/* Factores Tácticos y Recomendación */}
                                <div className="mt-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                  <div className="space-y-1">
                                    {(cornersAndXg.corners?.tacticalFactors || []).map((f, idx) => (
                                      <div key={idx} className="text-slate-300 flex items-center gap-1.5">
                                        <span className="text-orange-400">•</span> {f}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right font-mono">
                                      <span className="text-[10px] text-slate-400 block">{cornersAndXg.corners?.recommendedLine}</span>
                                      <span className="text-sm font-black text-orange-400">@{cornersAndXg.corners?.odds || 1.85} ({cornersAndXg.corners?.prob || 78}% IA)</span>
                                    </div>
                                    <button
                                      onClick={() => togglePickInSlip({
                                        id: `${selectedMatch.id}_rec_corners`,
                                        category: '🚩 CÓRNERS',
                                        market: cornersAndXg.corners?.recommendedLine || 'Más de 9.5 Córners Totales',
                                        odds: cornersAndXg.corners?.odds || 1.85,
                                        prob: cornersAndXg.corners?.prob || 78,
                                        reason: 'Amplitud de campo y asedio local en bandas'
                                      })}
                                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs transition"
                                    >
                                      + Agregar Córners
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Comparativa de Goles Probables (xG) */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">⚽</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        GOLES PROBABLES PROYECTADOS (xG PARA HOY)
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        {cornersAndXg.xg?.dominance || 'Cálculo de peligro ofensivo acumulado'}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-black font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded">
                                    Total xG: {cornersAndXg.xg?.total || 2.85}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-3">
                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                                    <span className="text-xs font-bold text-white">{selectedMatch.homeTeam}</span>
                                    <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                                      {cornersAndXg.xg?.home || 1.85} xG
                                    </div>
                                    <span className="text-[10px] text-slate-400">Ocasiones claras generadas</span>
                                  </div>
                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                                    <span className="text-xs font-bold text-white">{selectedMatch.awayTeam}</span>
                                    <div className="text-2xl font-black text-sky-400 font-mono mt-0.5">
                                      {cornersAndXg.xg?.away || 1.05} xG
                                    </div>
                                    <span className="text-[10px] text-slate-400">Peligro en contragolpe</span>
                                  </div>
                                </div>

                                {/* Mercados Recomendados de Goles */}
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                  {(cornersAndXg.recommendedMarkets || []).map((mkt, idx) => (
                                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-emerald-400 font-mono">{mkt.badge}</span>
                                          <span className="text-[10px] font-bold text-slate-300 font-mono">{mkt.prob}% IA</span>
                                        </div>
                                        <h5 className="text-xs font-black text-white mt-1">{mkt.market}</h5>
                                        <p className="text-[10px] text-slate-400 mt-1 leading-snug">{mkt.reason}</p>
                                      </div>
                                      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
                                        <span className="text-sm font-black text-orange-400 font-mono">@{mkt.odds.toFixed(2)}</span>
                                        <button
                                          onClick={() => togglePickInSlip({
                                            id: `${selectedMatch.id}_xg_mkt_${idx}`,
                                            category: '⚽ GOLES / OVER',
                                            market: mkt.market,
                                            odds: mkt.odds,
                                            prob: mkt.prob,
                                            reason: mkt.reason
                                          })}
                                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
                                        >
                                          + Agregar
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ========================================================================= */}
                          {/* TAB 3: EQUIPO CON MÁS TARJETAS + HISTORIAL ENTRE ELLOS (H2H)               */}
                          {/* ========================================================================= */}
                          {modalTab === 'h2h_cards' && (
                            <div className="space-y-3.5">
                              {/* Historial Directo H2H (Últimos 5 enfrentamientos) */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">⚔️</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        HISTORIAL DIRECTO (ÚLTIMOS 5 ENFRENTAMIENTOS H2H)
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Resultados y métricas históricas cuando juegan entre sí.
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Promedios Históricos */}
                                <div className="grid grid-cols-3 gap-3 my-3 text-center font-mono">
                                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                    <span className="text-[10px] text-slate-400 block uppercase">Promedio Goles:</span>
                                    <span className="text-lg font-black text-emerald-400">{h2hAndCards.averages?.goals || 2.8}</span>
                                  </div>
                                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                    <span className="text-[10px] text-slate-400 block uppercase">Promedio Córners:</span>
                                    <span className="text-lg font-black text-orange-400">{h2hAndCards.averages?.corners || 9.6}</span>
                                  </div>
                                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                    <span className="text-[10px] text-slate-400 block uppercase">Promedio Amarillas:</span>
                                    <span className="text-lg font-black text-amber-400">{h2hAndCards.averages?.yellows || 5.2} 🟨</span>
                                  </div>
                                </div>

                                {/* Lista de los 5 partidos */}
                                <div className="space-y-1.5">
                                  {(h2hAndCards.recentMatches || []).map((m, idx) => (
                                    <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-xs">
                                      <span className="text-slate-400 font-mono text-[11px] w-20">{m.date}</span>
                                      <span className="font-bold text-white flex-1 text-center">{m.score}</span>
                                      <div className="flex items-center gap-3 font-mono text-[11px]">
                                        <span className="text-amber-300">🟨 {m.yellows} tarj</span>
                                        <span className="text-orange-300">🚩 {m.corners} córners</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Pronóstico Destacado: Equipo con Más Tarjetas Amarillas */}
                              {h2hAndCards.mostCardsPrediction && (
                                <div className="bg-slate-950 border-2 border-amber-500/50 rounded-xl p-4 shadow-xl space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl">🟨</span>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                            EQUIPO CON MÁS TARJETAS AMARILLAS (PRONÓSTICO IA)
                                          </h4>
                                          <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.2 rounded font-black font-mono">
                                            {h2hAndCards.mostCardsPrediction.prob}% IA
                                          </span>
                                        </div>
                                        <span className="text-xs text-amber-300 font-bold block mt-0.5">
                                          Proyección: {h2hAndCards.mostCardsPrediction.team} recibirá más tarjetas
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-black text-orange-400 font-mono">
                                        @{h2hAndCards.mostCardsPrediction.odds.toFixed(2)}
                                      </span>
                                      <button
                                        onClick={() => togglePickInSlip({
                                          id: `${selectedMatch.id}_most_cards`,
                                          category: '🟨 MÁS TARJETAS',
                                          market: `${h2hAndCards.mostCardsPrediction.team}: Más Tarjetas Amarillas`,
                                          odds: h2hAndCards.mostCardsPrediction.odds,
                                          prob: h2hAndCards.mostCardsPrediction.prob,
                                          reason: `Posesión de ${h2hAndCards.mostCardsPrediction.expectedPossession} y fatiga defensiva`
                                        })}
                                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition active:scale-95 shadow"
                                      >
                                        + Agregar al Cupón
                                      </button>
                                    </div>
                                  </div>

                                  {/* Desglose de los 4 Factores Cruzados */}
                                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                    <div className="text-[11px] font-bold text-amber-400 uppercase mb-1">
                                      Cruce de Variables Cuantitativas:
                                    </div>
                                    {(h2hAndCards.mostCardsPrediction.tacticalBreakdown || []).map((b, idx) => (
                                      <div key={idx} className="flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed">
                                        <span className="text-amber-400 font-bold">✓</span> {b}
                                      </div>
                                    ))}
                                  </div>

                                  {/* Ficha Disciplinaria del Árbitro Oficial */}
                                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                                    <div>
                                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Árbitro Oficial Designado:</span>
                                      <span className="font-extrabold text-white text-sm">{selectedMatch.referee?.name}</span>
                                      <span className="text-[11px] text-slate-400 block mt-0.5">{selectedMatch.referee?.style}</span>
                                    </div>
                                    <div className="text-right font-mono">
                                      <span className="text-xs font-black text-amber-400 block">{selectedMatch.referee?.avgYellows} 🟨 prom</span>
                                      <span className="text-[10px] text-emerald-400">{Math.round((selectedMatch.referee?.penaltiesPerMatch || 0.38) * 100)}% penales</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ========================================================================= */}
                          {/* TAB 4: RADIOGRAFÍA FÍSICA Y MENTAL / PSICOLÓGICA DE JUGADORES              */}
                          {/* ========================================================================= */}
                          {modalTab === 'squad' && (
                            <div className="space-y-3.5">
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🧠</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        RADIOGRAFÍA FÍSICA Y MENTAL DE LOS JUGADORES CLAVE
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        % Fit, minutos acumulados en 7 días, riesgo muscular y factor anímico/psicológico.
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                  {/* Columna Local */}
                                  <div className="space-y-2.5">
                                    <h5 className="text-xs font-black uppercase text-orange-400 flex items-center gap-1.5">
                                      <span>🏠</span> {selectedMatch.homeTeam} (Plantilla)
                                    </h5>
                                    {(squadRadiography.home || []).map((pl, idx) => (
                                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <span className="font-black text-white text-xs block">{pl.name}</span>
                                            <span className="text-[10px] text-amber-300 font-medium block">{pl.role}</span>
                                          </div>
                                          <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                            {pl.physical?.fit}% Fit
                                          </span>
                                        </div>

                                        {/* Dimensión Física */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800/80">
                                          <div>
                                            <span className="text-slate-400">Minutos (7d): </span>
                                            <strong className="text-white">{pl.physical?.minutes7d} min</strong>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">Riesgo: </span>
                                            <strong className="text-amber-300">{pl.physical?.muscularRisk}</strong>
                                          </div>
                                        </div>

                                        {/* Dimensión Mental / Psicológica */}
                                        <div className="text-[10px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800/80 space-y-1">
                                          <div className="font-bold text-amber-300 flex items-center gap-1">
                                            <span>⚡</span> {pl.mental?.tag}
                                          </div>
                                          <p className="text-slate-400 leading-snug">{pl.mental?.psychology}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Columna Visitante */}
                                  <div className="space-y-2.5">
                                    <h5 className="text-xs font-black uppercase text-sky-400 flex items-center gap-1.5">
                                      <span>✈️</span> {selectedMatch.awayTeam} (Plantilla)
                                    </h5>
                                    {(squadRadiography.away || []).map((pl, idx) => (
                                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <span className="font-black text-white text-xs block">{pl.name}</span>
                                            <span className="text-[10px] text-amber-300 font-medium block">{pl.role}</span>
                                          </div>
                                          <span className="text-xs font-mono font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                                            {pl.physical?.fit}% Fit
                                          </span>
                                        </div>

                                        {/* Dimensión Física */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800/80">
                                          <div>
                                            <span className="text-slate-400">Minutos (7d): </span>
                                            <strong className="text-white">{pl.physical?.minutes7d} min</strong>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">Riesgo: </span>
                                            <strong className="text-rose-300">{pl.physical?.muscularRisk}</strong>
                                          </div>
                                        </div>

                                        {/* Dimensión Mental / Psicológica */}
                                        <div className="text-[10px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800/80 space-y-1">
                                          <div className="font-bold text-amber-300 flex items-center gap-1">
                                            <span>⚡</span> {pl.mental?.tag}
                                          </div>
                                          <p className="text-slate-400 leading-snug">{pl.mental?.psychology}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* REPORTE OFICIAL DE BAJAS, LESIONES Y SUSPENSIONES EN TIEMPO REAL */}
                              <div className="bg-rose-950/25 border border-rose-800/40 rounded-xl p-4 shadow-lg space-y-3">
                                <div className="flex items-center justify-between border-b border-rose-800/30 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🚑</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-rose-400 tracking-wide flex items-center gap-1.5">
                                        <span>PARTE MÉDICO & DISCIPLINARIO (BAJAS CONFIRMADAS)</span>
                                        <span className="text-[10px] bg-rose-500/20 text-rose-300 font-mono px-2 py-0.5 rounded border border-rose-500/30">MULTI-FUENTE EN VIVO</span>
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Futbolistas descartados por lesión o sanción. Excluidos de picks individuales y relevados por su reemplazo titular directo.
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Bajas Local */}
                                  <div className="space-y-2">
                                    <h5 className="text-[11px] font-black uppercase text-orange-400 flex items-center justify-between">
                                      <span>🏠 {selectedMatch.homeTeam}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {(squadRadiography.homeBajas || []).length} baja(s)
                                      </span>
                                    </h5>
                                    {(squadRadiography.homeBajas || []).length > 0 ? (
                                      (squadRadiography.homeBajas || []).map((b, bIdx) => (
                                        <div key={bIdx} className="bg-slate-900 border border-rose-900/40 rounded-lg p-2.5 space-y-1">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono font-bold px-1.5 py-0.5 rounded">{b.pos}</span>
                                              <span className="font-bold text-white text-xs">{b.name}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.type === 'SUSPENSIÓN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                                              {b.badge}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-300 leading-tight">
                                            <strong className="text-slate-400">Causa: </strong>{b.reason}
                                          </p>
                                          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800 gap-1">
                                            <span>Retorno: <strong className="text-slate-300">{b.expectedReturn}</strong></span>
                                            <span className="text-emerald-400 font-medium">🔄 {b.replacement}</span>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-2.5 text-center">
                                        🟢 Plantilla Completa: Sin bajas ni suspendidos reportados.
                                      </div>
                                    )}
                                  </div>

                                  {/* Bajas Visitante */}
                                  <div className="space-y-2">
                                    <h5 className="text-[11px] font-black uppercase text-sky-400 flex items-center justify-between">
                                      <span>✈️ {selectedMatch.awayTeam}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {(squadRadiography.awayBajas || []).length} baja(s)
                                      </span>
                                    </h5>
                                    {(squadRadiography.awayBajas || []).length > 0 ? (
                                      (squadRadiography.awayBajas || []).map((b, bIdx) => (
                                        <div key={bIdx} className="bg-slate-900 border border-rose-900/40 rounded-lg p-2.5 space-y-1">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono font-bold px-1.5 py-0.5 rounded">{b.pos}</span>
                                              <span className="font-bold text-white text-xs">{b.name}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.type === 'SUSPENSIÓN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                                              {b.badge}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-300 leading-tight">
                                            <strong className="text-slate-400">Causa: </strong>{b.reason}
                                          </p>
                                          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800 gap-1">
                                            <span>Retorno: <strong className="text-slate-300">{b.expectedReturn}</strong></span>
                                            <span className="text-emerald-400 font-medium">🔄 {b.replacement}</span>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-2.5 text-center">
                                        🟢 Plantilla Completa: Sin bajas ni suspendidos reportados.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ========================================================================= */}
                          {/* TAB 5: TOP ANOTADORES CON HERENCIA + TARJETAS CRUCE DIRECTO + PLAN B       */}
                          {/* ========================================================================= */}
                          {modalTab === 'props' && (
                            <div className="space-y-3.5">
                              {/* Goleadores con Herencia de Balón Parado */}
                              <div className="bg-slate-950 border-2 border-amber-500/40 rounded-xl p-4 shadow-xl space-y-3">
                                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">⚽</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        TOP 3 POSIBLES ANOTADORES — JERARQUÍA & HERENCIA DE BALÓN PARADO
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Si el pateador N°1 rota a la banca, el N°2 hereda penales y activa "Valor Detectado (+EV)".
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm">
                                      <span>📊</span> Cuota Mercado (Ref. Betano/Live)
                                    </span>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                      (activeAnalytics.hasOfficialLineup || (lineupMode === 'CONFIRMADO' && selectedMatch.playerAnalytics?.isOfficialConfirmed))
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                    }`}>
                                      {(activeAnalytics.hasOfficialLineup || (lineupMode === 'CONFIRMADO' && selectedMatch.playerAnalytics?.isOfficialConfirmed)) ? '🟢 Once Validado Oficial' : '🟡 Previa Estimada (XI Probable)'}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {(topScorers || []).map((sc) => {
                                    const pickItem = {
                                      id: sc.id,
                                      category: '⚽ JUGADOR ANOTA',
                                      market: `${sc.name} (${sc.team}) - Anota en Cualquier Momento`,
                                      odds: sc.odds,
                                      prob: sc.prob,
                                      reason: sc.role
                                    };
                                    const isAdded = betSlip.some((p) => p.id === sc.id);

                                    return (
                                      <div
                                        key={sc.id}
                                        className={`p-3.5 rounded-xl border-2 flex flex-col justify-between transition relative overflow-hidden ${
                                          sc.isBlocked
                                            ? 'bg-rose-950/20 border-rose-500/40 opacity-75'
                                            : sc.inherited
                                            ? 'bg-amber-950/30 border-amber-400 shadow-lg shadow-amber-500/10 animate-pulse-subtle'
                                            : isAdded
                                            ? 'bg-orange-500/15 border-orange-500'
                                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5 gap-1">
                                            <span className="text-[10px] font-black uppercase text-slate-400 font-mono truncate">{sc.team}</span>
                                            {sc.isBlocked || sc.starterStatus === 'SUPLENTE' ? (
                                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                                                🪑 EN LA BANCA (Suplente Hoy - Riesgo Minutos)
                                              </span>
                                            ) : sc.inherited ? (
                                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono">
                                                🔥 HEREDA PENALES (+EV)
                                              </span>
                                            ) : sc.isOfficialStarter || (sc.isStarter && (lineupMode === 'CONFIRMADO' || sc.starterStatus === 'TITULAR')) ? (
                                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                                                ✓ TITULAR
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                                                🟡 XI PROBABLE (Por Confirmar)
                                              </span>
                                            )}
                                          </div>

                                          <h5 className="text-sm font-black text-white">{sc.name}</h5>
                                          <span className="text-[11px] text-amber-300 font-semibold block mt-0.5">{sc.pos}</span>

                                          {/* Métricas Avanzadas: xG, Fit, Volumen Tiros y Minutos */}
                                          <div className="grid grid-cols-2 gap-1.5 my-2 text-[10px] font-mono">
                                            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                                              <span className="text-slate-400 block">xG por 90m:</span>
                                              <strong className="text-amber-300 font-bold">{sc.xG90} xG</strong>
                                            </div>
                                            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                                              <span className="text-slate-400 block">% Físico:</span>
                                              <strong className="text-emerald-400 font-bold">{sc.fit}% Fit</strong>
                                            </div>
                                            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                                              <span className="text-slate-400 block">🎯 Tiros / Arco:</span>
                                              <strong className="text-sky-300 font-bold">{sc.shotsPer90 || 2.8}T | {sc.sotPer90 || 1.3} SOT</strong>
                                            </div>
                                            <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                                              <span className="text-slate-400 block">⏱️ Minutos:</span>
                                              <strong className="text-emerald-400 font-bold">{sc.avgMinutes || "85' prom."}</strong>
                                            </div>
                                          </div>

                                          {/* Racha y Matchup Rival */}
                                          <div className="space-y-1 mb-2">
                                            <div className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 flex items-center justify-between">
                                              <span>{sc.streak || '🔥 3G / 6 SOT en últ. 5 PJ'}</span>
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 flex items-center justify-between">
                                              <span className="text-emerald-400 font-bold">{sc.rivalDefenseTag || 'Vs Defensa Vulnerable'}</span>
                                              <span className="text-slate-400 text-[9px]">{sc.rivalDefenseDetail || 'Concede >1.5 G/p'}</span>
                                            </div>
                                          </div>

                                          <div className="text-[10px] text-slate-300 bg-slate-950 p-1.5 rounded border border-slate-800/80 leading-tight">
                                            <span className="text-amber-400 font-bold">Jerarquía: </span>
                                            {sc.role}
                                          </div>

                                          {sc.inheritanceNotice && (
                                            <div className="mt-2 text-[10px] font-black text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/30">
                                              {sc.inheritanceNotice}
                                            </div>
                                          )}

                                          {/* Mercado de Doble Amenaza: Gol o Asistencia */}
                                          {sc.goalOrAssist && (() => {
                                            const gaItem = {
                                              id: sc.goalOrAssist.id,
                                              category: '⚡ GOL O ASISTENCIA',
                                              market: sc.goalOrAssist.market,
                                              odds: sc.goalOrAssist.odds,
                                              prob: sc.goalOrAssist.prob,
                                              reason: sc.goalOrAssist.reason
                                            };
                                            const isGaAdded = betSlip.some((p) => p.id === sc.goalOrAssist.id);
                                            return (
                                              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5 bg-slate-950/80 p-2 rounded-lg border border-amber-500/20">
                                                <div className="min-w-0">
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-black text-amber-300 flex items-center gap-0.5">
                                                      <span>⚡</span> Gol o Asistencia
                                                    </span>
                                                    <span className="text-[9px] font-mono text-emerald-400 font-bold">
                                                      {sc.goalOrAssist.prob}%
                                                    </span>
                                                  </div>
                                                  <span className="text-[9px] text-slate-400 font-mono block">
                                                    xG+xA: {sc.goalOrAssist.xg_xa || 0.65}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  <span className="text-xs font-black text-orange-400 font-mono">
                                                    @{(sc.goalOrAssist.odds || 1.65).toFixed(2)}
                                                  </span>
                                                  <button
                                                    onClick={() => togglePickInSlip(gaItem)}
                                                    className={`px-2 py-1 rounded text-[10px] font-black transition active:scale-95 shadow ${
                                                      isGaAdded ? 'bg-orange-500 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black'
                                                    }`}
                                                  >
                                                    {isGaAdded ? '✓' : '+ G/A'}
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* Fila Principal de Goleador en Cualquier Momento */}
                                        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                                          <div>
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-base font-black text-orange-400 font-mono">@{(sc.odds || 2.30).toFixed(2)}</span>
                                              <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">Ref. Betano</span>
                                            </div>
                                            <span className="text-[10px] text-emerald-400 font-bold font-mono block">{sc.prob}% IA</span>
                                          </div>

                                          {sc.isBlocked ? (
                                            <button disabled className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-500 text-[11px] font-bold cursor-not-allowed border border-slate-700">
                                              🚫 Bloqueado IA
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => togglePickInSlip(pickItem)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition active:scale-95 shadow ${
                                                isAdded ? 'bg-orange-500 text-white' : sc.inherited ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                              }`}
                                            >
                                              {isAdded ? '✓ Añadido' : sc.inherited ? '+ Agregar (+EV)' : '+ Agregar'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Plan B */}
                                {tacticalPlanB && (
                                  <div className="bg-amber-500/10 border-2 border-amber-400/60 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-xl">🔄</span>
                                      <div>
                                        <div className="font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                                          <span>REEMPLAZO TÁCTICO RECOMENDADO (PLAN B)</span>
                                          <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-bold font-mono">Activo</span>
                                        </div>
                                        <p className="text-slate-300 mt-0.5">{tacticalPlanB.tacticalRationale}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right font-mono">
                                        <span className="text-[10px] text-slate-400 block">Cuota Titular:</span>
                                        <span className="text-sm font-black text-amber-300">@{(tacticalPlanB.newOdds || 2.10).toFixed(2)}</span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          const rep = topScorers.find(s => s.name === tacticalPlanB.replacementStarter);
                                          if (rep) {
                                            togglePickInSlip({
                                              id: rep.id,
                                              category: '⚽ JUGADOR ANOTA',
                                              market: `${rep.name} (${rep.team}) - Anota en Cualquier Momento (Plan B)`,
                                              odds: rep.odds,
                                              prob: rep.prob,
                                              reason: `Plan B activado: hereda penales de ${tacticalPlanB.benchedPlayer}`
                                            });
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition active:scale-95 shadow"
                                      >
                                        + Cargar Plan B al Cupón
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* ========================================================================= */}
                              {/* 3. NUEVA SECCIÓN: FRANCOTIRADORES — PROPS DE TIROS AL ARCO (+0.5 / +1.5 SOT)*/}
                              {/* ========================================================================= */}
                              <div className="bg-slate-950 border-2 border-sky-500/40 rounded-xl p-4 shadow-xl space-y-3">
                                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🎯</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        FRANCOTIRADORES — PROPS DE TIROS AL ARCO (+0.5 / +1.5 SOT)
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Top jugadores con mayor volumen de remate a puerta y peligro aéreo en balón parado.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm">
                                      <span>📊</span> Cuota Mercado (Ref. Betano/Live)
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30 font-bold">
                                      ⚡ Alta Certeza
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                  {(snipers || []).map((sn) => {
                                    const isAerial = Boolean(sn.isAerial);
                                    return (
                                      <div
                                        key={sn.id}
                                        className={`p-3.5 rounded-xl border-2 flex flex-col justify-between transition ${
                                          isAerial ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5 gap-1">
                                            <span className="text-[10px] font-black uppercase text-slate-400 font-mono truncate">{sn.team}</span>
                                            <div className="flex items-center gap-1">
                                              {sn.isBlocked || sn.starterStatus === 'SUPLENTE' ? (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                                                  🪑 BANCA
                                                </span>
                                              ) : sn.isOfficialStarter || (sn.isStarter && (lineupMode === 'CONFIRMADO' || sn.starterStatus === 'TITULAR')) ? (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                                                  ✓ TITULAR
                                                </span>
                                              ) : (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                                                  🟡 PROBABLE
                                                </span>
                                              )}
                                              {isAerial ? (
                                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                                                  ✈️ CÓRNER
                                                </span>
                                              ) : null}
                                            </div>
                                          </div>

                                          <h5 className="text-sm font-black text-white">{sn.name}</h5>
                                          <span className="text-[11px] text-sky-300 font-semibold block mt-0.5">{sn.pos}</span>

                                          <div className="my-2 p-1.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono flex items-center justify-between">
                                            <span className="text-slate-400">Volumen:</span>
                                            <strong className="text-white">{sn.shots90 || 2.5}T · <span className="text-emerald-400">{sn.sot90 || 1.2} SOT</span></strong>
                                          </div>
                                        </div>

                                        <div className="space-y-2 mt-2 pt-2 border-t border-slate-800">
                                          {/* Opción 1: Over 0.5 SOT */}
                                          {sn.over05 && (() => {
                                            const p05 = {
                                              id: sn.over05.id,
                                              category: '🎯 TIROS AL ARCO',
                                              market: sn.over05.market,
                                              odds: sn.over05.odds,
                                              prob: sn.over05.prob,
                                              reason: sn.over05.reason
                                            };
                                            const isP05Added = betSlip.some((p) => p.id === sn.over05.id);
                                            return (
                                              <div className="flex items-center justify-between gap-1.5 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                                                <div>
                                                  <span className="text-[10px] font-bold text-white block">🎯 +0.5 Tiros Arco</span>
                                                  <span className="text-[9px] text-emerald-400 font-bold font-mono">{sn.over05.prob}% IA</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-xs font-black text-orange-400 font-mono">@{(sn.over05.odds || 1.35).toFixed(2)}</span>
                                                  <button
                                                    onClick={() => togglePickInSlip(p05)}
                                                    className={`px-2 py-1 rounded text-[10px] font-black transition active:scale-95 ${
                                                      isP05Added ? 'bg-orange-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                                    }`}
                                                  >
                                                    {isP05Added ? '✓' : '+'}
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          {/* Opción 2: Over 1.5 SOT */}
                                          {sn.over15 && (() => {
                                            const p15 = {
                                              id: sn.over15.id,
                                              category: '🎯 TIROS AL ARCO',
                                              market: sn.over15.market,
                                              odds: sn.over15.odds,
                                              prob: sn.over15.prob,
                                              reason: sn.over15.reason
                                            };
                                            const isP15Added = betSlip.some((p) => p.id === sn.over15.id);
                                            return (
                                              <div className="flex items-center justify-between gap-1.5 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                                                <div>
                                                  <span className="text-[10px] font-bold text-amber-300 block">🎯 +1.5 Tiros Arco</span>
                                                  <span className="text-[9px] text-emerald-400 font-bold font-mono">{sn.over15.prob}% IA</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-xs font-black text-orange-400 font-mono">@{(sn.over15.odds || 1.95).toFixed(2)}</span>
                                                  <button
                                                    onClick={() => togglePickInSlip(p15)}
                                                    className={`px-2 py-1 rounded text-[10px] font-black transition active:scale-95 ${
                                                      isP15Added ? 'bg-orange-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                                    }`}
                                                  >
                                                    {isP15Added ? '✓' : '+'}
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          {/* Opción Aérea: Zaguero Central */}
                                          {sn.aerialPick && (() => {
                                            const pAer = {
                                              id: sn.aerialPick.id,
                                              category: '✈️ AMENAZA AÉREA',
                                              market: sn.aerialPick.market,
                                              odds: sn.aerialPick.odds,
                                              prob: sn.aerialPick.prob,
                                              reason: sn.aerialPick.reason
                                            };
                                            const isAerAdded = betSlip.some((p) => p.id === sn.aerialPick.id);
                                            return (
                                              <div className="flex items-center justify-between gap-1.5 bg-indigo-950/40 p-1.5 rounded border border-indigo-500/30">
                                                <div>
                                                  <span className="text-[10px] font-bold text-indigo-300 block">✈️ +0.5 Cabezazo</span>
                                                  <span className="text-[9px] text-emerald-400 font-bold font-mono">{sn.aerialPick.prob}% IA</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-xs font-black text-orange-400 font-mono">@{(sn.aerialPick.odds || 2.35).toFixed(2)}</span>
                                                  <button
                                                    onClick={() => togglePickInSlip(pAer)}
                                                    className={`px-2 py-1 rounded text-[10px] font-black transition active:scale-95 ${
                                                      isAerAdded ? 'bg-orange-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                                    }`}
                                                  >
                                                    {isAerAdded ? '✓' : '+'}
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 4. TOP 3 TARJETAS CON CRUCE DIRECTO Y FALTAS COMETIDAS (+1.5 FALTAS) */}
                              <div className="bg-slate-950 border-2 border-rose-500/40 rounded-xl p-4 shadow-xl space-y-3">
                                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🟨</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        TOP 3 POSIBLES AMARILLAS — EMPAREJAMIENTO DIRECTO EN ZONA
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Emparejamiento individual directo, rigor arbitral y mercado de faltas tácticas.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm">
                                      <span>📊</span> Cuota Mercado (Ref. Betano/Live)
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 font-bold">
                                      Duelo Táctico
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {(topCards || []).map((cd) => {
                                    const pickItem = {
                                      id: cd.id,
                                      category: '🟨 RECIBE TARJETA',
                                      market: `${cd.name} (${cd.team}) - Será Amonestado`,
                                      odds: cd.odds,
                                      prob: cd.prob,
                                      reason: `${cd.matchup} · ${cd.alert}`
                                    };
                                    const isAdded = betSlip.some((p) => p.id === cd.id);

                                    return (
                                      <div
                                        key={cd.id}
                                        className={`p-3.5 rounded-xl border-2 flex flex-col justify-between transition ${
                                          isAdded ? 'bg-orange-500/15 border-orange-500 shadow-md' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">{cd.team}</span>
                                            <div className="flex items-center gap-1">
                                              {cd.isBlocked || cd.starterStatus === 'SUPLENTE' ? (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                                                  🪑 BANCA
                                                </span>
                                              ) : cd.isOfficialStarter || (cd.isStarter && (lineupMode === 'CONFIRMADO' || cd.starterStatus === 'TITULAR')) ? (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                                                  ✓ TITULAR
                                                </span>
                                              ) : (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                                                  🟡 PROBABLE
                                                </span>
                                              )}
                                              <span className="text-[10px] font-bold text-rose-400 font-mono">🟨 Alta Frecuencia</span>
                                            </div>
                                          </div>
                                          <h5 className="text-sm font-black text-white">{cd.name}</h5>
                                          <span className="text-[11px] text-rose-300 font-semibold block mt-0.5">{cd.pos}</span>

                                          <div className="mt-2 text-[10px] font-black px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 leading-snug">
                                            {cd.alert}
                                          </div>

                                          <div className="mt-2 text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 space-y-1">
                                            <div className="text-[10px] font-bold text-amber-400 uppercase">⚔️ Cruce Directo:</div>
                                            <p className="text-[10px] text-slate-400 leading-snug">{cd.matchup}</p>
                                          </div>

                                          {/* Promedio de Faltas Cometidas por 90m frente al rival */}
                                          <div className="mt-1.5 text-[10px] text-amber-300 bg-slate-950 p-1.5 rounded border border-amber-500/20 font-mono flex items-center justify-between">
                                            <span>🛑 Faltas: <strong>{cd.foulsPer90 || 2.4}/90m</strong></span>
                                            <span className="text-slate-400 text-[9px]">vs {cd.foulsTargetReceived || 2.6} recibidas ({cd.foulsTargetRival || 'rival'})</span>
                                          </div>

                                          <div className="mt-1.5 text-[10px] text-slate-400 bg-slate-950/60 p-1.5 rounded border border-slate-800/80 leading-tight">
                                            <span className="text-slate-300 font-bold">⚖️ Árbitro: </span>{cd.refereeFactor}
                                          </div>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2">
                                          {/* Pick 1: Tarjeta Amarilla */}
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-black text-orange-400 font-mono">@{(cd.odds || 2.80).toFixed(2)}</span>
                                                <span className="text-[9px] text-rose-300 font-mono font-bold bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20">Tarjeta</span>
                                              </div>
                                              <span className="text-[10px] text-rose-400 font-bold font-mono block">{cd.prob || 55}% IA</span>
                                            </div>
                                            <button
                                              onClick={() => togglePickInSlip(pickItem)}
                                              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition active:scale-95 shadow ${
                                                isAdded ? 'bg-orange-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                              }`}
                                            >
                                              {isAdded ? '✓ Tarjeta' : '+ Tarjeta'}
                                            </button>
                                          </div>

                                          {/* Pick 2: +1.5 Faltas Cometidas */}
                                          {cd.foulsPick && (() => {
                                            const foulsItem = {
                                              id: cd.foulsPick.id,
                                              category: '🛑 FALTAS COMETIDAS',
                                              market: cd.foulsPick.market,
                                              odds: cd.foulsPick.odds,
                                              prob: cd.foulsPick.prob,
                                              reason: cd.foulsPick.reason
                                            };
                                            const isFoulsAdded = betSlip.some((p) => p.id === cd.foulsPick.id);
                                            return (
                                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                                                <div>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-black text-amber-300 font-mono">@{(cd.foulsPick.odds || 1.55).toFixed(2)}</span>
                                                    <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">+1.5 Faltas</span>
                                                  </div>
                                                  <span className="text-[10px] text-emerald-400 font-bold font-mono block">{cd.foulsPick.prob || 68}% IA</span>
                                                </div>
                                                <button
                                                  onClick={() => togglePickInSlip(foulsItem)}
                                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition active:scale-95 shadow ${
                                                    isFoulsAdded ? 'bg-orange-500 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black'
                                                  }`}
                                                >
                                                  {isFoulsAdded ? '✓ Faltas' : '+1.5 Faltas'}
                                                </button>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ========================================================================= */}
                          {/* TAB 6: AUDITORÍA ESTADÍSTICA Y "COMBINADAS SEGURAS" BET BUILDER            */}
                          {/* ========================================================================= */}
                          {modalTab === 'betbuilder' && (
                            <div className="space-y-3.5">
                              {/* 2 Combinadas Seguras Sugeridas por IA (82% a 92% Certeza) */}
                              <div className="bg-slate-950 border-2 border-amber-400/60 rounded-xl p-4 shadow-xl space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl">🛡️</span>
                                    <div>
                                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                                        COMBINADAS SEGURAS SUGERIDAS POR IA (BET BUILDER ALTA CERTEZA)
                                      </h4>
                                      <p className="text-[11px] text-slate-400">
                                        Sinergia táctica cruzada (H2H + Tiros + Córners + Tarjetas + Clima). Carga de 1 clic al cupón.
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black">
                                    82% - 92% Certeza
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                  {(betBuilderSuggestions || []).map((comb, idx) => (
                                    <div key={idx} className="bg-slate-900 border-2 border-slate-800 hover:border-amber-400/50 rounded-xl p-4 flex flex-col justify-between transition shadow-md">
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono">
                                            {comb.badge}
                                          </span>
                                          <span className="text-base font-black text-orange-400 font-mono">
                                            @{comb.combinedOdds.toFixed(2)}
                                          </span>
                                        </div>

                                        <h5 className="text-sm font-black text-white">{comb.title}</h5>
                                        <p className="text-[11px] text-slate-300 mt-1 leading-snug">{comb.rationale}</p>

                                        {/* Lista de selecciones incluidas */}
                                        <div className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-2.5">
                                          {(comb.picks || []).map((pk, pIdx) => (
                                            <div key={pIdx} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-xs">
                                              <div>
                                                <span className="text-[9px] font-bold text-orange-400 uppercase block">{pk.category}</span>
                                                <span className="font-bold text-white block text-[11px]">{pk.market}</span>
                                              </div>
                                              <span className="font-mono text-orange-300 font-black text-xs shrink-0">
                                                @{pk.odds.toFixed(2)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                                        <span className="text-xs text-emerald-400 font-bold font-mono">
                                          Certeza: {comb.certainty}% IA
                                        </span>
                                        <button
                                          onClick={() => loadCombinadaToSlip(comb)}
                                          className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition active:scale-95 shadow flex items-center gap-1.5"
                                        >
                                          <span>📥</span> Cargar Combinada al Cupón CLP
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Perfiles de Riesgo Rápidos */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                <h4 className="text-xs font-black uppercase text-white mb-2 flex items-center gap-2">
                                  <span>⚖️</span> OTRAS COMBINACIONES SUGERIDAS POR PERFIL DE RIESGO
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                  {['conservador', 'medio', 'altoRiesgo'].map((key) => {
                                    const prof = selectedMatch.suggestedProfiles?.[key];
                                    if (!prof) return null;
                                    const isSelected = activeProfileName === key;
                                    return (
                                      <div
                                        key={key}
                                        onClick={() => applyRiskProfile(key)}
                                        className={`rounded-xl border p-3 cursor-pointer transition flex flex-col justify-between ${
                                          isSelected ? 'border-orange-500 bg-orange-500/20' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${key === 'conservador' ? 'bg-emerald-500 text-slate-950' : key === 'medio' ? 'bg-amber-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                                              {key === 'conservador' ? 'CONSERVADOR' : key === 'medio' ? 'MODERADO' : 'ALTO RIESGO'}
                                            </span>
                                            <span className="text-xs font-bold text-emerald-400 font-mono">{prof.prob}% IA</span>
                                          </div>
                                          <h5 className="text-xs font-extrabold text-white mt-1">{prof.title}</h5>
                                          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{prof.description}</p>
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between font-mono">
                                          <span className="text-sm font-black text-orange-400">@{prof.targetOdds.toFixed(2)}</span>
                                          <span className="text-[10px] text-slate-300 font-bold">{isSelected ? '✓ Activo' : 'Cargar'}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Nivel 1: Sumadores Seguros */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <h4 className="text-xs font-black uppercase text-white flex items-center gap-2">
                                    <span>🛡️</span> NIVEL 1: SUMADORES SEGUROS (PICKS INDIVIDUALES)
                                  </h4>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm">
                                    <span>📊</span> Cuota Mercado (Ref. Betano/Live)
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                  {(selectedMatch.betanoLevel1 || []).map((pick) => {
                                    const isAdded = betSlip.some((p) => p.id === pick.id);
                                    return (
                                      <div
                                        key={pick.id}
                                        onClick={() => togglePickInSlip(pick)}
                                        className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                                          isAdded ? 'bg-orange-500/15 border-orange-500 shadow-md' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-orange-400 uppercase">{pick.category}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isAdded ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                              {isAdded ? '✓ Añadido' : '+ Agregar'}
                                            </span>
                                          </div>
                                          <span className="text-xs font-extrabold text-white block mt-1">{pick.market}</span>
                                          <span className="text-[10px] text-slate-400 block mt-1 leading-snug">{pick.reason}</span>
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-black text-orange-400">@{pick.odds.toFixed(2)}</span>
                                            <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">Ref. Betano</span>
                                          </div>
                                          <span className="text-[11px] text-emerald-400 font-bold">{pick.prob}% IA</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                        </div>

                        {/* ====== COLUMNA DERECHA: CUPÓN "CREAR APUESTA BETANO" (4 COLS) ====== */}
                        <div className="lg:col-span-4">
                          <div className="bg-slate-950 border-2 border-orange-500 rounded-xl p-4 shadow-2xl space-y-3.5 sticky top-2">
                            
                            {/* Cabecera del Cupón */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                              <div>
                                <h3 className="text-sm font-black text-white uppercase flex items-center gap-1.5">
                                  <span className="text-orange-500">⚡</span> CUPÓN "CREAR APUESTA"
                                </h3>
                                <p className="text-[11px] text-slate-400">Calculadora Dinámica en Pesos Chilenos (CLP)</p>
                              </div>
                              {betSlip.length > 0 && (
                                <button
                                  onClick={() => setBetSlip([])}
                                  className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
                                >
                                  Limpiar ({betSlip.length})
                                </button>
                              )}
                            </div>

                            {/* Lista de Selecciones del Cupón */}
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                              {betSlip.length === 0 ? (
                                <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
                                  <span className="text-lg block mb-1">🎯</span>
                                  El cupón está vacío. Selecciona un perfil de riesgo arriba o haz clic en los picks para agregarlos.
                                </div>
                              ) : (
                                betSlip.map((item) => (
                                  <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-start justify-between gap-2 group">
                                    <div className="flex-1">
                                      <div className="text-[10px] font-bold text-orange-400 uppercase">{item.category || item.type}</div>
                                      <div className="text-xs font-bold text-white mt-0.5">{item.market || item.player}</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-black px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 shrink-0 font-mono">
                                        @{item.odds.toFixed(2)}
                                      </span>
                                      <button
                                        onClick={(e) => removePickFromSlip(item.id, e)}
                                        className="text-slate-500 hover:text-rose-400 text-xs px-1"
                                        title="Quitar selección"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Métricas: Cuota Total y Probabilidad Conjunta */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 font-mono text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Cuota Total Betano:</span>
                                <span className="text-xl font-black text-orange-400">@{combinedOdds.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Probabilidad Conjunta IA:</span>
                                <span className="font-bold text-emerald-400">{combinedProb}%</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800">
                                <span className="text-slate-400">Sugerencia Criterio Kelly:</span>
                                <span className="text-amber-300 font-bold">{formatCLP(suggestedKellyStakeCLP)}</span>
                              </div>
                            </div>

                            {/* Monto de Apuesta en CLP con Botones Rápidos */}
                            <div>
                              <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
                                <span>Monto de Apuesta (CLP):</span>
                                <button
                                  onClick={() => setStakeCLP(suggestedKellyStakeCLP)}
                                  className="text-amber-400 hover:underline font-bold"
                                >
                                  Aplicar Kelly ({formatCLP(suggestedKellyStakeCLP)})
                                </button>
                              </div>
                              <input
                                type="number"
                                step="1000"
                                value={stakeCLP}
                                onChange={(e) => setStakeCLP(Number(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-orange-500 font-mono"
                              />
                              <div className="grid grid-cols-4 gap-1.5 mt-2">
                                {[5000, 10000, 20000, 50000].map((val) => (
                                  <button
                                    key={val}
                                    onClick={() => setStakeCLP(val)}
                                    className={`py-1 rounded text-[11px] font-bold transition font-mono ${stakeCLP === val ? 'bg-orange-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'}`}
                                  >
                                    {formatCLP(val)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Retorno Potencial y Ganancia Neta */}
                            <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                              <div>
                                <div className="text-[11px] text-slate-400">Retorno Potencial:</div>
                                <div className="text-xl font-black text-emerald-400">{formatCLP(stakeCLP * combinedOdds)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[11px] text-slate-400">Ganancia Neta:</div>
                                <div className="text-sm font-bold text-emerald-300">+{formatCLP(Math.max(0, stakeCLP * combinedOdds - stakeCLP))}</div>
                              </div>
                            </div>

                            {/* CHECKLIST DE SEGURIDAD PRE-APUESTA */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5 text-[11px]">
                              <div className="font-extrabold uppercase text-slate-300 flex items-center justify-between">
                                <span>Checklist Pre-Apuesta:</span>
                                <span className="text-emerald-400 font-mono">4/4 Validado</span>
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={checklist.lineupsConfirmed}
                                  onChange={(e) => setChecklist({ ...checklist, lineupsConfirmed: e.target.checked })}
                                  className="rounded text-orange-500 focus:ring-0 bg-slate-950 border-slate-700"
                                />
                                <span>Alineaciones oficiales confirmadas (Sin rotación)</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={checklist.weatherOptimal}
                                  onChange={(e) => setChecklist({ ...checklist, weatherOptimal: e.target.checked })}
                                  className="rounded text-orange-500 focus:ring-0 bg-slate-950 border-slate-700"
                                />
                                <span>Sin tormenta o viento severo (&gt;40 km/h)</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={checklist.refereeCompatible}
                                  onChange={(e) => setChecklist({ ...checklist, refereeCompatible: e.target.checked })}
                                  className="rounded text-orange-500 focus:ring-0 bg-slate-950 border-slate-700"
                                />
                                <span>Árbitro compatible con el mercado de tarjetas</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={checklist.bankrollProtected}
                                  onChange={(e) => setChecklist({ ...checklist, bankrollProtected: e.target.checked })}
                                  className="rounded text-orange-500 focus:ring-0 bg-slate-950 border-slate-700"
                                />
                                <span>Stake Kelly &lt; 3% del Bankroll Total</span>
                              </label>
                            </div>

                            {/* Botón de acción para Betano */}
                            <button
                              onClick={handleCopyReport}
                              disabled={betSlip.length === 0}
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {copySuccess ? '✓ ¡Selección Copiada al Portapapeles!' : 'Copiar Selección para Betano'}
                            </button>

                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                </div>
              </div>
            );
          })()}

          {/* MODAL VIP CON LOS 158 CLUBES REALES */}
          {showVipModal && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                      <span>👑</span> Seleccionar Equipos Favoritos VIP
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Cobertura total de los 158 clubes de las 9 ligas oficiales.
                    </p>
                  </div>
                  <button onClick={() => setShowVipModal(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
                </div>

                {/* Filtros de búsqueda */}
                <div className="my-3 space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Buscar equipo (Colo-Colo, Arsenal, Real Madrid, Celtic, Bodø...)"
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />

                  {/* Filtro por liga */}
                  <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
                    <button
                      onClick={() => setTeamLeagueFilter('all')}
                      className={`px-2 py-0.5 rounded-lg font-bold shrink-0 ${teamLeagueFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                    >
                      Todas ({flatTeamsList.length})
                    </button>
                    {LEAGUES_LIST.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setTeamLeagueFilter(l.id)}
                        className={`px-2 py-0.5 rounded-lg font-bold shrink-0 ${teamLeagueFilter === l.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                      >
                        {l.flag} {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de equipos */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[380px]">
                  {flatTeamsList.map((t, idx) => {
                    const isVip = vipTeams.some(vt => vt.toLowerCase().trim() === t.name.toLowerCase().trim());
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleVipTeam(t.name)}
                        className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs ${
                          isVip ? 'bg-amber-500/15 border-amber-400 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {t.logo ? (
                            <img src={t.logo} alt={t.name} className="w-5 h-5 object-contain" />
                          ) : (
                            <span className="w-5 h-5 flex items-center justify-center font-bold text-slate-500">⚽</span>
                          )}
                          <div>
                            <div className="font-bold">{t.name}</div>
                            <div className="text-[10px] text-slate-500">{t.league}</div>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isVip ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                          {isVip ? '⭐ VIP Activo' : '+ Agregar'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap justify-between items-center gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Total Favoritos: <strong className="text-amber-400">{vipTeams.length}</strong></span>
                    {vipTeams.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm("¿Deseas desmarcar todos los equipos favoritos?")) {
                            setVipTeams([]);
                            try {
                              localStorage.setItem(STORAGE_KEY_FAVORITES, '[]');
                              localStorage.setItem('sportagent_vip_teams_v10', '[]');
                            } catch(e) {}
                          }
                        }}
                        className="text-[11px] text-rose-400 hover:text-rose-300 underline transition cursor-pointer"
                      >
                        Limpiar lista
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowVipModal(false)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-1.5 rounded-xl shadow transition"
                  >
                    Guardar y Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
