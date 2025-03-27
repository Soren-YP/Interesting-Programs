// 游戏状态
let deck = [];
let dealerCards = [];
let playerCards = [];
let currentBet = 0;
let balance = 1000;
let gameState = 'betting'; // betting, playing, dealerTurn, gameOver

// DOM 元素
const dealerCardsEl = document.getElementById('dealer-cards');
const playerCardsEl = document.getElementById('player-cards');
const dealerScoreEl = document.getElementById('dealer-score');
const playerScoreEl = document.getElementById('player-score');
const messageEl = document.getElementById('message');
const currentBetEl = document.getElementById('current-bet');
const balanceEl = document.getElementById('balance');
const chipsContainer = document.getElementById('chips-container');

// 按钮
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const newGameBtn = document.getElementById('new-game-btn');

// 初始化游戏
function initGame() {
    // 重置游戏状态
    deck = [];
    dealerCards = [];
    playerCards = [];
    currentBet = 0;
    gameState = 'betting';
    
    // 更新UI
    updateBetUI();
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';
    dealerScoreEl.textContent = '点数: ?';
    playerScoreEl.textContent = '点数: 0';
    messageEl.textContent = '';
    
    // 启用/禁用按钮
    dealBtn.disabled = true;
    hitBtn.disabled = true;
    standBtn.disabled = true;
    doubleBtn.disabled = true;
    
    // 启用筹码选择
    enableChips();
}

// 创建一副新牌
function createDeck() {
    const suits = ['♥', '♦', '♠', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ suit, value });
        }
    }
    
    return deck;
}

// 洗牌
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 计算手牌点数
function calculateHandValue(cards) {
    let value = 0;
    let aceCount = 0;
    
    for (let card of cards) {
        if (card.value === 'A') {
            aceCount++;
            value += 11;
        } else if (['K', 'Q', 'J'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value);
        }
    }
    
    // 如果点数超过21且有A，则将A的值从11改为1
    while (value > 21 && aceCount > 0) {
        value -= 10;
        aceCount--;
    }
    
    return value;
}

// 发牌
function dealCard(to) {
    const card = deck.pop();
    to.push(card);
    return card;
}

// 创建卡牌元素
function createCardElement(card, hidden = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    if (hidden) {
        cardEl.classList.add('hidden');
        return cardEl;
    }
    
    const isRed = card.suit === '♥' || card.suit === '♦';
    
    // 上方的点数和花色
    const topValue = document.createElement('div');
    topValue.className = `card-value top ${isRed ? 'red' : ''}`;
    topValue.textContent = `${card.value}${card.suit}`;
    
    // 中间的花色
    const suitEl = document.createElement('div');
    suitEl.className = `card-suit ${isRed ? 'red' : ''}`;
    suitEl.textContent = card.suit;
    
    // 下方的点数和花色（倒置）
    const bottomValue = document.createElement('div');
    bottomValue.className = `card-value bottom ${isRed ? 'red' : ''}`;
    bottomValue.textContent = `${card.value}${card.suit}`;
    
    cardEl.appendChild(topValue);
    cardEl.appendChild(suitEl);
    cardEl.appendChild(bottomValue);
    
    return cardEl;
}

// 开始新一轮游戏
function startRound() {
    // 创建并洗牌
    deck = createDeck();
    deck = shuffleDeck(deck);
    
    // 清空手牌
    dealerCards = [];
    playerCards = [];
    
    // 清空UI
    dealerCardsEl.innerHTML = '';
    playerCardsEl.innerHTML = '';
    
    // 发牌
    // 玩家第一张牌
    const playerCard1 = dealCard(playerCards);
    playerCardsEl.appendChild(createCardElement(playerCard1));
    
    // 庄家第一张牌（暗牌）
    const dealerCard1 = dealCard(dealerCards);
    dealerCardsEl.appendChild(createCardElement(dealerCard1, true));
    
    // 玩家第二张牌
    const playerCard2 = dealCard(playerCards);
    playerCardsEl.appendChild(createCardElement(playerCard2));
    
    // 庄家第二张牌
    const dealerCard2 = dealCard(dealerCards);
    dealerCardsEl.appendChild(createCardElement(dealerCard2));
    
    // 更新点数
    updateScores(true);
    
    // 更新游戏状态
    gameState = 'playing';
    
    // 启用/禁用按钮
    dealBtn.disabled = true;
    hitBtn.disabled = false;
    standBtn.disabled = false;
    doubleBtn.disabled = balance < currentBet;
    
    // 禁用筹码选择
    disableChips();
    
    // 检查玩家是否有黑杰克
    checkForBlackjack();
}

// 更新分数显示
function updateScores(hideDealer = false) {
    const playerValue = calculateHandValue(playerCards);
    playerScoreEl.textContent = `点数: ${playerValue}`;
    
    if (hideDealer) {
        dealerScoreEl.textContent = '点数: ?';
    } else {
        const dealerValue = calculateHandValue(dealerCards);
        dealerScoreEl.textContent = `点数: ${dealerValue}`;
    }
}

// 检查是否有黑杰克
function checkForBlackjack() {
    const playerValue = calculateHandValue(playerCards);
    const dealerValue = calculateHandValue(dealerCards);
    
    if (playerCards.length === 2 && playerValue === 21) {
        if (dealerValue === 21) {
            // 双方都有黑杰克，平局
            endRound('push');
        } else {
            // 玩家有黑杰克，赢1.5倍
            endRound('blackjack');
        }
    } else if (dealerCards.length === 2 && dealerValue === 21) {
        // 庄家有黑杰克，玩家输
        revealDealerCard();
        endRound('lose');
    }
}

// 玩家要牌
function playerHit() {
    if (gameState !== 'playing') return;
    
    const card = dealCard(playerCards);
    playerCardsEl.appendChild(createCardElement(card));
    
    const playerValue = calculateHandValue(playerCards);
    updateScores(true);
    
    // 检查是否爆牌
    if (playerValue > 21) {
        endRound('bust');
    }
    
    // 禁用加倍按钮（只能在最初两张牌时加倍）
    doubleBtn.disabled = true;
}

// 玩家停牌
function playerStand() {
    if (gameState !== 'playing') return;
    
    gameState = 'dealerTurn';
    dealerPlay();
}

// 玩家加倍
function playerDouble() {
    if (gameState !== 'playing' || playerCards.length !== 2 || balance < currentBet) return;
    
    // 加倍下注
    const additionalBet = currentBet;
    balance -= additionalBet;
    currentBet += additionalBet;
    updateBetUI();
    
    // 要一张牌然后停牌
    const card = dealCard(playerCards);
    playerCardsEl.appendChild(createCardElement(card));
    updateScores(true);
    
    const playerValue = calculateHandValue(playerCards);
    if (playerValue > 21) {
        endRound('bust');
    } else {
        playerStand();
    }
}

// 庄家回合
function dealerPlay() {
    // 显示庄家的暗牌
    revealDealerCard();
    
    // 庄家按规则要牌（小于等于16必须要牌，大于等于17必须停牌）
    let dealerValue = calculateHandValue(dealerCards);
    
    const dealerTurn = () => {
        if (dealerValue < 17) {
            const card = dealCard(dealerCards);
            dealerCardsEl.appendChild(createCardElement(card));
            dealerValue = calculateHandValue(dealerCards);
            updateScores();
            
            // 使用setTimeout创建动画效果
            setTimeout(dealerTurn, 500);
        } else {
            // 庄家停牌，判断胜负
            determineWinner();
        }
    };
    
    setTimeout(dealerTurn, 500);
}

// 显示庄家的暗牌
function revealDealerCard() {
    dealerCardsEl.innerHTML = '';
    for (let card of dealerCards) {
        dealerCardsEl.appendChild(createCardElement(card));
    }
    updateScores();
}

// 判断胜负
function determineWinner() {
    const playerValue = calculateHandValue(playerCards);
    const dealerValue = calculateHandValue(dealerCards);
    
    if (dealerValue > 21) {
        // 庄家爆牌，玩家赢
        endRound('win');
    } else if (playerValue > dealerValue) {
        // 玩家点数大，玩家赢
        endRound('win');
    } else if (playerValue < dealerValue) {
        // 庄家点数大，玩家输
        endRound('lose');
    } else {
        // 点数相同，平局
        endRound('push');
    }
}

// 结束回合
function endRound(result) {
    gameState = 'gameOver';
    
    // 显示庄家的暗牌
    revealDealerCard();
    
    // 根据结果更新余额和显示消息
    switch (result) {
        case 'blackjack':
            balance += currentBet * 2.5; // 本金 + 1.5倍赔率
            messageEl.textContent = '黑杰克！你赢了！';
            break;
        case 'win':
            balance += currentBet * 2; // 本金 + 1倍赔率
            messageEl.textContent = '你赢了！';
            break;
        case 'lose':
            messageEl.textContent = '你输了！';
            break;
        case 'bust':
            messageEl.textContent = '爆牌了！你输了！';
            break;
        case 'push':
            balance += currentBet; // 返还本金
            messageEl.textContent = '平局！';
            break;
    }
    
    // 更新UI
    updateBetUI();
    
    // 禁用游戏按钮
    hitBtn.disabled = true;
    standBtn.disabled = true;
    doubleBtn.disabled = true;
    
    // 如果余额为0，游戏结束
    if (balance <= 0) {
        messageEl.textContent = '游戏结束！余额为0！';
        dealBtn.disabled = true;
        newGameBtn.disabled = false;
    } else {
        // 准备下一轮
        setTimeout(() => {
            initGame();
        }, 2000);
    }
}

// 更新下注和余额显示
function updateBetUI() {
    currentBetEl.textContent = currentBet;
    balanceEl.textContent = balance;
    
    // 如果下注大于0，启用发牌按钮
    dealBtn.disabled = currentBet <= 0;
}

// 启用筹码选择
function enableChips() {
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        const value = parseInt(chip.getAttribute('data-value'));
        chip.style.opacity = balance >= value ? '1' : '0.5';
        chip.style.cursor = balance >= value ? 'pointer' : 'not-allowed';
        
        // 添加点击事件
        chip.addEventListener('click', () => {
            if (gameState !== 'betting' || balance < value) return;
            
            // 增加下注
            currentBet += value;
            balance -= value;
            updateBetUI();
        });
    });
}

// 禁用筹码选择
function disableChips() {
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.style.opacity = '0.5';
        chip.style.cursor = 'not-allowed';
    });
}

// 事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 初始化游戏
    initGame();
    
    // 发牌按钮
    dealBtn.addEventListener('click', () => {
        if (gameState !== 'betting' || currentBet <= 0) return;
        startRound();
    });
    
    // 要牌按钮
    hitBtn.addEventListener('click', playerHit);
    
    // 停牌按钮
    standBtn.addEventListener('click', playerStand);
    
    // 加倍按钮
    doubleBtn.addEventListener('click', playerDouble);
    
    // 新游戏按钮
    newGameBtn.addEventListener('click', () => {
        balance = 1000;
        initGame();
    });
})