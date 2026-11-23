class ReginasUnicornGame {
  constructor() {
    this.saveKey = 'reginas_unicorn_kitchen_stations_v2';
    this.state = this.loadProgress();

    this.currentCustomer = null;
    this.targetRecipe = null;
    this.dish = this.createEmptyDish();
    this.nearestStation = null;
    this.activeStationType = null;
    this.moveVec = { x: 0, z: 0 };
    this.keys = {};
    this.lastCompletedRecipeId = null;

    this.initWorld();
    this.spawnNewCustomer(true);
    this.bindUI();
    this.syncHUD();
    this.startLoadingSequence();
  }

  createEmptyDish() {
    return {
      recipeId: null,
      name: 'Creación Libre',
      emoji: '🦄',
      category: 'REPOSTERIA',
      ingredients: [],
      flavor: FLAVORS[0],
      colorTheme: COLOR_THEMES[0],
      prepDone: false,
      prepMethod: null,
      cookDone: false,
      cookProgress: 0,
      cookMethod: null,
      vessel: VESSELS[0],
      frosting: null,
      toppings: [], // cada elemento: { id, emoji, name, xPct, yPct }
      color: 0xff85c0,
      accentColor: 0xffffff
    };
  }

  loadProgress() {
    const defaults = {
      stars: 0,
      discovered: [],
      favorites: [],
      currentWorld: 'rainbow',
      custom: { hat: 'unicorn_horn', outfit: 'pink_apron', hair: 'pink', pet: 'white_pink' },
      settings: { music: true, sfx: true, particles: true, quality: 'medium' }
    };
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch (e) {}
    return defaults;
  }

  saveProgress() {
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(this.state));
    } catch (e) {}
    this.syncHUD();
  }

  initWorld() {
    const container = document.getElementById('game-container');
    this.world = new UnicornKitchenWorld(container);
    this.world.applyCustomization(this.state.custom);
    this.world.setQuality(this.state.settings.quality);

    const wObj = WORLDS.find((w) => w.id === this.state.currentWorld) || WORLDS[0];
    this.world.applyWorldTheme(wObj);
    magicAudio.setWorld(wObj.id);
    magicAudio.musicEnabled = this.state.settings.music;
    magicAudio.sfxEnabled = this.state.settings.sfx;
  }

  spawnNewCustomer(silent = false) {
    const cust = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    const matching = RECIPES.filter((r) => r.category === cust.favCat);
    const pool = matching.length ? matching : RECIPES;
    const rec = pool[Math.floor(Math.random() * pool.length)];

    this.currentCustomer = cust;
    this.targetRecipe = rec;
    this.dish = this.createEmptyDish();
    this.dish.recipeId = rec.id;
    this.dish.name = rec.name;
    this.dish.emoji = rec.emoji;
    this.dish.category = rec.category;
    this.dish.vessel = VESSELS.find((v) => v.id === rec.vessel) || VESSELS[0];
    this.dish.color = rec.color;
    this.dish.accentColor = rec.accentColor;

    this.refreshHandVisual();
    this.updateTicketPanel();
    if (!silent) magicAudio.playSFX('pickup');
  }

  startLoadingSequence() {
    const bar = document.getElementById('loading-bar');
    const status = document.getElementById('loading-status');
    const steps = [
      [35, 'Acomodando las 6 estaciones de cocina...'],
      [70, 'Saludando a los clientes adorables sin prisa...'],
      [100, '¡Cocina de Regina lista para jugar!']
    ];
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < steps.length) {
        bar.style.width = steps[idx][0] + '%';
        status.textContent = steps[idx][1];
        idx++;
      } else {
        clearInterval(timer);
        document.getElementById('loading-screen').classList.remove('active');
        document.getElementById('main-menu').classList.add('active');
        this.animateLoop();
      }
    }, 300);
  }

  bindUI() {
    document.getElementById('btn-play').addEventListener('click', () => {
      magicAudio.playSFX('button');
      magicAudio.startMusic();
      document.getElementById('main-menu').classList.remove('active');
      document.getElementById('hud').classList.remove('hidden');
    });

    document.getElementById('btn-recipes-menu').addEventListener('click', () => { magicAudio.playSFX('button'); this.openRecipesModal(); });
    document.getElementById('btn-customize-menu').addEventListener('click', () => { magicAudio.playSFX('button'); this.openCustomizeModal(); });
    document.getElementById('btn-worlds-menu').addEventListener('click', () => { magicAudio.playSFX('button'); this.openWorldsModal(); });
    document.getElementById('btn-settings-menu').addEventListener('click', () => { magicAudio.playSFX('button'); this.openModal('modal-settings'); });

    document.getElementById('btn-hud-recipes').addEventListener('click', () => { magicAudio.playSFX('button'); this.openRecipesModal(); });
    document.getElementById('btn-hud-customize').addEventListener('click', () => { magicAudio.playSFX('button'); this.openCustomizeModal(); });
    document.getElementById('btn-hud-worlds').addEventListener('click', () => { magicAudio.playSFX('button'); this.openWorldsModal(); });
    document.getElementById('btn-hud-camera').addEventListener('click', () => { magicAudio.playSFX('button'); this.world.cycleCameraMode(); });
    document.getElementById('btn-hud-pause').addEventListener('click', () => { magicAudio.playSFX('button'); this.openModal('modal-pause'); });

    document.getElementById('btn-new-customer-order').addEventListener('click', () => this.spawnNewCustomer(false));

    // Navegación rápida a cualquiera de las 6 estaciones
    document.querySelectorAll('.st-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stType = btn.getAttribute('data-st');
        magicAudio.playSFX('button');
        this.world.movePlayerToStation(stType);
        this.detectNearestStation();
        this.openStationWorkspace(stType);
      });
    });

    document.getElementById('btn-ws-close').addEventListener('click', () => {
      magicAudio.playSFX('button');
      this.closeWorkspace();
    });

    document.getElementById('btn-action-interact').addEventListener('click', () => {
      const targetType = this.nearestStation ? this.nearestStation.type : 'order';
      this.openStationWorkspace(targetType);
    });

    document.getElementById('btn-action-pickup').addEventListener('click', () => {
      magicAudio.playSFX('place');
      this.refreshHandVisual();
      this.updateTicketPanel();
    });

    document.getElementById('btn-action-drop').addEventListener('click', () => {
      magicAudio.playSFX('drop');
      this.dish = this.createEmptyDish();
      if (this.targetRecipe) {
        this.dish.recipeId = this.targetRecipe.id;
        this.dish.name = this.targetRecipe.name;
        this.dish.emoji = this.targetRecipe.emoji;
        this.dish.category = this.targetRecipe.category;
        this.dish.vessel = VESSELS.find((v) => v.id === this.targetRecipe.vessel) || VESSELS[0];
        this.dish.color = this.targetRecipe.color;
        this.dish.accentColor = this.targetRecipe.accentColor;
      }
      this.refreshHandVisual();
      this.updateTicketPanel();
    });

    document.getElementById('btn-pause-recipes').addEventListener('click', () => { this.closeAllModals(); this.openRecipesModal(); });
    document.getElementById('btn-pause-customize').addEventListener('click', () => { this.closeAllModals(); this.openCustomizeModal(); });
    document.getElementById('btn-pause-settings').addEventListener('click', () => { this.closeAllModals(); this.openModal('modal-settings'); });
    document.getElementById('btn-pause-home').addEventListener('click', () => {
      this.closeAllModals();
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('main-menu').classList.add('active');
    });

    document.querySelectorAll('.close-modal').forEach((btn) => {
      btn.addEventListener('click', () => {
        magicAudio.playSFX('button');
        const target = btn.getAttribute('data-close');
        if (target) document.getElementById(target).classList.add('hidden');
      });
    });

    document.getElementById('btn-fav-last').addEventListener('click', () => {
      if (!this.lastCompletedRecipeId) return;
      this.toggleFavorite(this.lastCompletedRecipeId);
      const isFav = this.state.favorites.includes(this.lastCompletedRecipeId);
      document.getElementById('btn-fav-last').textContent = isFav ? '💗' : '🤍';
    });

    const setMusic = document.getElementById('set-music');
    const setSfx = document.getElementById('set-sfx');
    const setParticles = document.getElementById('set-particles');
    const setQuality = document.getElementById('set-quality');

    setMusic.checked = this.state.settings.music;
    setSfx.checked = this.state.settings.sfx;
    setParticles.checked = this.state.settings.particles;
    setQuality.value = this.state.settings.quality;

    setMusic.addEventListener('change', () => {
      this.state.settings.music = setMusic.checked;
      magicAudio.musicEnabled = setMusic.checked;
      if (setMusic.checked) magicAudio.startMusic();
      else magicAudio.stopMusic();
      this.saveProgress();
    });

    setSfx.addEventListener('change', () => {
      this.state.settings.sfx = setSfx.checked;
      magicAudio.sfxEnabled = setSfx.checked;
      this.saveProgress();
    });

    setParticles.addEventListener('change', () => {
      this.state.settings.particles = setParticles.checked;
      this.saveProgress();
    });

    setQuality.addEventListener('change', () => {
      this.state.settings.quality = setQuality.value;
      this.world.setQuality(setQuality.value);
      this.saveProgress();
    });

    document.getElementById('btn-unlock-all').addEventListener('click', () => {
      magicAudio.playSFX('celebrate');
      this.state.stars = Math.max(this.state.stars, 30);
      this.state.discovered = RECIPES.map((r) => r.id);
      this.saveProgress();
      alert('¡Todo desbloqueado! Las 62 recetas, todos los escenarios y clientes están disponibles ✨');
    });

    document.getElementById('btn-reset-save').addEventListener('click', () => {
      if (confirm('¿Quieres reiniciar tus estrellas y recetas descubiertas?')) {
        localStorage.removeItem(this.saveKey);
        location.reload();
      }
    });

    this.setupJoystick();
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  setupJoystick() {
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    let dragging = false;
    const maxRadius = 36;

    const updateStick = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.moveVec.x = dx / maxRadius;
      this.moveVec.z = dy / maxRadius;
    };

    const resetStick = () => {
      dragging = false;
      stick.style.transform = 'translate(0px, 0px)';
      this.moveVec.x = 0;
      this.moveVec.z = 0;
    };

    zone.addEventListener('pointerdown', (e) => {
      dragging = true;
      zone.setPointerCapture(e.pointerId);
      updateStick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => { if (dragging) updateStick(e.clientX, e.clientY); });
    zone.addEventListener('pointerup', resetStick);
    zone.addEventListener('pointercancel', resetStick);
  }

  openModal(id) { document.getElementById(id).classList.remove('hidden'); }
  closeAllModals() { document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')); }
  closeWorkspace() {
    this.activeStationType = null;
    document.getElementById('station-workspace-overlay').classList.add('hidden');
  }

  syncHUD() {
    const total = RECIPES.length;
    document.getElementById('hud-stars').textContent = this.state.stars;
    document.getElementById('hud-recipes').textContent = this.state.discovered.length;
    document.getElementById('hud-total-recipes').textContent = total;
    document.getElementById('menu-discovered-count').textContent = this.state.discovered.length;
    document.getElementById('menu-total-recipes').textContent = total;

    const wObj = WORLDS.find((w) => w.id === this.state.currentWorld) || WORLDS[0];
    document.getElementById('hud-world-name').textContent = `${wObj.icon} ${wObj.name}`;
    this.refreshHandVisual();
    this.updateTicketPanel();
  }

  updateTicketPanel() {
    const badge = document.getElementById('ticket-customer-badge');
    const body = document.getElementById('ticket-body');
    if (!this.currentCustomer || !this.targetRecipe) return;

    badge.textContent = `${this.currentCustomer.avatar} ${this.currentCustomer.name} · ${this.targetRecipe.emoji} ${this.targetRecipe.name}`;

    const hasIngs = this.targetRecipe.ingredients.every((i) => this.dish.ingredients.includes(i));
    const step1 = `<span class="ticket-step-tag ${hasIngs ? 'done' : ''}">1. Ingredientes</span>`;
    const step2 = `<span class="ticket-step-tag ${this.dish.prepDone ? 'done' : ''}">2. Prep</span>`;
    const step3 = `<span class="ticket-step-tag ${this.dish.cookDone ? 'done' : ''}">3. Cocción</span>`;
    const step4 = `<span class="ticket-step-tag ${this.dish.vessel ? 'done' : ''}">4. Montaje</span>`;
    const step5 = `<span class="ticket-step-tag ${this.dish.toppings.length > 0 ? 'done' : ''}">5. Decorar</span>`;

    const ingList = this.targetRecipe.ingredients.map((id) => {
      const ing = INGREDIENTS[id];
      const ok = this.dish.ingredients.includes(id);
      return `${ok ? '✅' : '⬜'}${ing.emoji}`;
    }).join(' ');

    body.innerHTML = `
      <div style="margin-bottom:4px;"><em>"${this.currentCustomer.greeting}"</em></div>
      <div>Base: <strong>${ingList}</strong> · Sabor: <strong>${this.dish.flavor.name}</strong></div>
      <div style="margin-top:4px;">${step1}${step2}${step3}${step4}${step5}</div>
    `;
  }

  refreshHandVisual() {
    const banner = document.getElementById('held-item-banner');
    const nameEl = document.getElementById('held-item-name');
    banner.classList.remove('hidden');

    const ingsEmo = this.dish.ingredients.map((id) => INGREDIENTS[id]?.emoji || '').join('');
    const flags = [
      this.dish.prepDone ? '🔪✓' : '',
      this.dish.cookDone ? '🍳✓' : '',
      this.dish.toppings.length ? `✨×${this.dish.toppings.length}` : ''
    ].filter(Boolean).join(' ');

    nameEl.textContent = `${this.dish.emoji} ${this.dish.name} [${ingsEmo || 'sin base'}] ${flags}`;

    while (this.world.handHoldPoint.children.length) {
      this.world.handHoldPoint.remove(this.world.handHoldPoint.children[0]);
    }
    if (this.dish.ingredients.length > 0 || this.dish.cookDone || this.dish.toppings.length > 0) {
      this.world.handHoldPoint.add(this.world.createFoodMesh(this.dish));
    }
  }

  // Abre la interfaz interactiva específica de cada una de las 6 estaciones
  openStationWorkspace(stationType) {
    this.activeStationType = stationType;
    document.querySelectorAll('.st-nav-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-st') === stationType);
    });

    const overlay = document.getElementById('station-workspace-overlay');
    const titleEl = document.getElementById('ws-title');
    const subEl = document.getElementById('ws-subtitle');
    const contentEl = document.getElementById('ws-content');

    overlay.classList.remove('hidden');
    subEl.textContent = 'Sin límite de tiempo · Personaliza y prepara a tu ritmo';

    if (stationType === 'order') {
      titleEl.textContent = '🧾 1. Estación de Pedidos y Selección de Receta';
      const rec = this.targetRecipe || RECIPES[0];
      contentEl.innerHTML = `
        <div class="ws-section-box">
          <div class="ws-section-title">${this.currentCustomer.avatar} Cliente Actual: ${this.currentCustomer.name}</div>
          <p style="font-size:0.9rem; margin-bottom:8px;">"${this.currentCustomer.greeting}"</p>
          <p style="font-size:0.88rem;"><strong>Pedido sugerido:</strong> ${rec.emoji} <strong>${rec.name}</strong> (${rec.category}) — ${rec.desc}</p>
          <p style="font-size:0.84rem; margin-top:4px;"><strong>Ingredientes base:</strong> ${rec.ingredients.map((id) => INGREDIENTS[id].emoji + ' ' + INGREDIENTS[id].name).join(', ')}</p>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button id="ws-auto-fill-base" class="btn-magic secondary small">🧺 Cargar Ingredientes de la Receta</button>
            <button id="ws-next-cust" class="btn-magic tertiary small">🔄 Llamar a Otro Cliente</button>
            <button id="ws-go-prep" class="btn-magic primary small">➡️ Ir a Preparación</button>
          </div>
        </div>
        <div class="ws-section-box">
          <div class="ws-section-title">🌈 Elige un Sabor y Color de Tu Creación</div>
          <div class="chips-grid" id="ws-flavor-grid"></div>
          <div class="chips-grid" id="ws-color-grid" style="margin-top:8px;"></div>
        </div>
      `;

      document.getElementById('ws-auto-fill-base').onclick = () => {
        magicAudio.playSFX('pickup');
        this.dish.ingredients = [...rec.ingredients];
        this.refreshHandVisual();
        this.updateTicketPanel();
        this.openStationWorkspace('order');
      };

      document.getElementById('ws-next-cust').onclick = () => {
        this.spawnNewCustomer(false);
        this.openStationWorkspace('order');
      };

      document.getElementById('ws-go-prep').onclick = () => {
        magicAudio.playSFX('button');
        this.world.movePlayerToStation('prep');
        this.openStationWorkspace('prep');
      };

      const fGrid = document.getElementById('ws-flavor-grid');
      fGrid.innerHTML = FLAVORS.map((f) => `<div class="pick-chip ${this.dish.flavor.id === f.id ? 'selected' : ''}" data-fid="${f.id}"><span class="emo">${f.emoji}</span>${f.name}</div>`).join('');
      fGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        magicAudio.playSFX('magic');
        this.dish.flavor = FLAVORS.find((x) => x.id === ch.getAttribute('data-fid')) || FLAVORS[0];
        this.updateTicketPanel();
        this.openStationWorkspace('order');
      });

      const cGrid = document.getElementById('ws-color-grid');
      cGrid.innerHTML = COLOR_THEMES.map((ct) => `<div class="pick-chip ${this.dish.colorTheme.id === ct.id ? 'selected' : ''}" data-cid="${ct.id}"><span class="emo" style="color:${ct.hex}">●</span>${ct.name}</div>`).join('');
      cGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        magicAudio.playSFX('magic');
        const chosen = COLOR_THEMES.find((x) => x.id === ch.getAttribute('data-cid')) || COLOR_THEMES[0];
        this.dish.colorTheme = chosen;
        this.dish.color = chosen.threeHex;
        this.refreshHandVisual();
        this.openStationWorkspace('order');
      });

    } else if (stationType === 'prep') {
      titleEl.textContent = '🔪 2. Estación de Preparación (Cortar, Pelar, Mezclar, Sazonar)';
      const allIngs = Object.values(INGREDIENTS);
      contentEl.innerHTML = `
        <div class="ws-section-box">
          <div class="ws-section-title">🧺 Selecciona o Añade Ingredientes (Actuales: ${this.dish.ingredients.length})</div>
          <div class="chips-grid" id="ws-ing-grid"></div>
        </div>
        <div class="ws-section-box">
          <div class="ws-section-title">⚙️ Técnica de Preparación (Sugerida: ${PREP_METHODS[this.targetRecipe?.prep || 'chop'].name})</div>
          <div class="chips-grid" id="ws-prep-actions"></div>
          <p id="ws-prep-status" style="margin-top:8px; font-weight:700; color:#be185d;">
            ${this.dish.prepDone ? `✅ Preparación lista (${this.dish.prepMethod})` : 'Elige una técnica para preparar tus ingredientes'}
          </p>
        </div>
      `;

      const ingGrid = document.getElementById('ws-ing-grid');
      ingGrid.innerHTML = allIngs.slice(0, 24).map((ing) => {
        const active = this.dish.ingredients.includes(ing.id);
        return `<div class="pick-chip ${active ? 'selected' : ''}" data-iid="${ing.id}"><span class="emo">${ing.emoji}</span>${ing.name}</div>`;
      }).join('');

      ingGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        magicAudio.playSFX('pickup');
        const iid = ch.getAttribute('data-iid');
        if (!this.dish.ingredients.includes(iid)) this.dish.ingredients.push(iid);
        this.refreshHandVisual();
        this.updateTicketPanel();
        this.openStationWorkspace('prep');
      });

      const pGrid = document.getElementById('ws-prep-actions');
      pGrid.innerHTML = Object.entries(PREP_METHODS).map(([key, pm]) => `<div class="pick-chip ${this.dish.prepMethod === key ? 'selected' : ''}" data-pm="${key}"><span class="emo">${pm.icon}</span>${pm.name}</div>`).join('');

      pGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        const pmKey = ch.getAttribute('data-pm');
        magicAudio.playSFX('chop');
        this.dish.prepMethod = pmKey;
        this.dish.prepDone = true;
        this.world.spawnBurstParticles(this.world.player.position.x, 1.3, this.world.player.position.z, 0xc084fc);
        this.refreshHandVisual();
        this.updateTicketPanel();
        this.openStationWorkspace('prep');
      });

    } else if (stationType === 'cook') {
      titleEl.textContent = '🍳 3. Estación de Cocción (Hornear, Freír, Hervir, Cocinar)';
      const target = this.targetRecipe?.cook || 'bake';
      const pct = Math.min(100, this.dish.cookProgress || 0);

      contentEl.innerHTML = `
        <div class="cook-meter-box">
          <div class="cook-status-badge">Estado de cocción: ${pct}% ${this.dish.cookDone ? '✨ ¡Listo!' : '(Toca cocinar cuanto quieras, sin prisa)'}</div>
          <div class="cook-bar-bg">
            <div class="cook-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="chips-grid" id="ws-cook-methods"></div>
          <div style="margin-top:12px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button id="ws-btn-cook-step" class="btn-magic primary">🔥 Aplicar Calor (+25%)</button>
            <button id="ws-btn-cook-finish" class="btn-magic secondary">✅ Marcar Cocción Lista</button>
          </div>
        </div>
      `;

      const cGrid = document.getElementById('ws-cook-methods');
      cGrid.innerHTML = Object.entries(COOK_METHODS).map(([k, cm]) => `<div class="pick-chip ${(this.dish.cookMethod || target) === k ? 'selected' : ''}" data-ck="${k}"><span class="emo">${cm.icon}</span>${cm.name}</div>`).join('');

      cGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        magicAudio.playSFX('cook');
        this.dish.cookMethod = ch.getAttribute('data-ck');
        this.openStationWorkspace('cook');
      });

      document.getElementById('ws-btn-cook-step').onclick = () => {
        magicAudio.playSFX('cook');
        this.dish.cookMethod = this.dish.cookMethod || target;
        this.dish.cookProgress = Math.min(100, (this.dish.cookProgress || 0) + 25);
        if (this.dish.cookProgress >= 50) this.dish.cookDone = true;
        this.world.spawnBurstParticles(this.world.player.position.x, 1.3, this.world.player.position.z, 0xfbbf24);
        this.refreshHandVisual();
        this.updateTicketPanel();
        this.openStationWorkspace('cook');
      };

      document.getElementById('ws-btn-cook-finish').onclick = () => {
        magicAudio.playSFX('magic');
        this.dish.cookMethod = this.dish.cookMethod || target;
        this.dish.cookProgress = Math.max(this.dish.cookProgress, 75);
        this.dish.cookDone = true;
        this.refreshHandVisual();
        this.updateTicketPanel();
        this.openStationWorkspace('cook');
      };

    } else if (stationType === 'build') {
      titleEl.textContent = '🍽️ 4. Estación de Montaje (Platos, Copas, Vasos y Bases)';
      contentEl.innerHTML = `
        <div class="ws-section-box">
          <div class="ws-section-title">Elige el Recipiente o Plato para Servir</div>
          <div class="chips-grid" id="ws-vessel-grid"></div>
        </div>
      `;

      const vGrid = document.getElementById('ws-vessel-grid');
      vGrid.innerHTML = VESSELS.map((v) => `<div class="pick-chip ${this.dish.vessel?.id === v.id ? 'selected' : ''}" data-vid="${v.id}"><span class="emo">${v.emoji}</span>${v.name}</div>`).join('');

      vGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        magicAudio.playSFX('place');
        this.dish.vessel = VESSELS.find((x) => x.id === ch.getAttribute('data-vid')) || VESSELS[0];
        this.refreshHandVisual();
        this.updateTicketPanel();
        this.openStationWorkspace('build');
      });

    } else if (stationType === 'decorate') {
      titleEl.textContent = '🦄 5. Estación de Decoración (Coberturas, Salsas, Frutas y Toppings)';
      const activeTop = this.selectedTopOption || TOPPINGS_FRUITS[0];

      contentEl.innerHTML = `
        <div class="ws-section-box">
          <div class="ws-section-title">🍦 Cobertura o Salsa</div>
          <div class="chips-grid" id="ws-frost-grid"></div>
        </div>
        <div class="ws-section-box">
          <div class="ws-section-title">✨ Elige un Topping/Fruta y TOCA SOBRE EL PLATILLO para colocarlo exactamente ahí</div>
          <div class="chips-grid" id="ws-top-grid" style="margin-bottom:10px;"></div>
          <div id="dish-preview-canvas" class="dish-preview-canvas" title="Toca dentro del plato para colocar el adorno">
            <div id="dish-vessel-base" class="dish-vessel-base" style="background:${this.dish.colorTheme.hex}; border-radius:${this.dish.vessel?.shape || '28px'};">
              <span>${this.dish.emoji}</span>
            </div>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.82rem; font-weight:700;">Adornos colocados: ${this.dish.toppings.length}</span>
            <button id="ws-clear-tops" class="mini-pill-btn">Quitar adornos</button>
          </div>
        </div>
      `;

      const fGrid = document.getElementById('ws-frost-grid');
      fGrid.innerHTML = FROSTINGS_SAUCES.map((fr) => `<div class="pick-chip ${this.dish.frosting?.id === fr.id ? 'selected' : ''}" data-frid="${fr.id}"><span class="emo">${fr.emoji}</span>${fr.name}</div>`).join('');
      fGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        magicAudio.playSFX('magic');
        this.dish.frosting = FROSTINGS_SAUCES.find((x) => x.id === ch.getAttribute('data-frid')) || null;
        this.refreshHandVisual();
        this.openStationWorkspace('decorate');
      });

      const tGrid = document.getElementById('ws-top-grid');
      tGrid.innerHTML = TOPPINGS_FRUITS.map((tp) => `<div class="pick-chip ${activeTop.id === tp.id ? 'selected' : ''}" data-tid="${tp.id}"><span class="emo">${tp.emoji}</span>${tp.name}</div>`).join('');
      tGrid.querySelectorAll('.pick-chip').forEach((ch) => ch.onclick = () => {
        magicAudio.playSFX('button');
        this.selectedTopOption = TOPPINGS_FRUITS.find((x) => x.id === ch.getAttribute('data-tid')) || TOPPINGS_FRUITS[0];
        this.openStationWorkspace('decorate');
      });

      const canvasEl = document.getElementById('dish-preview-canvas');
      const vesselEl = document.getElementById('dish-vessel-base');

      // Renderiza cada topping en sus coordenadas exactas dentro del plato/recipiente
      this.dish.toppings.forEach((pt) => {
        const marker = document.createElement('span');
        marker.className = 'placed-topping-marker';
        marker.textContent = pt.emoji;
        marker.style.left = pt.xPct + '%';
        marker.style.top = pt.yPct + '%';
        canvasEl.appendChild(marker);
      });

      canvasEl.addEventListener('pointerdown', (e) => {
        const rect = canvasEl.getBoundingClientRect();
        // Limita la posición al área del recipiente central para que nunca flote afuera
        const rawX = ((e.clientX - rect.left) / rect.width) * 100;
        const rawY = ((e.clientY - rect.top) / rect.height) * 100;
        const clampedX = Math.max(38, Math.min(62, rawX));
        const clampedY = Math.max(30, Math.min(70, rawY));

        magicAudio.playSFX('magic');
        this.dish.toppings.push({
          id: activeTop.id,
          emoji: activeTop.emoji,
          name: activeTop.name,
          xPct: clampedX,
          yPct: clampedY
        });
        vesselEl.style.transform = 'scale(1.06)';
        setTimeout(() => { vesselEl.style.transform = 'scale(1)'; }, 120);
        this.refreshHandVisual();
        this.updateTicketPanel();
        this.openStationWorkspace('decorate');
      });

      document.getElementById('ws-clear-tops').onclick = () => {
        magicAudio.playSFX('drop');
        this.dish.toppings = [];
        this.refreshHandVisual();
        this.openStationWorkspace('decorate');
      };

    } else if (stationType === 'serve') {
      titleEl.textContent = '🎁 6. Estación de Entrega al Cliente';
      const rec = this.targetRecipe || RECIPES[0];

      contentEl.innerHTML = `
        <div class="ws-section-box" style="text-align:center;">
          <div style="font-size:3rem;">${this.currentCustomer.avatar} ➡️ ${rec.emoji}</div>
          <h4 style="font-size:1.15rem; margin:6px 0;">Entregar a ${this.currentCustomer.name}</h4>
          <p style="font-size:0.88rem; color:#6b4c7a; margin-bottom:12px;">
            Platillo: <strong>${rec.name}</strong> · Sabor: <strong>${this.dish.flavor.name}</strong> · Adornos: <strong>${this.dish.toppings.length}</strong>
          </p>
          <button id="ws-btn-deliver" class="btn-magic primary" style="width:100%;">💗 ¡ENTREGAR PEDIDO CON CARIÑO!</button>
        </div>
      `;

      document.getElementById('ws-btn-deliver').onclick = () => {
        this.deliverOrderToCustomer();
      };
    }
  }

  deliverOrderToCustomer() {
    const rec = this.targetRecipe || RECIPES[0];
    const isNew = !this.state.discovered.includes(rec.id);
    if (isNew) this.state.discovered.push(rec.id);

    const bonus = (this.dish.prepDone ? 1 : 0) + (this.dish.cookDone ? 1 : 0) + (this.dish.toppings.length > 0 ? 1 : 0);
    const gainedStars = (isNew ? 2 : 1) + Math.min(2, bonus);
    this.state.stars += gainedStars;
    this.lastCompletedRecipeId = rec.id;
    this.saveProgress();

    magicAudio.playSFX('celebrate');
    this.world.spawnBurstParticles(this.world.player.position.x, 1.6, this.world.player.position.z, 0xff7eb9);
    this.closeWorkspace();

    const banner = document.getElementById('celebration-banner');
    document.getElementById('celeb-icon').textContent = `${this.currentCustomer.avatar}😍`;
    document.getElementById('celeb-tag').textContent = isNew
      ? `¡${this.currentCustomer.name.toUpperCase()} DESCUBRIÓ UNA RECETA!`
      : `¡${this.currentCustomer.name.toUpperCase()} ADORÓ SU PEDIDO!`;
    document.getElementById('celeb-title').textContent = `${rec.emoji} ${rec.name}`;
    document.getElementById('celeb-desc').textContent = `"¡Qué delicia! Gracias por prepararlo con tanto estilo." (+${gainedStars} ⭐)`;
    document.getElementById('btn-fav-last').textContent = this.state.favorites.includes(rec.id) ? '💗' : '🤍';

    banner.classList.remove('hidden');
    clearTimeout(this.celebTimer);
    this.celebTimer = setTimeout(() => banner.classList.add('hidden'), 5200);

    this.spawnNewCustomer(true);
  }

  toggleFavorite(recipeId) {
    const idx = this.state.favorites.indexOf(recipeId);
    if (idx === -1) this.state.favorites.push(recipeId);
    else this.state.favorites.splice(idx, 1);
    this.saveProgress();
  }

  openRecipesModal() {
    document.getElementById('modal-discovered-count').textContent = this.state.discovered.length;
    document.getElementById('modal-total-count').textContent = RECIPES.length;

    const listEl = document.getElementById('recipes-list');
    const detailEl = document.getElementById('recipe-detail');
    let currentCat = 'ALL';

    const renderDetail = (rec) => {
      const isDiscovered = this.state.discovered.includes(rec.id);
      const isFav = this.state.favorites.includes(rec.id);

      detailEl.innerHTML = `
        <div class="detail-header">
          <div class="detail-emoji">${rec.emoji}</div>
          <div>
            <h3>${rec.name}</h3>
            <span style="font-size:0.82rem; font-weight:700; color:#9333ea;">
              ${isDiscovered ? '✅ Descubierta en el libro' : '✨ Lista para preparar'}
            </span>
          </div>
        </div>
        <p style="font-size:0.9rem; margin-bottom:10px;">${rec.desc}</p>
        <div class="detail-section-title">🧺 Ingredientes:</div>
        <ul class="detail-list">
          ${rec.ingredients.map((id) => `<li>${INGREDIENTS[id].emoji} ${INGREDIENTS[id].name}</li>`).join('')}
        </ul>
        <div class="detail-section-title">👩‍🍳 Flujo en Estaciones (Sin Límite de Tiempo):</div>
        <ol class="detail-list">
          <li>🧾 Pedidos: Elige sabor y color</li>
          <li>🔪 Preparación: ${PREP_METHODS[rec.prep]?.name || 'Cortar y Picar'}</li>
          <li>🍳 Cocción: ${COOK_METHODS[rec.cook]?.name || 'Hornear'} (punto ideal ~${rec.targetCook}%)</li>
          <li>🍽️ Montaje: ${VESSELS.find((v) => v.id === rec.vessel)?.name || 'Plato'}</li>
          <li>🦄 Decoración y Entrega al cliente</li>
        </ol>
        <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
          <button id="btn-load-recipe-order" class="btn-magic primary small" style="flex:1;">🍳 Preparar Esta Receta</button>
          <button id="btn-toggle-fav-detail" class="btn-magic secondary small">${isFav ? '💗 Favorita' : '🤍 Guardar'}</button>
        </div>
      `;

      document.getElementById('btn-load-recipe-order').addEventListener('click', () => {
        magicAudio.playSFX('button');
        this.targetRecipe = rec;
        this.dish = this.createEmptyDish();
        this.dish.recipeId = rec.id;
        this.dish.name = rec.name;
        this.dish.emoji = rec.emoji;
        this.dish.category = rec.category;
        this.dish.vessel = VESSELS.find((v) => v.id === rec.vessel) || VESSELS[0];
        this.dish.color = rec.color;
        this.dish.accentColor = rec.accentColor;

        this.closeAllModals();
        document.getElementById('main-menu').classList.remove('active');
        document.getElementById('hud').classList.remove('hidden');
        magicAudio.startMusic();
        this.refreshHandVisual();
        this.updateTicketPanel();
      });

      document.getElementById('btn-toggle-fav-detail').addEventListener('click', () => {
        this.toggleFavorite(rec.id);
        renderDetail(rec);
        renderList();
      });
    };

    const renderList = () => {
      const filtered = RECIPES.filter((r) => {
        if (currentCat === 'ALL') return true;
        if (currentCat === 'FAVORITES') return this.state.favorites.includes(r.id);
        return r.category === currentCat;
      });

      listEl.innerHTML = filtered.map((r) => {
        const disc = this.state.discovered.includes(r.id);
        const fav = this.state.favorites.includes(r.id);
        return `<div class="recipe-item-row ${disc ? 'discovered' : ''}" data-rid="${r.id}"><span><strong>${r.emoji} ${r.name}</strong></span><span>${fav ? '💗' : ''} ${disc ? '⭐' : '📖'}</span></div>`;
      }).join('');

      listEl.querySelectorAll('.recipe-item-row').forEach((row) => {
        row.addEventListener('click', () => {
          listEl.querySelectorAll('.recipe-item-row').forEach((x) => x.classList.remove('selected'));
          row.classList.add('selected');
          const rec = RECIPES.find((x) => x.id === row.getAttribute('data-rid'));
          if (rec) renderDetail(rec);
        });
      });

      if (filtered.length > 0) renderDetail(filtered[0]);
    };

    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentCat = btn.getAttribute('data-cat');
        renderList();
      };
    });

    renderList();
    this.openModal('modal-recipes');
  }

  openCustomizeModal() {
    const renderGroup = (containerId, options, stateKey) => {
      const el = document.getElementById(containerId);
      el.innerHTML = options.map((opt) => `<button class="opt-chip ${this.state.custom[stateKey] === opt.id ? 'active' : ''}" data-val="${opt.id}">${opt.name}</button>`).join('');
      el.querySelectorAll('.opt-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          magicAudio.playSFX('magic');
          this.state.custom[stateKey] = chip.getAttribute('data-val');
          this.world.applyCustomization(this.state.custom);
          this.saveProgress();
          renderGroup(containerId, options, stateKey);
        });
      });
    };

    renderGroup('opt-hats', CUSTOM_OPTIONS.hats, 'hat');
    renderGroup('opt-outfits', CUSTOM_OPTIONS.outfits, 'outfit');
    renderGroup('opt-hair', CUSTOM_OPTIONS.hair, 'hair');
    renderGroup('opt-pet', CUSTOM_OPTIONS.pet, 'pet');
    this.openModal('modal-customize');
  }

  openWorldsModal() {
    const grid = document.getElementById('worlds-grid');
    grid.innerHTML = WORLDS.map((w) => {
      const unlocked = this.state.stars >= w.unlockStars;
      const isCurrent = this.state.currentWorld === w.id;
      return `
        <div class="world-card ${isCurrent ? 'active-world' : ''}">
          <div class="world-icon">${w.icon}</div>
          <h3>${w.name}</h3>
          <p style="font-size:0.84rem; color:#6b4c7a;">${w.desc}</p>
          ${unlocked
            ? `<button class="btn-magic ${isCurrent ? 'secondary' : 'primary'} small btn-select-world" data-wid="${w.id}">${isCurrent ? '✨ Escenario Actual' : '🚪 Visitar Cocina'}</button>`
            : `<div style="font-weight:700; color:#be185d;">🔒 Requiere ${w.unlockStars} ⭐</div>`}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-select-world').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wid = btn.getAttribute('data-wid');
        const wObj = WORLDS.find((x) => x.id === wid);
        if (!wObj) return;
        magicAudio.playSFX('celebrate');
        this.state.currentWorld = wid;
        this.world.applyWorldTheme(wObj);
        magicAudio.setWorld(wid);
        this.saveProgress();
        this.openWorldsModal();
      });
    });

    this.openModal('modal-worlds');
  }

  detectNearestStation() {
    const px = this.world.player.position.x;
    const pz = this.world.player.position.z;
    let best = null;
    let bestDist = 2.0;

    for (const st of this.world.stations) {
      const dist = Math.hypot(px - st.interactX, pz - st.interactZ);
      st.ring.material.opacity = 0.35;
      if (dist < bestDist) { bestDist = dist; best = st; }
    }

    this.nearestStation = best;
    const promptEl = document.getElementById('station-prompt');
    if (best) {
      best.ring.material.opacity = 0.95;
      promptEl.classList.remove('hidden');
      document.getElementById('station-prompt-icon').textContent = best.icon;
      document.getElementById('station-prompt-text').textContent = best.name;
    } else {
      promptEl.classList.add('hidden');
    }
  }

  animateLoop() {
    requestAnimationFrame(() => this.animateLoop());
    const dt = Math.min(this.world.clock.getDelta(), 0.05);

    let mx = this.moveVec.x;
    let mz = this.moveVec.z;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    this.detectNearestStation();
    this.world.update(dt, { x: mx, z: mz }, Boolean(this.activeStationType === 'cook'), this.state.settings.particles);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new ReginasUnicornGame();
});
