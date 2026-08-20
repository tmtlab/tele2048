// ============ GAME STATE ============
const GameState = { PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'gameOver' };
let currentState = GameState.PLAYING;

let board = [];
let score = 0;
let bestScore = parseInt(localStorage.getItem('bestScore2048Master') || '0');
let coins = parseInt(localStorage.getItem('coins2048') || '0');
let moveHistory = [];
let obstacles = new Set();
let bombs = new Set();
let shieldedValues = new Set();
let hasWon = false;
let soundEnabled = localStorage.getItem('soundEnabled2048') !== 'false';
let nightMode = localStorage.getItem('nightMode2048') === 'true';
let difficultyMode = localStorage.getItem('difficultyMode2048') !== 'false';
let currentLevel = 1;
let maxTileReached = 2;
let bestTileEver = parseInt(localStorage.getItem('bestTileEver2048') || '2');
let dropMeter = 0;
let currentLeaderboardTab = 'all';
let currentProfileTab = 'stats';
let playerName = localStorage.getItem('playerName2048') || 'You';
let achievements = JSON.parse(localStorage.getItem('achievements2048') || '{}');
let gamesPlayed = parseInt(localStorage.getItem('gamesPlayed2048') || '0');
let totalMerges = parseInt(localStorage.getItem('totalMerges2048') || '0');
let audioContext = null;
let shieldMode = false;

let powerUps = { 
    shuffle: parseInt(localStorage.getItem('powerup_shuffle') || '0'),
    hammer: parseInt(localStorage.getItem('powerup_hammer') || '0'),
    double: parseInt(localStorage.getItem('powerup_double') || '0'),
    shield: parseInt(localStorage.getItem('powerup_shield') || '0')
};
let doubleScoreActive = false;
let doubleScoreTimer = null;
let hammerMode = false;

const MILESTONES = [2, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const POWERUP_PRICES = { shuffle: 50, hammer: 75, double: 100, shield: 80 };

const ACHIEVEMENTS = {
    firstMerge: { icon: '🔗', name: 'First Merge', desc: 'Merge your first tiles' },
    reach64: { icon: '📊', name: 'Getting Serious', desc: 'Reach tile 64' },
    reach128: { icon: '🎯', name: 'Century Club', desc: 'Reach tile 128' },
    reach256: { icon: '💪', name: 'Power Player', desc: 'Reach tile 256' },
    reach512: { icon: '🚀', name: 'High Roller', desc: 'Reach tile 512' },
    reach1024: { icon: '🏆', name: 'Almost There', desc: 'Reach tile 1024' },
    reach2048: { icon: '👑', name: '2048 Master', desc: 'Reach tile 2048' },
    score1000: { icon: '💰', name: 'Point Collector', desc: 'Score 1000 points' },
    score5000: { icon: '💎', name: 'Score Hunter', desc: 'Score 5000 points' },
    score10000: { icon: '🌟', name: 'Score Legend', desc: 'Score 10000 points' },
    firstPowerUp: { icon: '🎁', name: 'Power Up', desc: 'Collect first power-up' },
    useHammer: { icon: '🔨', name: 'Demolition', desc: 'Use hammer power-up' },
    useShuffle: { icon: '🔀', name: 'Mix Master', desc: 'Use shuffle power-up' },
    useDouble: { icon: '✨', name: 'Double Trouble', desc: 'Use 2x score power-up' },
    useShield: { icon: '🛡️', name: 'Protected', desc: 'Use shield power-up' },
    surviveBomb: { icon: '💣', name: 'Bomb Survivor', desc: 'Survive a bomb explosion' },
    level5: { icon: '📈', name: 'Level Up', desc: 'Reach difficulty level 5' },
    level10: { icon: '🔥', name: 'Maximum Difficulty', desc: 'Reach difficulty level 10' }
};

let leaderboardData = { all: [], weekly: [], daily: [] };

// ============ AUDIO SYSTEM ============
function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error('Web Audio API not supported:', error);
        }
    }
}

function playSound(type) {
    if (!soundEnabled || !audioContext) return;
    
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        let freq = 440, dur = 0.1, vol = 0.3;
        switch(type) {
            case 'merge': freq = 523; dur = 0.1; break;
            case 'bigMerge': freq = 659; dur = 0.15; break;
            case 'bomb': freq = 100; dur = 0.3; break;
            case 'powerup': freq = 784; dur = 0.2; break;
            case 'achievement': freq = 880; dur = 0.3; break;
            case 'gameOver': freq = 200; dur = 0.5; break;
            case 'click': freq = 440; dur = 0.05; vol = 0.2; break;
            case 'coin': freq = 988; dur = 0.15; break;
            case 'shield': freq = 660; dur = 0.3; break;
        }
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        gain.gain.setValueAtTime(vol, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + dur);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + dur);
    } catch (error) {
        console.error('Sound playback error:', error);
    }
}

// ============ COINS SYSTEM ============
function addCoins(amount) {
    if (amount <= 0) return;
    coins += amount;
    localStorage.setItem('coins2048', coins);
    updateCoinsDisplay();
    playSound('coin');
    if (typeof TelegramIntegration !== 'undefined') {
        TelegramIntegration.hapticFeedback('light');
    }
}

function spendCoins(amount) {
    if (coins >= amount) {
        coins -= amount;
        localStorage.setItem('coins2048', coins);
        updateCoinsDisplay();
        return true;
    }
    return false;
}

function updateCoinsDisplay() {
    const coinsDisplay = document.getElementById('coinsDisplay');
    if (coinsDisplay) coinsDisplay.textContent = coins;
    
    const shopCoins = document.getElementById('shopCoinsDisplay');
    if (shopCoins) shopCoins.textContent = coins;
    
    const profileCoins = document.getElementById('profileCoins');
    if (profileCoins) profileCoins.textContent = coins;
    
    updateShopButtons();
}

function rewardCoins(mergedValue, index) {
    const coinReward = Math.floor(mergedValue / 16);
    if (coinReward > 0) {
        addCoins(coinReward);
        showCoinPopup(index, `+${coinReward}🪙`);
    }
}

function showCoinPopup(index, text) {
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const popup = document.createElement('div');
    popup.className = 'coin-popup';
    popup.textContent = text;
    popup.style.cssText = `left:${(index%4)*25+12}%;top:${Math.floor(index/4)*25+10}%;font-size:1em;`;
    boardContainer.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

// ============ SHOP SYSTEM ============
function updateShopButtons() {
    Object.keys(POWERUP_PRICES).forEach(key => {
        const btn = document.getElementById(`buy-${key}`);
        if (btn) btn.disabled = coins < POWERUP_PRICES[key];
    });
}

function openShopModal(event) {
    if (event) event.preventDefault();
    updateCoinsDisplay();
    const shopModal = document.getElementById('shopModal');
    if (shopModal) shopModal.classList.add('show');
    
    const starPackages = document.getElementById('starPackages');
    if (starPackages && typeof TelegramIntegration !== 'undefined') {
        if (TelegramIntegration.isTelegramEnvironment) {
            starPackages.style.display = 'block';
        } else {
            starPackages.innerHTML = '<p style="color:#ff4757;text-align:center;">Star payments available in Telegram app only</p>';
        }
    }
}

function closeShopModal() {
    const shopModal = document.getElementById('shopModal');
    if (shopModal) shopModal.classList.remove('show');
}

function buyPowerUp(type, price) {
    if (typeof EnhancedShop !== 'undefined') {
        EnhancedShop.buyWithCoins(type);
    } else {
        // Fallback to original system
        if (spendCoins(price)) {
            powerUps[type]++;
            updatePowerUpUI();
            playSound('powerup');
            updateCoinsDisplay();
        }
    }
}

// ============ ACHIEVEMENTS SYSTEM ============
function unlockAchievement(key) {
    if (!achievements[key]) {
        achievements[key] = true;
        localStorage.setItem('achievements2048', JSON.stringify(achievements));
        showAchievementPopup(key);
        playSound('achievement');
        addCoins(25);
        if (typeof TelegramIntegration !== 'undefined') {
            TelegramIntegration.hapticFeedback('success');
        }
    }
}

function showAchievementPopup(key) {
    const ach = ACHIEVEMENTS[key];
    if (!ach) return;
    
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `${ach.icon} <strong>${ach.name}</strong> - ${ach.desc}`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 3000);
}

function checkAchievements() {
    if (maxTileReached >= 2 && score > 0) unlockAchievement('firstMerge');
    if (bestTileEver >= 64) unlockAchievement('reach64');
    if (bestTileEver >= 128) unlockAchievement('reach128');
    if (bestTileEver >= 256) unlockAchievement('reach256');
    if (bestTileEver >= 512) unlockAchievement('reach512');
    if (bestTileEver >= 1024) unlockAchievement('reach1024');
    if (bestTileEver >= 2048) unlockAchievement('reach2048');
    if (score >= 1000) unlockAchievement('score1000');
    if (score >= 5000) unlockAchievement('score5000');
    if (score >= 10000) unlockAchievement('score10000');
    if (currentLevel >= 5) unlockAchievement('level5');
    if (currentLevel >= 10) unlockAchievement('level10');
}

function getUnlockedCount() {
    return Object.keys(achievements).filter(k => achievements[k]).length;
}

function getTotalAchievements() {
    return Object.keys(ACHIEVEMENTS).length;
}

// ============ PROFILE SYSTEM ============
function updateProfileDisplay() {
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const best = document.getElementById('profileBestScore');
    const games = document.getElementById('profileGamesPlayed');
    const profCoins = document.getElementById('profileCoins');
    const telegramBadge = document.getElementById('telegramBadge');
    
    if (avatar) avatar.textContent = playerName.charAt(0).toUpperCase();
    if (name) name.textContent = playerName;
    if (best) best.textContent = bestScore;
    if (games) games.textContent = gamesPlayed;
    if (profCoins) profCoins.textContent = coins;
    
    if (telegramBadge && typeof TelegramIntegration !== 'undefined' && TelegramIntegration.isTelegramEnvironment) {
        telegramBadge.style.display = 'block';
        if (TelegramIntegration.isPremiumUser()) {
            telegramBadge.innerHTML = '<span style="background:#FFD700; color:#333; padding:3px 8px; border-radius:10px; font-size:0.7em;">⭐ Premium User</span>';
        }
    }
}

function renderProfileStats() {
    const content = document.getElementById('profileContent');
    if (!content) return;
    
    const progress = Math.floor((getUnlockedCount() / getTotalAchievements()) * 100);
    content.innerHTML = `
        <div class="profile-progress">
            <div class="pp-label">Achievements: ${getUnlockedCount()}/${getTotalAchievements()} (${progress}%)</div>
            <div class="pp-bar"><div class="pp-fill" style="width:${progress}%;"></div></div>
        </div>
        <div class="profile-stats">
            <div class="profile-stat"><div class="p-label">Best Tile</div><div class="p-value">${bestTileEver}</div></div>
            <div class="profile-stat"><div class="p-label">Merges</div><div class="p-value">${totalMerges}</div></div>
        </div>
        ${typeof TelegramIntegration !== 'undefined' && TelegramIntegration.isTelegramEnvironment ? `
            <div class="profile-stats">
                <div class="profile-stat"><div class="p-label">User ID</div><div class="p-value" style="font-size:0.8em;">${TelegramIntegration.getUserId()}</div></div>
                <div class="profile-stat"><div class="p-label">Language</div><div class="p-value" style="font-size:0.8em;">${TelegramIntegration.getLanguageCode()}</div></div>
            </div>
        ` : ''}
    `;
}

function renderAchievements() {
    const grid = document.getElementById('profileContent');
    if (!grid) return;
    
    let html = '<div class="achievements-grid">';
    Object.keys(ACHIEVEMENTS).forEach(key => {
        const ach = ACHIEVEMENTS[key];
        const unlocked = achievements[key];
        html += `<div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
            <div class="ach-icon">${unlocked ? ach.icon : '🔒'}</div>
            <div class="ach-name">${ach.name}</div>
            <div class="ach-desc">${ach.desc}</div>
        </div>`;
    });
    html += '</div>';
    grid.innerHTML = html;
}

function switchProfileTab(tab, btn) {
    currentProfileTab = tab;
    document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (tab === 'stats') renderProfileStats();
    else renderAchievements();
}

// ============ LEADERBOARD SYSTEM ============
function loadLeaderboardData() {
    const saved = localStorage.getItem('leaderboard2048Master');
    if (saved) {
        try {
            leaderboardData = JSON.parse(saved);
        } catch (error) {
            console.error('Failed to parse leaderboard data:', error);
            leaderboardData = { all: [], weekly: [], daily: [] };
        }
    } else {
        leaderboardData = {
            all: [{ name: 'MasterPlayer', score: 15420, date: '2024-01-15' }],
            weekly: [{ name: 'TileWizard', score: 5800, date: '2024-01-20' }],
            daily: [{ name: 'NumberNinja', score: 1200, date: '2024-01-20' }]
        };
        saveLeaderboardData();
    }
}

function saveLeaderboardData() {
    localStorage.setItem('leaderboard2048Master', JSON.stringify(leaderboardData));
}

function addScoreToLeaderboard(finalScore) {
    const today = new Date().toISOString().split('T')[0];
    leaderboardData.all.push({ name: playerName, score: finalScore, date: today });
    leaderboardData.weekly.push({ name: playerName, score: finalScore, date: today });
    leaderboardData.daily.push({ name: playerName, score: finalScore, date: today });
    leaderboardData.all.sort((a, b) => b.score - a.score);
    leaderboardData.weekly.sort((a, b) => b.score - a.score);
    leaderboardData.daily.sort((a, b) => b.score - a.score);
    leaderboardData.all = leaderboardData.all.slice(0, 50);
    leaderboardData.weekly = leaderboardData.weekly.slice(0, 20);
    leaderboardData.daily = leaderboardData.daily.slice(0, 20);
    saveLeaderboardData();
}

function renderLeaderboard(tab) {
    const content = document.getElementById('leaderboardContent');
    if (!content) return;
    
    const data = leaderboardData[tab] || [];
    let playerRank = -1;
    let html = '<table class="leaderboard-table">';
    html += '<thead><tr><th>Rank</th><th>Player</th><th>Score</th></tr></thead><tbody>';
    
    data.slice(0, 10).forEach((entry, index) => {
        const rank = index + 1;
        const isYou = entry.name === playerName;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
        if (isYou) playerRank = rank;
        html += `<tr class="${isYou ? 'you' : ''}">
            <td class="rank ${rankClass}">${rank}</td>
            <td class="player-name">${entry.name}${isYou ? ' (You)' : ''}</td>
            <td class="player-score">${entry.score.toLocaleString()}</td>
        </tr>`;
    });
    
    if (data.length === 0) {
        html += '<tr><td colspan="3" style="text-align:center;">No scores yet!</td></tr>';
    }
    
    html += '</tbody></table>';
    content.innerHTML = html;
    
    const playerRankDisplay = document.getElementById('playerRank');
    if (playerRankDisplay) {
        playerRankDisplay.textContent = playerRank > 0 ? `#${playerRank}` : 'Not ranked yet';
    }
}

function switchLeaderboardTab(tab, btn) {
    currentLeaderboardTab = tab;
    document.querySelectorAll('.leaderboard-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderLeaderboard(tab);
}

// ============ GAME INITIALIZATION ============
function initializeGame() {
    board = Array(16).fill(null);
    score = 0;
    moveHistory = [];
    obstacles = new Set();
    bombs = new Set();
    shieldedValues = new Set();
    hasWon = false;
    doubleScoreActive = false;
    hammerMode = false;
    shieldMode = false;
    currentLevel = 1;
    maxTileReached = 2;
    dropMeter = 0;
    currentState = GameState.PLAYING;
    
    updateScore();
    updateBestScore();
    updateUndoButton();
    updatePauseButton();
    updatePowerUpUI();
    updateLevelIndicator();
    updateDropMeter();
    updateCoinsDisplay();
    renderBackgroundCells();
    addRandomTile();
    addRandomTile();
    renderTiles();
}

function renderBackgroundCells() {
    const boardElement = document.getElementById('board');
    if (!boardElement) return;
    
    boardElement.innerHTML = '';
    boardElement.className = 'board grid-4';
    
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        boardElement.appendChild(cell);
    }
}

function addRandomTile() {
    const emptyTiles = board.map((tile, index) => 
        tile === null && !obstacles.has(index) && !bombs.has(index) ? index : null
    ).filter(index => index !== null);
    
    if (emptyTiles.length === 0) return;
    
    const randomIndex = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    board[randomIndex] = Math.random() < 0.9 ? 2 : 4;
}

function updateDropMeter() {
    const fill = document.getElementById('dropMeterFill');
    const percentage = document.getElementById('dropMeterPercentage');
    const container = document.getElementById('dropMeterContainer');
    
    if (!fill || !percentage || !container) return;
    
    const meterPercentage = Math.min(dropMeter, 100);
    fill.style.width = meterPercentage + '%';
    percentage.textContent = Math.floor(meterPercentage) + '%';
    container.classList.toggle('ready', meterPercentage >= 100);
}

function updateLevelIndicator() {
    const indicator = document.getElementById('levelIndicator');
    if (!indicator) return;
    
    if (difficultyMode) {
        indicator.textContent = `Level ${currentLevel}`;
        indicator.classList.remove('inactive');
    } else {
        indicator.textContent = 'Level Off';
        indicator.classList.add('inactive');
    }
}

function checkPowerUpDrop(mergedValue) {
    dropMeter += Math.min(mergedValue / 20, 25);
    
    if (dropMeter >= 100) {
        dropMeter = 0;
        const list = ['shuffle', 'hammer', 'double', 'shield'];
        const randomPowerUp = list[Math.floor(Math.random() * list.length)];
        powerUps[randomPowerUp]++;
        localStorage.setItem(`powerup_${randomPowerUp}`, powerUps[randomPowerUp]);
        updatePowerUpUI();
        showPowerUpDropAnimation(randomPowerUp);
        unlockAchievement('firstPowerUp');
        playSound('powerup');
    }
    
    updateDropMeter();
}

function showPowerUpDropAnimation(powerUpType) {
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const dropElement = document.createElement('div');
    dropElement.style.cssText = `position:absolute;font-size:2em;animation:dropAnimation 1.5s ease-out forwards;pointer-events:none;z-index:100;left:${Math.random()*80+10}%;top:${Math.random()*80+10}%;`;
    dropElement.textContent = { shuffle: '🔀', hammer: '🔨', double: '✨', shield: '🛡️' }[powerUpType];
    boardContainer.appendChild(dropElement);
    setTimeout(() => dropElement.remove(), 1500);
}

function updatePowerUpUI() {
    ['shuffle', 'hammer', 'double', 'shield'].forEach(id => {
        const countElement = document.getElementById(`count-${id}`);
        const powerUpElement = document.getElementById(`powerup-${id}`);
        
        if (!countElement || !powerUpElement) return;
        
        if (powerUps[id] > 0) {
            countElement.textContent = powerUps[id];
            countElement.classList.remove('zero');
            powerUpElement.classList.remove('disabled');
        } else {
            countElement.textContent = '0';
            countElement.classList.add('zero');
            powerUpElement.classList.add('disabled');
        }
    });
}

function usePowerUp(type) {
    if (powerUps[type] <= 0 || currentState !== GameState.PLAYING) return;
    
    initAudio();
    playSound('click');
    if (typeof TelegramIntegration !== 'undefined') {
        TelegramIntegration.hapticFeedback('medium');
    }
    
    switch(type) {
        case 'shuffle': 
            shuffleBoard(); 
            unlockAchievement('useShuffle'); 
            break;
        case 'hammer': 
            activateHammerMode(); 
            unlockAchievement('useHammer'); 
            break;
        case 'double': 
            activateDoubleScore(); 
            unlockAchievement('useDouble'); 
            break;
        case 'shield': 
            activateShieldMode(); 
            unlockAchievement('useShield'); 
            break;
    }
    
    powerUps[type]--;
    localStorage.setItem(`powerup_${type}`, powerUps[type]);
    updatePowerUpUI();
}

function shuffleBoard() {
    const tiles = [];
    const positions = [];
    
    board.forEach((tile, index) => {
        if (tile !== null && !obstacles.has(index) && !bombs.has(index)) {
            tiles.push(tile);
            positions.push(index);
        }
    });
    
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    board = board.map((tile, index) => {
        if (tile !== null && !obstacles.has(index) && !bombs.has(index)) return null;
        return tile;
    });
    
    tiles.forEach((tile, i) => { 
        board[positions[i]] = tile; 
    });
    
    renderTiles();
}

function activateHammerMode() {
    hammerMode = true;
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const hint = document.createElement('div');
    hint.id = 'hammerHint';
    hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:15px 25px;border-radius:10px;z-index:20;text-align:center;pointer-events:none;';
    hint.innerHTML = '🔨 Click a tile to remove it!';
    boardContainer.appendChild(hint);
    
    const tiles = boardContainer.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.style.pointerEvents = 'auto';
        tile.style.cursor = 'pointer';
        tile.onclick = function() {
            if (!hammerMode) return;
            const index = parseInt(this.dataset.index);
            if (board[index] !== null || bombs.has(index) || obstacles.has(index)) {
                if (board[index] !== null) {
                    shieldedValues.delete(board[index]);
                }
                board[index] = null;
                bombs.delete(index);
                obstacles.delete(index);
                hammerMode = false;
                const hint = document.getElementById('hammerHint');
                if (hint) hint.remove();
                tiles.forEach(t => { 
                    t.style.pointerEvents = 'none'; 
                    t.style.cursor = 'default'; 
                    t.onclick = null; 
                });
                renderTiles();
            }
        };
    });
    
    setTimeout(() => {
        if (hammerMode) {
            hammerMode = false;
            const hint = document.getElementById('hammerHint');
            if (hint) hint.remove();
            tiles.forEach(t => { 
                t.style.pointerEvents = 'none'; 
                t.style.cursor = 'default'; 
                t.onclick = null; 
            });
        }
    }, 5000);
}

function activateDoubleScore() {
    doubleScoreActive = true;
    const scoreElement = document.getElementById('score');
    if (scoreElement) scoreElement.style.color = '#ffd700';
    
    if (doubleScoreTimer) clearTimeout(doubleScoreTimer);
    
    doubleScoreTimer = setTimeout(() => {
        doubleScoreActive = false;
        const scoreElement = document.getElementById('score');
        if (scoreElement) scoreElement.style.color = 'white';
    }, 30000);
}

function activateShieldMode() {
    shieldMode = true;
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const hint = document.createElement('div');
    hint.id = 'shieldHint';
    hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:15px 25px;border-radius:10px;z-index:20;text-align:center;pointer-events:none;';
    hint.innerHTML = '🛡️ Click a number to protect it!';
    boardContainer.appendChild(hint);
    
    const tiles = boardContainer.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.style.pointerEvents = 'auto';
        tile.style.cursor = 'pointer';
        tile.onclick = function() {
            if (!shieldMode) return;
            const index = parseInt(this.dataset.index);
            if (board[index] !== null && !obstacles.has(index) && !bombs.has(index)) {
                shieldedValues.add(board[index]);
                shieldMode = false;
                const hint = document.getElementById('shieldHint');
                if (hint) hint.remove();
                tiles.forEach(t => { 
                    t.style.pointerEvents = 'none'; 
                    t.style.cursor = 'default'; 
                    t.onclick = null; 
                });
                playSound('shield');
                renderTiles();
            }
        };
    });
    
    setTimeout(() => {
        if (shieldMode) {
            shieldMode = false;
            const hint = document.getElementById('shieldHint');
            if (hint) hint.remove();
            tiles.forEach(t => { 
                t.style.pointerEvents = 'none'; 
                t.style.cursor = 'default'; 
                t.onclick = null; 
            });
        }
    }, 5000);
}

// ============ CORE MOVEMENT LOGIC ============
function move(direction) {
    if (currentState !== GameState.PLAYING || hammerMode || shieldMode) return;
    
    let moved = false;
    let mergeScore = 0;
    
    moveHistory.push({
        board: JSON.parse(JSON.stringify(board)),
        score: score,
        obstacles: new Set(obstacles),
        bombs: new Set(bombs),
        shieldedValues: new Set(shieldedValues)
    });
    if (moveHistory.length > 5) moveHistory.shift();
    
    for (let line = 0; line < 4; line++) {
        let indices = [];
        for (let i = 0; i < 4; i++) {
            switch(direction) {
                case 'left': indices.push(line * 4 + i); break;
                case 'right': indices.push(line * 4 + (3 - i)); break;
                case 'up': indices.push(i * 4 + line); break;
                case 'down': indices.push((3 - i) * 4 + line); break;
            }
        }
        
        let segments = [];
        let currentSegment = [];
        for (let idx of indices) {
            if (obstacles.has(idx) || bombs.has(idx)) {
                if (currentSegment.length > 0) { 
                    segments.push(currentSegment); 
                    currentSegment = []; 
                }
            } else {
                currentSegment.push(idx);
            }
        }
        if (currentSegment.length > 0) segments.push(currentSegment);
        
        for (let segment of segments) {
            const values = segment.map(idx => board[idx]);
            let result = [];
            let i = 0;
            
            while (i < values.length) {
                if (values[i] === null) { 
                    i++; 
                    continue; 
                }
                
                let j = i + 1;
                while (j < values.length && values[j] === null) j++;
                
                if (j < values.length && values[i] === values[j]) {
                    const mergedValue = values[i] * 2;
                    result.push(mergedValue);
                    mergeScore += mergedValue;
                    totalMerges++;
                    moved = true;
                    
                    initAudio();
                    playSound(mergedValue >= 128 ? 'bigMerge' : 'merge');
                    checkPowerUpDrop(mergedValue);
                    rewardCoins(mergedValue, segment[i]);
                    
                    if (shieldedValues.has(values[i]) || shieldedValues.has(values[j])) {
                        shieldedValues.delete(values[i]);
                        shieldedValues.delete(values[j]);
                        shieldedValues.add(mergedValue);
                    }
                    
                    if (mergedValue > maxTileReached) {
                        maxTileReached = mergedValue;
                        if (mergedValue > bestTileEver) {
                            bestTileEver = mergedValue;
                            localStorage.setItem('bestTileEver2048', bestTileEver);
                        }
                        checkDifficultyIncrease();
                    }
                    
                    if (!hasWon && mergedValue >= 2048) {
                        hasWon = true;
                        showWinMessage();
                    }
                    
                    i = j + 1;
                } else {
                    result.push(values[i]);
                    i++;
                }
            }
            
            while (result.length < values.length) result.push(null);
            
            segment.forEach((idx, pos) => {
                if (board[idx] !== result[pos]) {
                    board[idx] = result[pos];
                    moved = true;
                }
            });
        }
    }
    
    if (moved) {
        if (doubleScoreActive) mergeScore *= 2;
        score += mergeScore;
        processBombs();
        checkAchievements();
        localStorage.setItem('totalMerges2048', totalMerges);
    }
    
    if (moved) {
        addRandomTile();
        renderTiles();
        updateScore();
        updateBestScore();
        updateUndoButton();
        
        if (isGameOver()) {
            currentState = GameState.GAME_OVER;
            gamesPlayed++;
            localStorage.setItem('gamesPlayed2048', gamesPlayed);
            addScoreToLeaderboard(score);
            playSound('gameOver');
            if (typeof TelegramIntegration !== 'undefined') {
                TelegramIntegration.hapticFeedback('error');
            }
            showGameOver();
            if (typeof EnhancedShop !== 'undefined') {
                EnhancedShop.syncToCloud();
            }
        }
    }
}

function processBombs() {
    const bombIndices = Array.from(bombs);
    let bombsExploded = false;
    
    for (let bombIndex of bombIndices) {
        if (!bombs.has(bombIndex)) continue;
        
        const neighbors = getNeighbors(bombIndex);
        let adjacentTiles = [];
        
        for (let neighbor of neighbors) {
            if (board[neighbor] !== null && !obstacles.has(neighbor) && !bombs.has(neighbor)) {
                adjacentTiles.push(neighbor);
            }
        }
        
        if (adjacentTiles.length > 0) {
            let penalty = 0;
            
            for (let tileIndex of adjacentTiles) {
                const tileValue = board[tileIndex];
                
                if (shieldedValues.has(tileValue)) {
                    shieldedValues.delete(tileValue);
                    showShieldSavePopup(tileIndex, tileValue);
                    continue;
                }
                
                if (tileValue >= 128) penalty += Math.floor(tileValue / 2);
                board[tileIndex] = null;
            }
            
            bombs.delete(bombIndex);
            
            if (penalty > 0) {
                score = Math.max(0, score - penalty);
                showScorePopup(bombIndex, `-${penalty}`);
            } else {
                showScorePopup(bombIndex, '💥');
                unlockAchievement('surviveBomb');
            }
            
            playSound('bomb');
            showExplosionAnimation(bombIndex, adjacentTiles);
            bombsExploded = true;
        }
    }
    
    if (bombsExploded) {
        updateScore();
        updateBestScore();
        renderTiles();
    }
}

function showShieldSavePopup(index, value) {
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `🛡️ ${value} Saved!`;
    popup.style.cssText = `left:${(index%4)*25+10}%;top:${Math.floor(index/4)*25+10}%;color:#00bfff;font-size:1.1em;`;
    boardContainer.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

function showExplosionAnimation(bombIndex, destroyedTiles) {
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const bombElement = boardContainer.querySelector(`.tile[data-index="${bombIndex}"]`);
    if (bombElement) {
        bombElement.classList.add('exploding');
        setTimeout(() => bombElement.remove(), 500);
    }
    
    destroyedTiles.forEach(tileIndex => {
        const tileValue = board[tileIndex];
        if (!shieldedValues.has(tileValue)) {
            const tileElement = boardContainer.querySelector(`.tile[data-index="${tileIndex}"]`);
            if (tileElement) {
                tileElement.classList.add('destroyed');
                setTimeout(() => tileElement.remove(), 300);
            }
        }
    });
}

function showScorePopup(index, text) {
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = text;
    popup.style.cssText = `left:${(index%4)*25+12}%;top:${Math.floor(index/4)*25+12}%;color:#ff4757;font-size:1.3em;`;
    boardContainer.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

function getNeighbors(index) {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const neighbors = [];
    
    if (row > 0) neighbors.push(index - 4);
    if (row < 3) neighbors.push(index + 4);
    if (col > 0) neighbors.push(index - 1);
    if (col < 3) neighbors.push(index + 1);
    
    return neighbors;
}

function checkDifficultyIncrease() {
    if (!difficultyMode) return;
    
    const milestoneIndex = MILESTONES.indexOf(maxTileReached);
    if (milestoneIndex > 0) {
        currentLevel = milestoneIndex + 1;
        updateLevelIndicator();
        
        if (currentLevel >= 5 && Math.random() < 0.3) addObstacles(1);
        if (currentLevel >= 7 && Math.random() < 0.2) addBombsSafe(1);
    }
}

function addObstacles(count) {
    const emptyTiles = board.map((tile, index) => 
        tile === null && !obstacles.has(index) && !bombs.has(index) ? index : null
    ).filter(index => index !== null);
    
    for (let i = 0; i < Math.min(count, emptyTiles.length); i++) {
        const randomIndex = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
        obstacles.add(randomIndex);
        emptyTiles.splice(emptyTiles.indexOf(randomIndex), 1);
    }
}

function addBombsSafe(count) {
    const emptyTiles = board.map((tile, index) => 
        tile === null && !obstacles.has(index) && !bombs.has(index) ? index : null
    ).filter(index => {
        const neighbors = getNeighbors(index);
        return !neighbors.some(n => board[n] !== null);
    });
    
    for (let i = 0; i < Math.min(count, emptyTiles.length); i++) {
        const randomIndex = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
        bombs.add(randomIndex);
        emptyTiles.splice(emptyTiles.indexOf(randomIndex), 1);
    }
}

function undoMove() {
    if (moveHistory.length === 0 || currentState === GameState.GAME_OVER) return;
    
    const previousState = moveHistory.pop();
    board = previousState.board;
    score = previousState.score;
    obstacles = previousState.obstacles;
    bombs = previousState.bombs;
    shieldedValues = previousState.shieldedValues || new Set();
    
    updateScore();
    updateBestScore();
    updateUndoButton();
    renderTiles();
}

function isGameOver() {
    for (let i = 0; i < board.length; i++) {
        if (board[i] === null && !obstacles.has(i) && !bombs.has(i)) return false;
    }
    
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const current = i * 4 + j;
            if (board[current] === null || obstacles.has(current) || bombs.has(current)) continue;
            
            if (j < 3) {
                const right = i * 4 + j + 1;
                if (board[right] !== null && board[current] === board[right] && 
                    !obstacles.has(right) && !bombs.has(right)) return false;
            }
            
            if (i < 3) {
                const down = (i + 1) * 4 + j;
                if (board[down] !== null && board[current] === board[down] && 
                    !obstacles.has(down) && !bombs.has(down)) return false;
            }
        }
    }
    
    return true;
}

function showWinMessage() {
    setTimeout(() => {
        if (typeof TelegramIntegration !== 'undefined' && TelegramIntegration.isTelegramEnvironment) {
            TelegramIntegration.showAlert('🎉 Congratulations! You reached 2048!');
        } else {
            alert('🎉 Congratulations! You reached 2048!');
        }
    }, 100);
}

function showGameOver() {
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.id = 'gameOverOverlay';
    overlay.innerHTML = `
        <h2>Game Over!</h2>
        <p>Score: ${score}</p>
        <button class="btn" onclick="document.getElementById('gameOverOverlay').remove(); newGame();">Try Again</button>
        <button class="btn" style="margin-top:8px;" onclick="document.getElementById('gameOverOverlay').remove(); openLeaderboardModal(event);">View Leaderboard</button>
    `;
    boardContainer.appendChild(overlay);
}

function togglePause() {
    if (currentState === GameState.GAME_OVER) return;
    
    if (currentState === GameState.PLAYING) {
        currentState = GameState.PAUSED;
        updatePauseButton();
        
        const boardContainer = document.getElementById('boardContainer');
        if (boardContainer) {
            const overlay = document.createElement('div');
            overlay.className = 'game-over-overlay';
            overlay.id = 'pauseOverlay';
            overlay.style.background = 'rgba(238, 228, 218, 0.5)';
            overlay.innerHTML = '<h2 style="font-size:2em;">Paused</h2><p style="font-size:1em;">Take a breather!</p>';
            boardContainer.appendChild(overlay);
        }
    } else if (currentState === GameState.PAUSED) {
        currentState = GameState.PLAYING;
        updatePauseButton();
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) pauseOverlay.remove();
    }
}

function updatePauseButton() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.textContent = currentState === GameState.PAUSED ? 'Resume' : 'Pause';
}

function renderTiles() {
    const boardContainer = document.getElementById('boardContainer');
    if (!boardContainer) return;
    
    const existingTiles = boardContainer.querySelectorAll('.tile');
    existingTiles.forEach(tile => tile.remove());
    
    const containerWidth = boardContainer.clientWidth;
    const gapValue = getComputedStyle(document.documentElement).getPropertyValue('--tile-gap').trim();
    const gap = parseInt(gapValue) || 15;
    const padding = gap;
    const boardWidth = containerWidth - (padding * 2);
    const cellWidth = (boardWidth - (gap * 3)) / 4;
    
    board.forEach((value, index) => {
        if (value === null && !obstacles.has(index) && !bombs.has(index)) return;
        
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.index = index;
        
        if (obstacles.has(index)) {
            tile.classList.add('obstacle');
            tile.textContent = '🚫';
        } else if (bombs.has(index)) {
            tile.classList.add('bomb');
            tile.textContent = '💣';
        } else {
            tile.classList.add(`tile-${value}`);
            tile.textContent = value;
            if (shieldedValues.has(value)) {
                tile.classList.add('shielded');
            }
        }
        
        const row = Math.floor(index / 4);
        const col = index % 4;
        const x = padding + col * (cellWidth + gap);
        const y = padding + row * (cellWidth + gap);
        
        tile.style.width = cellWidth + 'px';
        tile.style.height = cellWidth + 'px';
        tile.style.transform = `translate(${x}px, ${y}px)`;
        tile.style.position = 'absolute';
        tile.style.top = '0';
        tile.style.left = '0';
        tile.style.pointerEvents = 'none';
        
        boardContainer.appendChild(tile);
    });
}

function updateScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = score;
        scoreElement.style.color = doubleScoreActive ? '#ffd700' : 'white';
    }
}

function updateBestScore() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore2048Master', bestScore);
    }
    
    const bestScoreElement = document.getElementById('bestScore');
    if (bestScoreElement) bestScoreElement.textContent = bestScore;
}

function updateUndoButton() {
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.disabled = moveHistory.length === 0;
}

// ============ SETTINGS FUNCTIONS ============
function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('soundEnabled2048', soundEnabled);
    
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.classList.toggle('active', soundEnabled);
    
    if (soundEnabled) { 
        initAudio(); 
        playSound('click'); 
    }
}

function toggleTheme() {
    nightMode = !nightMode;
    localStorage.setItem('nightMode2048', nightMode);
    document.body.setAttribute('data-theme', nightMode ? 'dark' : 'light');
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.classList.toggle('active', nightMode);
}

function toggleDifficultyMode() {
    difficultyMode = !difficultyMode;
    localStorage.setItem('difficultyMode2048', difficultyMode);
    
    const difficultyToggle = document.getElementById('difficultyToggle');
    if (difficultyToggle) difficultyToggle.classList.toggle('active', difficultyMode);
    
    if (!difficultyMode) {
        obstacles.clear();
        bombs.clear();
        currentLevel = 1;
        renderTiles();
    }
    
    updateLevelIndicator();
}

function savePlayerName() {
    const input = document.getElementById('playerNameInput');
    if (input && input.value.trim()) {
        playerName = input.value.trim();
        localStorage.setItem('playerName2048', playerName);
        updateProfileDisplay();
    }
}

// ============ MODAL FUNCTIONS ============
function openHelpModal(event) { 
    if (event) event.preventDefault(); 
    const modal = document.getElementById('helpModal');
    if (modal) modal.classList.add('show');
}

function closeHelpModal() { 
    const modal = document.getElementById('helpModal');
    if (modal) modal.classList.remove('show');
}

function openSettingsModal(event) {
    if (event) event.preventDefault();
    
    const input = document.getElementById('playerNameInput');
    if (input) input.value = playerName === 'You' ? '' : playerName;
    
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('show');
}

function closeSettingsModal() { 
    savePlayerName(); 
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('show');
}

function openProfileModal(event) {
    if (event) event.preventDefault();
    updateProfileDisplay();
    renderProfileStats();
    
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('show');
}

function closeProfileModal() { 
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('show');
}

function openLeaderboardModal(event) {
    if (event) event.preventDefault();
    
    const modal = document.getElementById('leaderboardModal');
    if (modal) modal.classList.add('show');
    
    renderLeaderboard(currentLeaderboardTab);
}

function closeLeaderboardModal() { 
    const modal = document.getElementById('leaderboardModal');
    if (modal) modal.classList.remove('show');
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    // Modal click handlers
    const modals = ['helpModal', 'settingsModal', 'profileModal', 'leaderboardModal', 'shopModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    switch(modalId) {
                        case 'helpModal': closeHelpModal(); break;
                        case 'settingsModal': closeSettingsModal(); break;
                        case 'profileModal': closeProfileModal(); break;
                        case 'leaderboardModal': closeLeaderboardModal(); break;
                        case 'shopModal': closeShopModal(); break;
                    }
                }
            });
        }
    });
    
    // Keyboard events
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { 
            closeHelpModal(); 
            closeSettingsModal(); 
            closeProfileModal(); 
            closeLeaderboardModal(); 
            closeShopModal(); 
        }
    });
    
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowLeft': e.preventDefault(); move('left'); break;
            case 'ArrowRight': e.preventDefault(); move('right'); break;
            case 'ArrowUp': e.preventDefault(); move('up'); break;
            case 'ArrowDown': e.preventDefault(); move('down'); break;
            case ' ': e.preventDefault(); togglePause(); break;
        }
    });
    
    // Touch events
    const boardContainer = document.getElementById('boardContainer');
    let touchStartX = 0, touchStartY = 0;
    
    if (boardContainer) {
        boardContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        boardContainer.addEventListener('touchend', (e) => {
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 30) move('right');
                else if (deltaX < -30) move('left');
            } else {
                if (deltaY > 30) move('down');
                else if (deltaY < -30) move('up');
            }
        });
        
        // Mouse events
        let mouseDown = false, mouseStartX = 0, mouseStartY = 0;
        
        boardContainer.addEventListener('mousedown', (e) => {
            mouseDown = true;
            mouseStartX = e.clientX;
            mouseStartY = e.clientY;
        });
        
        document.addEventListener('mouseup', (e) => {
            if (!mouseDown) return;
            mouseDown = false;
            
            const deltaX = e.clientX - mouseStartX;
            const deltaY = e.clientY - mouseStartY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 30) move('right');
                else if (deltaX < -30) move('left');
            } else {
                if (deltaY > 30) move('down');
                else if (deltaY < -30) move('up');
            }
        });
    }
}

// ============ WINDOW FUNCTIONS ============
window.newGame = newGame;
window.undoMove = undoMove;
window.togglePause = togglePause;
window.usePowerUp = usePowerUp;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.openLeaderboardModal = openLeaderboardModal;
window.closeLeaderboardModal = closeLeaderboardModal;
window.openShopModal = openShopModal;
window.closeShopModal = closeShopModal;
window.buyPowerUp = buyPowerUp;
window.toggleSound = toggleSound;
window.toggleTheme = toggleTheme;
window.toggleDifficultyMode = toggleDifficultyMode;
window.switchLeaderboardTab = switchLeaderboardTab;
window.switchProfileTab = switchProfileTab;

// ============ INITIALIZATION ============
function newGame() {
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    if (gameOverOverlay) gameOverOverlay.remove();
    
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (pauseOverlay) pauseOverlay.remove();
    
    initializeGame();
}

// Apply saved theme
document.body.setAttribute('data-theme', nightMode ? 'dark' : 'light');

// Set up toggle states
const soundToggle = document.getElementById('soundToggle');
if (soundToggle) soundToggle.classList.toggle('active', soundEnabled);

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) themeToggle.classList.toggle('active', nightMode);

const difficultyToggle = document.getElementById('difficultyToggle');
if (difficultyToggle) difficultyToggle.classList.toggle('active', difficultyMode);

// Set player name from Telegram
if (typeof TelegramIntegration !== 'undefined' && TelegramIntegration.isTelegramEnvironment && TelegramIntegration.user) {
    playerName = TelegramIntegration.getUserName();
    localStorage.setItem('playerName2048', playerName);
}

// Initialize everything
loadLeaderboardData();
initializeGame();
updateProfileDisplay();
setupEventListeners();

// Load cloud data
if (typeof EnhancedShop !== 'undefined') {
    EnhancedShop.loadFromCloud();
}

// Auto-sync every 30 seconds
setInterval(() => {
    if (typeof TelegramIntegration !== 'undefined' && TelegramIntegration.isTelegramEnvironment) {
        EnhancedShop.syncToCloud();
    }
}, 30000);

// Sync on page unload
window.addEventListener('beforeunload', () => {
    if (typeof TelegramIntegration !== 'undefined' && TelegramIntegration.isTelegramEnvironment) {
        EnhancedShop.syncToCloud();
    }
});

console.log('2048 Master game initialized successfully!');