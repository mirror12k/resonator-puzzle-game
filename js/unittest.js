
let beforeEachAction = null;

function beforeEach(action) {
    beforeEachAction = action;
}

function describe(description, callback) {
    console.log(description);
    callback();
}

function test(description, callback) {
    if (beforeEachAction) {
        beforeEachAction();
    }

    try {
        callback();
        console.log(`[t]: ${description}`);
    } catch (error) {
        console.error(`[t]: Error occurred on ${description}: `, error.message);
    }
}
function expect(received) {
    const not = {
        toEqual(expected) {
            if (JSON.stringify(received) === JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(received)} to not equal ${JSON.stringify(expected)}`);
            }
        },
        toBe(expected) {
            if (received === expected) {
                throw new Error(`Expected not ${expected}, but received ${received}`);
            }
        }
    };

    return {
        toEqual(expected) {
            if (JSON.stringify(received) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, but received ${JSON.stringify(received)}`);
            }
        },
        toBe(expected) {
            if (received !== expected) {
                throw new Error(`Expected ${expected}, but received ${received}`);
            }
        },
        not
    };
}


const save_singleton = Game.singleton;

describe('Player tests', () => {
    let puzzleGrid;
    const tileSize = 20;

    beforeEach(() => {
        puzzleGrid = new PuzzleGrid();
        Game.singleton = { canvas: { width: 100, height: 100 } }; // Mock Game singleton
        Game.assets = {
            images: {
                wolf_tileset: {
                    subimg: () => ({ mock: true })
                },
                wall_tileset: {
                    subimg: () => ({ mock: true })
                }
            }
        };
    });

    function addPlayerAtPosition(x, y) {
        const player = new PlayerEntity(vec(x, y));
        puzzleGrid.add(player);
        return player;
    }

    function addWallAtPosition(x, y) {
        const wall = new WallEntity(vec(x, y));
        puzzleGrid.add(wall);
    }

    test('Player movement in all 4 directions', () => {
        const directions = [vec(1, 0), vec(0, 1), vec(-1, 0), vec(0, -1)]; // right, down, left, up
        const initialPosition = vec(50, 50);
        const player = addPlayerAtPosition(initialPosition.x, initialPosition.y);

        directions.forEach(direction => {
            puzzleGrid.move_player(direction);
            const expectedPosition = initialPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            expect(player.r.p).toEqual(expectedPosition);
            initialPosition.copy(player.r.p); // Update initial position for next direction
        });
    });

    test('Player blocked from moving out of bounds in all 4 directions', () => {
        const edgePositions = [vec(90, 50), vec(50, 90), vec(0, 50), vec(50, 0)]; // right edge, bottom edge, left edge, top edge
        const directions = [vec(1, 0), vec(0, 1), vec(-1, 0), vec(0, -1)]; // right, down, left, up

        edgePositions.forEach((position, index) => {
            const player = addPlayerAtPosition(position.x, position.y);
            puzzleGrid.move_player(directions[index]);
            expect(player.r.p).toEqual(position); // Player should not move
        });
    });

    test('Player blocked by a wall in all 4 directions', () => {
        const playerPosition = vec(40, 40);
        const wallPositions = [vec(60, 40), vec(40, 60), vec(20, 40), vec(40, 20)]; // right, down, left, up of player
        const directions = [vec(1, 0), vec(0, 1), vec(-1, 0), vec(0, -1)]; // right, down, left, up

        wallPositions.forEach((wallPos, index) => {
            const player = addPlayerAtPosition(playerPosition.x, playerPosition.y);
            addWallAtPosition(wallPos.x, wallPos.y);
            puzzleGrid.move_player(directions[index]);
            expect(player.r.p).toEqual(playerPosition); // Player should not move
            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('Player not being blocked by a wall in all 4 directions', () => {
        const playerPosition = vec(40, 40);
        const wallPositions = [vec(80, 40), vec(40, 80), vec(0, 40), vec(40, 0)]; // right, down, left, up but further away
        const directions = [vec(1, 0), vec(0, 1), vec(-1, 0), vec(0, -1)]; // right, down, left, up

        wallPositions.forEach((wallPos, index) => {
            const player = addPlayerAtPosition(playerPosition.x, playerPosition.y);
            addWallAtPosition(wallPos.x, wallPos.y);
            puzzleGrid.move_player(directions[index]);
            const expectedPosition = playerPosition.clone().add(directions[index].multiplyScalar(tileSize));
            expect(player.r.p).toEqual(expectedPosition); // Player should move
            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });
});

describe('Boulder Tests', () => {
    let puzzleGrid;
    const tileSize = 20;

    beforeEach(() => {
        puzzleGrid = new PuzzleGrid();
        Game.singleton = { canvas: { width: 300, height: 300 } }; // Adjusted canvas size for tileSize
        Game.assets = {
            images: {
                wolf_tileset: {
                    subimg: () => ({ mock: true })
                }
            }
        };
    });

    function addPlayerAtPosition(x, y) {
        const player = new PlayerEntity(vec(x, y));
        puzzleGrid.add(player);
        return player;
    }

    function addWallAtPosition(x, y) {
        const wall = new WallEntity(vec(x, y));
        puzzleGrid.add(wall);
    }

    function addBoulderAtPosition(x, y) {
        const boulder = new BoulderEntity(vec(x, y));
        puzzleGrid.add(boulder);
        return boulder;
    }

    const directions = [vec(1, 0), vec(0, 1), vec(-1, 0), vec(0, -1)]; // right, down, left, up

    test('Player pushing a boulder in each of 4 directions', () => {
        const initialPlayerPosition = vec(100, 100); // Central position

        directions.forEach(direction => {
            const player = addPlayerAtPosition(initialPlayerPosition.x, initialPlayerPosition.y);
            const boulderInitialPosition = initialPlayerPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            const boulder = addBoulderAtPosition(boulderInitialPosition.x, boulderInitialPosition.y);

            puzzleGrid.move_player(direction);
            const expectedBoulderPos = boulderInitialPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            expect(boulder.r.p).toEqual(expectedBoulderPos); // Boulder should have moved
            expect(player.r.p).toEqual(boulderInitialPosition); // Player should have moved to boulder's original position

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('Player pushing a boulder 1 tile, then unable to push it further due to a wall', () => {
        const initialPlayerPosition = vec(100, 100); // Central position

        directions.forEach(direction => {
            const player = addPlayerAtPosition(initialPlayerPosition.x, initialPlayerPosition.y);
            const boulderInitialPosition = initialPlayerPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            const boulder = addBoulderAtPosition(boulderInitialPosition.x, boulderInitialPosition.y);
            const emptyPosition = boulderInitialPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            const wallPosition = emptyPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            addWallAtPosition(wallPosition.x, wallPosition.y);

            // First push
            puzzleGrid.move_player(direction);
            expect(boulder.r.p).toEqual(emptyPosition); // Boulder should have moved one tile

            // Second push attempt
            puzzleGrid.move_player(direction);
            expect(boulder.r.p).toEqual(emptyPosition); // Boulder should not have moved further

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('Player pushing a boulder 1 tile, then unable to push it further due to another boulder', () => {
        const initialPlayerPosition = vec(100, 100); // Central position

        directions.forEach(direction => {
            const player = addPlayerAtPosition(initialPlayerPosition.x, initialPlayerPosition.y);
            const firstBoulderInitialPosition = initialPlayerPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            const firstBoulder = addBoulderAtPosition(firstBoulderInitialPosition.x, firstBoulderInitialPosition.y);
            const emptyPosition = firstBoulderInitialPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            const secondBoulderPosition = emptyPosition.clone().add(direction.clone().multiplyScalar(tileSize));
            addBoulderAtPosition(secondBoulderPosition.x, secondBoulderPosition.y);

            // First push
            puzzleGrid.move_player(direction);
            expect(firstBoulder.r.p).toEqual(emptyPosition); // First boulder should have moved one tile

            // Second push attempt
            puzzleGrid.move_player(direction);
            expect(firstBoulder.r.p).toEqual(emptyPosition); // First boulder should not have moved further

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('Player moving past a boulder not in the way', () => {
        const initialPlayerPosition = vec(100, 100); // Central position

        directions.forEach(direction => {
            const player = addPlayerAtPosition(initialPlayerPosition.x, initialPlayerPosition.y);
            const boulderPosition = initialPlayerPosition.clone().add(vec(direction.y, direction.x).multiplyScalar(tileSize)); // Position boulder to the side
            const boulder = addBoulderAtPosition(boulderPosition.x, boulderPosition.y);

            puzzleGrid.move_player(direction);
            expect(player.r.p).toEqual(initialPlayerPosition.clone().add(direction.multiplyScalar(tileSize))); // Player should have moved
            expect(boulder.r.p).toEqual(boulderPosition); // Boulder position should not change

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('Player should not be able to push a boulder out-of-bounds', () => {
        const edgePositions = [vec(280, 100), vec(100, 280), vec(20, 100), vec(100, 20)]; // Positions near the edges

        directions.forEach((direction, index) => {
            const player = addPlayerAtPosition(edgePositions[index].x, edgePositions[index].y);
            const boulderPosition = edgePositions[index].clone().add(direction.multiplyScalar(tileSize));
            addBoulderAtPosition(boulderPosition.x, boulderPosition.y);

            puzzleGrid.move_player(direction);
            expect(player.r.p).toEqual(edgePositions[index]); // Player should not have moved
            expect(puzzleGrid.has_boulder(boulderPosition)).toBe(true); // Boulder should still be there

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('Player should not be able to push a wall', () => {
        const initialPlayerPosition = vec(100, 100); // Central position

        directions.forEach(direction => {
            const player = addPlayerAtPosition(initialPlayerPosition.x, initialPlayerPosition.y);
            const wallPosition = initialPlayerPosition.clone().add(direction.multiplyScalar(tileSize));
            addWallAtPosition(wallPosition.x, wallPosition.y);

            puzzleGrid.move_player(direction);
            expect(player.r.p).toEqual(initialPlayerPosition); // Player should not have moved
            expect(puzzleGrid.has_wall(wallPosition)).toBe(true); // Wall should still be there

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });
});



describe('DemonEntity Tests', () => {
    let puzzleGrid;
    const tileSize = 20;

    beforeEach(() => {
        puzzleGrid = new PuzzleGrid();
        Game.singleton = { canvas: { width: 300, height: 300 } }; // Mock Game singleton
    });

    function addPlayerAtPosition(x, y) {
        const player = new PlayerEntity(vec(x, y));
        puzzleGrid.add(player);
        return player;
    }

    function addDemonAtPosition(x, y, facingDirection) {
        const demon = new DemonEntity(vec(x, y), facingDirection);
        puzzleGrid.add(demon);
        return demon;
    }

    function addWallAtPosition(x, y) {
        const wall = new WallEntity(vec(x, y));
        puzzleGrid.add(wall);
    }

    function addBoulderAtPosition(x, y) {
        const boulder = new BoulderEntity(vec(x, y));
        puzzleGrid.add(boulder);
        return boulder;
    }

    const directions = [vec(1, 0), vec(0, 1), vec(-1, 0), vec(0, -1)]; // right, down, left, up

    test('DemonEntity moves when the player moves', () => {
        directions.forEach(direction => {
            const player = addPlayerAtPosition(100, 100);
            const demon = addDemonAtPosition(120, 100, direction);
            const initialDemonPos = demon.r.p.clone();

            puzzleGrid.move_player(direction);
            expect(demon.r.p).not.toEqual(initialDemonPos); // Demon should have moved

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('DemonEntity rotates when bumping up against out-of-bounds', () => {
        const edgePositions = [vec(290, 100), vec(100, 290), vec(10, 100), vec(100, 10)]; // Positions near the edges

        directions.forEach((direction, index) => {
            addPlayerAtPosition(100, 100); // Player's position doesn't matter here
            const demon = addDemonAtPosition(edgePositions[index].x, edgePositions[index].y, direction);
            const initialFacingDirection = demon.facing_direction.clone();

            puzzleGrid.move_player(vec(0, 0)); // Trigger movement
            expect(demon.facing_direction).not.toEqual(initialFacingDirection); // Demon should have rotated

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('DemonEntity rotates when bumping up against a wall', () => {
        directions.forEach(direction => {
            addPlayerAtPosition(100, 100); // Player's position doesn't matter here
            const demon = addDemonAtPosition(140, 100, direction);
            addWallAtPosition(demon.r.p.x + direction.x * tileSize, demon.r.p.y + direction.y * tileSize);
            const initialFacingDirection = demon.facing_direction.clone();

            puzzleGrid.move_player(vec(0, 0)); // Trigger movement
            expect(demon.facing_direction).not.toEqual(initialFacingDirection); // Demon should have rotated

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });

    test('DemonEntity rotates when bumping up against a boulder', () => {
        directions.forEach(direction => {
            addPlayerAtPosition(100, 100); // Player's position doesn't matter here
            const demon = addDemonAtPosition(140, 100, direction);
            addBoulderAtPosition(demon.r.p.x + direction.x * tileSize, demon.r.p.y + direction.y * tileSize);
            const initialFacingDirection = demon.facing_direction.clone();

            puzzleGrid.move_player(vec(0, 0)); // Trigger movement
            expect(demon.facing_direction).not.toEqual(initialFacingDirection); // Demon should have rotated

            puzzleGrid.sub_entities = []; // Reset entities for next iteration
        });
    });
});

describe('TeleporterEntity', () => {
    let puzzleGrid;
    const tileSize = 20;

    beforeEach(() => {
        puzzleGrid = new PuzzleGrid();
        Game.singleton = { canvas: { width: 300, height: 300 } }; // Mock Game singleton
    });

    function addPlayerAtPosition(x, y) {
        const player = new PlayerEntity(vec(x, y));
        puzzleGrid.add(player);
        return player;
    }

    function addDemonAtPosition(x, y, facingDirection) {
        const demon = new DemonEntity(vec(x, y), facingDirection);
        puzzleGrid.add(demon);
        return demon;
    }

    function addBoulderAtPosition(x, y) {
        const boulder = new BoulderEntity(vec(x, y));
        puzzleGrid.add(boulder);
        return boulder;
    }

    function addTeleporterAtPosition(x, y, destination) {
        const teleporter = new TeleporterEntity(vec(x, y), destination);
        puzzleGrid.add(teleporter);
        return teleporter;
    }

    test('Teleports a PlayerEntity', () => {
        const player = addPlayerAtPosition(100, 100);
        const destination = vec(200, 200);
        addTeleporterAtPosition(120, 100, destination);

        puzzleGrid.move_player(vec(1, 0)); // Move player right onto the teleporter
        expect(player.r.p).toEqual(destination); // Player should be teleported
    });

    test('Teleports a DemonEntity', () => {
        const demon = addDemonAtPosition(100, 100, vec(1, 0)); // Facing right
        const destination = vec(200, 200);
        addTeleporterAtPosition(120, 100, destination);

        puzzleGrid.move_player(vec(0, 0)); // Trigger movement
        expect(demon.r.p).toEqual(destination); // Demon should be teleported
    });

    test('Teleports a BoulderEntity', () => {
        const boulder = addBoulderAtPosition(100, 100);
        const player = addPlayerAtPosition(80, 100); // Position player to push the boulder
        const destination = vec(200, 200);
        addTeleporterAtPosition(120, 100, destination);

        puzzleGrid.move_player(vec(1, 0)); // Move player right to push the boulder onto the teleporter
        expect(boulder.r.p).toEqual(destination); // Boulder should be teleported
    });
});




Game.singleton = save_singleton;

