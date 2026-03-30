// ── Game Engine ──
(() => {
    const COLS = 22;
    const ROWS = 31;
    const BLOCK = 24;
    const COLORS = [
        null,
        '#00f0f0', '#f0f000', '#a000f0', '#00f000',
        '#f00000', '#0000f0', '#f0a000',
    ];

    const PIECES = [
        null,
        [[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],[[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]],
        [[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]]],
        [[[0,1,0],[1,1,1],[0,0,0]],[[0,1,0],[0,1,1],[0,1,0]],[[0,0,0],[1,1,1],[0,1,0]],[[0,1,0],[1,1,0],[0,1,0]]],
        [[[0,1,1],[1,1,0],[0,0,0]],[[0,1,0],[0,1,1],[0,0,1]],[[0,0,0],[0,1,1],[1,1,0]],[[1,0,0],[1,1,0],[0,1,0]]],
        [[[1,1,0],[0,1,1],[0,0,0]],[[0,0,1],[0,1,1],[0,1,0]],[[0,0,0],[1,1,0],[0,1,1]],[[0,1,0],[1,1,0],[1,0,0]]],
        [[[1,0,0],[1,1,1],[0,0,0]],[[0,1,1],[0,1,0],[0,1,0]],[[0,0,0],[1,1,1],[0,0,1]],[[0,1,0],[0,1,0],[1,1,0]]],
        [[[0,0,1],[1,1,1],[0,0,0]],[[0,1,0],[0,1,0],[0,1,1]],[[0,0,0],[1,1,1],[1,0,0]],[[1,1,0],[0,1,0],[0,1,0]]],
    ];

    const KICKS = [
        [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
        [[0,0],[1,0],[1,-1],[0,2],[1,2]],
        [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
        [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    ];
    const KICKS_I = [
        [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
        [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
        [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
        [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    ];

    const LINE_POINTS = [0, 100, 300, 500, 800];

    let board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    let current, next, score, level, linesCleared, gameOver, paused, running;
    let dropInterval, dropCounter, lastTime;
    let bag = [];
    let hardDropping = false;
    window.showGrid = localStorage.getItem('tetris-grid') !== 'false';
    const HARD_DROP_SPEED = 20;

    function scoreMultiplier() { return window.showGrid ? 0.6 : 1; }

    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d');
    canvas.width = COLS * BLOCK;
    canvas.height = ROWS * BLOCK;

    const nextCanvas = document.getElementById('next');
    const nextCtx = nextCanvas.getContext('2d');

    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const linesEl = document.getElementById('lines');
    const overlayStart = document.getElementById('overlay-start');
    const overlayPause = document.getElementById('overlay-pause');
    const overlayGameover = document.getElementById('overlay-gameover');
    const finalScoreEl = document.getElementById('final-score');
    const lastScoreEl = document.getElementById('last-score');
    const bestScoreEl = document.getElementById('best-score');

    function loadScores() {
        const last = localStorage.getItem('tetris-last-score');
        const best = localStorage.getItem('tetris-best-score');
        if (last !== null) lastScoreEl.textContent = Number(last).toLocaleString();
        if (best !== null) bestScoreEl.textContent = Number(best).toLocaleString();
    }

    function saveScore(finalScore) {
        localStorage.setItem('tetris-last-score', finalScore);
        lastScoreEl.textContent = finalScore.toLocaleString();
        const best = Number(localStorage.getItem('tetris-best-score') || 0);
        if (finalScore > best) {
            localStorage.setItem('tetris-best-score', finalScore);
            bestScoreEl.textContent = finalScore.toLocaleString();
        }
    }

    loadScores();

    function refillBag() {
        const pieces = [1, 2, 3, 4, 5, 6, 7];
        for (let i = pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        bag.push(...pieces);
    }

    function nextPiece() {
        if (bag.length < 2) refillBag();
        return bag.shift();
    }

    function createPiece(type) {
        const shape = PIECES[type];
        const size = shape[0].length;
        return { type, rotation: 0, x: Math.floor((COLS - size) / 2), y: 0 };
    }

    function getShape(piece) { return PIECES[piece.type][piece.rotation]; }

    function collides(piece, dx, dy, rotation) {
        const shape = PIECES[piece.type][rotation !== undefined ? rotation : piece.rotation];
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const nx = piece.x + c + (dx || 0);
                const ny = piece.y + r + (dy || 0);
                if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
                if (ny >= 0 && board[ny][nx]) return true;
            }
        }
        return false;
    }

    function lock(piece) {
        const shape = getShape(piece);
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const y = piece.y + r;
                const x = piece.x + c;
                if (y < 0) { endGame(); return; }
                board[y][x] = piece.type;
            }
        }
        clearLines();
    }

    function clearLines() {
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r].every(cell => cell !== 0)) {
                board.splice(r, 1);
                board.unshift(new Array(COLS).fill(0));
                cleared++;
                r++;
            }
        }
        if (cleared > 0) {
            linesCleared += cleared;
            score += Math.round(LINE_POINTS[cleared] * level * scoreMultiplier());
            level = Math.floor(linesCleared / 10) + 1;
            dropInterval = Math.max(80, 1800 - (level - 1) * 150);
            updateUI();
        }
    }

    function rotate(piece, dir) {
        const newRot = (piece.rotation + dir + 4) % 4;
        const kicks = piece.type === 1 ? KICKS_I : KICKS;
        const kickIndex = piece.rotation;
        for (const [kx, ky] of kicks[kickIndex]) {
            if (!collides(piece, kx, ky, newRot)) {
                piece.x += kx;
                piece.y += ky;
                piece.rotation = newRot;
                return;
            }
        }
    }

    function drawBlock(ctx, x, y, type, alpha) {
        const a = alpha || 1;
        const color = COLORS[type];
        const px = x * BLOCK, py = y * BLOCK, B = BLOCK, inset = 1, inner = B - 2;
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        ctx.fillRect(px + inset, py + inset, inner, inner);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.moveTo(px+inset,py+inset); ctx.lineTo(px+B-inset,py+inset); ctx.lineTo(px+B-inset-4,py+inset+4); ctx.lineTo(px+inset+4,py+inset+4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.moveTo(px+inset,py+inset); ctx.lineTo(px+inset+4,py+inset+4); ctx.lineTo(px+inset+4,py+B-inset-4); ctx.lineTo(px+inset,py+B-inset); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.moveTo(px+inset,py+B-inset); ctx.lineTo(px+inset+4,py+B-inset-4); ctx.lineTo(px+B-inset-4,py+B-inset-4); ctx.lineTo(px+B-inset,py+B-inset); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.moveTo(px+B-inset,py+inset); ctx.lineTo(px+B-inset,py+B-inset); ctx.lineTo(px+B-inset-4,py+B-inset-4); ctx.lineTo(px+B-inset-4,py+inset+4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(px+inset+4, py+inset+4, 3, 3);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5;
        ctx.strokeRect(px+inset, py+inset, inner, inner);
        ctx.globalAlpha = 1;
    }

    function getThemeColor(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function draw() {
        ctx.fillStyle = getThemeColor('--surface');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (window.showGrid) {
            ctx.strokeStyle = getThemeColor('--grid');
            ctx.lineWidth = 0.5;
            for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r*BLOCK); ctx.lineTo(COLS*BLOCK, r*BLOCK); ctx.stroke(); }
            for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c*BLOCK, 0); ctx.lineTo(c*BLOCK, ROWS*BLOCK); ctx.stroke(); }
        }
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) drawBlock(ctx, c, r, board[r][c]);
        if (current && !gameOver) {
            const shape = getShape(current);
            for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) drawBlock(ctx, current.x+c, current.y+r, current.type);
        }
    }

    function drawNext() {
        nextCtx.fillStyle = getThemeColor('--surface');
        nextCtx.fillRect(0, 0, 100, 100);
        if (!next) return;
        const shape = PIECES[next][0], size = shape.length;
        const ox = (100-size*20)/2, oy = (100-size*20)/2;
        for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) {
            const bx = ox+c*20, by = oy+r*20;
            nextCtx.fillStyle = COLORS[next]; nextCtx.fillRect(bx+1,by+1,18,18);
            nextCtx.fillStyle = 'rgba(255,255,255,0.15)'; nextCtx.fillRect(bx+1,by+1,18,3);
            nextCtx.fillStyle = 'rgba(0,0,0,0.2)'; nextCtx.fillRect(bx+1,by+16,18,3);
        }
    }

    function updateUI() { scoreEl.textContent = score.toLocaleString(); levelEl.textContent = level; linesEl.textContent = linesCleared; }

    function spawn() {
        const type = next || nextPiece();
        next = nextPiece();
        current = createPiece(type);
        drawNext();
        if (collides(current, 0, 0)) endGame();
    }

    function drop() {
        if (!collides(current, 0, 1)) {
            current.y++;
            if (hardDropping) { score += Math.round(2 * scoreMultiplier()); updateUI(); }
        } else {
            if (hardDropping) { hardDropping = false; dropInterval = Math.max(80, 1800-(level-1)*150); }
            lock(current);
            if (!gameOver) spawn();
        }
    }

    function hardDrop() { hardDropping = true; dropCounter = 0; dropInterval = HARD_DROP_SPEED; }
    function moveLeft() { if (!collides(current, -1, 0)) current.x--; }
    function moveRight() { if (!collides(current, 1, 0)) current.x++; }
    function softDrop() { if (!collides(current, 0, 1)) { current.y++; score += Math.round(1 * scoreMultiplier() * 0.6); updateUI(); } }

    function endGame() {
        gameOver = true; running = false;
        finalScoreEl.textContent = `Score: ${score.toLocaleString()}`;
        saveScore(score);
        overlayGameover.classList.remove('hidden');
    }

    function gameLoop(time) {
        if (!running) return;
        if (!lastTime) lastTime = time;
        const delta = time - lastTime;
        lastTime = time;
        dropCounter += delta;
        if (dropCounter >= dropInterval) { drop(); dropCounter = 0; }
        draw();
        requestAnimationFrame(gameLoop);
    }

    function startGame() {
        board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
        bag = []; refillBag();
        score = 0; level = 1; linesCleared = 0;
        dropInterval = 1800; dropCounter = 0; lastTime = 0;
        gameOver = false; paused = false; running = true; hardDropping = false;
        next = null; current = null;
        overlayStart.classList.add('hidden');
        overlayPause.classList.add('hidden');
        overlayGameover.classList.add('hidden');
        updateUI(); spawn(); draw(); drawNext();
        requestAnimationFrame(gameLoop);
    }

    function togglePause() {
        if (gameOver) return;
        paused = !paused;
        if (paused) { running = false; overlayPause.classList.remove('hidden'); }
        else { running = true; overlayPause.classList.add('hidden'); lastTime = 0; requestAnimationFrame(gameLoop); }
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!overlayStart.classList.contains('hidden')) startGame();
            else if (!overlayGameover.classList.contains('hidden')) startGame();
            else if (!overlayPause.classList.contains('hidden')) togglePause();
            return;
        }
        if (!running && !paused) return;
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
        if (paused || gameOver) return;
        if (hardDropping) { e.preventDefault(); return; }
        switch (e.key) {
            case 'ArrowLeft': e.preventDefault(); moveLeft(); break;
            case 'ArrowRight': e.preventDefault(); moveRight(); break;
            case 'ArrowDown': e.preventDefault(); softDrop(); break;
            case 'ArrowUp': e.preventDefault(); rotate(current, 1); break;
            case ' ': e.preventDefault(); hardDrop(); break;
        }
    });

    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-resume').addEventListener('click', togglePause);
    document.getElementById('btn-restart').addEventListener('click', startGame);

    function touchAction(fn) { return e => { e.preventDefault(); if (running && !paused && !gameOver) fn(); }; }
    ['touchstart','mousedown'].forEach(evt => {
        document.getElementById('t-left').addEventListener(evt, touchAction(moveLeft));
        document.getElementById('t-right').addEventListener(evt, touchAction(moveRight));
        document.getElementById('t-rotate').addEventListener(evt, touchAction(() => rotate(current, 1)));
        document.getElementById('t-drop').addEventListener(evt, touchAction(softDrop));
        document.getElementById('t-hard').addEventListener(evt, touchAction(hardDrop));
    });

    // Pause button for mobile
    const tPause = document.getElementById('t-pause');
    if (tPause) {
        ['touchstart','mousedown'].forEach(evt => {
            tPause.addEventListener(evt, e => {
                e.preventDefault();
                if (running || paused) togglePause();
            });
        });
    }

    // ── Swipe gestures on canvas ──
    (function() {
        const el = document.querySelector('.game-container');
        let startX, startY, startTime, swiped;
        const SWIPE_MIN = 30;
        const SWIPE_TIME = 300;

        el.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startTime = Date.now();
            swiped = false;
        }, { passive: true });

        el.addEventListener('touchmove', function(e) {
            if (!startX || !running || paused || gameOver || hardDropping) return;
            const t = e.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            if (!swiped && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
                swiped = true;
                if (dx > 0) moveRight(); else moveLeft();
                startX = t.clientX;
                startY = t.clientY;
                e.preventDefault();
            } else if (!swiped && dy > SWIPE_MIN && Math.abs(dy) > Math.abs(dx)) {
                swiped = true;
                softDrop();
                startY = t.clientY;
                startX = t.clientX;
                e.preventDefault();
            } else if (!swiped && dy < -SWIPE_MIN && Math.abs(dy) > Math.abs(dx)) {
                swiped = true;
                hardDrop();
                e.preventDefault();
            }

            // continuous horizontal swipe — reset after each move
            if (swiped && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) moveRight(); else moveLeft();
                startX = t.clientX;
                startY = t.clientY;
                e.preventDefault();
            }
            if (swiped && dy > SWIPE_MIN && Math.abs(dy) > Math.abs(dx)) {
                softDrop();
                startY = t.clientY;
                e.preventDefault();
            }
        }, { passive: false });

        el.addEventListener('touchend', function(e) {
            if (!running || paused || gameOver || hardDropping) {
                // tap on overlay — let button clicks through
                startX = null;
                return;
            }
            const elapsed = Date.now() - startTime;
            if (!swiped && elapsed < SWIPE_TIME) {
                // tap = rotate
                rotate(current, 1);
            }
            startX = null;
        }, { passive: true });
    })();

    // ── Sync mobile stat elements ──
    const mScoreEl = document.getElementById('m-score');
    const mLevelEl = document.getElementById('m-level');
    const mLinesEl = document.getElementById('m-lines');
    const mBestEl = document.getElementById('m-best');

    const origUpdateUI = updateUI;
    updateUI = function() {
        origUpdateUI();
        if (mScoreEl) mScoreEl.textContent = score.toLocaleString();
        if (mLevelEl) mLevelEl.textContent = level;
        if (mLinesEl) mLinesEl.textContent = linesCleared;
    };

    function syncMobileBest() {
        const best = localStorage.getItem('tetris-best-score');
        if (mBestEl) mBestEl.textContent = best ? Number(best).toLocaleString() : '-';
    }

    const origSaveScore = saveScore;
    saveScore = function(s) {
        origSaveScore(s);
        syncMobileBest();
    };

    syncMobileBest();

    window.tetrisDraw = draw;
    window.tetrisStartGame = startGame;
    window.tetrisTogglePause = togglePause;
    draw();
    drawNext();
})();

// ── i18n, Theme, Grid ──
(() => {
    const i18n = {
        ru: { title:'Тетрис', subtitle:'Классическая игра', start:'Начать игру', paused:'Пауза', resume:'Продолжить', gameover:'Игра окончена', restart:'Играть снова', score:'Очки', level:'Уровень', lines_label:'Линии', next:'Следующая', last_score:'Последний счёт', best_score:'Лучший счёт', move:'Движение', rotate:'Поворот', soft_drop:'Вниз', hard_drop:'Бросить', pause:'Пауза', enter_start:'Старт', score_prefix:'Счёт', rules_btn:'Правила', swipe_hint:'Свайп ← → ↓ по полю • Тап = поворот • Свайп ↑ = бросить' },
        en: { title:'Tetris', subtitle:'Classic block-stacking game', start:'Start Game', paused:'Paused', resume:'Resume', gameover:'Game Over', restart:'Play Again', score:'Score', level:'Level', lines_label:'Lines', next:'Next', last_score:'Last Score', best_score:'Best Score', move:'Move', rotate:'Rotate', soft_drop:'Soft drop', hard_drop:'Hard drop', pause:'Pause', enter_start:'Start', score_prefix:'Score', rules_btn:'Rules', swipe_hint:'Swipe ← → ↓ on field • Tap = rotate • Swipe ↑ = drop' }
    };

    let currentLang = localStorage.getItem('tetris-lang') || 'ru';
    const langBtn = document.getElementById('lang-btn');

    function applyLang(lang) {
        currentLang = lang;
        const strings = i18n[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (strings[key]) el.textContent = strings[key];
        });
        langBtn.textContent = lang === 'ru' ? 'EN' : 'RU';
        localStorage.setItem('tetris-lang', lang);
        const fs = document.getElementById('final-score');
        if (fs.textContent) {
            const num = fs.textContent.replace(/[^\d,.\s]/g, '').trim();
            fs.textContent = strings.score_prefix + ': ' + num;
        }
    }

    const fsEl = document.getElementById('final-score');
    const observer = new MutationObserver(() => {
        if (fsEl.textContent && fsEl.textContent.startsWith('Score:')) {
            const num = fsEl.textContent.replace('Score:', '').trim();
            fsEl.textContent = i18n[currentLang].score_prefix + ': ' + num;
        }
    });
    observer.observe(fsEl, { childList: true, characterData: true, subtree: true });

    const mLangBtn = document.getElementById('m-lang-btn');
    function toggleLang() { applyLang(currentLang === 'ru' ? 'en' : 'ru'); }
    langBtn.addEventListener('click', toggleLang);
    if (mLangBtn) mLangBtn.addEventListener('click', toggleLang);

    const origApplyLang = applyLang;
    applyLang = function(lang) {
        origApplyLang(lang);
        if (mLangBtn) mLangBtn.textContent = lang === 'ru' ? 'EN' : 'RU';
    };
    applyLang(currentLang);

    const themeBtn = document.getElementById('theme-btn');
    let currentTheme = localStorage.getItem('tetris-theme') || 'dark';
    function applyTheme(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('tetris-theme', theme);
        window["tetrisDraw"]();
    }
    const mThemeBtn = document.getElementById('m-theme-btn');
    function toggleTheme() { applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); }
    themeBtn.addEventListener('click', toggleTheme);
    if (mThemeBtn) mThemeBtn.addEventListener('click', toggleTheme);

    const origApplyTheme = applyTheme;
    applyTheme = function(theme) {
        origApplyTheme(theme);
        if (mThemeBtn) mThemeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    };
    applyTheme(currentTheme);

    const gridBtn = document.getElementById('grid-btn');
    const mGridBtn = document.getElementById('m-grid-btn');
    function syncGridBtns() {
        const op = window.showGrid ? 1 : 0.4;
        gridBtn.style.opacity = op;
        if (mGridBtn) mGridBtn.style.opacity = op;
    }
    syncGridBtns();
    function toggleGrid() {
        window.showGrid = !window.showGrid;
        localStorage.setItem('tetris-grid', window.showGrid);
        syncGridBtns();
        window["tetrisDraw"]();
    }
    gridBtn.addEventListener('click', toggleGrid);
    if (mGridBtn) mGridBtn.addEventListener('click', toggleGrid);

    // ── Rules modal ──
    const rulesHtml = {
        ru: `<h2>Правила игры</h2>
<h3>Цель</h3>
Заполняйте горизонтальные линии блоками. Полная линия исчезает и приносит очки. Игра заканчивается, когда блоки достигают верха поля.

<h3>Управление</h3>
<table>
<tr><td>← →</td><td>Движение</td></tr>
<tr><td>↑</td><td>Поворот</td></tr>
<tr><td>↓</td><td>Сдвиг вниз (+1 очко)</td></tr>
<tr><td>Пробел</td><td>Бросить вниз (+2 за клетку)</td></tr>
<tr><td>Esc / P</td><td>Пауза</td></tr>
<tr><td>Enter</td><td>Старт / Рестарт</td></tr>
</table>

<h3>Очки за линии</h3>
<table>
<tr><td>1 линия</td><td>100 × уровень</td></tr>
<tr><td>2 линии</td><td>300 × уровень</td></tr>
<tr><td>3 линии</td><td>500 × уровень</td></tr>
<tr><td>4 линии (Тетрис)</td><td>800 × уровень</td></tr>
</table>

<h3>Уровни</h3>
Каждые 10 очищенных линий — новый уровень. Скорость увеличивается.

<h3>Сетка</h3>
<span class="highlight">При включённой сетке (▦) очки начисляются на 40% меньше.</span> Отключите сетку для максимального счёта!

<h3>Прицеливание</h3>
<span class="highlight">Кнопка ↓ (сдвиг вниз) снижает очки за сдвиг на 40%</span> по сравнению с пробелом (бросить). Используйте пробел для максимальных очков!

<button class="rules-close" id="rules-close">Понятно</button>`,
        en: `<h2>Game Rules</h2>
<h3>Goal</h3>
Fill horizontal lines with blocks. Complete lines disappear and earn points. Game ends when blocks reach the top.

<h3>Controls</h3>
<table>
<tr><td>← →</td><td>Move</td></tr>
<tr><td>↑</td><td>Rotate</td></tr>
<tr><td>↓</td><td>Soft drop (+1 point)</td></tr>
<tr><td>Space</td><td>Hard drop (+2 per cell)</td></tr>
<tr><td>Esc / P</td><td>Pause</td></tr>
<tr><td>Enter</td><td>Start / Restart</td></tr>
</table>

<h3>Line Scores</h3>
<table>
<tr><td>1 line</td><td>100 × level</td></tr>
<tr><td>2 lines</td><td>300 × level</td></tr>
<tr><td>3 lines</td><td>500 × level</td></tr>
<tr><td>4 lines (Tetris)</td><td>800 × level</td></tr>
</table>

<h3>Levels</h3>
Every 10 cleared lines advances the level. Speed increases.

<h3>Grid</h3>
<span class="highlight">With grid enabled (▦), scores are reduced by 40%.</span> Disable the grid for maximum points!

<h3>Aiming penalty</h3>
<span class="highlight">Using ↓ (soft drop) gives 40% fewer points per cell</span> compared to Space (hard drop). Use Space for maximum points!

<button class="rules-close" id="rules-close">Got it</button>`
    };

    const rulesModal = document.getElementById('rules-modal');
    const rulesContent = document.getElementById('rules-content');

    function showRules() {
        rulesContent.innerHTML = rulesHtml[currentLang];
        rulesModal.classList.add('visible');
        document.getElementById('rules-close').addEventListener('click', () => {
            rulesModal.classList.remove('visible');
        });
    }

    document.getElementById('rules-btn-bottom').addEventListener('click', showRules);
    const mRulesBtn = document.getElementById('m-rules-btn');
    if (mRulesBtn) mRulesBtn.addEventListener('click', showRules);
    rulesModal.addEventListener('click', e => {
        if (e.target === rulesModal) rulesModal.classList.remove('visible');
    });
})();

// ── Scale control ──
(() => {
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValueEl = document.getElementById('scale-value');
    const gameWrapper = document.querySelector('.game-wrapper');
    const canvas = document.getElementById('board');

    function isMobile() {
        return window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    }

    function applyScale(val) {
        val = Math.round(val * 100) / 100;
        gameWrapper.style.transform = 'scale(' + val + ')';
        scaleSlider.value = val;
        scaleValueEl.textContent = Math.round(val * 100) + '%';
        localStorage.setItem('tetris-scale', val);
    }

    function autoScale() {
        if (isMobile()) {
            // on mobile: fit canvas width to screen width with some padding
            const availWidth = window.innerWidth - 16;
            const naturalWidth = canvas.width + 4;
            const fitW = availWidth / naturalWidth;
            // also check height: canvas + top bar (~50) + touch controls (~160) + bottom btns (~50) + hints (~20)
            const availHeight = window.innerHeight - 280;
            const naturalHeight = canvas.height + 4;
            const fitH = availHeight / naturalHeight;
            return Math.min(fitW, fitH, 2.5);
        }
        const naturalHeight = canvas.height + 4;
        const availableHeight = window.innerHeight - 80;
        const fit = availableHeight / naturalHeight;
        return Math.min(Math.max(fit, 0.5), 2.5);
    }

    function mobileAutoScale() {
        if (isMobile()) {
            applyScale(autoScale());
        }
    }

    const savedScale = localStorage.getItem('tetris-scale');
    if (isMobile()) {
        applyScale(autoScale());
    } else {
        applyScale(savedScale ? Number(savedScale) : autoScale());
    }

    scaleSlider.addEventListener('input', e => applyScale(Number(e.target.value)));

    document.getElementById('auto-scale-btn').addEventListener('click', () => {
        localStorage.removeItem('tetris-scale');
        applyScale(autoScale());
    });

    // re-fit on orientation change
    window.addEventListener('orientationchange', () => setTimeout(mobileAutoScale, 200));
    window.addEventListener('resize', () => { if (isMobile()) mobileAutoScale(); });
})();

// ── Prevent scroll on touch devices ──
document.addEventListener('touchmove', function(e) {
    if (e.target.closest('.game-container') || e.target.closest('.touch-controls')) {
        e.preventDefault();
    }
}, { passive: false });
