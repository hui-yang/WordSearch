angular.module('myApp', ['ngTouch', 'ui.bootstrap'])
  .run(['$translate', '$log', 'realTimeService', 'randomService',
      function ($translate, $log, realTimeService, randomService) {
'use strict';

// Constants
var canvasWidth = 390;
var canvasHeight = 300;
//Lets save the cell width in a variable for easy control
var cellWidth = 30;
var cellHeight = 30;
var colsNum = canvasWidth / cellWidth;
var rowsNum = canvasHeight / cellHeight;
var drawEveryMilliseconds = 120;


// There are 1-8 players.
// Colors:
// black: canvas borders
// white: canvas background
// black: words
var playerColor = [
  'blue', 'red', 'brown', 'purple',
  'pink', 'yellow', 'orange', 'silver',
];
var colorCode = [
  'rgba(0, 0, 255, .4)', 'rgba(255, 0, 0, .4)', 'rgba(139, 69, 19, .4)', 'rgba(128, 0, 128, .4)',
  'rgba(255, 192, 203, .4)','rgba(255, 255, 0, .4)','rgba(255, 165, 0, .4)','rgba(192, 192, 192, .4)'
];
var wordSet = ['alligator', 'ant', 'bear', 'bee', 'bird', 'camel', 'cat', 'cheetah',
  'chicken', 'chimpanzee', 'cow', 'crocodile', 'deer', 'dog', 'dolphin', 'duck',
  'eagle', 'elephant', 'fish', 'fly', 'fox', 'frog', 'giraffe', 'goat', 'goldfish',
  'hamster', 'hippo', 'horse', 'kangaroo', 'kitten', 'lion', 'lobster', 'monkey',
  'octopus', 'owl', 'panda', 'pig', 'puppy', 'rabbit', 'rat', 'scorpion', 'seal',
  'shark', 'sheep', 'snail', 'snake', 'spider', 'squirrel', 'tiger', 'turtle', 'wolf', 'zebra'
];

function createCanvasController(canvas) {
  $log.info("createCanvasController for canvas.id=" + canvas.id);
  var isGameOngoing = false;
  var isSinglePlayer = false;
  var playersInfo = null;
  var yourPlayerIndex = null;
  var matchController = null;

  var gameArea = document.getElementById("gameArea");

  // Game state
  var allWordsFound; // allWordsFound[playerIndex]  is the words found by playerIndex
  var wordsFound_array; // points to allWordsFound[yourPlayerIndex]
  var allScores;
  var wordsLeft; // Number of all words.
  var words; // [{x1: ..., y1: ..., x2: ..., y2: ..., content: ..., found: ...}, ...]
  var startMatchTime; // For displaying a countdown.
  var currentSelection;
  var newSelection;
  var board;

  function gotStartMatch(params) {
    yourPlayerIndex = params.yourPlayerIndex;
    playersInfo = params.playersInfo;
    matchController = params.matchController;
    isGameOngoing = true;
    isSinglePlayer = playersInfo.length === 1;

    wordsLeft = 0;
    words = [];
    allWordsFound = [];
    allScores = [];
    currentSelection = null;
    newSelection = false;
    board = [];

    for (var index = 0; index < playersInfo.length; index++) {
      allWordsFound[index] = [];
      allScores[index] = 0;
    }
    wordsFound_array = allWordsFound[yourPlayerIndex];
    create_board(wordSet);
    startMatchTime = new Date().getTime();
    setDrawInterval();
  }

  function findWord(line) {
    for (var i = 0; i < words.length; i++) {
      if (line.x1 === words[i].x1 && line.y1 === words[i].y1 &&
      line.x2 === words[i].x2 && line.y2 === words[i].y2) {
        return i;
      }
    }
    return -1;
  }

  function gotMessage(params) {
    var fromPlayerIndex = params.fromPlayerIndex;
    var messageString = params.message;
    // {s: score, a: {x1:.. y1:.. x2:.. y2:..}}
    // The array representing the newly found word of a player
    var messageObject = angular.fromJson(messageString);
    allWordsFound[fromPlayerIndex].push(messageObject.a);
    allScores[fromPlayerIndex] = messageObject.s;

    var index = findWord(messageObject.a);
    if (! words[index].found) {
      words[index].found = true;
      wordsLeft--;
    }
  }

  function gotEndMatch(endMatchScores) {
    // Note that endMatchScores can be null if the game was cancelled (e.g., someone disconnected).
    allScores = endMatchScores;
    isGameOngoing = false;
    stopDrawInterval();
  }

  function sendMessage(isReliable) {
    if (isSinglePlayer || !isGameOngoing) {
      return; // No need to send messages if you're the only player or game is over.
    }
    var messageString = angular.toJson(
        {s: allScores[yourPlayerIndex], a: {x1: xfrom, y1: yfrom, x2: xto, y2: yto}});
    if (isReliable) {
      matchController.sendReliableMessage(messageString);
    } else {
      matchController.sendUnreliableMessage(messageString);
    }
  }

  function endOfMatch() {
    if (!isGameOngoing) {
      return;
    }
    isGameOngoing = false;
    matchController.endMatch(allScores);
  }

	//Canvas stuff
	var ctx = canvas.getContext("2d");

  var drawInterval;

  function setDrawInterval() {
    stopDrawInterval();
    // Every 2 words pieces we increase the snake speed (to a max speed of 50ms interval).
    drawInterval = setInterval(updateAndDraw, drawEveryMilliseconds);
  }

  function stopDrawInterval() {
    clearInterval(drawInterval);
  }

  function getDelta(direction) {
    switch (direction) {
      case 0:
      return {dx: 0, dy: 1};
      case 1:
      return {dx: 1, dy: 1};
      case 2:
      return {dx: 1, dy: 0};
      case 3:
      return {dx: 1, dy: -1};
      case 4:
      return {dx: 0, dy: -1};
      case 5:
      return {dx: -1, dy: -1};
      case 6:
      return {dx: -1, dy: 0};
      case 7:
      return {dx: -1, dy: 1};
    }
  }

  function loadWord(w) {
    var x1, y1, x2, y2, dx, dy, dir; // the trial position
    var collision;
    var fits = false, loop = 0, tryCap = 200;
    if (w.length > rowsNum) {
      return;
    }
    while (!fits) {
      x1 = randomService.randomFromTo(wordsLeft + 10 * (3 * loop + 1), 0, rowsNum);
      y1 = randomService.randomFromTo(wordsLeft + 10 * (3 * loop + 2), 0, rowsNum);
      dir = randomService.randomFromTo(wordsLeft + 10 * (3 * loop + 3), 0, 8);

      var delta = getDelta(dir);
      dx = delta.dx;
      dy = delta.dy;
      x2 = x1 + dx * (w.length - 1);
      y2 = y1 + dy * (w.length - 1);

      loop++;
      if (loop > tryCap) {
        return;
      }
      if (y2 >= rowsNum || y2 < 0 || x2 >= rowsNum || x2 <0) {
        continue;
      }
      collision = false;
      var x = x1, y = y1;
      for (var c = 0; c < w.length; c++) {
        if (board[x][y] !== '' && board[x][y] !== w.substring(c, c+1)) {
          collision = true;
        }
        x += dx;
        y += dy;
      }
      if (collision) {
        continue;
      }
      // find a position
      x = x1;
      y = y1;
      for (c = 0; c < w.length; c++) {
        board[x][y] = w.substring(c, c+1).toUpperCase();
        x += dx;
        y += dy;
      }
      fits = true;
    }
    return {x1: x1, y1: y1, x2: x2, y2: y2};
  }
  function fillEmpty() {
    var row, col;
    var seed = 6020;
    for (row = 0; row < rowsNum; row++) {
      for (col = 0; col < rowsNum; col++) {
        if (board[row][col] === ''){
          board[row][col] = String.fromCharCode(
            randomService.randomFromTo(seed, 65, 90)
          ).toUpperCase();
          seed++;
        }
      }
    }
  }
  function create_board(wordSet) {
    var row, col, res;
    for (row = 0; row < rowsNum; row++) {
      board[row] = [];
      for (col = 0; col < rowsNum; col++) {
        board[row][col] = '';
      }
    }

    var startIndex = randomService.randomFromTo(wordsLeft, 0, wordSet.length);
    var count = 0;
    for (var i = startIndex; count < wordSet.length && wordsLeft < 10; count++) {
      var w = wordSet[i].toLowerCase().replace(/\s/, '');
      res = loadWord(w);
      if (!res) {
        i = (i + 1) % wordSet.length;
        continue;
      }
      var item = {x1: res.x1, y1: rowsNum - 1 - res.y1, x2: res.x2, y2: rowsNum - 1 - res.y2, content: wordSet[i], found: false};
      words.push(item);
      $log.info(item);

      wordsLeft++;
      i = (i + 1) % wordSet.length;
    }
    fillEmpty();
  }

	function updateAndDraw() {
    if (!isGameOngoing) {
      return;
    }
    var secondsFromStart =
      Math.floor((new Date().getTime() - startMatchTime) / 1000);
    if (secondsFromStart < 3) {
      // Countdown to really start
      draw();
      // Draw countdown
      var secondsToReallyStart = 3 - secondsFromStart;

      // Gives you a hint what is your color
      var yourColor = playerColor[yourPlayerIndex];
      ctx.fillStyle = yourColor;
      ctx.font = '80px sans-serif';
      ctx.fillText("" + secondsToReallyStart, canvasWidth / 2, canvasHeight / 2);

      ctx.font = '20px sans-serif';
      var msg = $translate("YOUR_PLAYER_COLOR_IS",
          {color: $translate(yourColor.toUpperCase())});
      ctx.fillText(msg, canvasWidth / 4 - 30, canvasHeight / 4 - 30);
      return;
    }
    draw();

    // currentSelection -- draw
    // newSelection
    // -- not word: undraw
    // -- word: delete word, (?end game, - send end game - send msg), draw

    var currSelection;
    if (currentSelection !== null) {
      currSelection = currentSelection;
      drawHighlight([currSelection], yourPlayerIndex);
    }
    if (newSelection) {
      currentSelection = null;
      newSelection = false;
      var index = findWord(currSelection);
      if (index === -1) {
        //undrawHighlight([currSelection], yourPlayerIndex);
        return;
      }

      if (words[index].found) {
        return;
      }
      words[index].found = true;
      wordsLeft--;
      allScores[yourPlayerIndex]++;
      wordsFound_array = allWordsFound[yourPlayerIndex];
      wordsFound_array.push(currSelection);
      allWordsFound[yourPlayerIndex] = wordsFound_array;
      sendMessage(true);
      if (wordsLeft === 0) {
        endOfMatch();
      }
      draw();
    }
  }

  function render() {
    var posx, posy;
    ctx.font = '20px monospace';
    ctx.fillStyle = '#8B7355';
    ctx.textBaseline = 'middle';
    // board
    for (var row = 0; row < rowsNum; row++) {
      posy = (rowsNum - row) * cellWidth - cellWidth / 2;
      for (var col = 0; col < rowsNum; col++) {
        posx = col * cellWidth + cellWidth / 4;
        var letter = board[col][row];
        ctx.fillText(letter, posx, posy);
      }
    }

    // word list
    posx = (rowsNum + 1/4) * cellWidth;
    for (var wrow = 0; wrow < words.length; wrow++) {
      posy = wrow * cellWidth + cellWidth / 2;
      ctx.font = words[wrow].found ? 'italic 12px Arial' : 'bold 12px Arial';
      ctx.fillStyle = words[wrow].found ? '#CDAA7D' : '#8B7355';
      ctx.fillText(words[wrow].content, posx, posy);
    }
    //ctx.textBaseline = 'bottom';
  }
  function draw() {
    //To avoid the snake trail we need to paint the BG on every frame
    //Lets paint the canvas now
    ctx.fillStyle = "#F5F5DC";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = "#8B4513";

    ctx.lineWidth = 2;
    //ctx.strokeRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeRect(0, 0, canvasHeight, canvasHeight);
    ctx.strokeRect(canvasHeight, 0, canvasWidth - canvasHeight, canvasHeight);
    render();

    var i;
    for (i = 0; i < allWordsFound.length; i++) {
      if (i !== yourPlayerIndex) {
        drawHighlight(allWordsFound[i], i);
      }
    }
    // Your bar is always drawn last (so it will be completely visible).
    drawHighlight(wordsFound_array, yourPlayerIndex);

		//Lets paint the score
		for (i = 0; i < allScores.length; i++) {
      ctx.font = '12px sans-serif';
      var color = playerColor[i];
      ctx.fillStyle = color;
      var msg = $translate("COLOR_SCORE_IS",
          {color: $translate(color.toUpperCase()), score: "" + allScores[i]});
  		ctx.fillText(msg,
          5 + i * canvasWidth / playersInfo.length, canvasHeight - 5);
    }
	}

  function getAbsolute(gx) {
    if (gx <= 0) {
      return cellWidth / 2;
    }
    if (gx >= rowsNum) {
      return canvasHeight - cellWidth / 2;
    }
    return gx * cellWidth + cellWidth / 2;
  }

  function drawHighlight(wordsFound, playerIndex) {
    for(var i = 0; i < wordsFound.length; i++) {
      var c = wordsFound[i];
      // highlight from c.x1 c.y1 to c.x2 c.y2
      ctx.beginPath();
      ctx.moveTo(getAbsolute(c.x1), getAbsolute(c.y1));
      ctx.lineTo(getAbsolute(c.x2), getAbsolute(c.y2));
      ctx.lineWidth = cellWidth;
      ctx.strokeStyle = colorCode[playerIndex];
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function getIndices(actualX, actualY) {
    var offsetX = gameArea.offsetLeft + canvas.offsetLeft;
    var offsetY = gameArea.offsetTop + canvas.offsetTop;
    var actualWidth = canvas.offsetWidth;
    var actualHeight = canvas.offsetHeight;

    var relativeX = (actualX - offsetX) / actualWidth * colsNum;
    var relativeY = (actualY - offsetY) / actualHeight * rowsNum;
    return {x: Math.floor(relativeX), y: Math.floor(relativeY)};
  }

  var xfrom = null, yfrom = null, xto = null, yto = null;
  function processTouch(e, touchType) {
    e.preventDefault(); // prevent scrolling and dispatching mouse events.


    if (touchType === 'touchend' && currentSelection !== null) {
      newSelection = true;
    }

    var touchobj = e.targetTouches[0]; // targetTouches includes only touch points in this canvas.
    if (!touchobj) {
      return;
    }

    var indices = getIndices(touchobj.pageX, touchobj.pageY);
    if (indices.x >= rowsNum) { // not valid: touch the words area
      return;
    }
    if (xfrom === null || yfrom === null) {
      xfrom = indices.x;
      yfrom = indices.y;

      return;
    }
    xto = indices.x;
    yto = indices.y;

    var distX = xto - xfrom; // get horizontal dist traveled by finger while in contact with surface
    var distY = yto - yfrom; // get vertical dist traveled by finger while in contact with surface
    var swipedir = null;
    var absDistX = Math.abs(distX);
    var absDistY = Math.abs(distY);
    var dist = Math.min(absDistX, absDistY);
    if (absDistX > 0 || absDistY > 0) {
      if (absDistY > 2 * absDistX) {
        xto = xfrom;
        yto = yto < 0 ? 0 : yto > colsNum - 1 ? colsNum - 1 : yto;
        swipedir = distY > 0 ? 'N' : 'S';
      } else if (absDistY < absDistX / 2) {
        yto = yfrom;
        swipedir = distX > 0 ? 'E' : 'W';
      } else if (distX > 0) {
        if (distY > 0) {
          xto = xfrom + dist;
          yto = yfrom + dist;
          swipedir = 'NE';
        } else {
          xto = xfrom + dist;
          yto = yfrom - dist;
          swipedir = 'SE';
        }
      } else {
        if (distY > 0) {
          xto = xfrom - dist;
          yto = yfrom + dist;
          swipedir = 'NW';
        } else {
          xto = xfrom - dist;
          yto = yfrom - dist;
          swipedir = 'SW';
        }
      }
      currentSelection = {x1: xfrom, y1: yfrom, x2: xto, y2: yto};
    }
  }
  canvas.addEventListener('touchstart', function(e) {
    xfrom = null;
    yfrom = null;
    xto = null;
    yto = null;
    processTouch(e, 'touchstart');
  }, false);
  canvas.addEventListener('touchmove', function(e) {
    processTouch(e, 'touchmove');
  }, false);
  canvas.addEventListener('touchend', function(e) {
    processTouch(e, 'touchend');
  }, false);

  return {
    gotStartMatch: gotStartMatch,
    gotMessage: gotMessage,
    gotEndMatch: gotEndMatch
  };
} // end of createCanvasController

realTimeService.init({
  createCanvasController: createCanvasController,
  canvasWidth: canvasWidth,
  canvasHeight: canvasHeight
});

}]);
