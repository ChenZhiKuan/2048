function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // 4*4����
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// ���¿�ʼ��Ϸ
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame();
  this.setup();
};

// ��ϷӮ���Ժ������
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame();
};

// true��ʾ��Ϸ����
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};


GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // ��ʹ�ر�ҳ��Ҳ�����¼��س���֮ǰ�������Ϸ
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells);
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    //��ʼ��
    this.addStartTiles();
  }


  this.actuate();
};

// ��Ϸ��ʼ�����������������
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// �������2��4������9��1
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// ��Ѽ�¼����
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // ��Ϸ����
  if (this.over) {
    this.storageManager.clearGameState();
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};


GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// �ƶ�����
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// ���հ���ָ�������ƶ�
GameManager.prototype.move = function (direction) {
  // 0: ��, 1: ��, 2: ��, 3: ��
  var self = this;

  if (this.isGameTerminated()) return;

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // ���浱ǰλ����Ϣ����ɾ��֮ǰ�ĺϲ���Ϣ
  this.prepareTiles();

  // �ƶ�
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // һ�������Ͽ��������κϲ�
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);  //�ϲ��ĸ�������Ϊ�ƶ������Ͽ�����Ǹ�����
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);
          // ����λ��
          tile.updatePosition(positions.next);
          // ���ӷ���
          self.score += merged.value;
          //��ʤ����
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // ֤���ƶ�����
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // ��Ϸ����
    }

    this.actuate();
  }
};

// ��ȡ�������Ա仯
GameManager.prototype.getVector = function (direction) {

  var map = {
    0: { x: 0,  y: -1 }, // ��
    1: { x: 1,  y: 0 },  // ��
    2: { x: 0,  y: 1 },  // ��
    3: { x: -1, y: 0 }   // ��
  };

  return map[direction];
};


GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }


  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // һֱ��ָ���������ƶ�ֱ����һ��Ҫ�ƶ��ĸ��ӱ�ռ��
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // �ϲ��ĸ���
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// ���������ܷ����
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {             //bug����Ӧ�ô�0��ʼ��������Ϸ�����ж�������覴�
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if ( other && other.value === tile.value) {
            return true; //���������ܹ��ϲ�
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
