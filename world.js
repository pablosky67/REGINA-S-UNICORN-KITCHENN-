class UnicornKitchenWorld {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffe4f2);
    this.scene.fog = new THREE.FogExp2(0xffe4f2, 0.02);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
    this.cameraMode = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.stations = [];
    this.colliders = [];
    this.particles = [];
    this.floatingStars = [];

    this.setupLights();
    this.buildRoom();
    this.buildSixStations();
    this.buildReginaCharacter();
    this.buildPetUnicorn();
    this.buildMagicParticles();

    window.addEventListener('resize', () => this.onResize());
  }

  setQuality(level) {
    if (level === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else if (level === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
    }
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xfbcfe8, 0.92);
    hemi.position.set(0, 14, 0);
    this.scene.add(hemi);

    this.dirLight = new THREE.DirectionalLight(0xfff5f7, 0.85);
    this.dirLight.position.set(7, 13, 8);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.scene.add(this.dirLight);
  }

  buildRoom() {
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    const tileSize = 1.45;
    const cols = 10;
    const rows = 9;
    const tileGeo = new THREE.BoxGeometry(tileSize, 0.2, tileSize);
    this.matFloorA = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    this.matFloorB = new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.35 });

    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const isA = (ix + iz) % 2 === 0;
        const tile = new THREE.Mesh(tileGeo, isA ? this.matFloorA : this.matFloorB);
        tile.position.set((ix - cols / 2 + 0.5) * tileSize, -0.1, (iz - rows / 2 + 0.5) * tileSize);
        tile.receiveShadow = true;
        this.roomGroup.add(tile);
      }
    }

    this.matWall = new THREE.MeshStandardMaterial({ color: 0xf3e8ff, roughness: 0.6 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(15, 4.6, 0.3), this.matWall);
    backWall.position.set(0, 2.2, -6.5);
    this.roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 13), this.matWall);
    leftWall.position.set(-7.3, 2.2, 0);
    this.roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 13), this.matWall);
    rightWall.position.set(7.3, 2.2, 0);
    this.roomGroup.add(rightWall);

    const rainbowColors = [0xff6b6b, 0xffa94d, 0xffe066, 0x69db7c, 0x74c0fc, 0xb197fc];
    rainbowColors.forEach((col, i) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(2.4 - i * 0.17, 0.08, 12, 48, Math.PI),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.15 })
      );
      arc.position.set(0, 1.8, -6.3);
      this.roomGroup.add(arc);
    });
  }

  addStation(config) {
    const group = new THREE.Group();
    group.position.set(config.x, 0, config.z);

    const w = config.w || 1.65;
    const d = config.d || 1.25;
    const h = config.h || 1.0;

    const baseMat = new THREE.MeshStandardMaterial({ color: config.color || 0xffadd2, roughness: 0.45 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08), topMat);
    top.position.y = h + 0.03;
    top.castShadow = true;
    group.add(top);

    if (config.buildProp) config.buildProp(group, h);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.48, 24),
      new THREE.MeshBasicMaterial({ color: 0xff6fb5, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(config.interactOffsetX || 0, 0.02, config.interactOffsetZ || 1.15);
    group.add(ring);

    this.scene.add(group);

    const stationObj = {
      id: config.id,
      name: config.name,
      icon: config.icon,
      type: config.type,
      group,
      ring,
      x: config.x,
      z: config.z,
      interactX: config.x + (config.interactOffsetX || 0),
      interactZ: config.z + (config.interactOffsetZ || 1.15),
      surfaceY: h + 0.08,
      itemVisual: null,
      itemData: null
    };

    this.stations.push(stationObj);
    this.colliders.push({
      minX: config.x - w / 2 - 0.25,
      maxX: config.x + w / 2 + 0.25,
      minZ: config.z - d / 2 - 0.25,
      maxZ: config.z + d / 2 + 0.25
    });

    return stationObj;
  }

  buildSixStations() {
    // 1. Estación de Pedidos
    this.addStation({
      id: 'st_order', name: '1. Estación de Pedidos', icon: '🧾', type: 'order',
      x: -4.4, z: -4.6, w: 1.7, d: 1.25, h: 1.0, color: 0xffadd2,
      buildProp: (g, h) => {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.35), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
        pad.position.set(0, h + 0.1, 0.1);
        g.add(pad);
      }
    });

    // 2. Estación de Preparación
    this.addStation({
      id: 'st_prep', name: '2. Estación de Preparación', icon: '🔪', type: 'prep',
      x: -1.8, z: -4.6, w: 1.7, d: 1.25, h: 1.0, color: 0xd8b4fe,
      buildProp: (g, h) => {
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.55), new THREE.MeshStandardMaterial({ color: 0xffe8cc }));
        board.position.set(0, h + 0.1, 0);
        g.add(board);
      }
    });

    // 3. Estación de Cocción
    this.addStation({
      id: 'st_cook', name: '3. Estación de Cocción', icon: '🍳', type: 'cook',
      x: 1.2, z: -4.6, w: 1.8, d: 1.25, h: 1.0, color: 0xfbcfe8,
      buildProp: (g, h) => {
        const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0x4a2c59 }));
        burner.position.set(-0.35, h + 0.1, 0);
        g.add(burner);
        const ovenBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.45), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.25 }));
        ovenBox.position.set(0.38, h + 0.22, 0);
        g.add(ovenBox);
      }
    });

    // 4. Estación de Montaje
    this.addStation({
      id: 'st_build', name: '4. Estación de Montaje', icon: '🍽️', type: 'build',
      x: 4.1, z: -4.6, w: 1.75, d: 1.25, h: 0.98, color: 0xbae6fd,
      buildProp: (g, h) => {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.06, 22), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        plate.position.set(0, h + 0.1, 0);
        g.add(plate);
      }
    });

    // 5. Estación de Decoración
    this.addStation({
      id: 'st_decorate', name: '5. Estación de Decoración', icon: '🦄', type: 'decorate',
      x: 2.6, z: 1.6, w: 1.8, d: 1.3, h: 0.98, color: 0xe9d5ff, interactOffsetZ: -1.15,
      buildProp: (g, h) => {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xff85c0 }));
        stand.position.set(0, h + 0.12, 0);
        g.add(stand);
      }
    });

    // 6. Estación de Entrega
    this.addStation({
      id: 'st_serve', name: '6. Estación de Entrega', icon: '🎁', type: 'serve',
      x: -2.6, z: 1.6, w: 1.8, d: 1.3, h: 0.98, color: 0xfde68a, interactOffsetZ: -1.15,
      buildProp: (g, h) => {
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0xffd43b, metalness: 0.5 }));
        bell.position.set(0, h + 0.18, 0);
        g.add(bell);
      }
    });
  }

  buildReginaCharacter() {
    this.player = new THREE.Group();
    this.player.position.set(0, 0, 2.5);

    this.matDress = new THREE.MeshStandardMaterial({ color: 0xff85c0, roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.78, 18), this.matDress);
    torso.position.y = 0.72;
    torso.castShadow = true;
    this.player.add(torso);

    this.matApron = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.12), this.matApron);
    apron.position.set(0, 0.66, 0.25);
    this.player.add(apron);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.55 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20), skinMat);
    head.position.y = 1.38;
    head.castShadow = true;
    this.player.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3b1c4a });
    [-0.11, 0.11].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), eyeMat);
      eye.position.set(ex, 1.4, 0.28);
      this.player.add(eye);
    });

    this.matHair = new THREE.MeshStandardMaterial({ color: 0xff7eb9, roughness: 0.5 });
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 18), this.matHair);
    hairBack.position.set(0, 1.42, -0.05);
    this.player.add(hairBack);

    this.hatGroup = new THREE.Group();
    this.hatGroup.position.set(0, 1.68, 0);
    this.player.add(this.hatGroup);

    this.leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.48, 12), skinMat);
    this.leftArm.position.set(-0.34, 0.85, 0.08);
    this.leftArm.rotation.z = 0.25;
    this.player.add(this.leftArm);

    this.rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.48, 12), skinMat);
    this.rightArm.position.set(0.34, 0.85, 0.08);
    this.rightArm.rotation.z = -0.25;
    this.player.add(this.rightArm);

    this.leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 12), skinMat);
    this.leftLeg.position.set(-0.14, 0.2, 0);
    this.player.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 12), skinMat);
    this.rightLeg.position.set(0.14, 0.2, 0);
    this.player.add(this.rightLeg);

    this.handHoldPoint = new THREE.Group();
    this.handHoldPoint.position.set(0, 0.88, 0.52);
    this.player.add(this.handHoldPoint);

    this.scene.add(this.player);
  }

  applyCustomization(custom) {
    const outfitOpt = CUSTOM_OPTIONS.outfits.find((o) => o.id === custom.outfit) || CUSTOM_OPTIONS.outfits[0];
    const hairOpt = CUSTOM_OPTIONS.hair.find((h) => h.id === custom.hair) || CUSTOM_OPTIONS.hair[0];
    const petOpt = CUSTOM_OPTIONS.pet.find((p) => p.id === custom.pet) || CUSTOM_OPTIONS.pet[0];

    this.matDress.color.setHex(outfitOpt.dress);
    this.matApron.color.setHex(outfitOpt.apron);
    this.matHair.color.setHex(hairOpt.color);

    while (this.hatGroup.children.length) this.hatGroup.remove(this.hatGroup.children[0]);
    if (custom.hat === 'unicorn_horn') {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 14), new THREE.MeshStandardMaterial({ color: 0xffd43b, metalness: 0.4 }));
      horn.position.set(0, 0.14, 0.12);
      horn.rotation.x = 0.25;
      this.hatGroup.add(horn);
    } else if (custom.hat === 'chef_hat') {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      puff.position.y = 0.14;
      this.hatGroup.add(puff);
    } else if (custom.hat === 'pink_bow') {
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0xff6fb5 }));
      bow.position.set(0, 0.08, 0.05);
      this.hatGroup.add(bow);
    } else {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xfcc419, metalness: 0.5 }));
      crown.position.y = 0.08;
      this.hatGroup.add(crown);
    }

    if (this.petBodyMat && this.petManeMat) {
      this.petBodyMat.color.setHex(petOpt.body);
      this.petManeMat.color.setHex(petOpt.mane);
    }
  }

  buildPetUnicorn() {
    this.pet = new THREE.Group();
    this.pet.position.set(-1.1, 0, 2.8);
    this.petBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    this.petManeMat = new THREE.MeshStandardMaterial({ color: 0xff7eb9, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.54), this.petBodyMat);
    body.position.y = 0.34;
    this.pet.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.32), this.petBodyMat);
    head.position.set(0, 0.56, 0.24);
    this.pet.add(head);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 12), new THREE.MeshStandardMaterial({ color: 0xffd43b, emissive: 0xfcc419, emissiveIntensity: 0.25 }));
    horn.position.set(0, 0.78, 0.3);
    horn.rotation.x = 0.25;
    this.pet.add(horn);

    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.26), this.petManeMat);
    mane.position.set(0, 0.58, 0.06);
    this.pet.add(mane);

    this.scene.add(this.pet);
  }

  buildMagicParticles() {
    const geo = new THREE.OctahedronGeometry(0.07, 0);
    const colors = [0xff7eb9, 0xc084fc, 0x7dd3fc, 0xfef08a];
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
      const star = new THREE.Mesh(geo, mat);
      star.position.set((Math.random() - 0.5) * 12, 0.9 + Math.random() * 3.2, (Math.random() - 0.5) * 9);
      star.userData = { baseY: star.position.y, phase: Math.random() * Math.PI * 2 };
      this.scene.add(star);
      this.floatingStars.push(star);
    }
  }

  spawnBurstParticles(x, y, z, colorHex = 0xff7eb9) {
    const geo = new THREE.SphereGeometry(0.07, 8, 8);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? colorHex : 0xffe066 });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);
      p.userData = {
        vx: (Math.random() - 0.5) * 3.2,
        vy: 1.5 + Math.random() * 2.4,
        vz: (Math.random() - 0.5) * 3.2,
        life: 0.9
      };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  // Posiciona el platillo y sus toppings pegados a la superficie real sin flotar ni desfasarse
  createFoodMesh(dishState) {
    const group = new THREE.Group();
    const baseColor = dishState.color || 0xff85c0;
    const accentColor = dishState.accentColor || 0xffffff;

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.26, 0.05, 22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    plate.position.y = 0.025;
    group.add(plate);

    const foodBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4 })
    );
    foodBody.position.y = 0.13;
    group.add(foodBody);

    if (dishState.frosting) {
      const frost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.05, 20),
        new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3 })
      );
      frost.position.y = 0.225;
      group.add(frost);
    }

    // Toppings colocados dentro del radio del plato sobre su superficie superior
    if (dishState.toppings && dishState.toppings.length) {
      dishState.toppings.slice(0, 8).forEach((t, idx) => {
        const angle = (idx / Math.max(1, dishState.toppings.length)) * Math.PI * 2 + (t.x || 0) * 1.5;
        const r = Math.min(0.16, 0.07 + (idx % 2) * 0.06);
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 10, 10),
          new THREE.MeshStandardMaterial({ color: idx % 2 === 0 ? 0xffd43b : 0xff4d6d })
        );
        dot.position.set(Math.cos(angle) * r, 0.265, Math.sin(angle) * r);
        group.add(dot);
      });
    }

    return group;
  }

  applyWorldTheme(worldObj) {
    const t = worldObj.theme;
    this.scene.background.setHex(t.sky);
    this.scene.fog.color.setHex(t.sky);
    this.matFloorA.color.setHex(t.floorA);
    this.matFloorB.color.setHex(t.floorB);
    this.matWall.color.setHex(t.wall);
  }

  cycleCameraMode() {
    this.cameraMode = (this.cameraMode + 1) % 3;
  }

  checkCollision(nx, nz) {
    if (nx < -6.3 || nx > 6.3 || nz < -4.0 || nz > 4.2) return true;
    for (const c of this.colliders) {
      if (nx > c.minX && nx < c.maxX && nz > c.minZ && nz < c.maxZ) return true;
    }
    return false;
  }

  movePlayerToStation(stationType) {
    const st = this.stations.find((s) => s.type === stationType);
    if (st) {
      this.player.position.x = Math.max(-6.1, Math.min(6.1, st.interactX));
      this.player.position.z = Math.max(-3.8, Math.min(4.0, st.interactZ));
      this.player.rotation.y = Math.atan2(st.x - this.player.position.x, st.z - this.player.position.z);
    }
  }

  update(dt, moveVec, isCookingAnim, particlesEnabled) {
    const elapsed = this.clock.getElapsedTime();
    const speed = 4.8;
    const moving = Math.hypot(moveVec.x, moveVec.z) > 0.05;

    if (moving) {
      const dx = moveVec.x * speed * dt;
      const dz = moveVec.z * speed * dt;
      if (!this.checkCollision(this.player.position.x + dx, this.player.position.z)) this.player.position.x += dx;
      if (!this.checkCollision(this.player.position.x, this.player.position.z + dz)) this.player.position.z += dz;

      this.player.rotation.y = Math.atan2(moveVec.x, moveVec.z);
      this.leftLeg.rotation.x = Math.sin(elapsed * 12) * 0.55;
      this.rightLeg.rotation.x = -Math.sin(elapsed * 12) * 0.55;
      this.player.position.y = Math.abs(Math.sin(elapsed * 12)) * 0.06;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.player.position.y *= 0.8;
    }

    if (isCookingAnim) {
      this.rightArm.rotation.x = -1.2 + Math.sin(elapsed * 22) * 0.5;
    } else if (this.handHoldPoint.children.length > 0) {
      this.leftArm.rotation.x = -0.85;
      this.rightArm.rotation.x = -0.85;
    } else {
      this.leftArm.rotation.x = moving ? -Math.sin(elapsed * 12) * 0.35 : 0;
      this.rightArm.rotation.x = moving ? Math.sin(elapsed * 12) * 0.35 : 0;
    }

    const targetPetX = this.player.position.x - Math.sin(this.player.rotation.y) * 1.15 - 0.55;
    const targetPetZ = this.player.position.z - Math.cos(this.player.rotation.y) * 1.15 + 0.35;
    this.pet.position.x += (targetPetX - this.pet.position.x) * 3.2 * dt;
    this.pet.position.z += (targetPetZ - this.pet.position.z) * 3.2 * dt;
    this.pet.position.y = Math.abs(Math.sin(elapsed * 4.5)) * 0.09;
    this.pet.lookAt(this.player.position.x, 0.3, this.player.position.z);

    this.floatingStars.forEach((s) => {
      s.visible = particlesEnabled;
      if (particlesEnabled) {
        s.rotation.y += dt * 1.5;
        s.position.y = s.userData.baseY + Math.sin(elapsed * 2 + s.userData.phase) * 0.16;
      }
    });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy -= 4.5 * dt;
      p.scale.setScalar(Math.max(0.01, p.userData.life));
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
      }
    }

    const isPortrait = window.innerHeight > window.innerWidth;
    let camOffsetY = isPortrait ? 8.4 : 6.9;
    let camOffsetZ = isPortrait ? 8.6 : 6.9;
    if (this.cameraMode === 1) { camOffsetY = 4.8; camOffsetZ = 5.0; }
    else if (this.cameraMode === 2) { camOffsetY = 10.6; camOffsetZ = 9.6; }

    this.camera.position.x += (this.player.position.x * 0.72 - this.camera.position.x) * 5 * dt;
    this.camera.position.y += (camOffsetY - this.camera.position.y) * 5 * dt;
    this.camera.position.z += (this.player.position.z * 0.65 + camOffsetZ - this.camera.position.z) * 5 * dt;
    this.camera.lookAt(this.player.position.x * 0.6, 0.7, this.player.position.z * 0.5 - 0.6);

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.UnicornKitchenWorld = UnicornKitchenWorld;
