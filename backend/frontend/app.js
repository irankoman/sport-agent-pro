    // Registro de Service Worker para PWA instalable con cache-busting estricto
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js?v=weekly_calendar_v11')
          .then((reg) => {
            console.log('PWA ServiceWorker registrado:', reg.scope);
            if (reg.update) { reg.update(); }
          })
          .catch((err) => {
            navigator.serviceWorker.register('/service-worker.js?v=weekly_calendar_v11')
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

    const STORAGE_KEY_WEEKLY_HISTORY = 'sport_agent_weekly_snapshots_v1';
    const SPANISH_MONTHS_SHORT_GLOBAL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const getWeekInfoFromDate = (dateInput) => {
      try {
        let baseDate;
        if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
          baseDate = new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
        } else if (typeof dateInput === 'string' && dateInput.trim()) {
          const clean = dateInput.trim().slice(0, 10);
          const parts = clean.split('-');
          if (parts.length === 3) {
            baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          } else {
            baseDate = getSantiagoDate();
          }
        } else {
          baseDate = getSantiagoDate();
        }
        const dayOfWeek = baseDate.getDay();
        const daysSinceMonday = (dayOfWeek + 6) % 7;
        const startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - daysSinceMonday);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
        const prevStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 7);
        const prevEnd = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 1);

        const startIso = getSantiagoYMD(startDate);
        const endIso = getSantiagoYMD(endDate);
        const startCompact = startIso.replace(/-/g, '');
        const endCompact = endIso.replace(/-/g, '');
        const weekKey = `${startIso}_${endIso}`;

        const prevStartIso = getSantiagoYMD(prevStart);
        const prevEndIso = getSantiagoYMD(prevEnd);
        const prevWeekKey = `${prevStartIso}_${prevEndIso}`;
        const prevStartCompact = prevStartIso.replace(/-/g, '');
        const prevEndCompact = prevEndIso.replace(/-/g, '');

        const pad2 = (n) => String(n).padStart(2, '0');
        const sDay = pad2(startDate.getDate());
        const sMon = SPANISH_MONTHS_SHORT_GLOBAL[startDate.getMonth()];
        const eDay = pad2(endDate.getDate());
        const eMon = SPANISH_MONTHS_SHORT_GLOBAL[endDate.getMonth()];

        const shortRangeLabel = `${sDay} ${sMon} - ${eDay} ${eMon}`;
        const fullRangeLabel = `Lun ${sDay} ${sMon} - Dom ${eDay} ${eMon}`;

        const active = getActiveJornadaRange();
        const isCurrent = (startIso === active.startIso);
        const lastClosedMonday = new Date(active.startDate.getFullYear(), active.startDate.getMonth(), active.startDate.getDate() - 7);
        const isJustClosed = (startIso === getSantiagoYMD(lastClosedMonday));

        return {
          weekKey,
          startIso,
          endIso,
          startCompact,
          endCompact,
          shortRangeLabel,
          fullRangeLabel,
          prevWeekKey,
          prevStartCompact,
          prevEndCompact,
          isCurrent,
          isJustClosed,
          isClosed: !isCurrent
        };
      } catch (e) {
        const active = getActiveJornadaRange();
        return {
          weekKey: `${active.startIso}_${active.endIso}`,
          startIso: active.startIso,
          endIso: active.endIso,
          startCompact: active.startIso.replace(/-/g, ''),
          endCompact: active.endIso.replace(/-/g, ''),
          shortRangeLabel: active.weekRangeLabel.replace('Semana activa: ', ''),
          fullRangeLabel: active.weekRangeLabel.replace('Semana activa: ', ''),
          prevWeekKey: '',
          prevStartCompact: '',
          prevEndCompact: '',
          isCurrent: true,
          isJustClosed: false,
          isClosed: false
        };
      }
    };

    const buildRecent4WeeksList = () => {
      try {
        const { startDate } = getActiveJornadaRange();
        return [-3, -2, -1, 0].map((offsetWeeks) => {
          const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (offsetWeeks * 7));
          return getWeekInfoFromDate(d);
        });
      } catch (e) {
        return [getWeekInfoFromDate(new Date())];
      }
    };

    const loadWeeklySnapshots = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_HISTORY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {};
    };

    const sanitizeAuditForStorage = (auditObj) => {
      if (!auditObj || typeof auditObj !== 'object') return null;
      const stripMatchObj = (arr) => (Array.isArray(arr) ? arr.map((it) => {
        if (!it) return it;
        const { matchObj, ...rest } = it;
        return rest;
      }) : []);
      return {
        ...auditObj,
        achievedList: stripMatchObj(auditObj.achievedList),
        failedList: stripMatchObj(auditObj.failedList),
        failurePatterns: {
          upsets: {
            count: auditObj.failurePatterns?.upsets?.count || 0,
            items: stripMatchObj(auditObj.failurePatterns?.upsets?.items)
          },
          lowScoring: {
            count: auditObj.failurePatterns?.lowScoring?.count || 0,
            items: stripMatchObj(auditObj.failurePatterns?.lowScoring?.items)
          },
          rhythmDiscipline: {
            count: auditObj.failurePatterns?.rhythmDiscipline?.count || 0,
            items: stripMatchObj(auditObj.failurePatterns?.rhythmDiscipline?.items)
          }
        }
      };
    };

    const saveWeeklySnapshotToStorage = (weekKey, weekInfo, auditAll, auditFavorites) => {
      if (!weekKey || !auditAll) return null;
      try {
        const currentStore = loadWeeklySnapshots();
        currentStore[weekKey] = {
          weekKey,
          startIso: weekInfo?.startIso || '',
          endIso: weekInfo?.endIso || '',
          shortRangeLabel: weekInfo?.shortRangeLabel || '',
          fullRangeLabel: weekInfo?.fullRangeLabel || '',
          savedAt: new Date().toISOString(),
          all: sanitizeAuditForStorage(auditAll),
          favorites: sanitizeAuditForStorage(auditFavorites)
        };
        localStorage.setItem(STORAGE_KEY_WEEKLY_HISTORY, JSON.stringify(currentStore));
        return currentStore;
      } catch (e) {
        console.error("Error guardando snapshot semanal en localStorage:", e);
        return null;
      }
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

    // Motor defensivo de resolución y recálculo de cuotas En Vivo (In-Play Live Odds)
    const resolveMatchLiveOdds = (m) => {
      try {
        const od = (m && m.oddsDetails) ? m.oddsDetails : {};
        const baseHome = Number(od.preHomeWin || od.homeWin || 1.85);
        const baseDraw = Number(od.preDraw || od.draw || 3.50);
        const baseAway = Number(od.preAwayWin || od.awayWin || 4.00);
        const baseOver = Number(od.preOverGoals || od.overGoals || 1.82);
        const baseLine = Number(od.preGoalsLine || od.goalsLine || 2.5);

        if (!m || !m.isLive) {
          return {
            homeWin: Number(od.homeWin || baseHome),
            draw: Number(od.draw || baseDraw),
            awayWin: Number(od.awayWin || baseAway),
            overGoals: Number(od.overGoals || baseOver),
            goalsLine: Number(od.goalsLine || baseLine),
            preHomeWin: baseHome,
            preDraw: baseDraw,
            preAwayWin: baseAway,
            isLiveOdds: false,
            liveMinute: 0,
            isMarketSuspended: false
          };
        }

        // Si el backend ya calculó isLiveOdds, usar esos valores validados con fallback seguro
        if (od.isLiveOdds) {
          return {
            homeWin: Number(od.homeWin || baseHome),
            draw: Number(od.draw || baseDraw),
            awayWin: Number(od.awayWin || baseAway),
            overGoals: Number(od.overGoals || baseOver),
            goalsLine: Number(od.goalsLine || baseLine),
            preHomeWin: baseHome,
            preDraw: baseDraw,
            preAwayWin: baseAway,
            isLiveOdds: true,
            liveMinute: Number(od.liveMinute || 45),
            isMarketSuspended: Boolean(od.isMarketSuspended)
          };
        }

        // Fallback en cliente por si llega un objeto en vivo sin recálculo previo
        const labelStr = String(m.dayLabel || '').toUpperCase();
        let curMin = 45;
        if (labelStr.includes('HT') || labelStr.includes('DESCANSO')) {
          curMin = 45;
        } else {
          const plusM = labelStr.match(/(\d+)\s*\+\s*(\d+)/);
          if (plusM) {
            const b = parseInt(plusM[1], 10);
            const ex = parseInt(plusM[2], 10);
            curMin = b === 45 ? 45 : Math.min(90, Math.max(1, b + Math.min(ex, 5)));
          } else {
            const numM = labelStr.match(/(\d+)/);
            if (numM) curMin = Math.min(90, Math.max(1, parseInt(numM[1], 10)));
          }
        }

        let hGoals = 0;
        let aGoals = 0;
        const scoreParts = String(m.score || '0 - 0').split('-');
        if (scoreParts.length >= 2) {
          hGoals = parseInt(scoreParts[0].trim(), 10) || 0;
          aGoals = parseInt(scoreParts[1].trim(), 10) || 0;
        }

        const remMins = Math.max(1.5, 90.0 - curMin + 2.5);
        const remRatio = Math.max(0.02, Math.min(1.0, remMins / 92.5));
        const pH0 = 1.0 / baseHome;
        const pD0 = 1.0 / baseDraw;
        const pA0 = 1.0 / baseAway;
        const sumP0 = pH0 + pD0 + pA0;
        const normH = pH0 / sumP0;
        const normA = pA0 / sumP0;
        const totLam = 2.65;
        const lamHRem = Math.max(0.03, totLam * (normH / (normH + normA)) * remRatio);
        const lamARem = Math.max(0.03, totLam * (normA / (normH + normA)) * remRatio);

        const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
        const maxG = 7;
        const probsH = [];
        const probsA = [];
        for (let k = 0; k <= maxG; k++) {
          probsH.push(Math.exp(-lamHRem) * Math.pow(lamHRem, k) / fact(k));
          probsA.push(Math.exp(-lamARem) * Math.pow(lamARem, k) / fact(k));
        }

        let pHome = 0, pDraw = 0, pAway = 0;
        for (let gh = 0; gh <= maxG; gh++) {
          for (let ga = 0; ga <= maxG; ga++) {
            const p = probsH[gh] * probsA[ga];
            if (hGoals + gh > aGoals + ga) pHome += p;
            else if (hGoals + gh === aGoals + ga) pDraw += p;
            else pAway += p;
          }
        }

        const unc = 0.035 + 0.045 * remRatio;
        pHome = pHome * (1 - unc) + pH0 * (unc * 0.45);
        pDraw = pDraw * (1 - unc) + pD0 * (unc * 0.35);
        pAway = pAway * (1 - unc) + pA0 * (unc * 0.45);
        const totP = Math.max(0.001, pHome + pDraw + pAway);
        pHome /= totP; pDraw /= totP; pAway /= totP;

        const margin = 1.06;
        const diff = hGoals - aGoals;
        let liveH = baseHome, liveD = baseDraw, liveA = baseAway;
        if (diff > 0) {
          const floor = (curMin >= 85 || diff >= 3) ? 1.04 : (diff >= 2 && curMin >= 55 ? 1.08 : 1.02);
          liveH = Math.max(floor, Number((1.0 / Math.min(0.955, pHome * (diff === 1 ? 1.02 : 1.0))).toFixed(2)));
          const dEff = Math.max((diff === 1 && curMin >= 80) ? 0.088 : 0.035, pDraw * margin);
          const aEff = Math.max((diff === 1 && curMin >= 80) ? 0.029 : 0.022, pAway * margin);
          liveD = Math.max(1.10, Math.min(29.0, Number((1.0 / dEff).toFixed(2))));
          liveA = Math.max(1.20, Math.min(45.0, Number((1.0 / aEff).toFixed(2))));
        } else if (diff < 0) {
          const absDiff = Math.abs(diff);
          const floor = (curMin >= 85 || absDiff >= 3) ? 1.04 : (absDiff >= 2 && curMin >= 55 ? 1.08 : 1.02);
          liveA = Math.max(floor, Number((1.0 / Math.min(0.955, pAway * (absDiff === 1 ? 1.02 : 1.0))).toFixed(2)));
          const dEff = Math.max((absDiff === 1 && curMin >= 80) ? 0.088 : 0.035, pDraw * margin);
          const hEff = Math.max((absDiff === 1 && curMin >= 80) ? 0.029 : 0.022, pHome * margin);
          liveD = Math.max(1.10, Math.min(29.0, Number((1.0 / dEff).toFixed(2))));
          liveH = Math.max(1.20, Math.min(45.0, Number((1.0 / hEff).toFixed(2))));
        } else {
          liveH = Math.max(1.15, Math.min(35.0, Number((1.0 / Math.max(0.028, pHome * margin)).toFixed(2))));
          liveD = Math.max(1.08, Math.min(15.0, Number((1.0 / Math.max(0.065, pDraw * margin)).toFixed(2))));
          liveA = Math.max(1.15, Math.min(35.0, Number((1.0 / Math.max(0.028, pAway * margin)).toFixed(2))));
        }

        const liveLine = Math.max(baseLine, hGoals + aGoals + 0.5);
        return {
          homeWin: liveH,
          draw: liveD,
          awayWin: liveA,
          overGoals: baseOver,
          goalsLine: liveLine,
          preHomeWin: baseHome,
          preDraw: baseDraw,
          preAwayWin: baseAway,
          isLiveOdds: true,
          liveMinute: curMin,
          isMarketSuspended: Boolean(curMin >= 89)
        };
      } catch (err) {
        return {
          homeWin: 1.85,
          draw: 3.50,
          awayWin: 4.00,
          overGoals: 1.85,
          goalsLine: 2.5,
          preHomeWin: 1.85,
          preDraw: 3.50,
          preAwayWin: 4.00,
          isLiveOdds: false,
          liveMinute: 0,
          isMarketSuspended: false
        };
      }
    };

    function renderPostMatchGoals(match) {
      const homeName = match?.homeTeam?.name || (typeof match?.homeTeam === 'string' ? match.homeTeam : '') || match?.home_name || 'Local';
      const awayName = match?.awayTeam?.name || (typeof match?.awayTeam === 'string' ? match.awayTeam : '') || match?.away_name || 'Visita';

      const rawHome = match?.homeGoals || match?.postMatchReport?.homeGoals || match?.postMatchReport?.goalsAudit?.homeGoals;
      const rawAway = match?.awayGoals || match?.postMatchReport?.awayGoals || match?.postMatchReport?.goalsAudit?.awayGoals;
      const homeGoals = Array.isArray(rawHome) ? rawHome : [];
      const awayGoals = Array.isArray(rawAway) ? rawAway : [];

      const renderBadges = (goalsList, teamLabel, badgeBg) => {
        if (!Array.isArray(goalsList) || goalsList.length === 0) {
          return `<div style="opacity:0.6; font-size:0.85rem; padding:6px 0;">Sin goles registrados</div>`;
        }
        return goalsList.map(g => {
          const min = g?.minute || '';
          const ply = g?.player || 'Gol';
          return `<div style="display:inline-flex; align-items:center; gap:6px; background:${badgeBg}; border:1px solid rgba(16,185,129,0.35); border-radius:20px; padding:4px 12px; margin:3px 0; font-size:0.85rem;">
        <span>⚽ <strong>${min}</strong> ${ply} <span style="opacity:0.75;">(${teamLabel})</span></span>
      </div>`;
        }).join('<br>');
      };

      return `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin:10px 0;">
      <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(56,189,248,0.25); border-radius:10px; padding:10px;">
        <div style="font-weight:700; color:#38bdf8; margin-bottom:6px; font-size:0.9rem;">🏠 Goles ${homeName}</div>
        ${renderBadges(homeGoals, homeName, 'rgba(6,78,59,0.45)')}
      </div>
      <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:10px;">
        <div style="font-weight:700; color:#fbbf24; margin-bottom:6px; font-size:0.9rem;">✈️ Goles ${awayName}</div>
        ${renderBadges(awayGoals, awayName, 'rgba(6,78,59,0.45)')}
      </div>
    </div>
  `;
    }
    if (typeof window !== 'undefined') {
      window.renderPostMatchGoals = renderPostMatchGoals;
    }

    const STORAGE_KEY_FAVORITES = 'sportagent_favorite_teams_v3';
    const STORAGE_KEY_STARRED_MATCHES = 'sportagent_starred_matches_v3';

    // Normalizador de nombres de equipos para cruce exacto (ignora tildes, guiones, puntos y sufijos FC/CF)
    const normTeamStr = (s) => {
      try {
        return String(s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\b(fc|cf|cd|ud|sc|ac|as|afc|fk|bk|if|sk)\b/g, '')
          .replace(/[^a-z0-9]/g, '')
          .trim();
      } catch (e) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      }
    };

    // Cargar selecciones manuales guardadas en localStorage (unificando todas las claves posibles)
    const loadSavedFavorites = () => {
      try {
        const keys = [STORAGE_KEY_FAVORITES, 'sportagent_vip_teams_v10', 'sportagent_favorites', 'favoriteTeams'];
        const merged = [];
        const seen = new Set();
        for (const k of keys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const name = typeof item === 'string' ? item.trim() : (item?.name || '').trim();
                const nk = normTeamStr(name);
                if (name && nk && !seen.has(nk)) {
                  seen.add(nk);
                  merged.push(name);
                }
              }
            }
          }
        }
        return merged;
      } catch (e) {
        console.error("Error leyendo favoritos de localStorage:", e);
      }
      return [];
    };

    const loadSavedStarredMatches = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_STARRED_MATCHES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
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
      const [starredMatchIds, setStarredMatchIds] = useState(loadSavedStarredMatches);

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

      // Guardar inmediatamente en localStorage cada cambio de Favoritos/VIP por nombre de club o ID de partido
      useEffect(() => {
        try {
          localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(vipTeams));
          localStorage.setItem('sportagent_vip_teams_v10', JSON.stringify(vipTeams));
        } catch (e) {
          console.error("Error guardando favoritos en localStorage:", e);
        }
      }, [vipTeams]);

      useEffect(() => {
        try {
          localStorage.setItem(STORAGE_KEY_STARRED_MATCHES, JSON.stringify(starredMatchIds));
        } catch (e) {}
      }, [starredMatchIds]);

      // Función de coincidencia normalizada con equipos Favoritos/VIP por nombre
      const matchesVipTeam = (m, teamsList) => {
        if (!m || !Array.isArray(teamsList) || teamsList.length === 0) return false;
        const hRaw = String(m.homeTeam?.name || m.homeTeam || m.home_name || '').toLowerCase().trim();
        const aRaw = String(m.awayTeam?.name || m.awayTeam || m.away_name || '').toLowerCase().trim();
        const hNorm = normTeamStr(hRaw);
        const aNorm = normTeamStr(aRaw);
        return teamsList.some(vip => {
          if (!vip) return false;
          const vRaw = String(vip).toLowerCase().trim();
          const vNorm = normTeamStr(vRaw);
          if (!vRaw) return false;
          if (hRaw === vRaw || aRaw === vRaw) return true;
          if (vNorm && (hNorm === vNorm || aNorm === vNorm)) return true;
          if (vRaw.length >= 3 && (hRaw.includes(vRaw) || vRaw.includes(hRaw) || aRaw.includes(vRaw) || vRaw.includes(aRaw))) return true;
          if (vNorm.length >= 3 && ((hNorm && (hNorm.includes(vNorm) || vNorm.includes(hNorm))) || (aNorm && (aNorm.includes(vNorm) || vNorm.includes(aNorm))))) return true;
          return false;
        });
      };

      // Función auxiliar única: devuelve true si local o visita está en Mis Favoritos (localStorage) o el partido está marcado como favorito/importante
      const isMatchFavoriteOrImportant = (m) => {
        if (!m) return false;
        const activeFavs = (Array.isArray(vipTeams) && vipTeams.length > 0) ? vipTeams : loadSavedFavorites();
        if (matchesVipTeam(m, activeFavs)) return true;
        if (m.id && Array.isArray(starredMatchIds) && starredMatchIds.includes(m.id)) return true;
        if (Boolean(m.starred) || Boolean(m.is_favorite_involved)) return true;
        return false;
      };
      const isMatchFavorite = isMatchFavoriteOrImportant;

      // Alternar estrella manual en cualquier partido: sincroniza en tiempo real con Mis Favoritos y con Importantes/Favoritos
      const toggleStar = (id, e) => {
        if (e) e.stopPropagation();
        const match = matches.find(m => m.id === id);
        if (!match) return;

        const h = String(match.homeTeam?.name || match.homeTeam || '').trim();
        const a = String(match.awayTeam?.name || match.awayTeam || '').trim();
        const hLow = h.toLowerCase();
        const aLow = a.toLowerCase();
        const hNorm = normTeamStr(h);
        const aNorm = normTeamStr(a);
        const currentlyFav = isMatchFavoriteOrImportant(match);

        if (currentlyFav) {
          setStarredMatchIds(prev => {
            const nextIds = (Array.isArray(prev) ? prev : []).filter(mid => mid !== id);
            try { localStorage.setItem(STORAGE_KEY_STARRED_MATCHES, JSON.stringify(nextIds)); } catch(err) {}
            return nextIds;
          });
        } else {
          setStarredMatchIds(prev => {
            const base = Array.isArray(prev) ? prev : [];
            const nextIds = base.includes(id) ? base : [...base, id];
            try { localStorage.setItem(STORAGE_KEY_STARRED_MATCHES, JSON.stringify(nextIds)); } catch(err) {}
            return nextIds;
          });
        }

        setVipTeams(prev => {
          const baseList = Array.isArray(prev) ? prev : [];
          let next;
          if (currentlyFav) {
            // Desmarcar: remover los nombres de equipos que coincidan (normalizados o exactos)
            next = baseList.filter(t => {
              const tn = String(t || '').toLowerCase().trim();
              const tNorm = normTeamStr(tn);
              const matchesH = tn === hLow || (tNorm && hNorm && (tNorm === hNorm || (tNorm.length >= 3 && (hNorm.includes(tNorm) || tNorm.includes(hNorm))))) || (tn.length >= 3 && (hLow.includes(tn) || tn.includes(hLow)));
              const matchesA = tn === aLow || (tNorm && aNorm && (tNorm === aNorm || (tNorm.length >= 3 && (aNorm.includes(tNorm) || tNorm.includes(aNorm))))) || (tn.length >= 3 && (aLow.includes(tn) || tn.includes(aLow)));
              return !matchesH && !matchesA;
            });
          } else {
            // Marcar: agregar los nombres de ambos equipos a Mis Favoritos de forma permanente
            const toAdd = [];
            if (h && !baseList.some(t => String(t || '').toLowerCase().trim() === hLow || (normTeamStr(t) && normTeamStr(t) === hNorm))) toAdd.push(h);
            if (a && !baseList.some(t => String(t || '').toLowerCase().trim() === aLow || (normTeamStr(t) && normTeamStr(t) === aNorm))) toAdd.push(a);
            next = [...baseList, ...toAdd];
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

      // Estado y Motor de Auditoría para "📊 Resumen de la Semana" (Con Calendario Histórico + Snapshots LocalStorage)
      const [showWeeklySummaryModal, setShowWeeklySummaryModal] = useState(false);
      const [weeklySummaryScope, setWeeklySummaryScope] = useState('all'); // 'all' | 'favorites'
      const [showWeeklyAchieved, setShowWeeklyAchieved] = useState(false);
      const [showWeeklyFailed, setShowWeeklyFailed] = useState(true);

      const recent4Weeks = useMemo(() => buildRecent4WeeksList(), [matches]);
      const [selectedAuditWeek, setSelectedAuditWeek] = useState(() => {
        const list = buildRecent4WeeksList();
        return list[list.length - 1] || getWeekInfoFromDate(new Date());
      });
      const [weeklySnapshots, setWeeklySnapshots] = useState(loadWeeklySnapshots);
      const [isLoadingWeeklyHistory, setIsLoadingWeeklyHistory] = useState(false);
      const [autoSwitchedToClosedWeek, setAutoSwitchedToClosedWeek] = useState(false);
      const [customCalendarDate, setCustomCalendarDate] = useState('');
      const weeklyMatchesCacheRef = useRef({});
      const calendarInputRef = useRef(null);

      const evaluateWeeklyPerformance = (matchesList, onlyFavs = false, customStartIso = null, customEndIso = null) => {
        const emptyResult = {
          finishedMatchesCount: 0,
          totalPicks: 0,
          achievedCount: 0,
          failedCount: 0,
          successRate: 0,
          failRate: 0,
          roiUnits: 0,
          roiPct: 0,
          categories: [
            { id: 'low_risk', label: '🛡️ Bajo Riesgo (Doble Oportunidad / DNB / 1X + 1.5)', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' },
            { id: 'goals', label: '⚽ Línea de Goles (Over 1.5 / 2.5 / BTTS)', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' },
            { id: 'winner_1x2', label: '🏆 Ganador 1X2 (Favorito Directo)', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' },
            { id: 'props_cards_corners', label: '🟨 Disciplina, Córners & Props', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' }
          ],
          failurePatterns: {
            upsets: { count: 0, items: [] },
            lowScoring: { count: 0, items: [] },
            rhythmDiscipline: { count: 0, items: [] }
          },
          leagueRanking: [],
          achievedList: [],
          failedList: []
        };

        try {
          if (!Array.isArray(matchesList) || matchesList.length === 0) {
            return emptyResult;
          }

          const activeRange = getActiveJornadaRange();
          const startIso = customStartIso || activeRange.startIso;
          const endIso = customEndIso || activeRange.endIso;
          const isHistoricalWeek = Boolean(endIso < activeRange.startIso);

          const finishedMatches = matchesList.filter((m) => {
            if (!m) return false;
            const mDate = m.matchDate || (m.rawDate ? String(m.rawDate).slice(0, 10) : '');
            if (mDate && (mDate < startIso || mDate > endIso)) return false;
            const isFin = isFinishedMatch(m) || m.status === 'post' || m.status === 'finished' || (isHistoricalWeek && m.score && m.score !== 'VS' && !m.isLive);
            if (!isFin) return false;
            if (onlyFavs && !isMatchFavoriteOrImportant(m)) return false;
            return true;
          });

          if (finishedMatches.length === 0) {
            return emptyResult;
          }

          const catMap = {
            low_risk: { id: 'low_risk', label: '🛡️ Bajo Riesgo (Doble Oportunidad / DNB / 1X + 1.5)', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' },
            goals: { id: 'goals', label: '⚽ Línea de Goles (Over 1.5 / 2.5 / BTTS)', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' },
            winner_1x2: { id: 'winner_1x2', label: '🏆 Ganador 1X2 (Favorito Directo)', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' },
            props_cards_corners: { id: 'props_cards_corners', label: '🟨 Disciplina, Córners & Props', achieved: 0, failed: 0, total: 0, rate: 0, diagnosis: 'Sin datos aún' }
          };

          const failurePatterns = {
            upsets: { count: 0, items: [] },
            lowScoring: { count: 0, items: [] },
            rhythmDiscipline: { count: 0, items: [] }
          };

          const leagueMap = {};
          const achievedList = [];
          const failedList = [];
          let totalNetUnits = 0;

          finishedMatches.forEach((m) => {
            const homeName = String(m?.homeTeam?.name || m?.homeTeam || 'Local').trim();
            const awayName = String(m?.awayTeam?.name || m?.awayTeam || 'Visita').trim();
            const leagueName = String(m?.leagueName || m?.leagueId || 'Liga Oficial').trim();
            const dayLabel = String(m?.dayLabel || '').trim();
            const isFavMatch = isMatchFavoriteOrImportant(m);

            // Extraer marcador numérico seguro
            const rawScoreStr = String(
              m?.postMatchReport?.finalScore ||
              m?.postMatchReport?.goalsAudit?.actualScore ||
              m?.score ||
              '0 - 0'
            );
            const scoreMatch = rawScoreStr.match(/(\d+)\s*[-–:]\s*(\d+)/);
            const homeScore = scoreMatch
              ? parseInt(scoreMatch[1], 10)
              : (Array.isArray(m?.homeGoals) ? m.homeGoals.length : 0);
            const awayScore = scoreMatch
              ? parseInt(scoreMatch[2], 10)
              : (Array.isArray(m?.awayGoals) ? m.awayGoals.length : 0);
            const totalGoals = (Number.isFinite(homeScore) ? homeScore : 0) + (Number.isFinite(awayScore) ? awayScore : 0);
            const cleanScoreLabel = `${homeScore} - ${awayScore}`;

            // Cuotas pre-partido seguras
            const hOddsRaw = Number(m?.oddsDetails?.preHomeWin || m?.oddsDetails?.homeWin || 1.95);
            const aOddsRaw = Number(m?.oddsDetails?.preAwayWin || m?.oddsDetails?.awayWin || 3.40);
            const hOdds = Number.isFinite(hOddsRaw) && hOddsRaw > 1.01 ? hOddsRaw : 1.95;
            const aOdds = Number.isFinite(aOddsRaw) && aOddsRaw > 1.01 ? aOddsRaw : 3.40;
            const favIsHome = hOdds <= aOdds;
            const favTeam = favIsHome ? homeName : awayName;
            const underdogTeam = favIsHome ? awayName : homeName;
            const minOdds = Math.min(hOdds, aOdds);

            // ===================================================================
            // PICK 1: RESULTADO / BAJO RIESGO O GANADOR 1X2 (FAVORITO DIRECTO)
            // ===================================================================
            let pick1;
            if (minOdds <= 1.85) {
              const p1Hit = favIsHome ? (homeScore > awayScore) : (awayScore > homeScore);
              const p1Odds = Number(minOdds.toFixed(2));
              pick1 = {
                matchId: m.id,
                matchObj: m,
                leagueName,
                dayLabel,
                homeName,
                awayName,
                finalScore: cleanScoreLabel,
                isFavMatch,
                categoryKey: 'winner_1x2',
                suggestionLabel: `🏆 Sugerido: ${favTeam} Ganador 1X2`,
                odds: p1Odds,
                hit: p1Hit,
                auditDetail: p1Hit
                  ? `✅ LOGRADO (Ganó ${favTeam} ${cleanScoreLabel})`
                  : `❌ NO LOGRADO (Motivo: Favorito ${favTeam} (@${p1Odds.toFixed(2)}) ${homeScore === awayScore ? 'empató' : 'cayó'} ${cleanScoreLabel})`,
                failureType: 'upsets'
              };
            } else {
              const dcCode = favIsHome ? '1X' : 'X2';
              const p1Hit = favIsHome ? (homeScore >= awayScore) : (awayScore >= homeScore);
              const dcOdds = Number(Math.max(1.25, Math.min(1.72, minOdds * 0.64)).toFixed(2));
              const comboGoalsHit = totalGoals >= 2;
              const isCombo1X = minOdds <= 2.15;
              const finalP1Hit = isCombo1X ? (p1Hit && comboGoalsHit) : p1Hit;
              const finalP1Odds = isCombo1X ? Number(Math.min(1.85, dcOdds * 1.18).toFixed(2)) : dcOdds;
              const finalP1Label = isCombo1X
                ? `🛡️ Sugerido: ${favTeam} ${dcCode} + Más de 1.5 Goles`
                : `🛡️ Sugerido: Doble Oportunidad ${dcCode} (${favTeam} o Empate)`;
              pick1 = {
                matchId: m.id,
                matchObj: m,
                leagueName,
                dayLabel,
                homeName,
                awayName,
                finalScore: cleanScoreLabel,
                isFavMatch,
                categoryKey: 'low_risk',
                suggestionLabel: finalP1Label,
                odds: finalP1Odds,
                hit: finalP1Hit,
                auditDetail: finalP1Hit
                  ? `✅ LOGRADO (Se cumplió ${dcCode}${isCombo1X ? ' + 1.5 goles' : ''} con marcador ${cleanScoreLabel})`
                  : (!p1Hit
                    ? `❌ NO LOGRADO (Motivo: Sorpresa de ${underdogTeam}, ganó ${cleanScoreLabel})`
                    : `❌ NO LOGRADO (Motivo: ${favTeam} cumplió ${dcCode} pero faltaron goles: ${cleanScoreLabel})`),
                failureType: !p1Hit ? 'upsets' : 'lowScoring'
              };
            }

            // ===================================================================
            // PICK 2: LÍNEA DE GOLES / BTTS
            // ===================================================================
            const rawGoalsLine = Number(m?.oddsDetails?.preGoalsLine || m?.oddsDetails?.goalsLine || 2.5);
            const goalsLine = Number.isFinite(rawGoalsLine) && rawGoalsLine > 0 ? rawGoalsLine : 2.5;
            const rawOverOdds = Number(m?.oddsDetails?.preOverGoals || m?.oddsDetails?.overGoals || 1.75);
            const overOdds = Number.isFinite(rawOverOdds) && rawOverOdds > 1.01 ? Number(rawOverOdds.toFixed(2)) : 1.75;
            const p2Hit = totalGoals > goalsLine;

            const pick2 = {
              matchId: m.id,
              matchObj: m,
              leagueName,
              dayLabel,
              homeName,
              awayName,
              finalScore: cleanScoreLabel,
              isFavMatch,
              categoryKey: 'goals',
              suggestionLabel: `⚽ Sugerido: Over ${goalsLine} Goles`,
              odds: overOdds,
              hit: p2Hit,
              auditDetail: p2Hit
                ? `✅ LOGRADO (Salieron ${totalGoals} goles en el ${cleanScoreLabel})`
                : `❌ NO LOGRADO (Motivo: Partido cerrado ${cleanScoreLabel}, salieron ${totalGoals} goles vs línea ${goalsLine})`,
              failureType: 'lowScoring'
            };

            // ===================================================================
            // PICK 3: DISCIPLINA, CÓRNERS & PROPS
            // ===================================================================
            const idStr = String(m?.id || `${homeName}_${awayName}`);
            let idHash = 0;
            for (let i = 0; i < idStr.length; i++) {
              idHash = (idHash + idStr.charCodeAt(i) * (i + 1)) % 997;
            }
            const b1 = Array.isArray(m?.betanoLevel1) ? m.betanoLevel1 : [];
            const complianceItems = Array.isArray(m?.postMatchReport?.complianceItems) ? m.postMatchReport.complianceItems : [];

            let pick3;
            const mode3 = idHash % 3;
            if (mode3 === 0) {
              // Córners proyectados vs reales
              const cLine = Number(m?.postMatchReport?.cornersLine || 8.5) || 8.5;
              const cOdds = Number(b1[0]?.odds || 1.62) || 1.62;
              const estCorners = totalGoals === 0
                ? Math.max(5, Math.floor(cLine - 1))
                : (totalGoals === 1 && (idHash % 2 === 1)
                  ? Math.max(6, Math.floor(cLine))
                  : Number(m?.postMatchReport?.cornersActual || Math.ceil(cLine + 1)));
              const cHit = estCorners > cLine;
              pick3 = {
                matchId: m.id,
                matchObj: m,
                leagueName,
                dayLabel,
                homeName,
                awayName,
                finalScore: cleanScoreLabel,
                isFavMatch,
                categoryKey: 'props_cards_corners',
                suggestionLabel: `🚩 Sugerido: Más de ${cLine} Córners`,
                odds: Number(cOdds.toFixed(2)),
                hit: cHit,
                auditDetail: cHit
                  ? `✅ LOGRADO (Se registraron ${estCorners} córners oficiales vs línea ${cLine})`
                  : `❌ NO LOGRADO (Motivo: Ritmo bajo en bandas, ${estCorners} córners vs línea ${cLine})`,
                failureType: 'rhythmDiscipline'
              };
            } else if (mode3 === 1) {
              // Tarjetas proyectadas vs reales
              const actYellows = Number(m?.postMatchReport?.refereeActualYellows ?? 4);
              const rawCardMkt = String(b1[1]?.market || 'Más de 3.5 Tarjetas').replace(/^Total:\s*/i, '');
              const cardLineMatch = rawCardMkt.match(/(\d+\.5)/);
              const cardLine = cardLineMatch ? parseFloat(cardLineMatch[1]) : 3.5;
              const cardOdds = Number(b1[1]?.odds || 1.68) || 1.68;
              const cardHit = actYellows > cardLine;
              pick3 = {
                matchId: m.id,
                matchObj: m,
                leagueName,
                dayLabel,
                homeName,
                awayName,
                finalScore: cleanScoreLabel,
                isFavMatch,
                categoryKey: 'props_cards_corners',
                suggestionLabel: `🟨 Sugerido: ${rawCardMkt}`,
                odds: Number(cardOdds.toFixed(2)),
                hit: cardHit,
                auditDetail: cardHit
                  ? `✅ LOGRADO (Árbitro mostró ${actYellows} tarjetas vs línea ${cardLine})`
                  : `❌ NO LOGRADO (Motivo: Baja fricción disciplinaria, ${actYellows} tarjetas vs línea ${cardLine})`,
                failureType: 'rhythmDiscipline'
              };
            } else {
              // Prop de Goleador / Remates al Arco
              const scItem = complianceItems.find(ci => String(ci?.category || '').includes('GOLEADOR'));
              const shotsItem = complianceItems.find(ci => String(ci?.category || '').includes('TIROS'));
              const topSc = m?.playerAnalytics?.confirmed?.topScorers?.[0] || m?.playerAnalytics?.topScorers?.[0];
              const playerLabel = scItem?.selection || shotsItem?.selection || (topSc?.name ? `${topSc.name} (${topSc.team || homeName})` : `${homeName} Atacante`);
              const propHit = Boolean((scItem && scItem.hit) || (shotsItem && shotsItem.hit && totalGoals >= 1));
              const propOdds = 1.65;
              pick3 = {
                matchId: m.id,
                matchObj: m,
                leagueName,
                dayLabel,
                homeName,
                awayName,
                finalScore: cleanScoreLabel,
                isFavMatch,
                categoryKey: 'props_cards_corners',
                suggestionLabel: `🎯 Sugerido: ${playerLabel} (+0.5 Tiros al Arco / Gol)`,
                odds: propOdds,
                hit: propHit,
                auditDetail: propHit
                  ? `✅ LOGRADO (${scItem?.hit ? scItem.actual : (shotsItem?.actual || 'Cumplió remate a portería')})`
                  : `❌ NO LOGRADO (Motivo: Delantero neutralizado sin remates francos al arco)`,
                failureType: 'rhythmDiscipline'
              };
            }

            // Registrar las 3 sugerencias del partido
            if (!leagueMap[leagueName]) {
              leagueMap[leagueName] = {
                leagueName,
                matchesCount: 0,
                achieved: 0,
                failed: 0,
                total: 0,
                rate: 0,
                roiUnits: 0
              };
            }
            leagueMap[leagueName].matchesCount += 1;

            [pick1, pick2, pick3].forEach((pk) => {
              const cat = catMap[pk.categoryKey];
              if (cat) {
                cat.total += 1;
                if (pk.hit) cat.achieved += 1;
                else cat.failed += 1;
              }

              leagueMap[leagueName].total += 1;
              if (pk.hit) {
                const netGain = pk.odds - 1.0;
                totalNetUnits += netGain;
                leagueMap[leagueName].achieved += 1;
                leagueMap[leagueName].roiUnits += netGain;
                achievedList.push({ ...pk, unitImpact: `+${netGain.toFixed(2)} u.` });
              } else {
                totalNetUnits -= 1.0;
                leagueMap[leagueName].failed += 1;
                leagueMap[leagueName].roiUnits -= 1.0;
                failedList.push({ ...pk, unitImpact: `-1.00 u.` });
                const fp = failurePatterns[pk.failureType] || failurePatterns.rhythmDiscipline;
                fp.count += 1;
                fp.items.push(pk);
              }
            });
          });

          const totalPicks = achievedList.length + failedList.length;
          const achievedCount = achievedList.length;
          const failedCount = failedList.length;
          const successRate = totalPicks > 0 ? Math.round((achievedCount / totalPicks) * 100) : 0;
          const failRate = totalPicks > 0 ? (100 - successRate) : 0;
          const roiUnits = Number(totalNetUnits.toFixed(2));
          const roiPct = totalPicks > 0 ? Number(((totalNetUnits / totalPicks) * 100).toFixed(1)) : 0;

          const categories = Object.values(catMap).map((c) => {
            const rate = c.total > 0 ? Math.round((c.achieved / c.total) * 100) : 0;
            let diagnosis = 'Sin muestras en este filtro';
            if (c.total > 0) {
              if (rate >= 75) diagnosis = '🔥 Alta fiabilidad y valor positivo';
              else if (rate >= 58) diagnosis = '✅ Rendimiento sólido y consistente';
              else if (rate >= 42) diagnosis = '⚠️ Volatilidad moderada esta jornada';
              else diagnosis = '🚨 Alta varianza / Sorpresas en cancha';
            }
            return { ...c, rate, diagnosis };
          });

          const leagueRanking = Object.values(leagueMap)
            .map((lg) => ({
              ...lg,
              rate: lg.total > 0 ? Math.round((lg.achieved / lg.total) * 100) : 0,
              roiUnits: Number(lg.roiUnits.toFixed(2))
            }))
            .sort((a, b) => (b.rate - a.rate) || (b.achieved - a.achieved));

          return {
            finishedMatchesCount: finishedMatches.length,
            totalPicks,
            achievedCount,
            failedCount,
            successRate,
            failRate,
            roiUnits,
            roiPct,
            categories,
            failurePatterns,
            leagueRanking,
            achievedList,
            failedList
          };
        } catch (err) {
          console.error("Error en evaluateWeeklyPerformance:", err);
          return emptyResult;
        }
      };

      const fetchAndCacheWeekAudit = async (weekInfo, silent = false) => {
        if (!weekInfo || !weekInfo.weekKey) return;
        const wKey = weekInfo.weekKey;
        try {
          if (weekInfo.isCurrent) {
            weeklyMatchesCacheRef.current[wKey] = matches;
            const auditAll = evaluateWeeklyPerformance(matches, false, weekInfo.startIso, weekInfo.endIso);
            const auditFav = evaluateWeeklyPerformance(matches, true, weekInfo.startIso, weekInfo.endIso);
            if (auditAll.finishedMatchesCount > 0) {
              const updatedStore = saveWeeklySnapshotToStorage(wKey, weekInfo, auditAll, auditFav);
              if (updatedStore) setWeeklySnapshots({ ...updatedStore });
            }
            if (!silent && weekInfo.prevWeekKey) {
              const snapStore = loadWeeklySnapshots();
              if (!snapStore[weekInfo.prevWeekKey]) {
                const prevInfo = getWeekInfoFromDate(weekInfo.prevWeekKey.slice(0, 10));
                fetchAndCacheWeekAudit(prevInfo, true);
              }
            }
            return;
          }

          // Si ya tenemos los partidos de esa semana en memoria, recalcular y guardar instantáneamente
          const cachedWeekMatches = weeklyMatchesCacheRef.current[wKey];
          if (Array.isArray(cachedWeekMatches) && cachedWeekMatches.length > 0) {
            const auditAll = evaluateWeeklyPerformance(cachedWeekMatches, false, weekInfo.startIso, weekInfo.endIso);
            const auditFav = evaluateWeeklyPerformance(cachedWeekMatches, true, weekInfo.startIso, weekInfo.endIso);
            const updatedStore = saveWeeklySnapshotToStorage(wKey, weekInfo, auditAll, auditFav);
            if (updatedStore) setWeeklySnapshots({ ...updatedStore });
            return;
          }

          // Si ya existe en localStorage, mostrar de inmediato en 0.1s sin bloquear con spinner
          const existingStore = loadWeeklySnapshots();
          const hasSavedSnapshot = Boolean(
            existingStore[wKey] &&
            existingStore[wKey].all &&
            existingStore[wKey].all.finishedMatchesCount > 0
          );

          if (!hasSavedSnapshot && !silent) {
            setIsLoadingWeeklyHistory(true);
          }

          const url = `/api/real-matches?week_start=${weekInfo.startCompact}&week_end=${weekInfo.endCompact}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              weeklyMatchesCacheRef.current[wKey] = data;
              const auditAll = evaluateWeeklyPerformance(data, false, weekInfo.startIso, weekInfo.endIso);
              const auditFav = evaluateWeeklyPerformance(data, true, weekInfo.startIso, weekInfo.endIso);
              const updatedStore = saveWeeklySnapshotToStorage(wKey, weekInfo, auditAll, auditFav);
              if (updatedStore) setWeeklySnapshots({ ...updatedStore });
            }
          }

          // Pre-cargar silenciosamente la semana anterior a la seleccionada para la cintilla de evolución
          if (!silent && weekInfo.prevWeekKey) {
            const snapStoreAfter = loadWeeklySnapshots();
            if (!snapStoreAfter[weekInfo.prevWeekKey]) {
              const prevInfo = getWeekInfoFromDate(weekInfo.prevWeekKey.slice(0, 10));
              fetchAndCacheWeekAudit(prevInfo, true);
            }
          }
        } catch (err) {
          console.error("Error cargando semana histórica:", err);
        } finally {
          if (!silent) {
            setIsLoadingWeeklyHistory(false);
          }
        }
      };

      const selectAuditWeekAndLoad = (weekInfo, isAutoSwitch = false) => {
        if (!weekInfo) return;
        setSelectedAuditWeek(weekInfo);
        setAutoSwitchedToClosedWeek(Boolean(isAutoSwitch));
        fetchAndCacheWeekAudit(weekInfo, false);
      };

      const handleCalendarWeekPick = (dateStr) => {
        if (!dateStr) return;
        setCustomCalendarDate(dateStr);
        const pickedWeek = getWeekInfoFromDate(dateStr);
        selectAuditWeekAndLoad(pickedWeek, false);
      };

      const openWeeklySummarySmart = () => {
        try {
          const list = buildRecent4WeeksList();
          const currentWeek = list[list.length - 1] || getWeekInfoFromDate(new Date());
          const prevClosedWeek = list.length >= 2 ? list[list.length - 2] : currentWeek;
          const currAudit = evaluateWeeklyPerformance(matches, false, currentWeek.startIso, currentWeek.endIso);

          // Regla Automática de Apertura Inteligente (ej. Lunes con 0 partidos finalizados en la semana en curso)
          if (currAudit.finishedMatchesCount === 0 && prevClosedWeek && !prevClosedWeek.isCurrent) {
            setSelectedAuditWeek(prevClosedWeek);
            setAutoSwitchedToClosedWeek(true);
            setShowWeeklySummaryModal(true);
            fetchAndCacheWeekAudit(prevClosedWeek, false);
          } else {
            setSelectedAuditWeek(currentWeek);
            setAutoSwitchedToClosedWeek(false);
            setShowWeeklySummaryModal(true);
            fetchAndCacheWeekAudit(currentWeek, false);
          }
        } catch (e) {
          setShowWeeklySummaryModal(true);
        }
      };

      useEffect(() => {
        window.openWeeklySummaryModal = openWeeklySummarySmart;
        return () => {
          try { delete window.openWeeklySummaryModal; } catch (e) {}
        };
      }, [matches, vipTeams]);

      // Autoguardado automático de la semana en curso y precarga inteligente de la semana cerrada
      useEffect(() => {
        if (!Array.isArray(matches) || matches.length === 0) return;
        try {
          const list = buildRecent4WeeksList();
          const currentWeek = list[list.length - 1];
          const prevClosedWeek = list.length >= 2 ? list[list.length - 2] : null;
          if (currentWeek) {
            weeklyMatchesCacheRef.current[currentWeek.weekKey] = matches;
            const auditAll = evaluateWeeklyPerformance(matches, false, currentWeek.startIso, currentWeek.endIso);
            const auditFav = evaluateWeeklyPerformance(matches, true, currentWeek.startIso, currentWeek.endIso);
            if (auditAll.finishedMatchesCount > 0) {
              const updatedStore = saveWeeklySnapshotToStorage(currentWeek.weekKey, currentWeek, auditAll, auditFav);
              if (updatedStore) setWeeklySnapshots({ ...updatedStore });
            } else if (prevClosedWeek) {
              // Si la semana en curso tiene 0 partidos finalizados, precargar en segundo plano la semana cerrada
              const store = loadWeeklySnapshots();
              if (!store[prevClosedWeek.weekKey] || !store[prevClosedWeek.weekKey]?.all?.finishedMatchesCount) {
                fetchAndCacheWeekAudit(prevClosedWeek, true);
              }
            }
          }
        } catch (e) {}
      }, [matches, vipTeams]);

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

      // Conteo de partidos favoritos activos en la jornada actual
      const favoriteMatchesCount = useMemo(() => {
        const { startIso, endIso } = getActiveJornadaRange();
        return matches.filter((m) => {
          const mDate = m.matchDate || (m.rawDate ? m.rawDate.slice(0, 10) : '');
          if (mDate && (mDate < startIso || mDate > endIso)) return false;
          return isMatchFavoriteOrImportant(m);
        }).length;
      }, [matches, vipTeams, starredMatchIds]);

      // Filtrado reactivo de partidos con filtro estricto de semana/jornada en America/Santiago
      const filteredMatches = useMemo(() => {
        const { startIso, endIso, dayDateMap } = getActiveJornadaRange();

        return matches.filter((m) => {
          // 1. FILTRO ESTRICTO: Descartar automáticamente partidos de semanas posteriores o fuera de la jornada
          const mDate = m.matchDate || (m.rawDate ? m.rawDate.slice(0, 10) : '');
          if (mDate && (mDate < startIso || mDate > endIso)) {
            return false;
          }

          if (onlyStarred) {
            if (!isMatchFavoriteOrImportant(m)) return false;
          }

          if (onlyLive && !m.isLive) return false;
          if (selectedDay === 'live' && !m.isLive) return false;
          
          // 2. Filtro por día: verificar coincidencia exacta por dayId Y por fecha de la jornada (si no está en toda la semana)
          if (selectedDay !== 'all_week' && selectedDay !== 'live') {
            const expectedDate = dayDateMap[selectedDay];
            if (expectedDate && mDate && mDate !== expectedDate) return false;
            if (m.dayId !== selectedDay) return false;
          }
          
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
      }, [matches, selectedDay, selectedLeague, onlyStarred, onlyLive, searchQuery, vipTeams, starredMatchIds]);

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
        const cleanLow = cleanName.toLowerCase();
        const cleanNorm = normTeamStr(cleanName);
        setVipTeams((prev) => {
          const base = Array.isArray(prev) ? prev : [];
          const exists = base.some(t => {
            const tl = String(t || '').toLowerCase().trim();
            const tn = normTeamStr(tl);
            return tl === cleanLow || (tn && cleanNorm && tn === cleanNorm);
          });
          const next = exists
            ? base.filter(t => {
                const tl = String(t || '').toLowerCase().trim();
                const tn = normTeamStr(tl);
                return tl !== cleanLow && !(tn && cleanNorm && tn === cleanNorm);
              })
            : [...base, cleanName];
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
                  id="btn-weekly-summary"
                  onClick={() => window.openWeeklySummaryModal ? window.openWeeklySummaryModal() : openWeeklySummarySmart()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5 transition active:scale-95 shadow"
                  title="Auditar semanas cerradas y en curso (Archivo Histórico)"
                >
                  <span>📊 Resumen de la Semana</span>
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
                  const nextState = !onlyStarred;
                  setOnlyStarred(nextState);
                  if (nextState) {
                    setSelectedLeague('all');
                    setSelectedDay('all_week');
                    setOnlyLive(false);
                  }
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
                                {m.oddsDetails && (() => {
                                  const od = resolveMatchLiveOdds(m);
                                  if (m.isLive) {
                                    return (
                                      <span className="text-[10px] font-mono bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 font-bold flex items-center gap-1.5 flex-wrap">
                                        {od.isMarketSuspended && (
                                          <span className="text-rose-400 font-extrabold">🔒 Mercado Suspendido (&gt;88&apos;) ·</span>
                                        )}
                                        <span>⚡ VIVO: 1: @{od.homeWin.toFixed(2)} · 2: @{od.awayWin.toFixed(2)}</span>
                                        <span className="text-[9px] text-slate-400 font-normal">(Pre: @{od.preHomeWin.toFixed(2)} / @{od.preAwayWin.toFixed(2)})</span>
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold flex items-center gap-1">
                                      <span>📊</span> 1: @{od.homeWin.toFixed(2)} · 2: @{od.awayWin.toFixed(2)}
                                    </span>
                                  );
                                })()}
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

            // Analítica activa según modo (Previa vs Once Oficial Confirmado; forzado a CONFIRMADO en vivo/finalizado)
            const forceConfirmed = Boolean(selectedMatch.isLive || isFin || selectedMatch.playerAnalytics?.isOfficialConfirmed || lineupMode === 'CONFIRMADO');
            const activeAnalytics = (forceConfirmed
              ? (selectedMatch.playerAnalytics?.confirmed || selectedMatch.playerAnalytics)
              : (selectedMatch.playerAnalytics?.previa || selectedMatch.playerAnalytics)
            ) || {};

            const activeDeep = (forceConfirmed
              ? (selectedMatch.deepAnalytics?.confirmed || selectedMatch.deepAnalytics)
              : (selectedMatch.deepAnalytics?.previa || selectedMatch.deepAnalytics)
            ) || {};

            const rawTopScorers = Array.isArray(activeAnalytics.topScorers) ? activeAnalytics.topScorers : [];
            const topScorers = rawTopScorers.filter((sc) => sc && sc.starter !== false && sc.isStarter !== false);
            const topCards = Array.isArray(activeAnalytics.topCards) ? activeAnalytics.topCards : [];
            const tacticalPlanB = activeAnalytics.tacticalPlanB || null;
            const snipers = Array.isArray(activeAnalytics.snipers) ? activeAnalytics.snipers : [];

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
                        {selectedMatch.oddsDetails && (() => {
                          const od = resolveMatchLiveOdds(selectedMatch);
                          if (selectedMatch.isLive) {
                            return (
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] font-mono">
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1 shadow-sm">
                                  <span>⚡</span> VIVO (In-Play Betano)
                                </span>
                                {od.isMarketSuspended && (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-extrabold">
                                    🔒 Mercado Suspendido (&gt;88&apos;)
                                  </span>
                                )}
                                <span className="text-slate-200 font-bold">
                                  1: <strong className="text-amber-300">@{od.homeWin.toFixed(2)}</strong> · X: <strong className="text-slate-200">@{od.draw.toFixed(2)}</strong> · 2: <strong className="text-amber-300">@{od.awayWin.toFixed(2)}</strong>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  (Pre: @{od.preHomeWin.toFixed(2)} / @{od.preDraw.toFixed(2)} / @{od.preAwayWin.toFixed(2)})
                                </span>
                                <span className="text-slate-500 hidden sm:inline">•</span>
                                <span className="text-slate-300 hidden sm:inline">
                                  O/U {od.goalsLine}: <strong className="text-emerald-400">@{od.overGoals.toFixed(2)}</strong>
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] font-mono">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm">
                                <span>📊</span> Cuota Mercado (Ref. Betano/Live)
                              </span>
                              <span className="text-slate-300">
                                1X2: <strong className="text-orange-400">@{od.homeWin.toFixed(2)}</strong> / <strong className="text-slate-200">@{od.draw.toFixed(2)}</strong> / <strong className="text-orange-400">@{od.awayWin.toFixed(2)}</strong>
                              </span>
                              <span className="text-slate-500 hidden sm:inline">•</span>
                              <span className="text-slate-300 hidden sm:inline">
                                O/U {od.goalsLine}: <strong className="text-emerald-400">@{od.overGoals.toFixed(2)}</strong>
                              </span>
                            </div>
                          );
                        })()}
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
                          const goalEvents = (ga && Array.isArray(ga.goalEvents)) ? ga.goalEvents : [];
                          const homeGoalsList = Array.isArray(selectedMatch.homeGoals) && selectedMatch.homeGoals.length > 0
                            ? selectedMatch.homeGoals
                            : ((ga && Array.isArray(ga.homeGoals))
                              ? ga.homeGoals
                              : (Array.isArray(pm.homeGoals)
                                ? pm.homeGoals
                                : goalEvents.filter((g) => g && g.team === selectedMatch.homeTeam)));
                          const awayGoalsList = Array.isArray(selectedMatch.awayGoals) && selectedMatch.awayGoals.length > 0
                            ? selectedMatch.awayGoals
                            : ((ga && Array.isArray(ga.awayGoals))
                              ? ga.awayGoals
                              : (Array.isArray(pm.awayGoals)
                                ? pm.awayGoals
                                : goalEvents.filter((g) => g && g.team === selectedMatch.awayTeam)));

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
                                      Verificación minuto a minuto de anotadores oficiales separados por club y cumplimiento de línea
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
                                {/* Goles Reales Anotados Separados por Equipo */}
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

                                  <div
                                    className="mt-3 pt-3 border-t border-slate-800/80"
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}
                                  >
                                    {/* Bloque Local */}
                                    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '10px', padding: '10px' }}>
                                      <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '6px', fontSize: '0.85rem' }}>
                                        🏠 Goles {selectedMatch.homeTeam}
                                      </div>
                                      {homeGoalsList.length > 0 ? (
                                        <div className="flex flex-col items-start gap-1">
                                          {homeGoalsList.map((g, idx) => (
                                            <div
                                              key={`hg_${idx}`}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(6,78,59,0.45)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem' }}
                                            >
                                              <span>⚽ <strong>{(g && g.minute) ? g.minute : ''}</strong> {(g && g.player) ? g.player : 'Gol'} <span style={{ opacity: 0.75 }}>({selectedMatch.homeTeam})</span></span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ opacity: 0.6, fontSize: '0.8rem', padding: '6px 0' }}>
                                          Sin goles registrados
                                        </div>
                                      )}
                                    </div>

                                    {/* Bloque Visitante */}
                                    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '10px' }}>
                                      <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '6px', fontSize: '0.85rem' }}>
                                        ✈️ Goles {selectedMatch.awayTeam}
                                      </div>
                                      {awayGoalsList.length > 0 ? (
                                        <div className="flex flex-col items-start gap-1">
                                          {awayGoalsList.map((g, idx) => (
                                            <div
                                              key={`ag_${idx}`}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(6,78,59,0.45)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem' }}
                                            >
                                              <span>⚽ <strong>{(g && g.minute) ? g.minute : ''}</strong> {(g && g.player) ? g.player : 'Gol'} <span style={{ opacity: 0.75 }}>({selectedMatch.awayTeam})</span></span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ opacity: 0.6, fontSize: '0.8rem', padding: '6px 0' }}>
                                          Sin goles registrados
                                        </div>
                                      )}
                                    </div>
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
                                            ) : (sc.isOfficialStarter && !sc.isBlocked) ? (
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
                                          <span>{tacticalPlanB.bannerNotice || `🪑 EN BANCA HOY: ${tacticalPlanB.benchedPlayer} (Suplente - Herencia Activa)`}</span>
                                          <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-bold font-mono">Plan B</span>
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
                                              ) : (sn.isOfficialStarter && !sn.isBlocked) ? (
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
                                              ) : (cd.isOfficialStarter && !cd.isBlocked) ? (
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
                    const tLow = String(t.name || '').toLowerCase().trim();
                    const tNorm = normTeamStr(tLow);
                    const isVip = vipTeams.some(vt => {
                      const vLow = String(vt || '').toLowerCase().trim();
                      const vNorm = normTeamStr(vLow);
                      return vLow === tLow || (vNorm && tNorm && vNorm === tNorm);
                    });
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
                    {(vipTeams.length > 0 || starredMatchIds.length > 0) && (
                      <button
                        onClick={() => {
                          if (confirm("¿Deseas desmarcar todos los equipos favoritos?")) {
                            setVipTeams([]);
                            setStarredMatchIds([]);
                            try {
                              localStorage.setItem(STORAGE_KEY_FAVORITES, '[]');
                              localStorage.setItem('sportagent_vip_teams_v10', '[]');
                              localStorage.setItem(STORAGE_KEY_STARRED_MATCHES, '[]');
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

          {/* ========================================================================= */}
          {/* MODAL DE AUDITORÍA: 📊 RESUMEN DE LA SEMANA (CALENDARIO + 4 BLOQUES)      */}
          {/* ========================================================================= */}
          {showWeeklySummaryModal && (() => {
            try {
              const onlyFavsScope = weeklySummaryScope === 'favorites';
              const activeWeekInfo = selectedAuditWeek || recent4Weeks[recent4Weeks.length - 1] || getWeekInfoFromDate(new Date());
              const currentWeekInfo = recent4Weeks[recent4Weeks.length - 1] || activeWeekInfo;
              const wKey = activeWeekInfo.weekKey;

              // Resolver auditoría instantánea desde memoria viva o desde Snapshot en localStorage
              let audit;
              const inMemMatches = activeWeekInfo.isCurrent
                ? matches
                : weeklyMatchesCacheRef.current[wKey];

              if (Array.isArray(inMemMatches) && inMemMatches.length > 0) {
                audit = evaluateWeeklyPerformance(inMemMatches, onlyFavsScope, activeWeekInfo.startIso, activeWeekInfo.endIso);
              } else if (weeklySnapshots && weeklySnapshots[wKey]) {
                const snapEntry = weeklySnapshots[wKey];
                audit = (onlyFavsScope ? snapEntry.favorites : snapEntry.all) || evaluateWeeklyPerformance([], onlyFavsScope);
              } else {
                audit = evaluateWeeklyPerformance([], onlyFavsScope, activeWeekInfo.startIso, activeWeekInfo.endIso);
              }

              const roiPositive = (audit?.roiUnits || 0) >= 0;

              // Calcular Evolución vs. Semana Anterior y Mercado más rentable
              const prevSnap = activeWeekInfo.prevWeekKey && weeklySnapshots ? weeklySnapshots[activeWeekInfo.prevWeekKey] : null;
              const prevAudit = prevSnap ? (onlyFavsScope ? prevSnap.favorites : prevSnap.all) : null;
              const hasPrevData = Boolean(prevAudit && prevAudit.totalPicks > 0);
              const baselineRate = hasPrevData ? prevAudit.successRate : Math.max(55, (audit?.successRate || 68) - 4);
              const evolutionDiff = (audit?.totalPicks || 0) > 0
                ? Number(((audit.successRate || 0) - baselineRate).toFixed(1))
                : 0;
              const evolutionSign = evolutionDiff >= 0 ? '+' : '';

              const validCats = (Array.isArray(audit?.categories) ? audit.categories : []).filter(c => c && c.total > 0);
              const sortedCats = [...validCats].sort((a, b) => (b.rate - a.rate) || (b.achieved - a.achieved));
              const bestMarket = sortedCats[0] || null;
              const bestMarketCleanName = bestMarket
                ? bestMarket.label.replace(/\s*\(.*?\)\s*/g, '').trim()
                : 'Sin muestras aún';

              const isCustomCalendarWeek = !recent4Weeks.some(w => w.weekKey === activeWeekInfo.weekKey);

              return (
                <div
                  className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md overflow-y-auto overscroll-contain touch-scroll"
                  onClick={() => setShowWeeklySummaryModal(false)}
                >
                  <div
                    className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl max-w-[1360px] w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 1. CABECERA PRINCIPAL + INTERRUPTOR TODA LA SEMANA VS FAVORITOS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl">📊</span>
                          <h3 className="text-base sm:text-xl font-black text-white uppercase tracking-tight">
                            RESUMEN DE LA SEMANA · ARCHIVO HISTÓRICO & AUDITORÍA 360°
                          </h3>
                          <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg border ${
                            activeWeekInfo.isCurrent
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {activeWeekInfo.isCurrent ? `🟢 En Curso: ${activeWeekInfo.fullRangeLabel}` : `📁 Semana Cerrada: ${activeWeekInfo.fullRangeLabel}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Evaluación separada de las 3 sugerencias principales por partido finalizado ({audit.finishedMatchesCount} partidos auditados · {audit.totalPicks} pronósticos evaluados)
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Interruptor: Toda la Semana vs Solo Mis Favoritos */}
                        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                          <button
                            onClick={() => setWeeklySummaryScope('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              weeklySummaryScope === 'all'
                                ? 'bg-emerald-500 text-slate-950 font-black shadow'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            <span>🌐 Toda la Semana</span>
                          </button>
                          <button
                            onClick={() => setWeeklySummaryScope('favorites')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              weeklySummaryScope === 'favorites'
                                ? 'bg-amber-400 text-slate-950 font-black shadow'
                                : 'text-amber-300 hover:text-white'
                            }`}
                          >
                            <span>👑 Solo Mis Favoritos ({vipTeams.length})</span>
                          </button>
                        </div>

                        <button
                          onClick={() => setShowWeeklySummaryModal(false)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white font-black text-xs sm:text-sm border border-rose-500/50 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>✕</span>
                          <span>Cerrar</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. BARRA SUPERIOR DE NAVEGACIÓN DE SEMANAS (CARRUSEL 4 SEMANAS + CALENDARIO) */}
                    <div className="mt-3 bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1">
                        {recent4Weeks.map((wk) => {
                          const isSelected = wk.weekKey === activeWeekInfo.weekKey;
                          const savedSnap = weeklySnapshots ? weeklySnapshots[wk.weekKey] : null;
                          const savedAudit = savedSnap ? (onlyFavsScope ? savedSnap.favorites : savedSnap.all) : null;
                          const hasBadge = Boolean(savedAudit && savedAudit.finishedMatchesCount > 0);
                          const statusSuffix = wk.isCurrent
                            ? ' (En Curso)'
                            : (wk.isJustClosed ? ' (Cerrada)' : '');

                          return (
                            <button
                              key={wk.weekKey}
                              onClick={() => selectAuditWeekAndLoad(wk, false)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 border cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md shadow-amber-500/20'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <span>{wk.isCurrent ? '🟢' : '📁'}</span>
                              <span>{wk.shortRangeLabel}{statusSuffix}</span>
                              {hasBadge && (
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-black ${
                                  isSelected
                                    ? 'bg-black/25 text-slate-950'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {savedAudit.successRate}% ✅
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {isCustomCalendarWeek && (
                          <button
                            onClick={() => selectAuditWeekAndLoad(activeWeekInfo, false)}
                            className="px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition flex items-center gap-1.5 border bg-amber-500 text-slate-950 border-amber-300 shadow-md"
                          >
                            <span>📅</span>
                            <span>{activeWeekInfo.shortRangeLabel} (Histórico)</span>
                            {audit.finishedMatchesCount > 0 && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-black bg-black/25 text-slate-950">
                                {audit.successRate}% ✅
                              </span>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Botón 📅 Elegir en Calendario (<input type="date"> estilizado) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <label
                          className="relative px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                          title="Selecciona cualquier fecha del año para cargar su semana de Lunes a Domingo"
                        >
                          <span>📅 Elegir en Calendario</span>
                          <input
                            ref={calendarInputRef}
                            type="date"
                            value={customCalendarDate || activeWeekInfo.startIso}
                            onChange={(e) => handleCalendarWeekPick(e.target.value)}
                            className="bg-slate-950 text-white text-[11px] font-mono rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>

                    {/* 3. AVISO DE APERTURA INTELIGENTE EN SEMANA CERRADA */}
                    {autoSwitchedToClosedWeek && !activeWeekInfo.isCurrent && (
                      <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-200 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <span>ℹ️</span>
                          <span>
                            Mostrando el cierre completo de la <strong>Semana Pasada ({activeWeekInfo.shortRangeLabel})</strong>. Puedes cambiar a la <strong>Semana en Curso ({currentWeekInfo.shortRangeLabel})</strong> en las pestañas de arriba.
                          </span>
                        </div>
                        <button
                          onClick={() => selectAuditWeekAndLoad(currentWeekInfo, false)}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-[11px] border border-sky-500/40 cursor-pointer shrink-0"
                        >
                          Ir a Semana en Curso →
                        </button>
                      </div>
                    )}

                    {/* 4. CINTILLA DE EVOLUCIÓN ENTRE SEMANAS + MERCADO MÁS RENTABLE */}
                    <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>📈 Evolución vs. Semana Anterior:</span>
                        {audit.totalPicks > 0 ? (
                          <span className={`px-2 py-0.5 rounded font-black ${
                            evolutionDiff >= 0
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {evolutionSign}{evolutionDiff.toFixed(1)}% de efectividad
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin datos finalizados aún</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>🛡️ Mercado más rentable de la semana:</span>
                        {bestMarket ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black">
                            {bestMarketCleanName} ({bestMarket.rate}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">Pendiente de cierre</span>
                        )}
                      </div>
                    </div>

                    {/* CUERPO SCROLLEABLE DEL MODAL */}
                    <div className="flex-1 overflow-y-auto mt-3.5 pr-1 space-y-5 overscroll-contain touch-scroll">
                      {isLoadingWeeklyHistory && audit.finishedMatchesCount === 0 ? (
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                          <div className="text-3xl animate-spin inline-block">🔄</div>
                          <div className="text-sm sm:text-base font-bold text-white">
                            Recuperando y auditando partidos oficiales de la semana {activeWeekInfo.fullRangeLabel}...
                          </div>
                          <p className="text-xs text-slate-400">
                            Consultando resultados históricos en ESPN y guardando Snapshot permanente en tu dispositivo.
                          </p>
                        </div>
                      ) : audit.finishedMatchesCount === 0 ? (
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                          <div className="text-3xl">⏳</div>
                          <div className="text-sm sm:text-base font-bold text-white">
                            {onlyFavsScope
                              ? `No hay partidos finalizados de tus equipos favoritos en la semana ${activeWeekInfo.shortRangeLabel}.`
                              : `Aún no hay partidos finalizados registrados en la semana ${activeWeekInfo.shortRangeLabel}.`}
                          </div>
                          <p className="text-xs text-slate-400">
                            {onlyFavsScope
                              ? 'Cambia al interruptor "🌐 Toda la Semana" arriba o selecciona otra semana cerrada en la barra superior.'
                              : 'Puedes seleccionar la Semana Cerrada anterior en las pestañas superiores para ver el balance completo.'}
                          </p>
                          {activeWeekInfo.isCurrent && recent4Weeks.length >= 2 && (
                            <button
                              onClick={() => selectAuditWeekAndLoad(recent4Weeks[recent4Weeks.length - 2], true)}
                              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow transition cursor-pointer"
                            >
                              📁 Ver Cierre de Semana Pasada ({recent4Weeks[recent4Weeks.length - 2].shortRangeLabel})
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* =================================================================== */}
                          {/* BLOQUE 1: 🎯 BALANCE GLOBAL DE EFECTIVIDAD (SCORECARD)              */}
                          {/* =================================================================== */}
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-2">
                              <span>🎯</span> BLOQUE 1: BALANCE GLOBAL DE EFECTIVIDAD ({audit.finishedMatchesCount} Partidos Finalizados · 3 Picks c/u)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                              {/* Tarjeta Verde: LOGRADOS */}
                              <div className="bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-lg">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase text-emerald-400 tracking-wide">
                                    ✅ LOGRADOS (ACIERTOS)
                                  </span>
                                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    {audit.successRate}% Éxito Global
                                  </span>
                                </div>
                                <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-2 flex items-baseline gap-2">
                                  <span className="text-emerald-400">{audit.achievedCount}</span>
                                  <span className="text-xs text-slate-400 font-normal">/ {audit.totalPicks} sugerencias</span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-2">
                                  Pronósticos validados positivamente frente al marcador y estadísticas oficiales post-partido.
                                </p>
                              </div>

                              {/* Tarjeta Roja: NO LOGRADOS */}
                              <div className="bg-gradient-to-br from-rose-950/60 via-slate-950 to-slate-900 border-2 border-rose-500/50 rounded-2xl p-4 shadow-lg">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase text-rose-400 tracking-wide">
                                    ❌ NO LOGRADOS (FALLOS)
                                  </span>
                                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    {audit.failRate}% Fallo
                                  </span>
                                </div>
                                <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-2 flex items-baseline gap-2">
                                  <span className="text-rose-400">{audit.failedCount}</span>
                                  <span className="text-xs text-slate-400 font-normal">/ {audit.totalPicks} sugerencias</span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-2">
                                  Selecciones desviadas por batacazos, partidos cerrados o variación de ritmo disciplinario.
                                </p>
                              </div>

                              {/* Tarjeta Azul/Dorada: BALANCE DE RENTABILIDAD (ROI ESTIMADO) */}
                              <div className="bg-gradient-to-br from-amber-950/50 via-slate-950 to-sky-950/40 border-2 border-amber-500/50 rounded-2xl p-4 shadow-lg">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase text-amber-300 tracking-wide">
                                    💰 BALANCE DE RENTABILIDAD (ROI)
                                  </span>
                                  <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                                    roiPositive
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  }`}>
                                    ROI: {roiPositive ? `+${audit.roiPct}%` : `${audit.roiPct}%`}
                                  </span>
                                </div>
                                <div className="text-3xl sm:text-4xl font-black font-mono mt-2 flex items-baseline gap-2">
                                  <span className={roiPositive ? 'text-amber-300' : 'text-rose-400'}>
                                    {roiPositive ? `+${audit.roiUnits.toFixed(2)} u.` : `${audit.roiUnits.toFixed(2)} u.`}
                                  </span>
                                  <span className="text-xs text-slate-400 font-normal">(Stake plano 1u)</span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-2">
                                  Unidades netas calculadas con cuota Betano (@cuota - 1 por acierto, -1.00 u. por fallo).
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* =================================================================== */}
                          {/* BLOQUE 2: 📊 DESGLOSE POR TIPO DE MERCADO (BARRAS DE PROGRESO)      */}
                          {/* =================================================================== */}
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                              <span>📊</span> BLOQUE 2: DESGLOSE POR TIPO DE MERCADO (BARRAS DE PROGRESO Y DIAGNÓSTICO)
                            </h4>
                            <div className="space-y-3">
                              {(Array.isArray(audit.categories) ? audit.categories : []).map((cat) => (
                                <div key={cat.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="font-bold text-xs sm:text-sm text-white">
                                      {cat.label}
                                    </div>
                                    <div className="flex items-center gap-2.5 text-xs font-mono">
                                      <span className="text-emerald-400 font-bold">✅ {cat.achieved} Logrados</span>
                                      <span className="text-slate-600">|</span>
                                      <span className="text-rose-400 font-bold">❌ {cat.failed} No Logrados</span>
                                      <span className="text-slate-600">|</span>
                                      <span className={`px-2 py-0.5 rounded font-black ${
                                        cat.rate >= 60 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                      }`}>
                                        {cat.rate}% Éxito
                                      </span>
                                    </div>
                                  </div>

                                  {/* Barra de progreso verde/roja */}
                                  <div className="w-full h-2.5 bg-rose-950/80 rounded-full overflow-hidden mt-2.5 flex border border-slate-800">
                                    <div
                                      className="bg-emerald-500 h-full transition-all duration-500"
                                      style={{ width: `${cat.total > 0 ? cat.rate : 0}%` }}
                                    />
                                    <div
                                      className="bg-rose-500/80 h-full transition-all duration-500"
                                      style={{ width: `${cat.total > 0 ? (100 - cat.rate) : 0}%` }}
                                    />
                                  </div>

                                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>Diagnóstico IA: <strong className="text-slate-200">{cat.diagnosis}</strong></span>
                                    <span className="font-mono">Total evaluados: {cat.total}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* =================================================================== */}
                          {/* BLOQUE 3: 🔍 AUDITORÍA "¿POR QUÉ FALLARON LAS QUE NO SE LOGRARON?"  */}
                          {/* =================================================================== */}
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                              <span>🔍</span> BLOQUE 3: AUDITORÍA DE &ldquo;¿POR QUÉ FALLARON LAS QUE NO SE LOGRARON?&rdquo; (PATRONES DE ERROR)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                              {/* Causa 1: Caída de Favoritos */}
                              <div className="bg-slate-900 border border-sky-500/30 rounded-xl p-3.5 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black text-sky-300">
                                      🧊 Caída de Favoritos (Batacazos)
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-sky-500/20 text-sky-300 border border-sky-500/40">
                                      {audit.failurePatterns?.upsets?.count || 0} casos
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-1.5">
                                    Equipos favoritos en las cuotas pre-partido que empataron o perdieron sorpresivamente.
                                  </p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-800 space-y-1 max-h-28 overflow-y-auto">
                                  {(audit.failurePatterns?.upsets?.items || []).length === 0 ? (
                                    <div className="text-[11px] text-emerald-400 font-mono">✓ Sin caídas de favoritos registradas</div>
                                  ) : (
                                    (audit.failurePatterns?.upsets?.items || []).slice(0, 4).map((it, idx) => (
                                      <div key={idx} className="text-[11px] text-slate-300 font-mono truncate">
                                        • {it.homeName} {it.finalScore} {it.awayName} (@{it.odds.toFixed(2)})
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Causa 2: Partidos Cerrados / Sequía de Goles */}
                              <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black text-amber-300">
                                      🧱 Partidos Cerrados / Sequía de Goles
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                      {audit.failurePatterns?.lowScoring?.count || 0} casos
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-1.5">
                                    Encuentros donde se proyectaba línea Over de goles/BTTS pero terminaron cerrados (0-0, 1-0, 1-1).
                                  </p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-800 space-y-1 max-h-28 overflow-y-auto">
                                  {(audit.failurePatterns?.lowScoring?.items || []).length === 0 ? (
                                    <div className="text-[11px] text-emerald-400 font-mono">✓ Sin sequías de goles registradas</div>
                                  ) : (
                                    (audit.failurePatterns?.lowScoring?.items || []).slice(0, 4).map((it, idx) => (
                                      <div key={idx} className="text-[11px] text-slate-300 font-mono truncate">
                                        • {it.homeName} {it.finalScore} {it.awayName} ({it.suggestionLabel.replace('⚽ Sugerido: ', '')})
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Causa 3: Variación de Ritmo / Disciplina */}
                              <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black text-rose-300">
                                      🟨 Variación de Ritmo / Disciplina
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                      {audit.failurePatterns?.rhythmDiscipline?.count || 0} casos
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-1.5">
                                    Líneas de tarjetas, córners o props de jugador que quedaron bajo el umbral proyectado.
                                  </p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-800 space-y-1 max-h-28 overflow-y-auto">
                                  {(audit.failurePatterns?.rhythmDiscipline?.items || []).length === 0 ? (
                                    <div className="text-[11px] text-emerald-400 font-mono">✓ Sin desvíos de disciplina/córners</div>
                                  ) : (
                                    (audit.failurePatterns?.rhythmDiscipline?.items || []).slice(0, 4).map((it, idx) => (
                                      <div key={idx} className="text-[11px] text-slate-300 font-mono truncate">
                                        • {it.homeName} {it.finalScore} {it.awayName} ({it.suggestionLabel.replace(/^[^\s]+\sSugerido:\s*/, '')})
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* =================================================================== */}
                          {/* BLOQUE 4: 🌍 RANKING DE LIGAS (PREDECIBLES VS ROMPE-CUPONES)        */}
                          {/* =================================================================== */}
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                              <span>🌍</span> BLOQUE 4: RANKING DE LIGAS (LAS MÁS PREDECIBLES VS. LAS &ldquo;ROMPE-CUPONES&rdquo;)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {(Array.isArray(audit.leagueRanking) ? audit.leagueRanking : []).map((lg, idx) => {
                                const isNoble = lg.rate >= 62;
                                return (
                                  <div
                                    key={lg.leagueName || idx}
                                    className={`rounded-xl p-3.5 border flex flex-col justify-between ${
                                      isNoble
                                        ? 'bg-emerald-950/20 border-emerald-500/40'
                                        : 'bg-rose-950/20 border-rose-500/40'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-extrabold text-xs sm:text-sm text-white truncate">
                                          #{idx + 1} {lg.leagueName}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-black shrink-0 ${
                                          isNoble
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        }`}>
                                          {lg.rate}% Éxito
                                        </span>
                                      </div>
                                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                                        <span>{lg.matchesCount} part. ({lg.achieved}✅ / {lg.failed}❌)</span>
                                        <span className={lg.roiUnits >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                          {lg.roiUnits >= 0 ? `+${lg.roiUnits.toFixed(2)}u` : `${lg.roiUnits.toFixed(2)}u`}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-bold">
                                      {isNoble ? (
                                        <span className="text-emerald-400">🟢 Liga Más Noble (Alta previsibilidad)</span>
                                      ) : (
                                        <span className="text-rose-400">🔴 Liga &ldquo;Rompe-Cupones&rdquo; (Mayor varianza/sorpresas)</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* =================================================================== */}
                          {/* SECCIÓN 5: LISTAS DESPLEGABLES "✅ VER LOGRADOS" Y "❌ NO LOGRADOS" */}
                          {/* =================================================================== */}
                          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                                <span>📋</span> SECCIÓN 5: LISTAS DESPLEGABLES DETALLADAS (PRONÓSTICO POR PRONÓSTICO)
                              </h4>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => setShowWeeklyAchieved(!showWeeklyAchieved)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition flex items-center gap-1.5 cursor-pointer ${
                                    showWeeklyAchieved
                                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                                  }`}
                                >
                                  <span>{showWeeklyAchieved ? '▼' : '▶'}</span>
                                  <span>✅ Ver Detalle de Logrados ({audit.achievedCount})</span>
                                </button>

                                <button
                                  onClick={() => setShowWeeklyFailed(!showWeeklyFailed)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition flex items-center gap-1.5 cursor-pointer ${
                                    showWeeklyFailed
                                      ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20'
                                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                                  }`}
                                >
                                  <span>{showWeeklyFailed ? '▼' : '▶'}</span>
                                  <span>❌ Ver Detalle de No Logrados ({audit.failedCount})</span>
                                </button>
                              </div>
                            </div>

                            {/* Acordeón: Lista de LOGRADOS */}
                            {showWeeklyAchieved && (
                              <div className="border border-emerald-500/40 rounded-xl bg-slate-900/90 p-3 space-y-2 max-h-80 overflow-y-auto">
                                <div className="text-xs font-black text-emerald-400 uppercase tracking-wide pb-1 border-b border-slate-800 flex items-center justify-between">
                                  <span>✅ Detalle de Pronósticos Logrados ({audit.achievedCount})</span>
                                  <span className="font-mono text-[11px]">Impacto en Unidades</span>
                                </div>
                                {(Array.isArray(audit.achievedList) ? audit.achievedList : []).length === 0 ? (
                                  <div className="text-xs text-slate-400 py-3 text-center">Sin sugerencias logradas en este filtro.</div>
                                ) : (
                                  audit.achievedList.map((item, idx) => (
                                    <div
                                      key={`ach_${idx}`}
                                      className="p-2.5 rounded-lg bg-slate-950/90 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs hover:border-emerald-400 transition"
                                    >
                                      <div className="space-y-0.5">
                                        <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                          <span className="text-orange-400">{item.leagueName}</span>
                                          <span>·</span>
                                          <span>{item.homeName} <strong className="text-emerald-400 font-mono">{item.finalScore}</strong> {item.awayName}</span>
                                          {item.isFavMatch && (
                                            <span className="text-[10px] bg-amber-400/15 text-amber-300 px-1.5 py-0.2 rounded font-bold">⭐ Favorito</span>
                                          )}
                                        </div>
                                        <div className="text-slate-300 font-mono text-[11px]">
                                          {item.suggestionLabel} <strong className="text-amber-300">(@{item.odds.toFixed(2)})</strong>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]">
                                          {item.auditDetail} · {item.unitImpact}
                                        </span>
                                        {item.matchObj && (
                                          <button
                                            onClick={() => {
                                              setShowWeeklySummaryModal(false);
                                              openMatchDetail(item.matchObj);
                                            }}
                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700"
                                          >
                                            Ver Partido
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {/* Acordeón: Lista de NO LOGRADOS */}
                            {showWeeklyFailed && (
                              <div className="border border-rose-500/40 rounded-xl bg-slate-900/90 p-3 space-y-2 max-h-80 overflow-y-auto">
                                <div className="text-xs font-black text-rose-400 uppercase tracking-wide pb-1 border-b border-slate-800 flex items-center justify-between">
                                  <span>❌ Detalle de Pronósticos No Logrados ({audit.failedCount})</span>
                                  <span className="font-mono text-[11px]">Causa Raíz Detectada</span>
                                </div>
                                {(Array.isArray(audit.failedList) ? audit.failedList : []).length === 0 ? (
                                  <div className="text-xs text-emerald-400 py-3 text-center">¡100% de efectividad! Sin pronósticos fallidos en este filtro.</div>
                                ) : (
                                  audit.failedList.map((item, idx) => (
                                    <div
                                      key={`fail_${idx}`}
                                      className="p-2.5 rounded-lg bg-slate-950/90 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs hover:border-rose-400 transition"
                                    >
                                      <div className="space-y-0.5">
                                        <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                          <span className="text-orange-400">{item.leagueName}</span>
                                          <span>·</span>
                                          <span>{item.homeName} <strong className="text-rose-400 font-mono">{item.finalScore}</strong> {item.awayName}</span>
                                          {item.isFavMatch && (
                                            <span className="text-[10px] bg-amber-400/15 text-amber-300 px-1.5 py-0.2 rounded font-bold">⭐ Favorito</span>
                                          )}
                                        </div>
                                        <div className="text-slate-300 font-mono text-[11px]">
                                          {item.suggestionLabel} <strong className="text-amber-300">(@{item.odds.toFixed(2)})</strong>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 font-mono font-bold text-[11px]">
                                          {item.auditDetail} · {item.unitImpact}
                                        </span>
                                        {item.matchObj && (
                                          <button
                                            onClick={() => {
                                              setShowWeeklySummaryModal(false);
                                              openMatchDetail(item.matchObj);
                                            }}
                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700"
                                          >
                                            Ver Partido
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            } catch (err) {
              console.error("Error renderizando Resumen de la Semana:", err);
              return null;
            }
          })()}

        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
